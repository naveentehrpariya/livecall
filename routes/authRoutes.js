const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateToken } = require('../controllers/authController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');
router.route('/signup').post(authController.signup);

router.route('/login').post(authController.login); 

router.route('/forgotpassword').post(authController.forgotPassword); 

router.route('/resetpassword/:token').patch(authController.resetpassword); 

router.route('/profile').get(validateToken, cacheMiddleware, authController.profile);

module.exports = router; 
