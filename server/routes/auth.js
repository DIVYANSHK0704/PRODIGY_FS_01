const express = require('express');
const { body } = require('express-validator');
const { register, login, refreshToken, getMe, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// FIX #7/#35: strong backend password policy enforced here and in model
const PASSWORD_RULES = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character'),
];

// FIX #6/#19: input trimming and normalization
const registerValidation = [
  body('name')
    .trim()                                             // FIX #6
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters')
    .escape(),                                           // FIX #24: sanitize XSS payloads
  body('email')
    .trim()                                             // FIX #6
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()                                   // FIX #19: normalize before storing
    .toLowerCase(),
  ...PASSWORD_RULES,
];

const loginValidation = [
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),                                     // FIX #3/#19
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh', refreshToken);                  // FIX #23
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);                // FIX #13

module.exports = router;
