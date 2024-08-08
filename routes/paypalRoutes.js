const express = require('express');
const router = express.Router();
const { createPaypalProduct, subscribeToPlan, plansLists } = require('../controllers/paypalController');
const { validateToken } = require('../controllers/authController');

router.route('/create-paypal-product').post(validateToken, createPaypalProduct);
router.route('/subscribe-to-plan').post(subscribeToPlan);
router.route('/plansLists').get(plansLists);

module.exports = router;
