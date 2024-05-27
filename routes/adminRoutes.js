const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');
const { validateToken } = require('../controllers/authController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

router.route('/media/:type').get(validateToken, admin.isAdmin, cacheMiddleware, admin.medias);

router.route('/users').get(validateToken, admin.isAdmin, cacheMiddleware, admin.users);
router.route('/user/enable-disable-user/:id').get(validateToken, admin.isAdmin, cacheMiddleware,  admin.EnableDisableUser);

router.route('/streams').get(validateToken, admin.isAdmin, cacheMiddleware, admin.streams);

// type - active, expired
router.route('/subscriptions/:type').get(validateToken, admin.isAdmin, cacheMiddleware, admin.subscriptions);
router.route('/dashboard').get(validateToken, admin.isAdmin, cacheMiddleware, admin.dashboard);

module.exports = router; 
