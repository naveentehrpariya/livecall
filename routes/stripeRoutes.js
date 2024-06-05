const express = require('express');
const router = express.Router();
const { validateToken } = require('../controllers/authController');
const { subscriptionWebhook, planDetail, cancelSubscription, disable_pricing_plan, create_pricing_plan, update_pricing_plan, subscribe, pricing_plan_lists, my_subscriptions, confirmSubscription, subscriptionRenew } = require('../controllers/stripeController');
router.route('/create-pricing-plan').post(validateToken, create_pricing_plan);
router.route('/update-pricing-plan/:id').post(validateToken, update_pricing_plan);
router.route('/disable_pricing_plan/:id').get(validateToken, disable_pricing_plan);

router.route('/subscribe').post(validateToken, subscribe);

router.route('/pricing-plans').get( pricing_plan_lists)
;
router.route('/plan-detail/:id').get(planDetail);

router.route('/my-subscriptions').get(validateToken, my_subscriptions);

router.route('/update-payment-status').post(validateToken,  confirmSubscription);

router.route('/cancel-subscription').get(validateToken,  cancelSubscription);

module.exports = router;