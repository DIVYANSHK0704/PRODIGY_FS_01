const jwt = require('jsonwebtoken');
const User = require('../models/User');

// FIX #12/#36: handle expired JWT gracefully with clear error distinction
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.', code: 'NO_TOKEN' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token.', code: 'INVALID_TOKEN' });
    }

    // FIX #16: use .lean() for read-only queries where we don't need Mongoose methods
    // NOTE: We need user methods here (isActive check, etc.) so we do NOT use lean() in the auth middleware.
    // lean() is applied in read-only listing queries (e.g., admin route).
    const user = await User.findById(decoded.id).select('-password -failedLoginAttempts -lockUntil -refreshTokenVersion');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Token invalid. User not found.', code: 'USER_NOT_FOUND' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact support.', code: 'ACCOUNT_DISABLED' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }
    next();
  };
};

module.exports = { protect, requireRole };
