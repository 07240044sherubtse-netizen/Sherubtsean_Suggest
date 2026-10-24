
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const User = require('../models/User');
const { staffHome } = require('../middleware/auth');
const {
  sendVerificationCode,
  sendPasswordResetCode
} = require('../services/emailService');

// Generate a cryptographically secure six-digit OTP.
function generateCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

// Create, store, and email a hashed registration verification code.
async function issueVerificationCode(user) {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);

  await User.createVerificationCode(user.id, codeHash);

  try {
    await sendVerificationCode(user.email, user.name, code);
  } catch (err) {
    await User.deleteVerificationCode(user.id);
    throw err;
  }
}

// Create, store, and email a hashed password-reset code.
async function issuePasswordResetCode(user) {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);

  await User.createPasswordResetCode(user.id, codeHash);

  try {
    await sendPasswordResetCode(user.email, user.name, code);
  } catch (err) {
    await User.deletePasswordResetCode(user.id);
    throw err;
  }
}

// Display the login/register page.
function showAuth(req, res) {
  const tab = req.query.tab === 'register' ? 'register' : 'login';
  const mode = req.query.mode === 'admin' ? 'admin' : 'user';

  res.render('auth', {
    title: 'Login or Register',
    next: req.query.next || '',
    tab,
    mode
  });
}

// Register a new student or tutor.
async function register(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = req.body.role;
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      req.flash('error', 'Please complete all required fields.');
      return res.redirect('/auth?tab=register');
    }

    if (!['student', 'tutor'].includes(role)) {
      req.flash('error', 'Choose Student or Tutor.');
      return res.redirect('/auth?tab=register');
    }

    if (password.length < 8) {
      req.flash('error', 'Your password must be at least 8 characters.');
      return res.redirect('/auth?tab=register');
    }

    const existing = await User.findByEmail(email);

    if (existing && existing.is_verified) {
      req.flash(
        'error',
        'An account with that email already exists. Try logging in.'
      );
      return res.redirect('/auth?tab=register');
    }

    // If an unverified account exists, resend its code.
    if (existing && !existing.is_verified) {
      try {
        await issueVerificationCode(existing);
      } catch (emailError) {
        console.error('Verification email could not be sent:', emailError.message);
        req.flash(
          'error',
          'We could not send your verification code. Please try again shortly.'
        );

        return res.redirect(
          `/auth/verify?email=${encodeURIComponent(email)}`
        );
      }

      req.flash(
        'success',
        'A new verification code has been sent to your email.'
      );

      return res.redirect(
        `/auth/verify?email=${encodeURIComponent(email)}`
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      isVerified: false
    });

    try {
      await issueVerificationCode(user);
    } catch (emailError) {
      console.error('Verification email could not be sent:', emailError.message);

      req.flash(
        'error',
        'Your account was created, but we could not send the verification email. Please try again shortly.'
      );

      return res.redirect('/auth?tab=register');
    }

    req.flash(
      'success',
      'We sent a six-digit verification code to your email. It expires in 10 minutes.'
    );

    return res.redirect(
      `/auth/verify?email=${encodeURIComponent(email)}`
    );
  } catch (err) {
    next(err);
  }
}

// Display the registration email-verification page.
function showVerification(req, res) {
  res.render('verify-email', {
    title: 'Verify your email',
    email: String(req.query.email || '').trim().toLowerCase()
  });
}

// Verify the registration email code.
async function verifyEmail(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();

    if (!email || !/^\d{6}$/.test(code)) {
      req.flash('error', 'Enter a valid email and six-digit code.');
      return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
    }

    const user = await User.findByEmail(email);

    if (!user || user.is_verified) {
      req.flash(
        'error',
        'This verification request is invalid or has already been completed.'
      );
      return res.redirect('/auth');
    }

    const record = await User.getVerificationCode(user.id);

    if (!record) {
      req.flash('error', 'Your verification code is missing. Request a new code.');
      return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
    }

    if (record.attempts >= 5) {
      await User.deleteVerificationCode(user.id);
      req.flash(
        'error',
        'Too many incorrect attempts. Request a new verification code.'
      );
      return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
    }

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      await User.deleteVerificationCode(user.id);
      req.flash('error', 'Your verification code has expired. Request a new code.');
      return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
    }

    const matches = await bcrypt.compare(code, record.code_hash);

    if (!matches) {
      await User.incrementVerificationAttempts(record.id);
      req.flash('error', 'Incorrect verification code.');
      return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
    }

    await User.markVerified(user.id);

    req.flash(
      'success',
      'Your email has been verified successfully. You can now log in.'
    );

    return res.redirect('/auth?tab=login');
  } catch (err) {
    next(err);
  }
}

// Resend a registration verification code with a one-minute cooldown.
async function resendVerification(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findByEmail(email);

    if (!user || user.is_verified) {
      req.flash(
        'error',
        'If your account needs verification, you can request a new code.'
      );
      return res.redirect('/auth');
    }

    const existing = await User.getVerificationCode(user.id);

    if (
      existing &&
      Date.now() - new Date(existing.last_sent_at).getTime() < 60 * 1000
    ) {
      req.flash('error', 'Please wait one minute before requesting another code.');
      return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
    }

    try {
      await issueVerificationCode(user);
    } catch (emailError) {
      console.error('Verification email could not be resent:', emailError.message);
      req.flash('error', 'We could not send a new code. Please try again shortly.');
      return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
    }

    req.flash('success', 'A new verification code has been sent.');
    return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// FORGOT PASSWORD
// ==========================================

// Display the forgot-password page.
function showForgotPassword(req, res) {
  res.render('forgot-password', {
    title: 'Forgot Password'
  });
}

// Request a password-reset code.
async function forgotPassword(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email || email.length > 254) {
      req.flash('error', 'Enter a valid email address.');
      return res.redirect('/auth/forgot-password');
    }

    const user = await User.findByEmail(email);

    // Use a generic response to avoid revealing whether an account exists.
    const genericMessage =
      'If an eligible account exists for that email, a password-reset code will be sent.';

    if (!user || user.is_verified !== true || user.is_active !== true) {
      req.flash('success', genericMessage);
      return res.redirect('/auth/forgot-password');
    }

    const existing = await User.getPasswordResetCode(user.id);

    if (
      existing &&
      Date.now() - new Date(existing.last_sent_at).getTime() < 60 * 1000
    ) {
      req.flash('success', genericMessage);
      return res.redirect('/auth/forgot-password');
    }

    try {
      await issuePasswordResetCode(user);
    } catch (emailError) {
      console.error('Password-reset email could not be sent:', emailError.message);
      req.flash(
        'error',
        'We could not send your reset code. Please try again shortly.'
      );
      return res.redirect('/auth/forgot-password');
    }

    req.flash('success', genericMessage);

    return res.redirect(
      `/auth/verify-reset-code?email=${encodeURIComponent(email)}`
    );
  } catch (err) {
    next(err);
  }
}

// Display the password-reset code page.
function showVerifyResetCode(req, res) {
  res.render('verify-reset-code', {
    title: 'Verify Reset Code',
    email: String(req.query.email || '').trim().toLowerCase()
  });
}

// Verify a password-reset code and proceed to the new-password page.
async function verifyResetCode(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();

    if (!email || !/^\d{6}$/.test(code)) {
      req.flash('error', 'Enter your email and six-digit reset code.');
      return res.redirect(
        `/auth/verify-reset-code?email=${encodeURIComponent(email)}`
      );
    }

    const user = await User.findByEmail(email);

    if (!user || user.is_verified !== true || user.is_active !== true) {
      req.flash('error', 'The reset request is invalid or has expired.');
      return res.redirect('/auth/forgot-password');
    }

    const record = await User.getPasswordResetCode(user.id);

    if (!record) {
      req.flash('error', 'Your reset code is missing or has expired. Request a new one.');
      return res.redirect(
        `/auth/verify-reset-code?email=${encodeURIComponent(email)}`
      );
    }

    if (record.attempts >= 5) {
      await User.deletePasswordResetCode(user.id);
      req.flash('error', 'Too many incorrect attempts. Request a new reset code.');
      return res.redirect('/auth/forgot-password');
    }

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      await User.deletePasswordResetCode(user.id);
      req.flash('error', 'Your reset code has expired. Request a new one.');
      return res.redirect('/auth/forgot-password');
    }

    const matches = await bcrypt.compare(code, record.code_hash);

    if (!matches) {
      await User.incrementPasswordResetAttempts(record.id);
      req.flash('error', 'Incorrect reset code.');
      return res.redirect(
        `/auth/verify-reset-code?email=${encodeURIComponent(email)}`
      );
    }

    // Store only a short-lived reset authorization in the session.
    // The final password-reset handler must recheck the code record.
    req.session.passwordResetUserId = user.id;
    req.session.passwordResetRecordId = record.id;
    req.session.passwordResetVerifiedAt = Date.now();

    return req.session.save((err) => {
      if (err) return next(err);
      return res.redirect('/auth/reset-password');
    });
  } catch (err) {
    next(err);
  }
}

// Display the new-password page only after code verification.
function showResetPassword(req, res) {
  const verifiedAt = Number(req.session.passwordResetVerifiedAt || 0);

  if (
    !req.session.passwordResetUserId ||
    !req.session.passwordResetRecordId ||
    !verifiedAt ||
    Date.now() - verifiedAt > 10 * 60 * 1000
  ) {
    req.flash('error', 'Verify a valid reset code before changing your password.');
    return res.redirect('/auth/forgot-password');
  }

  return res.render('reset-password', {
    title: 'Reset Password'
  });
}

// Save the new password after rechecking reset authorization and expiry.
async function resetPassword(req, res, next) {
  try {
    const userId = req.session.passwordResetUserId;
    const recordId = req.session.passwordResetRecordId;
    const verifiedAt = Number(req.session.passwordResetVerifiedAt || 0);

    if (
      !userId ||
      !recordId ||
      !verifiedAt ||
      Date.now() - verifiedAt > 10 * 60 * 1000
    ) {
      clearPasswordResetSession(req);
      req.flash('error', 'Your reset session has expired. Please start again.');
      return res.redirect('/auth/forgot-password');
    }

    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (password.length < 8 || password.length > 128) {
      req.flash('error', 'Your new password must be between 8 and 128 characters.');
      return res.redirect('/auth/reset-password');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'The passwords do not match.');
      return res.redirect('/auth/reset-password');
    }

    const user = await User.findById(userId);

    if (!user || user.is_active !== true || user.is_verified !== true) {
      clearPasswordResetSession(req);
      req.flash('error', 'This password-reset request is no longer valid.');
      return res.redirect('/auth/forgot-password');
    }

    const record = await User.getPasswordResetCode(userId);

    if (
      !record ||
      String(record.id) !== String(recordId) ||
      record.attempts >= 5 ||
      new Date(record.expires_at).getTime() <= Date.now()
    ) {
      clearPasswordResetSession(req);
      req.flash('error', 'Your reset code has expired or been used. Please start again.');
      return res.redirect('/auth/forgot-password');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // The model should make this update and code invalidation atomic.
    await User.resetPassword(userId, passwordHash);

    clearPasswordResetSession(req);

    // Do not automatically log the user in after a password reset.
    req.flash('success', 'Your password has been reset. Please log in.');
    return res.redirect('/auth?tab=login');
  } catch (err) {
    next(err);
  }
}

// Clear temporary password-reset authorization.
function clearPasswordResetSession(req) {
  delete req.session.passwordResetUserId;
  delete req.session.passwordResetRecordId;
  delete req.session.passwordResetVerifiedAt;
}

// Log in an existing user.
async function login(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findByEmail(email);

    if (!user || !(await bcrypt.compare(
      String(req.body.password || ''),
      user.password_hash
    ))) {
      req.flash('error', 'Invalid email or password.');

      return res.redirect(
        `/auth?tab=login&mode=${req.body.mode === 'admin' ? 'admin' : 'user'}`
      );
    }

    if (!user.is_active) {
      req.flash('error', 'This account has been disabled. Contact an administrator.');

      return res.redirect(
        `/auth?tab=login&mode=${req.body.mode === 'admin' ? 'admin' : 'user'}`
      );
    }

    if (user.is_verified === false) {
      req.flash('error', 'Please verify your email before logging in.');
      return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
    }

    const mode = req.body.mode === 'admin' ? 'admin' : 'user';
    const isStaff = ['admin', 'super_admin'].includes(user.role);

    if (mode === 'admin' && !isStaff) {
      req.flash('error', 'This account does not have administrator privileges.');
      return res.redirect('/auth?tab=login&mode=admin');
    }

    if (mode === 'user' && isStaff) {
      req.flash('error', 'Please use the administrator login option for this account.');
      return res.redirect('/auth?tab=login&mode=user');
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    req.flash('success', `Welcome back, ${user.name.split(' ')[0]}.`);

    const nextUrl =
      typeof req.body.next === 'string' &&
      req.body.next.startsWith('/') &&
      !req.body.next.startsWith('//')
        ? req.body.next
        : '';

    const destination = nextUrl || staffHome(user);

    return req.session.save(() => res.redirect(destination));
  } catch (err) {
    next(err);
  }
}

// Log out the current user.
function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);

    res.clearCookie('connect.sid');
    return res.redirect('/');
  });
}

module.exports = {
  showAuth,
  register,
  login,
  logout,
  showVerification,
  verifyEmail,
  resendVerification,
  showForgotPassword,
  forgotPassword,
  showVerifyResetCode,
  verifyResetCode,
  showResetPassword,
  resetPassword
};
