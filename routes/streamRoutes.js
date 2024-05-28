const express = require('express');
const router = express.Router();
const { notificationCallback, force_start_stream, start_stream, stop_stream, oauth, oauth2callback} = require('../controllers/streamController');
const { unLinkYoutube, checkIsYoutubeLinked, active_stream_lists, checkUserStreamLimit } = require('../controllers/youtubeStreamController');
const { validateToken } = require('../controllers/authController');

// checkUserStreamLimit
router.route('/force-create-stream').post(validateToken, force_start_stream);

router.route('/create-stream').post(validateToken, start_stream);

router.route('/kill-stream/:streamKey').get(validateToken, stop_stream); 

router.route('/my-streams').get(validateToken, active_stream_lists); 

router.route('/auth').get(validateToken, oauth);

router.route('/oauth2callback').get(validateToken, oauth2callback);

router.route('/check-youtube-link-status').get(validateToken, checkIsYoutubeLinked);

router.route('/unLinkYoutube').get(validateToken, unLinkYoutube);

router.route('/notification/youtube/callback/:streamKey').post(notificationCallback);

router.route('/notification/youtube/callback/:streamKey').get(notificationCallback);

module.exports = router; 

