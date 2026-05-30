const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    // unique:true removed — index below is the single source of truth (FIX #9)
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: { type: Date },
  loginCount: { type: Number, default: 0 },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, select: false },
  // FIX #3: refresh token rotation — store current valid refresh token jti
  refreshTokenVersion: { type: Number, default: 0, select: false },
  lastPasswordChange: { type: Date },
  registeredAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// FIX #9: single canonical unique index (removed duplicate unique:true from field def above)
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1 });

userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const pwd = this.password;
  if (pwd.length < 8) return next(new Error('Password must be at least 8 characters'));
  if (!/[A-Z]/.test(pwd)) return next(new Error('Password must contain at least one uppercase letter'));
  if (!/[a-z]/.test(pwd)) return next(new Error('Password must contain at least one lowercase letter'));
  if (!/\d/.test(pwd)) return next(new Error('Password must contain at least one number'));
  if (!/[^A-Za-z0-9]/.test(pwd)) return next(new Error('Password must contain at least one special character'));
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.lastPasswordChange = new Date();
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.incFailedAttempts = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_DURATION = 30 * 60 * 1000;
  if (this.lockUntil && this.lockUntil < Date.now()) {
    await this.constructor.findByIdAndUpdate(this._id, {
      $set: { failedLoginAttempts: 1, lockUntil: undefined },
    });
    return;
  }
  const updates = { $inc: { failedLoginAttempts: 1 } };
  if (this.failedLoginAttempts + 1 >= MAX_ATTEMPTS) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_DURATION) };
  }
  await this.constructor.findByIdAndUpdate(this._id, updates);
};

// FIX #3: increment version to invalidate all issued refresh tokens for this user
userSchema.methods.invalidateRefreshTokens = async function () {
  await this.constructor.findByIdAndUpdate(this._id, { $inc: { refreshTokenVersion: 1 } });
};

// FIX #8: explicit safe projection — toJSON never leaks sensitive fields
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  delete obj.failedLoginAttempts;
  delete obj.lockUntil;
  delete obj.refreshTokenVersion;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
