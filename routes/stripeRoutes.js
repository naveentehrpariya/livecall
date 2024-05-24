const express = require('express');
const router = express.Router();
const { validateToken } = require('../controllers/authController');
const { create_pricing_plan, update_pricing_plan, subscribe, pricing_plan_lists, my_subscriptions, confirmSubscription, subscriptionRenew } = require('../controllers/stripeController');

router.route('/create-pricing-plan').post(validateToken, create_pricing_plan);
router.route('/update-pricing-plan').post(validateToken, update_pricing_plan);

router.route('/subscribe').post(validateToken, subscribe);
router.route('/pricing-plans').get( pricing_plan_lists);
router.route('/my-subscriptions').get(validateToken, my_subscriptions);
router.route('/update-payment-status').post(validateToken, confirmSubscription);
router.route('/update-subscription-renew-status').get(validateToken, subscriptionRenew);

module.exports = router;