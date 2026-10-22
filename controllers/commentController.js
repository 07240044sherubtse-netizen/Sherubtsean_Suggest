const Comment = require('../models/Comment');
const Suggestion = require('../models/Suggestion');
const { canManageComment } = require('../middleware/auth');

async function create(req, res, next) {
  try {
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      req.flash('error', 'That suggestion was not found.');
      return res.redirect('/suggestions');
    }

    await Comment.create({
      suggestionId: suggestion.id,
      userId: req.session.user.id,
      content: req.body.content.trim()
    });

    req.flash('success', 'Comment posted.');
    res.redirect(`/suggestions/${suggestion.id}#comments`);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      req.flash('error', 'That comment was not found.');
      return res.redirect('/suggestions');
    }

    if (!canManageComment(req.session.user, comment)) {
      req.flash('error', 'You can only edit your own comments.');
      return res.redirect(`/suggestions/${comment.suggestion_id}#comments`);
    }

    await Comment.update(comment.id, req.body.content.trim());
    req.flash('success', 'Comment updated.');
    res.redirect(`/suggestions/${comment.suggestion_id}#comments`);
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      req.flash('error', 'That comment was not found.');
      return res.redirect('/suggestions');
    }

    if (!canManageComment(req.session.user, comment)) {
      req.flash('error', 'You can only delete your own comments.');
      return res.redirect(`/suggestions/${comment.suggestion_id}#comments`);
    }

    await Comment.remove(comment.id);
    req.flash('success', 'Comment deleted.');
    res.redirect(`/suggestions/${comment.suggestion_id}#comments`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  update,
  destroy
};
