const express = require('express');
const homeController = require('../controllers/homeController');

const router = express.Router();

router.get('/', homeController.home);
router.get('/privacy', homeController.privacy);
router.get('/terms', homeController.terms);

module.exports = router;
