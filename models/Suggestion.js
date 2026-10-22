const { query } = require('../config/db');

const authorSelect = `
  CASE
    WHEN s.is_anonymous AND ($1::int IS NULL OR ($1 <> s.user_id AND $2 NOT IN ('admin', 'super_admin')))
      THEN 'Anonymous'
    ELSE u.name
  END AS author_name,
  CASE
    WHEN s.is_anonymous AND ($1::int IS NULL OR ($1 <> s.user_id AND $2 NOT IN ('admin', 'super_admin')))
      THEN NULL
    ELSE s.user_id
  END AS public_user_id
`;

const Suggestion = {
  async create({ userId, categoryId, title, description, isAnonymous }) {
    const result = await query(
      `INSERT INTO suggestions (user_id, category_id, title, description, is_anonymous, status)
       VALUES ($1, $2, $3, $4, $5, 'Open')
       RETURNING *`,
      [userId, categoryId, title, description, isAnonymous]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await query(
      `SELECT s.*, c.name AS category_name, u.name AS owner_name
       FROM suggestions s
       JOIN categories c ON c.id = s.category_id
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async findPublicById(id, currentUser) {
    const viewerId = currentUser ? currentUser.id : null;
    const viewerRole = currentUser ? currentUser.role : '';
    const result = await query(
      `SELECT
         s.id, s.title, s.description, s.is_anonymous, s.status,
         s.created_at, s.updated_at, s.user_id, s.category_id,
         c.name AS category_name,
         ${authorSelect},
         (SELECT COUNT(*)::int FROM likes l WHERE l.suggestion_id = s.id) AS like_count,
         (SELECT COUNT(*)::int FROM comments cm WHERE cm.suggestion_id = s.id) AS comment_count
       FROM suggestions s
       JOIN categories c ON c.id = s.category_id
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $3`,
      [viewerId, viewerRole, id]
    );
    return result.rows[0] || null;
  },

  async list({
    q = '',
    categoryId = null,
    status = '',
    sort = 'newest',
    limit = 8,
    offset = 0,
    userId = null,
    currentUser = null
  }) {
    const viewerId = currentUser ? currentUser.id : null;
    const viewerRole = currentUser ? currentUser.role : '';
    const orderBy = sort === 'upvoted'
      ? 'like_count DESC, s.created_at DESC'
      : 's.created_at DESC';

    const result = await query(
      `SELECT
         s.id, s.title, s.description, s.is_anonymous, s.status,
         s.created_at, s.updated_at, s.user_id, s.category_id,
         c.name AS category_name,
         ${authorSelect},
         (SELECT COUNT(*)::int FROM likes l WHERE l.suggestion_id = s.id) AS like_count,
         (SELECT COUNT(*)::int FROM comments cm WHERE cm.suggestion_id = s.id) AS comment_count
       FROM suggestions s
       JOIN categories c ON c.id = s.category_id
       JOIN users u ON u.id = s.user_id
       WHERE ($3 = '' OR s.title ILIKE '%' || $3 || '%' OR s.description ILIKE '%' || $3 || '%')
         AND ($4::int IS NULL OR s.category_id = $4)
         AND ($5 = '' OR s.status = $5)
         AND ($6::int IS NULL OR s.user_id = $6)
       ORDER BY ${orderBy}
       LIMIT $7 OFFSET $8`,
      [viewerId, viewerRole, q, categoryId, status, userId, limit, offset]
    );
    return result.rows;
  },

  async count({ q = '', categoryId = null, status = '', userId = null }) {
    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM suggestions s
       WHERE ($1 = '' OR s.title ILIKE '%' || $1 || '%' OR s.description ILIKE '%' || $1 || '%')
         AND ($2::int IS NULL OR s.category_id = $2)
         AND ($3 = '' OR s.status = $3)
         AND ($4::int IS NULL OR s.user_id = $4)`,
      [q, categoryId, status, userId]
    );
    return result.rows[0].count;
  },

  async update(id, { title, description, categoryId, isAnonymous, status }) {
    const result = await query(
      `UPDATE suggestions
       SET title = $2,
           description = $3,
           category_id = $4,
           is_anonymous = $5,
           status = COALESCE($6, status),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, title, description, categoryId, isAnonymous, status || null]
    );
    return result.rows[0] || null;
  },

  async updateStatus(id, status) {
    const result = await query(
      `UPDATE suggestions
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );
    return result.rows[0] || null;
  },

  async remove(id) {
    const result = await query(
      'DELETE FROM suggestions WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0] || null;
  },

  // Retrieve all suggestions for authorized feedback exports.
  // Anonymous submissions are always labelled "Anonymous".
  // Private user IDs and email addresses are not exported.
  async exportAll() {
    const result = await query(
      `SELECT
         s.id,
         s.title,
         s.description,
         c.name AS category,
         s.status,
         s.is_anonymous,
         CASE
           WHEN s.is_anonymous THEN 'Anonymous'
           ELSE u.name
         END AS author_name,
         s.created_at,
         s.updated_at
       FROM suggestions s
       JOIN categories c ON c.id = s.category_id
       JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC`
    );

    return result.rows;
  },

  async stats() {
    const result = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'Open')::int AS open_count,
         COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress_count,
         COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved_count
       FROM suggestions`
    );
    return result.rows[0];
  },

  async statsForUser(userId) {
    const result = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'Open')::int AS open_count,
         COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress_count,
         COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved_count
       FROM suggestions
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0];
  }
};

module.exports = Suggestion;