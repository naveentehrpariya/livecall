const express = require('express');
const router = express.Router();
const { edit_stream, edit_rtmp_stream, createPlaylist, force_start_stream, start_stream, start_rmtp_stream, stop_stream, oauth, oauth2callback} = require('../controllers/streamController');
const { streamDetails, unLinkYoutube, checkIsYoutubeLinked, active_stream_lists, checkUserStreamLimit } = require('../controllers/youtubeStreamController');
const { validateToken } = require('../controllers/authController');

router.route('/create-playlist').post(validateToken, checkUserStreamLimit, createPlaylist);
// router.route('/create-playlist').post(validateToken, createPlaylist);

router.route('/force-create-stream').post(validateToken, force_start_stream);

router.route('/create-stream').post(validateToken, start_stream);

router.route('/create-rtmp-stream').post(validateToken, start_rmtp_stream);

router.route('/kill-stream/:streamId').get(validateToken, stop_stream); 

router.route('/my-streams').get(validateToken, active_stream_lists); 

router.route('/stream/:streamId').get(validateToken, streamDetails); 

router.route('/edit-stream').post(validateToken, edit_stream); 

router.route('/edit-rtmp-stream').post(validateToken, edit_rtmp_stream); 

router.route('/auth').get(validateToken, oauth);

router.route('/oauth2callback').get(validateToken, oauth2callback);

router.route('/check-youtube-link-status').get(validateToken, checkIsYoutubeLinked);

router.route('/unLinkYoutube').get(validateToken, unLinkYoutube);

module.exports = router; 

