const { query } = require('../config/db');

const Category = {
  async findAll() {
    const result = await query('SELECT * FROM categories ORDER BY name ASC');
    return result.rows;
  },

  async findById(id) {
    const result = await query('SELECT * FROM categories WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create({ name, description }) {
    const result = await query(
      `INSERT INTO categories (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name, description]
    );
    return result.rows[0];
  },

  async update(id, { name, description }) {
    const result = await query(
      `UPDATE categories
       SET name = $2, description = $3
       WHERE id = $1
       RETURNING *`,
      [id, name, description]
    );
    return result.rows[0] || null;
  },

  async suggestionCount(id) {
    const result = await query(
      'SELECT COUNT(*)::int AS count FROM suggestions WHERE category_id = $1',
      [id]
    );
    return result.rows[0].count;
  },

  async remove(id) {
    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  }
};

module.exports = Category;
