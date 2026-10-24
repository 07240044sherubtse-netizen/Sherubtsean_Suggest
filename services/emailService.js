async function sendCode(email, name, code, type) {
  const url = String(
    process.env.GOOGLE_SCRIPT_URL || ''
  ).trim();

  const secret = String(
    process.env.EMAIL_API_SECRET || ''
  ).trim();

  if (
    !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)
  ) {
    throw new Error(
      'Set GOOGLE_SCRIPT_URL to the deployed Apps Script /exec URL.'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      'Set EMAIL_API_SECRET to the same secret used in Apps Script.'
    );
  }

  let response;

  try {
    response = await fetch(url, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        secret,
        email,
        name,
        code: String(code),
        type
      }),

      redirect: 'follow',
      signal: AbortSignal.timeout(30000)
    });
  } catch (err) {
    throw new Error(
      'Google email request failed or timed out. Please try again.'
    );
  }

  if (!response.ok) {
    throw new Error(
      'Google email endpoint returned HTTP ' + response.status
    );
  }

  let result;

  try {
    result = await response.json();
  } catch (err) {
    throw new Error(
      'Google returned a non-JSON response. Check web app access and the /exec URL.'
    );
  }

  if (!result || result.ok !== true) {
    throw new Error(
      (result && result.error) ||
      'Google did not confirm email delivery.'
    );
  }
}

// Send the registration verification code.
async function sendVerificationCode(email, name, code) {
  await sendCode(email, name, code, 'verification');
}

// Send the password-reset code.
async function sendPasswordResetCode(email, name, code) {
  await sendCode(email, name, code, 'password-reset');
}

module.exports = {
  sendVerificationCode,
  sendPasswordResetCode
};