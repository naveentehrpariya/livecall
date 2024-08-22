const express = require('express');
const router = express.Router();
const { createPlan } = require('../controllers/rajorpayController');
const { validateToken } = require('../controllers/authController');

router.route('/create-plan').post(createPlan);

module.exports = router;
