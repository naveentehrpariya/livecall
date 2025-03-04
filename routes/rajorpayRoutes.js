const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment,paymentWebhook } = require('../controllers/rajorpayController');

const { validateToken } = require('../controllers/authController');
router.route('/create-order').post(validateToken, createOrder);
router.route('/stripepaymentWebhook').post(paymentWebhook);

module.exports = router;
