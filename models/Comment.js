const { query } = require('../config/db');

const Comment = {
  async create({ suggestionId, userId, content }) {
    const result = await query(
      `INSERT INTO comments (suggestion_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [suggestionId, userId, content]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await query(
      `SELECT c.*, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async listBySuggestion(suggestionId) {
    const result = await query(
      `SELECT c.id, c.suggestion_id, c.user_id, c.content, c.created_at, c.updated_at, u.name AS author_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.suggestion_id = $1
       ORDER BY c.created_at ASC`,
      [suggestionId]
    );
    return result.rows;
  },

  async update(id, content) {
    const result = await query(
      `UPDATE comments
       SET content = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, content]
    );
    return result.rows[0] || null;
  },

  async remove(id) {
    const result = await query('DELETE FROM comments WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  },

  async count() {
    const result = await query('SELECT COUNT(*)::int AS count FROM comments');
    return result.rows[0].count;
  }
};

module.exports = Comment;
