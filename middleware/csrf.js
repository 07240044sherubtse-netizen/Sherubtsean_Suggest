const crypto = require('crypto');

function ensureCsrfToken(req, res, next) {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyCsrf(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const token = req.body._csrf || req.get('x-csrf-token');
  if (!token || !req.session || token !== req.session.csrfToken) {
    const wantsJson = req.get('x-requested-with') === 'fetch' || req.accepts('json') === 'json' && req.get('accept')?.includes('application/json');
    if (wantsJson) {
      return res.status(403).json({ error: 'Your session expired. Refresh the page and try again.' });
    }

    req.flash('error', 'Your session expired. Please try again.');
    return res.redirect(req.get('Referrer') || '/');
  }

  next();
}

module.exports = {
  ensureCsrfToken,
  verifyCsrf
};
