const Suggestion = require('../models/Suggestion');

async function show(req, res, next) {
  try {
    const user = req.session.user;
    const [stats, recent] = await Promise.all([
      Suggestion.statsForUser(user.id),
      Suggestion.list({
        userId: user.id,
        limit: 8,
        offset: 0,
        currentUser: user
      })
    ]);

    res.render('dashboard', {
      title: 'Your Dashboard',
      stats,
      recent
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { show };
