
const nodemailer = require('nodemailer');

function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    throw new Error('Email credentials are missing from .env');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });
}

// Escape HTML characters to prevent HTML injection.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

// Send registration verification code.
async function sendVerificationCode(email, name, code) {
  const transporter = createTransporter();
  const safeName = escapeHtml(name);

  await transporter.sendMail({
    from: `"Sherubtsean Suggest" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify your Sherubtsean Suggest email',
    text: `Hello ${name},

Your verification code is: ${code}

This code expires in 10 minutes.

Sherubtsean Suggest`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2>Verify your email</h2>
        <p>Hello ${safeName},</p>
        <p>Your six-digit verification code is:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px">
          ${code}
        </p>
        <p>This code expires in 10 minutes.</p>
        <p>Sherubtsean Suggest</p>
      </div>
    `
  });
}

// Send password-reset verification code.
async function sendPasswordResetCode(email, name, code) {
  const transporter = createTransporter();
  const safeName = escapeHtml(name);

  await transporter.sendMail({
    from: `"Sherubtsean Suggest" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset your Sherubtsean Suggest password',
    text: `Hello ${name},

Your six-digit password-reset code is: ${code}

This code expires in 10 minutes.

Sherubtsean Suggest`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2>Reset your password</h2>
        <p>Hello ${safeName},</p>
        <p>Your six-digit password-reset code is:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px">
          ${code}
        </p>
        <p>This code expires in 10 minutes.</p>
        <p>Sherubtsean Suggest</p>
      </div>
    `
  });
}

module.exports = {
  sendVerificationCode,
  sendPasswordResetCode
};
