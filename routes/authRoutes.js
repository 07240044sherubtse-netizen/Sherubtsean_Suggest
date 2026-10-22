
const express = require('express');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController');
const { ensureGuest, ensureAuth } = require('../middleware/auth');
const {
  registerRules,
  loginRules,
  handleValidation
} = require('../middleware/validation');

const router = express.Router();

// Rate limit login and registration attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    req.flash(
      'error',
      'Too many attempts. Please wait a few minutes and try again.'
    );

    res.redirect('/auth');
  }
});

// Rate limit email verification and resend requests.
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    req.flash(
      'error',
      'Too many verification attempts. Please wait and try again.'
    );

    res.redirect('/auth');
  }
});

// Rate limit password-reset requests separately.
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    req.flash(
      'error',
      'Too many password-reset attempts. Please wait and try again.'
    );

    res.redirect('/auth/forgot-password');
  }
});

// Login and registration page.
router.get('/', ensureGuest, authController.showAuth);

// Register a student or tutor.
router.post(
  '/register',
  ensureGuest,
  authLimiter,
  registerRules,
  handleValidation,
  authController.register
);

// Login.
router.post(
  '/login',
  ensureGuest,
  authLimiter,
  loginRules,
  handleValidation,
  authController.login
);

// Display the registration email-verification page.
router.get(
  '/verify',
  ensureGuest,
  authController.showVerification
);

// Submit the registration verification code.
router.post(
  '/verify',
  ensureGuest,
  verificationLimiter,
  authController.verifyEmail
);

// Request another registration verification code.
router.post(
  '/resend-verification',
  ensureGuest,
  verificationLimiter,
  authController.resendVerification
);

// ==========================================
// FORGOT PASSWORD ROUTES
// ==========================================

// Display the forgot-password page.
router.get(
  '/forgot-password',
  ensureGuest,
  authController.showForgotPassword
);

// Submit the email address to request a reset code.
router.post(
  '/forgot-password',
  ensureGuest,
  passwordResetLimiter,
  authController.forgotPassword
);

// Display the password-reset code page.
router.get(
  '/verify-reset-code',
  ensureGuest,
  authController.showVerifyResetCode
);

// Verify the password-reset code.
router.post(
  '/verify-reset-code',
  ensureGuest,
  passwordResetLimiter,
  authController.verifyResetCode
);

// Display the new-password page.
router.get(
  '/reset-password',
  ensureGuest,
  authController.showResetPassword
);

// Save the new password.
router.post(
  '/reset-password',
  ensureGuest,
  passwordResetLimiter,
  authController.resetPassword
);

// Logout.
router.post(
  '/logout',
  ensureAuth,
  authController.logout
);

module.exports = router;
