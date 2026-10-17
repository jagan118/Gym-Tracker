const express = require('express');
const { body } = require('express-validator');
const { register, login, googleAuth, setPassword, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name too long'),
    body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .isLength({ max: 128 })
      .withMessage('Password too long'),
  ],
  validate,
  register
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

// POST /api/auth/google
router.post(
  '/google',
  [body('idToken').notEmpty().withMessage('Google ID token is required')],
  validate,
  googleAuth
);

// POST /api/auth/password
router.post(
  '/password',
  protect,
  [
    body('password')
      .isString()
      .withMessage('Password must be a string')
      .bail()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .isLength({ max: 128 })
      .withMessage('Password too long'),
  ],
  validate,
  setPassword
);

// POST /api/auth/logout
router.post('/logout', protect, logout);

// GET /api/auth/me
router.get('/me', protect, getMe);

module.exports = router;
