
const express = require('express');
const adminController = require('../controllers/adminController');
const feedbackExportController = require('../controllers/feedbackExportController');
const { ensureAdmin } = require('../middleware/auth');
const {
  statusRules,
  handleValidation
} = require('../middleware/validation');

const router = express.Router();

// Protect all admin routes
router.use(ensureAdmin);

// Admin dashboard
router.get('/', adminController.dashboard);

// Download campus feedback as Excel, CSV, PDF, or JSON
router.get(
  '/feedback/export/:format',
  feedbackExportController.exportFeedback
);

// Update suggestion status
router.post(
  '/suggestions/:id/status',
  statusRules,
  handleValidation,
  adminController.updateSuggestionStatus
);

// Activate or deactivate a user
router.post(
  '/users/:id/toggle-active',
  adminController.toggleUserActive
);

module.exports = router;
