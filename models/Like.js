const { query } = require('../config/db');

const Like = {
  async hasLiked(userId, suggestionId) {
    const result = await query(
      'SELECT id FROM likes WHERE user_id = $1 AND suggestion_id = $2',
      [userId, suggestionId]
    );
    return Boolean(result.rows[0]);
  },

  async toggle(userId, suggestionId) {
    const existing = await query(
      'SELECT id FROM likes WHERE user_id = $1 AND suggestion_id = $2',
      [userId, suggestionId]
    );

    if (existing.rows[0]) {
      await query('DELETE FROM likes WHERE id = $1', [existing.rows[0].id]);
      return { liked: false };
    }

    await query(
      'INSERT INTO likes (user_id, suggestion_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, suggestionId]
    );
    return { liked: true };
  },

  async countForSuggestion(suggestionId) {
    const result = await query(
      'SELECT COUNT(*)::int AS count FROM likes WHERE suggestion_id = $1',
      [suggestionId]
    );
    return result.rows[0].count;
  }
};

module.exports = Like;
