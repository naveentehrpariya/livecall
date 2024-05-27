const express = require('express');
const router = express.Router();
const { myMedia, deleteMedia } = require('../controllers/fileController');
const { validateToken } = require('../controllers/authController');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

// types = all/ images / videos / audios;
router.route('/my-media/:type').get(validateToken, cacheMiddleware, myMedia);
router.route('/delete/media/:id').get(validateToken, deleteMedia);

module.exports = router; 

