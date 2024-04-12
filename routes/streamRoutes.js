const express = require('express');
const router = express.Router();
const {start_stream, stop_stream} = require('../controllers/streamController');

router.route('/create-stream').post(start_stream);

router.route('/kill-stream').post(stop_stream); 

module.exports = router; 
