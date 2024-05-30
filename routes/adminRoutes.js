const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');
const { validateToken } = require('../controllers/authController');

router.route('/media/:type').get(validateToken, admin.isAdmin,  admin.medias);

router.route('/users/:status').get(validateToken, admin.isAdmin,  admin.users);
router.route('/user/enable-disable-user/:id').get(validateToken, admin.isAdmin,   admin.EnableDisableUser);

router.route('/streams').get(validateToken, admin.isAdmin,  admin.streams);

// type - active, expired
router.route('/subscriptions/:type').get(validateToken, admin.isAdmin,  admin.subscriptions);
router.route('/dashboard').get(validateToken, admin.isAdmin,  admin.dashboard);

module.exports = router; 
