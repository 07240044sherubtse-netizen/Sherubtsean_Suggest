
const express = require('express');
const superAdminController = require('../controllers/superAdminController');
const feedbackExportController = require('../controllers/feedbackExportController');
const { ensureSuperAdmin } = require('../middleware/auth');

const {
  categoryRules,
  staffRoleRules,
  createAdminRules,
  handleValidation
} = require('../middleware/validation');

const router = express.Router();

// Protect all Super Admin routes
router.use(ensureSuperAdmin);

// Super Admin dashboard
router.get('/', superAdminController.dashboard);

// Download campus feedback as Excel, CSV, PDF, or JSON
router.get(
  '/feedback/export/:format',
  feedbackExportController.exportFeedback
);

// Create an administrator
router.post(
  '/users',
  createAdminRules,
  handleValidation,
  superAdminController.createAdmin
);

// Change a user's role
router.post(
  '/users/:id/role',
  staffRoleRules,
  handleValidation,
  superAdminController.updateUserRole
);

// Activate or deactivate a user
router.post(
  '/users/:id/toggle-active',
  superAdminController.toggleUserActive
);

// Create a category
router.post(
  '/categories',
  categoryRules,
  handleValidation,
  superAdminController.createCategory
);

// Edit a category
router.post(
  '/categories/:id/edit',
  categoryRules,
  handleValidation,
  superAdminController.updateCategory
);

// Delete a category
router.post(
  '/categories/:id/delete',
  superAdminController.deleteCategory
);

module.exports = router;
