const express = require('express');
const router = express.Router();
const { validateToken } = require('../controllers/authController');
const {  admin_pricing_plan_lists, planDetail, cancelSubscription, disable_pricing_plan, create_pricing_plan, update_pricing_plan,  pricing_plan_lists, my_subscriptions } = require('../controllers/planController');
 
router.route('/create-pricing-plan').post(validateToken, create_pricing_plan);
router.route('/update-pricing-plan/:id').post(validateToken, update_pricing_plan);
router.route('/disable_pricing_plan/:id').get(validateToken, disable_pricing_plan);
router.route('/pricing-plans').get( pricing_plan_lists);
router.route('/admin-pricing-plans').get( admin_pricing_plan_lists);
router.route('/plan-detail/:id').get(planDetail);
router.route('/my-subscriptions').get(validateToken, my_subscriptions);
router.route('/cancel-subscription').get(validateToken,  cancelSubscription); 

module.exports = router; 
// router.route('/update-payment-status').post(validateToken,  confirmSubscription);
