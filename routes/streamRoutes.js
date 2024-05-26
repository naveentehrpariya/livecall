const express = require('express');
const router = express.Router();
const { start_stream, stop_stream, oauth, oauth2callback} = require('../controllers/streamController');
const { checkIsYoutubeLinked, active_stream_lists, checkUserStreamLimit } = require('../controllers/youtubeStreamController');
const { validateToken } = require('../controllers/authController');

// checkUserStreamLimit
router.route('/create-stream').post(validateToken, start_stream);

router.route('/kill-stream').post(validateToken, stop_stream); 

router.route('/my-streams').get(validateToken, active_stream_lists); 

router.route('/auth').get(validateToken, oauth);

router.route('/oauth2callback').get(validateToken, oauth2callback);

router.route('/check-youtube-link-status').get(validateToken, checkIsYoutubeLinked);

// router.route('/setlive').post(validateToken, makeStartTransitionToLive);

module.exports = router; 

