const Category = require('../models/Category');
const Suggestion = require('../models/Suggestion');
const Comment = require('../models/Comment');
const User = require('../models/User');

async function home(req, res, next) {
  try {
    const [categories, latest, suggestionStats, userCount, commentCount] = await Promise.all([
      Category.findAll(),
      Suggestion.list({ limit: 6, offset: 0, currentUser: req.session.user }),
      Suggestion.stats(),
      User.count(),
      Comment.count()
    ]);

    res.render('home', {
      title: 'Sherubtsean Suggest',
      categories,
      latest,
      stats: {
        suggestions: suggestionStats.total,
        users: userCount,
        resolved: suggestionStats.resolved_count,
        comments: commentCount
      }
    });
  } catch (err) {
    next(err);
  }
}

function privacy(req, res) {
  res.render('privacy', { title: 'Privacy Policy' });
}

function terms(req, res) {
  res.render('terms', { title: 'Terms of Service' });
}

module.exports = {
  home,
  privacy,
  terms
};
