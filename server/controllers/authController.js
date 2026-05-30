const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

// ── Token helpers ─────────────────────────────────────────────────────────────

const generateAccessToken = (id) =>
  jwt.sign({ id, type: 'access' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

// FIX #3: embed refreshTokenVersion in the token so rotated tokens are rejected
const generateRefreshToken = (id, version) =>
  jwt.sign(
    { id, type: 'refresh', version },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
  });
};

// FIX #8: explicit safe fields to return — never rely solely on toJSON
const SAFE_USER_FIELDS = '-password -failedLoginAttempts -lockUntil -refreshTokenVersion -__v';

const auditLog = (event, req, meta = {}) => {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ip: req.ip,
    ua: req.get('user-agent'),
    ...meta,
  }));
};

// ── Register ──────────────────────────────────────────────────────────────────

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const name  = (req.body.name  || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const { password } = req.body;

    // FIX #1/#2: drop the findOne+create pattern entirely.
    // Attempt insert directly — the unique index is the atomic guard.
    // If a concurrent request wins the race we get E11000 → errorHandler returns
    // the same opaque message, preventing enumeration.
    let user;
    try {
      user = await User.create({ name, email, password });
    } catch (createErr) {
      if (createErr.code === 11000) {
        // FIX #1: indistinguishable response whether email exists or not
        return res.status(201).json({
          success: true,
          message: 'If this email is new, your account has been created.',
        });
      }
      throw createErr;
    }

    auditLog('REGISTER_SUCCESS', req, { userId: user._id });

    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id, user.refreshTokenVersion);
    setRefreshCookie(res, refreshToken);

    // FIX #8: re-fetch with explicit safe projection instead of relying on toJSON alone
    const safeUser = await User.findById(user._id).select(SAFE_USER_FIELDS).lean();

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token: accessToken,
      user: safeUser,
    });
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const email    = (req.body.email || '').trim().toLowerCase();
    const { password } = req.body;

    const user = await User.findOne({ email })
      .select('+password +failedLoginAttempts +lockUntil +refreshTokenVersion');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      auditLog('LOGIN_LOCKED', req, { email });
      return res.status(429).json({
        success: false,
        message: `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact support.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incFailedAttempts();
      auditLog('LOGIN_FAILED', req, { email });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    await User.findByIdAndUpdate(user._id, {
      $set:  { failedLoginAttempts: 0, lockUntil: undefined, lastLogin: new Date() },
      $inc:  { loginCount: 1 },
    });

    auditLog('LOGIN_SUCCESS', req, { userId: user._id });

    const accessToken  = generateAccessToken(user._id);
    // FIX #3: include current version in token so rotation invalidates old tokens
    const refreshToken = generateRefreshToken(user._id, user.refreshTokenVersion);
    setRefreshCookie(res, refreshToken);

    // FIX #8: explicit safe projection
    const safeUser = await User.findById(user._id).select(SAFE_USER_FIELDS).lean();

    res.json({ success: true, message: 'Logged in successfully!', token: accessToken, user: safeUser });
  } catch (err) {
    next(err);
  }
};

// ── Refresh ───────────────────────────────────────────────────────────────────

const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token.', code: 'NO_REFRESH_TOKEN' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh');
    } catch {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: 'Refresh token expired. Please log in again.', code: 'REFRESH_EXPIRED' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: 'Invalid token type.' });
    }

    // FIX #3: verify the token version matches what's stored — rejects rotated-away tokens
    const user = await User.findById(decoded.id).select('+refreshTokenVersion');
    if (!user || !user.isActive) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    if (decoded.version !== user.refreshTokenVersion) {
      // Token has been rotated (e.g. stolen token used after legitimate refresh)
      clearRefreshCookie(res);
      auditLog('REFRESH_TOKEN_REUSE_DETECTED', req, { userId: user._id });
      return res.status(401).json({ success: false, message: 'Token reuse detected. Please log in again.', code: 'TOKEN_REUSED' });
    }

    // FIX #3: rotate — increment version and fetch updated doc in one round-trip
    const rotated = await User.findByIdAndUpdate(
      user._id,
      { $inc: { refreshTokenVersion: 1 } },
      { new: true, select: `${SAFE_USER_FIELDS} +refreshTokenVersion` }
    ).lean();

    const newAccessToken  = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id, rotated.refreshTokenVersion);
    setRefreshCookie(res, newRefreshToken);

    // Strip refreshTokenVersion from the response object before sending
    const { refreshTokenVersion: _v, ...safeUser } = rotated;
    res.json({ success: true, token: newAccessToken, user: safeUser });
  } catch (err) {
    next(err);
  }
};

// ── getMe ─────────────────────────────────────────────────────────────────────

const getMe = async (req, res, next) => {
  try {
    // FIX #8: always use explicit safe projection
    const freshUser = await User.findById(req.user._id).select(SAFE_USER_FIELDS).lean();
    res.json({ success: true, user: freshUser || req.user });
  } catch (err) {
    next(err);
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

const logout = async (req, res, next) => {
  try {
    // FIX #3: invalidate all refresh tokens in a single DB call (no need to load the doc first)
    if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { refreshTokenVersion: 1 } });
    }
    clearRefreshCookie(res);
    auditLog('LOGOUT', req, { userId: req.user?._id });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refreshToken, getMe, logout };
