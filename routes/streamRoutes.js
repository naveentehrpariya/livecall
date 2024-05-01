const express = require('express');
const router = express.Router();
const {start_stream, stop_stream, active_stream_lists} = require('../controllers/streamController');
const { validateToken } = require('../controllers/authController');

router.route('/create-stream').post(validateToken, start_stream);

router.route('/kill-stream').post(validateToken, stop_stream); 

router.route('/my-streams').get(validateToken, active_stream_lists); 

module.exports = router; 

