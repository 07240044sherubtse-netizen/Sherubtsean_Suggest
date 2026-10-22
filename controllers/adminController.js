const User = require('../models/User');
const Category = require('../models/Category');
const Suggestion = require('../models/Suggestion');
const Comment = require('../models/Comment');
const { isStaff } = require('../middleware/auth');

async function dashboard(req, res, next) {
  try {
    const tab = ['overview', 'suggestions', 'users'].includes(req.query.tab) ? req.query.tab : 'overview';

    const q = (req.query.q || '').trim().slice(0, 120);
    const status = ['Open', 'In Progress', 'Resolved'].includes(req.query.status) ? req.query.status : '';
    const categoryId = req.query.category ? Number(req.query.category) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 10;

    const [suggestionStats, userCount, commentCount, categories] = await Promise.all([
      Suggestion.stats(),
      User.count(),
      Comment.count(),
      Category.findAll()
    ]);

    let suggestions = [];
    let suggestionTotal = 0;
    let users = [];
    let userTotal = 0;
    let recent = [];

    if (tab === 'overview' || tab === 'suggestions') {
      recent = await Suggestion.list({
        limit: 6,
        offset: 0,
        currentUser: req.session.user
      });
    }

    if (tab === 'suggestions') {
      suggestions = await Suggestion.list({
        q,
        categoryId: Number.isInteger(categoryId) ? categoryId : null,
        status,
        sort: req.query.sort === 'upvoted' ? 'upvoted' : 'newest',
        limit: pageSize,
        offset: (page - 1) * pageSize,
        currentUser: req.session.user
      });
      suggestionTotal = await Suggestion.count({
        q,
        categoryId: Number.isInteger(categoryId) ? categoryId : null,
        status
      });
    }

    if (tab === 'users') {
      users = await User.search({ q, limit: pageSize, offset: (page - 1) * pageSize });
      userTotal = await User.countSearch(q);
    }

    res.render('admin-dashboard', {
      title: 'Admin Dashboard',
      tab,
      stats: {
        users: userCount,
        suggestions: suggestionStats.total,
        comments: commentCount,
        resolved: suggestionStats.resolved_count,
        open: suggestionStats.open_count,
        inProgress: suggestionStats.in_progress_count
      },
      recent,
      suggestions,
      suggestionTotal,
      suggestionPages: Math.max(1, Math.ceil(suggestionTotal / pageSize)),
      users,
      userTotal,
      userPages: Math.max(1, Math.ceil(userTotal / pageSize)),
      categories,
      filters: {
        q,
        status,
        category: Number.isInteger(categoryId) ? String(categoryId) : '',
        page
      }
    });
  } catch (err) {
    next(err);
  }
}

async function updateSuggestionStatus(req, res, next) {
  try {
    const redirectTo = req.body.from === 'super-admin' ? '/super-admin?tab=suggestions' : '/admin?tab=suggestions';
    await Suggestion.updateStatus(req.params.id, req.body.status);
    req.flash('success', 'Suggestion status updated.');
    res.redirect(redirectTo);
  } catch (err) {
    next(err);
  }
}

async function toggleUserActive(req, res, next) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin?tab=users');
    }

    if (Number(target.id) === Number(req.session.user.id)) {
      req.flash('error', 'You cannot disable your own account.');
      return res.redirect('/admin?tab=users');
    }

    if (isStaff(target)) {
      req.flash('error', 'Administrators can only disable student or tutor accounts. Ask a super administrator to manage staff accounts.');
      return res.redirect('/admin?tab=users');
    }

    await User.setActive(target.id, !target.is_active);
    req.flash('success', target.is_active ? 'Account disabled.' : 'Account reactivated.');
    res.redirect('/admin?tab=users');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard,
  updateSuggestionStatus,
  toggleUserActive
};
