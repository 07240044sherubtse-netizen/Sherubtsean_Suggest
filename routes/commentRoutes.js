const express = require('express');
const commentController = require('../controllers/commentController');
const { ensureAuth } = require('../middleware/auth');
const { commentRules, handleValidation } = require('../middleware/validation');

const router = express.Router();

router.post('/:id/edit', ensureAuth, commentRules, handleValidation, commentController.update);
router.post('/:id/delete', ensureAuth, commentController.destroy);

module.exports = router;
