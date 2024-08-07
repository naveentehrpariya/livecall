const express = require('express');
const router = express.Router();
const { createPaypalProduct, execute_subscription } = require('../controllers/paypalController');
const { validateToken } = require('../controllers/authController');

router.route('/create-paypal-product').post(validateToken, createPaypalProduct);
// router.route('/execute-subscription').get(execute_subscription);

module.exports = router;
