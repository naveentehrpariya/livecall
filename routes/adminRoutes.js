const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');
const { validateToken } = require('../controllers/authController');
const { admin_stop_stream } = require('../controllers/streamController');

router.route('/users/:status').get(validateToken, admin.isAdmin, admin.users);
router.route('/user/enable-disable-user/:id').get(validateToken, admin.isAdmin,   admin.EnableDisableUser);
router.route('/dashboard').get(validateToken, admin.isAdmin, admin.dashboard);
router.route('/earnings').get(validateToken, admin.isAdmin, admin.earnings);
router.route('/streams/:type').get(validateToken, admin.isAdmin, admin.streams);
// type - pending, paid, expired, inactive
router.route('/subscriptions/:type').get(validateToken, admin.isAdmin, admin.subscriptions);
router.route('/stop-stream').get(validateToken, admin.isAdmin, admin_stop_stream);

router.route('/media/:type').get(validateToken, admin.isAdmin, admin.medias);
router.route('/readlogs').get(admin.readLogs);
router.route('/clearlog').get(admin.clearlog);
router.route('/allinquries').get(validateToken, admin.isAdmin, admin.allinquries);


module.exports = router; 
