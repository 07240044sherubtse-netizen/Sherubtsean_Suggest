const STAFF_ROLES = ['admin', 'super_admin'];

function isStaff(user) {
  return Boolean(user && STAFF_ROLES.includes(user.role));
}

function isSuperAdmin(user) {
  return Boolean(user && user.role === 'super_admin');
}

function isAdmin(user) {
  return Boolean(user && user.role === 'admin');
}

function staffHome(user) {
  if (isSuperAdmin(user)) return '/super-admin';
  if (isAdmin(user)) return '/admin';
  return '/dashboard';
}

function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  req.flash('error', 'Please log in to continue.');
  const nextUrl = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/auth?next=${nextUrl}`);
}

function ensureGuest(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect(staffHome(req.session.user));
  }
  return next();
}

function ensureAdmin(req, res, next) {
  if (isStaff(req.session && req.session.user)) {
    return next();
  }

  const status = req.session && req.session.user ? 403 : 401;
  if (status === 401) {
    req.flash('error', 'Please log in as an administrator.');
    return res.redirect('/auth');
  }

  req.flash('error', 'You do not have permission to view that page.');
  return res.redirect('/dashboard');
}

function ensureSuperAdmin(req, res, next) {
  if (isSuperAdmin(req.session && req.session.user)) {
    return next();
  }

  if (!(req.session && req.session.user)) {
    req.flash('error', 'Please log in as a super administrator.');
    return res.redirect('/auth');
  }

  req.flash('error', 'Only a super administrator can open that page.');
  return res.redirect(isStaff(req.session.user) ? '/admin' : '/dashboard');
}

function canManageSuggestion(user, suggestion) {
  if (!user || !suggestion) return false;
  return isStaff(user) || Number(user.id) === Number(suggestion.user_id);
}

function canManageComment(user, comment) {
  if (!user || !comment) return false;
  return isStaff(user) || Number(user.id) === Number(comment.user_id);
}

function canChangeStatus(user) {
  return isStaff(user);
}

module.exports = {
  STAFF_ROLES,
  isStaff,
  isAdmin,
  isSuperAdmin,
  staffHome,
  ensureAuth,
  ensureGuest,
  ensureAdmin,
  ensureSuperAdmin,
  canManageSuggestion,
  canManageComment,
  canChangeStatus
};
