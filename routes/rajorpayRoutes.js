const express = require('express');
const router = express.Router();
const { createPlan, createSubscription } = require('../controllers/rajorpayController');
const { validateToken } = require('../controllers/authController');

router.route('/create-plan').post(createPlan);
router.route('/create-subscription').post(createSubscription);

module.exports = router;
