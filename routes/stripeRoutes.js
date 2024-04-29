const express = require('express');
const router = express.Router();
const { validateToken } = require('../controllers/authController');
const { create_pricing_plan, subscribe } = require('../controllers/stripeController');

router.route('/create-pricing-plan').post(validateToken, create_pricing_plan);
router.route('/subscribe').post(validateToken, subscribe);

module.exports = router;