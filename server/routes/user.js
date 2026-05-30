const express    = require('express');
const mongoose   = require('mongoose');
const { body,  validationResult } = require('express-validator');
const User       = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();

const SAFE_USER_FIELDS = '-password -failedLoginAttempts -lockUntil -refreshTokenVersion -__v';

const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// @route   GET /api/user/dashboard
router.get('/dashboard', protect, (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to your dashboard!',
    user: req.user,
    data: {
      loginCount:  req.user.loginCount,
      lastLogin:   req.user.lastLogin,
      memberSince: req.user.createdAt,
    },
  });
});

// @route   GET /api/user/admin?page=1&limit=20
// FIX #5: paginated admin user listing
router.get('/admin', protect, requireRole('admin'), async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({})
        .select(SAFE_USER_FIELDS)      // FIX #8
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),                        // FIX #16
      User.countDocuments({}),
    ]);

    res.json({
      success: true,
      message: 'Admin access granted',
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      count: users.length,
      users,
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/user/profile
router.put(
  '/profile',
  protect,
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
      .escape(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
      }

      const name = req.body.name.trim();

      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
      user.name = name;
      await user.save();

      // FIX #8: use safe projection on response
      const safeUser = await User.findById(user._id).select(SAFE_USER_FIELDS).lean();
      res.json({ success: true, message: 'Profile updated!', user: safeUser });
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/user/:id
router.get('/:id', protect, requireRole('admin'), async (req, res, next) => {
  try {
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format.' });
    }
    const user = await User.findById(req.params.id).select(SAFE_USER_FIELDS).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
