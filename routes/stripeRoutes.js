const express = require('express');
const router = express.Router();
const { validateToken } = require('../controllers/authController');
const { create_pricing_plan, subscribe, pricing_plan_lists, my_subscriptions, confirmSubscription } = require('../controllers/stripeController');

router.route('/create-pricing-plan').post(validateToken, create_pricing_plan);
router.route('/subscribe').post(validateToken, subscribe);
router.route('/pricing-plans').get(validateToken, pricing_plan_lists);
router.route('/my-subscriptions').get(validateToken, my_subscriptions);
router.route('/update-payment-status').post(validateToken, confirmSubscription);

module.exports = router;