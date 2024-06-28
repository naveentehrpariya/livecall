const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateToken } = require('../controllers/authController');

router.route('/signup').post(authController.signup);
router.route('/login').post(authController.login); 
router.route('/forgotpassword').post(authController.forgotPassword); 
router.route('/resetpassword/:token').patch(authController.resetpassword); 
router.route('/profile').get(validateToken, authController.profile);
router.route('/contact_us').post(validateToken, authController.contact_us);
router.route('/sendVerifyEmail').get(validateToken, authController.sendVerifyEmail);
router.route('/verifymail/:token').get(validateToken, authController.verifymail);

module.exports = router;