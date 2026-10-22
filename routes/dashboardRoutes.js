const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { ensureAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', ensureAuth, dashboardController.show);

module.exports = router;
