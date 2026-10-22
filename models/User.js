
const { query } = require('../config/db');

const User = {
  // Create a user. Public registration passes isVerified: false.
  // Other account-creation flows default to verified.
  async create({
    name,
    email,
    passwordHash,
    role,
    isVerified = true
  }) {
    const result = await query(
      `INSERT INTO users
         (name, email, password_hash, role, is_verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, is_active,
                 is_verified, created_at`,
      [name, email, passwordHash, role, isVerified]
    );

    return result.rows[0];
  },

  // Find a user by email.
  async findByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    return result.rows[0] || null;
  },

  // Find a user by ID.
  async findById(id) {
    const result = await query(
      `SELECT id, name, email, role, is_active,
              is_verified, created_at
       FROM users
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  },

  // Save a hashed email-verification code and its expiry.
  async createVerificationCode(userId, codeHash) {
    await query(
      `DELETE FROM email_verification_codes
       WHERE user_id = $1`,
      [userId]
    );

    await query(
      `INSERT INTO email_verification_codes
         (user_id, code_hash, expires_at, attempts, last_sent_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0, NOW())`,
      [userId, codeHash]
    );
  },

  // Retrieve the current email-verification code record.
  async getVerificationCode(userId) {
    const result = await query(
      `SELECT id, code_hash, expires_at, attempts, last_sent_at
       FROM email_verification_codes
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  },

  // Count failed email-verification attempts.
  async incrementVerificationAttempts(id) {
    await query(
      `UPDATE email_verification_codes
       SET attempts = attempts + 1
       WHERE id = $1`,
      [id]
    );
  },

  // Mark the user's email as verified and remove its code.
  async markVerified(userId) {
    await query(
      `UPDATE users
       SET is_verified = TRUE
       WHERE id = $1`,
      [userId]
    );

    await query(
      `DELETE FROM email_verification_codes
       WHERE user_id = $1`,
      [userId]
    );
  },

  // Delete an email-verification code.
  async deleteVerificationCode(userId) {
    await query(
      `DELETE FROM email_verification_codes
       WHERE user_id = $1`,
      [userId]
    );
  },

  // ==========================================
  // PASSWORD RESET FUNCTIONS
  // ==========================================

  // Save a hashed password-reset code with a 10-minute expiry.
  async createPasswordResetCode(userId, codeHash) {
    await query(
      `DELETE FROM password_reset_codes
       WHERE user_id = $1`,
      [userId]
    );

    await query(
      `INSERT INTO password_reset_codes
         (user_id, code_hash, expires_at, attempts, last_sent_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes', 0, NOW())`,
      [userId, codeHash]
    );
  },

  // Retrieve the current password-reset code record.
  async getPasswordResetCode(userId) {
    const result = await query(
      `SELECT id, user_id, code_hash, expires_at,
              attempts, last_sent_at
       FROM password_reset_codes
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  },

  // Count failed password-reset code attempts.
  async incrementPasswordResetAttempts(id) {
    await query(
      `UPDATE password_reset_codes
       SET attempts = attempts + 1
       WHERE id = $1`,
      [id]
    );
  },

  // Delete all password-reset codes belonging to a user.
  async deletePasswordResetCode(userId) {
    await query(
      `DELETE FROM password_reset_codes
       WHERE user_id = $1`,
      [userId]
    );
  },

  // Update the user's password and invalidate reset codes.
  async resetPassword(userId, passwordHash) {
    await query(
      `UPDATE users
       SET password_hash = $2
       WHERE id = $1`,
      [userId, passwordHash]
    );

    await this.deletePasswordResetCode(userId);
  },

  // ==========================================
  // EXISTING USER MANAGEMENT FUNCTIONS
  // ==========================================

  // Count all users.
  async count() {
    const result = await query(
      'SELECT COUNT(*)::int AS count FROM users'
    );

    return result.rows[0].count;
  },

  // Search users.
  async search({ q = '', limit = 20, offset = 0 }) {
    const term = `%${q}%`;

    const result = await query(
      `SELECT id, name, email, role, is_active,
              is_verified, created_at
       FROM users
       WHERE ($1 = '%%')
          OR name ILIKE $1
          OR email ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [term, limit, offset]
    );

    return result.rows;
  },

  // Count users matching a search.
  async countSearch(q = '') {
    const term = `%${q}%`;

    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE ($1 = '%%')
          OR name ILIKE $1
          OR email ILIKE $1`,
      [term]
    );

    return result.rows[0].count;
  },

  // Update a user's role.
  async updateRole(id, role) {
    const result = await query(
      `UPDATE users
       SET role = $2
       WHERE id = $1
       RETURNING id, name, email, role, is_active`,
      [id, role]
    );

    return result.rows[0] || null;
  },

  // Enable or disable a user account.
  async setActive(id, isActive) {
    const result = await query(
      `UPDATE users
       SET is_active = $2
       WHERE id = $1
       RETURNING id, name, email, role, is_active`,
      [id, isActive]
    );

    return result.rows[0] || null;
  },

  // Count users by role.
  async countByRole(role) {
    const result = await query(
      'SELECT COUNT(*)::int AS count FROM users WHERE role = $1',
      [role]
    );

    return result.rows[0].count;
  },

  // Count disabled accounts.
  async countInactive() {
    const result = await query(
      'SELECT COUNT(*)::int AS count FROM users WHERE is_active = FALSE'
    );

    return result.rows[0].count;
  },

  // Count active administrators.
  async countActiveAdmins() {
    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE role = 'admin'
         AND is_active = TRUE`
    );

    return result.rows[0].count;
  },

  // Count active super administrators.
  async countActiveSuperAdmins() {
    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE role = 'super_admin'
         AND is_active = TRUE`
    );

    return result.rows[0].count;
  }
};

module.exports = User;
