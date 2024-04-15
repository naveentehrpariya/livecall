const express = require('express');
const router = express.Router();
const { validateToken } = require('../controllers/authController');
const { create_subscription } = require('../controllers/stripeController');

router.route('/create-subscription').post(validateToken, create_subscription);
router.route('/subscribe').post(validateToken, subscribe);

module.exports = router;