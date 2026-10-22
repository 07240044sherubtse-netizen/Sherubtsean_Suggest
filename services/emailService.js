
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.EMAIL_FROM || 'Sherubtsean Suggest <onboarding@resend.dev>';

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

// Send the registration verification code.
async function sendVerificationCode(email, name, code) {
  const safeName = escapeHtml(name);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your Sherubtsean Suggest email',
    text: `Hello ${name},

Your verification code is: ${code}

This code expires in 10 minutes.
If you did not request this, you can ignore this email.

Sherubtsean Suggest`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2>Verify your email</h2>
        <p>Hello ${safeName},</p>
        <p>Your six-digit verification code is:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
        <p>Sherubtsean Suggest</p>
      </div>
    `
  });

  if (error) {
    console.error('Verification email failed:', error.message);
    throw new Error('Could not send verification email.');
  }

  return data;
}

// Send the password-reset verification code.
async function sendPasswordResetCode(email, name, code) {
  const safeName = escapeHtml(name);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your Sherubtsean Suggest password',
    text: `Hello ${name},

We received a request to reset your Sherubtsean Suggest password.

Your six-digit password-reset code is: ${code}

This code expires in 10 minutes.

If you did not request a password reset, ignore this email. Your password will not change unless the reset process is completed.

Sherubtsean Suggest`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#102a43">Reset your password</h2>
        <p>Hello ${safeName},</p>
        <p>We received a request to reset your Sherubtsean Suggest password.</p>
        <p>Your six-digit password-reset code is:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2563eb">${code}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request a password reset, you can ignore this email. Your password will not change unless the reset process is completed.</p>
        <p style="color:#64748b">Sherubtsean Suggest</p>
      </div>
    `
  });

  if (error) {
    console.error('Password-reset email failed:', error.message);
    throw new Error('Could not send password-reset email.');
  }

  return data;
}

module.exports = {
  sendVerificationCode,
  sendPasswordResetCode
};
