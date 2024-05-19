const express = require('express');
const router = express.Router();
const { myMedia } = require('../controllers/fileController');
const { validateToken } = require('../controllers/authController');

// types = all/ images / videos / audios;
router.route('/my-media/:type').get(validateToken, myMedia);

module.exports = router; 

