const express = require('express');
const suggestionController = require('../controllers/suggestionController');
const commentController = require('../controllers/commentController');
const { ensureAuth } = require('../middleware/auth');
const {
  suggestionRules,
  commentRules,
  handleValidation
} = require('../middleware/validation');

const router = express.Router();

router.get('/', suggestionController.index);
router.get('/new', ensureAuth, suggestionController.newForm);
router.post('/', ensureAuth, suggestionRules, handleValidation, suggestionController.create);
router.get('/:id/edit', ensureAuth, suggestionController.editForm);
router.post('/:id/edit', ensureAuth, suggestionRules, handleValidation, suggestionController.update);
router.post('/:id/delete', ensureAuth, suggestionController.destroy);
router.post('/:id/upvote', ensureAuth, suggestionController.upvote);
router.post('/:id/comments', ensureAuth, commentRules, handleValidation, commentController.create);
router.get('/:id', suggestionController.show);

module.exports = router;
