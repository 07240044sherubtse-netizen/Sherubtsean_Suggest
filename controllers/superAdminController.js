const bcrypt = require('bcrypt');
const User = require('../models/User');
const Category = require('../models/Category');
const Suggestion = require('../models/Suggestion');
const Comment = require('../models/Comment');
const { isSuperAdmin } = require('../middleware/auth');

async function dashboard(req, res, next) {
  try {
    const tab = ['overview', 'suggestions', 'users', 'categories'].includes(req.query.tab)
      ? req.query.tab
      : 'overview';

    const q = (req.query.q || '').trim().slice(0, 120);
    const status = ['Open', 'In Progress', 'Resolved'].includes(req.query.status) ? req.query.status : '';
    const categoryId = req.query.category ? Number(req.query.category) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 10;

    const [suggestionStats, userCount, commentCount, categories, adminCount, superAdminCount, inactiveCount] =
      await Promise.all([
        Suggestion.stats(),
        User.count(),
        Comment.count(),
        Category.findAll(),
        User.countByRole('admin'),
        User.countByRole('super_admin'),
        User.countInactive()
      ]);

    let suggestions = [];
    let suggestionTotal = 0;
    let users = [];
    let userTotal = 0;
    let categoryCounts = {};
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

    if (tab === 'categories') {
      for (const category of categories) {
        categoryCounts[category.id] = await Category.suggestionCount(category.id);
      }
    }

    res.render('super-admin-dashboard', {
      title: 'Super Admin',
      tab,
      stats: {
        users: userCount,
        suggestions: suggestionStats.total,
        comments: commentCount,
        resolved: suggestionStats.resolved_count,
        admins: adminCount,
        superAdmins: superAdminCount,
        inactive: inactiveCount
      },
      recent,
      suggestions,
      suggestionTotal,
      suggestionPages: Math.max(1, Math.ceil(suggestionTotal / pageSize)),
      users,
      userTotal,
      userPages: Math.max(1, Math.ceil(userTotal / pageSize)),
      categories,
      categoryCounts,
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

async function createAdmin(req, res, next) {
  try {
    const name = req.body.name.trim();
    const email = req.body.email.trim().toLowerCase();

    const existing = await User.findByEmail(email);
    if (existing) {
      req.flash('error', 'An account with that email already exists.');
      return res.redirect('/super-admin?tab=users');
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    await User.create({ name, email, passwordHash, role: 'admin' });
    req.flash('success', `Admin account created for ${name}.`);
    res.redirect('/super-admin?tab=users');
  } catch (err) {
    next(err);
  }
}

async function updateUserRole(req, res, next) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      req.flash('error', 'User not found.');
      return res.redirect('/super-admin?tab=users');
    }

    const role = req.body.role;
    if (!['student', 'tutor', 'admin'].includes(role)) {
      req.flash('error', 'Choose Student, Tutor, or Admin. Super administrators are created from the setup command only.');
      return res.redirect('/super-admin?tab=users');
    }

    if (Number(target.id) === Number(req.session.user.id)) {
      req.flash('error', 'You cannot change your own role.');
      return res.redirect('/super-admin?tab=users');
    }

    if (isSuperAdmin(target)) {
      req.flash('error', 'A super administrator role cannot be changed from this page.');
      return res.redirect('/super-admin?tab=users');
    }

    await User.updateRole(target.id, role);
    req.flash('success', `${target.name}'s role was updated.`);
    res.redirect('/super-admin?tab=users');
  } catch (err) {
    next(err);
  }
}

async function toggleUserActive(req, res, next) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      req.flash('error', 'User not found.');
      return res.redirect('/super-admin?tab=users');
    }

    if (Number(target.id) === Number(req.session.user.id)) {
      req.flash('error', 'You cannot disable your own account.');
      return res.redirect('/super-admin?tab=users');
    }

    if (isSuperAdmin(target) && target.is_active) {
      const superCount = await User.countActiveSuperAdmins();
      if (superCount <= 1) {
        req.flash('error', 'You cannot disable the last active super administrator.');
        return res.redirect('/super-admin?tab=users');
      }
    }

    await User.setActive(target.id, !target.is_active);
    req.flash('success', target.is_active ? 'Account disabled.' : 'Account reactivated.');
    res.redirect('/super-admin?tab=users');
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    await Category.create({
      name: req.body.name.trim(),
      description: (req.body.description || '').trim()
    });
    req.flash('success', 'Category added.');
    res.redirect('/super-admin?tab=categories');
  } catch (err) {
    if (err.code === '23505') {
      req.flash('error', 'A category with that name already exists.');
      return res.redirect('/super-admin?tab=categories');
    }
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    await Category.update(req.params.id, {
      name: req.body.name.trim(),
      description: (req.body.description || '').trim()
    });
    req.flash('success', 'Category updated.');
    res.redirect('/super-admin?tab=categories');
  } catch (err) {
    if (err.code === '23505') {
      req.flash('error', 'A category with that name already exists.');
      return res.redirect('/super-admin?tab=categories');
    }
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const count = await Category.suggestionCount(req.params.id);
    if (count > 0) {
      req.flash('error', 'This category still has suggestions, so it cannot be deleted.');
      return res.redirect('/super-admin?tab=categories');
    }

    await Category.remove(req.params.id);
    req.flash('success', 'Category deleted.');
    res.redirect('/super-admin?tab=categories');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard,
  createAdmin,
  updateUserRole,
  toggleUserActive,
  createCategory,
  updateCategory,
  deleteCategory
};
