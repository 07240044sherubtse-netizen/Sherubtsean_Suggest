const Category = require('../models/Category');
const Suggestion = require('../models/Suggestion');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const { canManageSuggestion, canChangeStatus, isStaff, isSuperAdmin } = require('../middleware/auth');

const PAGE_SIZE = 8;

function wantsJson(req) {
  return req.get('x-requested-with') === 'fetch';
}

async function index(req, res, next) {
  try {
    const q = (req.query.q || '').trim().slice(0, 120);
    const categoryId = req.query.category ? Number(req.query.category) : null;
    const status = ['Open', 'In Progress', 'Resolved'].includes(req.query.status) ? req.query.status : '';
    const sort = req.query.sort === 'upvoted' ? 'upvoted' : 'newest';
    const page = Math.max(1, Number(req.query.page) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const [categories, suggestions, total] = await Promise.all([
      Category.findAll(),
      Suggestion.list({
        q,
        categoryId: Number.isInteger(categoryId) ? categoryId : null,
        status,
        sort,
        limit: PAGE_SIZE,
        offset,
        currentUser: req.session.user
      }),
      Suggestion.count({
        q,
        categoryId: Number.isInteger(categoryId) ? categoryId : null,
        status
      })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    res.render('suggestions', {
      title: 'Suggestions',
      categories,
      suggestions,
      filters: {
        q,
        category: Number.isInteger(categoryId) ? String(categoryId) : '',
        status,
        sort,
        page
      },
      pagination: {
        page,
        totalPages,
        total
      }
    });
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const suggestion = await Suggestion.findPublicById(req.params.id, req.session.user);
    if (!suggestion) {
      return res.status(404).render('error', {
        title: 'Suggestion not found',
        status: 404,
        message: 'That suggestion does not exist or was removed.'
      });
    }

    const full = await Suggestion.findById(req.params.id);
    const comments = await Comment.listBySuggestion(suggestion.id);
    let hasLiked = false;
    if (req.session.user) {
      hasLiked = await Like.hasLiked(req.session.user.id, suggestion.id);
    }

    res.render('suggestion-details', {
      title: suggestion.title,
      suggestion,
      comments,
      hasLiked,
      canManage: canManageSuggestion(req.session.user, full)
    });
  } catch (err) {
    next(err);
  }
}

async function newForm(req, res, next) {
  try {
    const categories = await Category.findAll();
    res.render('suggestion-form', {
      title: 'Share a Suggestion',
      categories,
      suggestion: null
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const suggestion = await Suggestion.create({
      userId: req.session.user.id,
      categoryId: Number(req.body.category_id),
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      isAnonymous: req.body.is_anonymous === 'on'
    });

    req.flash('success', 'Your suggestion has been posted.');
    res.redirect(`/suggestions/${suggestion.id}`);
  } catch (err) {
    next(err);
  }
}

async function editForm(req, res, next) {
  try {
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      return res.status(404).render('error', {
        title: 'Suggestion not found',
        status: 404,
        message: 'That suggestion does not exist or was removed.'
      });
    }

    if (!canManageSuggestion(req.session.user, suggestion)) {
      req.flash('error', 'You can only edit your own suggestions.');
      return res.redirect(`/suggestions/${suggestion.id}`);
    }

    const categories = await Category.findAll();
    res.render('suggestion-form', {
      title: 'Edit Suggestion',
      categories,
      suggestion
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      req.flash('error', 'That suggestion was not found.');
      return res.redirect('/suggestions');
    }

    if (!canManageSuggestion(req.session.user, suggestion)) {
      req.flash('error', 'You can only edit your own suggestions.');
      return res.redirect(`/suggestions/${suggestion.id}`);
    }

    const status =
      canChangeStatus(req.session.user) && ['Open', 'In Progress', 'Resolved'].includes(req.body.status)
        ? req.body.status
        : null;

    await Suggestion.update(suggestion.id, {
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      categoryId: Number(req.body.category_id),
      isAnonymous: req.body.is_anonymous === 'on',
      status
    });

    req.flash('success', 'Suggestion updated.');
    res.redirect(`/suggestions/${suggestion.id}`);
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      req.flash('error', 'That suggestion was not found.');
      return res.redirect('/suggestions');
    }

    if (!canManageSuggestion(req.session.user, suggestion)) {
      req.flash('error', 'You can only delete your own suggestions.');
      return res.redirect(`/suggestions/${suggestion.id}`);
    }

    await Suggestion.remove(suggestion.id);
    req.flash('success', 'Suggestion deleted.');
    let destination = '/dashboard';
    if (isStaff(req.session.user) && req.body.from === 'admin') {
      destination = '/admin?tab=suggestions';
    } else if (isSuperAdmin(req.session.user) && req.body.from === 'super-admin') {
      destination = '/super-admin?tab=suggestions';
    }
    res.redirect(destination);
  } catch (err) {
    next(err);
  }
}

async function upvote(req, res, next) {
  try {
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      if (wantsJson(req)) {
        return res.status(404).json({ error: 'Suggestion not found.' });
      }
      req.flash('error', 'Suggestion not found.');
      return res.redirect('/suggestions');
    }

    const result = await Like.toggle(req.session.user.id, suggestion.id);
    const likeCount = await Like.countForSuggestion(suggestion.id);

    if (wantsJson(req)) {
      return res.json({ liked: result.liked, likeCount });
    }

    res.redirect(`/suggestions/${suggestion.id}`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  index,
  show,
  newForm,
  create,
  editForm,
  update,
  destroy,
  upvote
};
