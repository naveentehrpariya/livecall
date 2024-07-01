const Stream = require("../db/Stream");
const catchAsync  = require("../utils/catchAsync");
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const Token = require("../db/Token");
const axios = require("axios");
const logger = require("../utils/logger");
const SizeReducer = require("../utils/SizeReducer");
const JSONerror = require("../utils/jsonErrorHandler");
const channelDetails = require("../utils/channelDetails");
const cron = require('node-cron');
const Subscription = require("../db/Subscription");
const API_KEY = process.env.YOUTUBE_API_KEY
const { execFile } = require('child_process');
const resolutionSettings = require("../utils/resolutionSettings"); // Adjusted resolutionSettings
const downloadAndMergeVideos = require("../utils/downloadAndMergeVideos");
const downloadAndMergeAudios = require("../utils/downloadAndMergeAudios");
const deleteFilesStartingWithName = require("../utils/deleteFilesStartingWithName");
const convertImageToVideo = require("../utils/convertImageToVideo");
const CLIENT_SECRETS_FILE = 'client_secret.json';
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];


// Load client secrets from a local file
const loadClientSecrets = () => {
  try {
    const content = fs.readFileSync(CLIENT_SECRETS_FILE);
    return JSON.parse(content);
  } catch (err) {
    console.error('Error loading client secrets:', err);
    return null;
  }
};

// Get OAuth2 client
const getOAuth2Client = (credentials, redirectUri) => {
  try {
    const { client_secret, client_id } = credentials.web;
    return new google.auth.OAuth2(client_id, client_secret, redirectUri);
  } catch (err) {
    console.error('Error creating OAuth2 client:', err);
    logger(`Error creating OAuth2 client:${err}`);
    return null;
  }
};

// Generate auth URL
const generateAuthUrl = (oAuth2Client) => {
  try {
    return oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
  } catch (err) {
    console.error('Error generating auth URL:', err);
    return null;
  }
};

// Store tokens
const storeToken = async (token, userId) => {
  try {
    const channel = await channelDetails(token);
    const isAlreadyExist = await Token.findOne({ user: userId });
    if (isAlreadyExist) {
      isAlreadyExist.token = JSON.stringify(token);
      isAlreadyExist.channel = JSON.stringify(channel);
      isAlreadyExist.status = "active"
      const saved = await isAlreadyExist.save();
      if (saved) {
        console.log('Token updated successfully:', token);
      }
    } else {
      const createToken = new Token({
        token: JSON.stringify(token),
        user: userId,
        status: "active",
        channel:JSON.stringify(channel)
      });
      const savetoken = await createToken.save();
      logger(`New token created successfully: ${savetoken}`);
      if(!savetoken){
        res.json({
          status:false,
          message:"Failed to save token."
        });
      }
      console.log('Token stored successfully:', token);
    }
  } catch (err) {
    console.error('Error storing token:', err);
  }
};

// Get stored token
const getStoredToken = async (userId) => {
  try {
     const token = await Token.findOne({ user: userId, status:"active" });
    console.log(token);
     if(!token){
       return null;
     }
     return {
      token : JSON.parse(token.token),
      channel : JSON.parse(token.channel)
     } 
  } catch (err) {
    console.error('Error getting stored token:', err);
    return null;
  }
};

// Route to initiate OAuth2 flow
const redirectUri = process.env.DOMAIN_URL+"/oauth2callback";
const oauth = async (req, res) => {
  try {
    const credentials = loadClientSecrets();
    if (!credentials){
      res.status(500).send('Error loading client secrets');
      return;
    }
    const oAuth2Client = getOAuth2Client(credentials, redirectUri);
    if (!oAuth2Client) {
      res.status(500).send('Error creating OAuth2 client');
      return;
    }
    const authUrl = generateAuthUrl(oAuth2Client);
    if (!authUrl) {
      logger(`Youtube autorization errror !!. ${authUrl}`);
      res.json({
        status:false,
        message: "Error generating auth URL",
        error : authUrl
      })
    }
    res.json({
      status:true,
      url: authUrl
    })
  } catch (err) {
    console.error('Error in OAuth route:', err);
    res.status(500).send('Internal server error');
  }
};

// OAuth2 callback route
const oauth2callback = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("userId",userId)
    const code = req.query.code;
    const credentials = loadClientSecrets();
    console.log("Credentials:", credentials);
    if (!credentials) {
      res.status(500).send('Error loading client secrets');
      return;
    }
    const oAuth2Client = getOAuth2Client(credentials, redirectUri);
    if (!oAuth2Client) {
      res.status(500).send('Error creating OAuth2 client');
      return;
    }
    const { tokens } = await oAuth2Client.getToken(code);
    console.log("Tokens:", tokens);
    oAuth2Client.setCredentials(tokens);
    storeToken(tokens, userId);
    res.json({
      status: true, 
      message: 'Authorization successful!!'
    });
  } catch (err) {
    res.status(500).json({
      status:false,
      err : err,
      message:'Internal server error'
    });
  }
};

const downloadThumbnail = async (url, dest) => {
  const response = await axios({url, responseType: 'stream',});
  console.log(`downloading thumbnail`);
  return new Promise((resolve, reject) => {
    const stream = response.data.pipe(fs.createWriteStream(dest));
    logger(`downloading thumbnail is about to finish.`);
    stream.on('finish', () => resolve());
    stream.on('error', (err) => reject(err));
  });
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const createAndBindLiveBroadcast = async (youtube, title, description) => {
  const scheduledStartTime = new Date(Date.now() + 15000).toISOString();
  console.log(`scheduledStartTime `, scheduledStartTime);
  const broadcastResponse = await youtube.liveBroadcasts.insert({
    part: 'snippet,status,contentDetails',
    requestBody: {
      snippet: {
        title: title,
        description: description,
        scheduledStartTime: scheduledStartTime,
      },
      status: {
        privacyStatus: 'public',
      },
      contentDetails: {
        monitorStream: {
          enableMonitorStream: true,
        },
        enableAutoStart: true,
        enableAutoStop: true,
      },
    },
  });

  console.log(`broadcastResponse `, broadcastResponse);
  logger(broadcastResponse);
  const broadcastId = broadcastResponse.data.id;
  
  // Step 2: Introduce delay before next API call
  await delay(3000); 

  // Step 2: Create the live stream
  const streamResponse = await youtube.liveStreams.insert({
    part: 'snippet,cdn',
    requestBody: {
      snippet: {
        title: title,
      },
      cdn: {
        ingestionType: 'rtmp',
        resolution: '1080p',
        frameRate: '30fps',
      },
    },
  });
  const streamId = streamResponse.data.id;
  console.log(`stream created `, streamId);
  logger(`stream created `, streamId);
  await delay(3000);
  const bindResponse = await youtube.liveBroadcasts.bind({
    part: 'id,contentDetails',
    id: broadcastId,
    streamId: streamId,
  });
  console.log(`stream broadcast or live stream created `, {
    broadcast: broadcastResponse.data,
    stream: streamResponse.data,
    bind: bindResponse.data,
    broadcastId: broadcastId
  });
  const result = {
    broadcast: broadcastResponse.data,
    stream: streamResponse.data,
    bind: bindResponse.data,
    broadcastId: broadcastId
  }
  logger(result);
  return result ;
};

let activeStreams = {};
const stopffmpegstream = async (videoid) => {
  const active = activeStreams[videoid];
  if(active){
    delete activeStreams[videoid];
    active.kill('SIGINT');
  }
  logger(`Ffmpeg stream stopped ${videoid}`);
  return true
}
  
const stopDbStream = async (videoId) => {
  const stream = await Stream.findOne({ streamId: videoId });
  if (!stream){
    return false
  }
  logger(`Database Stopping stream ${videoId}`);
  stream.status = 0;
  stream.endedAt = Date.now();
  const savedstream = await stream.save();
  return savedstream;
}

async function start_ffmpeg(data) {
  const { streamKey, audio, video, res, videoID } = data
  console.log("ffmpeg data",data)
  logger(`Starting ffmpeg stream ${data}`);
  try {
    const { resolution, videoBitrate, maxrate, bufsize, preset, gop } = resolutionSettings[res || '1080p'];
    
    let ffmpegCommand = [
      '-re',
      '-stream_loop', '-1',
      '-i', video,
      '-vf', `scale=${resolution}`,
      '-c:v', 'libx264',
      '-preset', preset,
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p',
      '-b:v', videoBitrate,
      '-maxrate', maxrate,
      '-bufsize', bufsize,
      '-r', '30',
      '-g', gop,
      '-use_wallclock_as_timestamps', '1',
      '-err_detect', 'ignore_err',
      '-avoid_negative_ts', 'make_zero',
      '-strict', '-2',
      '-f', 'flv',
      `rtmp://a.rtmp.youtube.com/live2/${streamKey}`
    ];

    if (audio && audio !== null && audio !== '') {
      console.log("ENTERED STREAM WITH AUDIO INPUT`);")
      ffmpegCommand = [
        '-re',
        '-stream_loop', '-1',
        '-i', audio, 
        '-stream_loop', '-1',
        '-i', video,  
        '-vf', `scale=${resolution}`,
        '-c:v', 'libx264',
        '-preset', preset,
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        '-b:v', videoBitrate,
        '-maxrate', maxrate,
        '-bufsize', bufsize,
        '-r', '30',
        '-g', gop,
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-map', '1:v', 
        '-map', '0:a',
        '-use_wallclock_as_timestamps', '1',
        '-err_detect', 'ignore_err',
        '-avoid_negative_ts', 'make_zero',
        '-strict', '-2',
        '-f', 'flv',
        `rtmp://a.rtmp.youtube.com/live2/${streamKey}`
      ];
    } else {
      ffmpegCommand = [
      '-stream_loop', '-1',
      '-re',
      '-i', video,
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-vf', `scale=${resolution}`, 
      '-c:v', 'libx264',
      '-preset', preset,
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p',
      '-b:v', videoBitrate,
      '-maxrate', maxrate,
      '-bufsize', bufsize,
      '-g', gop,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-strict', 'experimental',
      '-f', 'flv',
      `rtmp://a.rtmp.youtube.com/live2/${streamKey}`]
      // ffmpegCommand.splice(ffmpegCommand.indexOf('-strict'), 0, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
    }
    const startFFmpegProcess = () => {
      if (!streamKey) {
        throw new Error('Required parameters missing');
      }
      const child = execFile('ffmpeg', ffmpegCommand, { detached: true });
      activeStreams[videoID] = child;
      child.on('close', (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
        stopffmpegstream(videoID);
        // if (code !== 0) {
        //   console.error('FFmpeg process exited unexpectedly, restarting...');
        //   setTimeout(startFFmpegProcess, 5000);
        // }
      });
      child.stdout.on('data', (data) => console.log(`stdout: ${data}`));
      child.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
        if (data.includes('HTTP error 404 Not Found')) {
          console.error('The provided video URL returned a 404 error');
        }
      });
      child.on('error', (err) => {
        console.error(`Child process error: ${err}`);
        stopffmpegstream(videoID);
        throw err;
      });
    };
    startFFmpegProcess();
  } catch (err) {
    console.log("ffmpeg stopping error =>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",err);
  }
};

const start_stream = catchAsync(async (req, res, next) => {
  try {
    const { title, description, audio, thumbnail, type } = req.body;
    const userId = req.user._id;
    const { token } = await getStoredToken(userId);
    console.log("token",token);
    const credentials = loadClientSecrets();
    const oAuth2Client = getOAuth2Client(credentials, redirectUri);
    oAuth2Client.setCredentials(token);
    
    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
    const streamData = await createAndBindLiveBroadcast(youtube, title, description);
    const streamKey = streamData.stream.cdn.ingestionInfo.streamName;
    
    // if (thumbnail) {
    //   const thumbnailPath = path.resolve(__dirname, `${title}-thumbnail.jpg`);
    //   const OutputPath = path.resolve(__dirname, `${title}-output-thumbnail.jpg`);
    //   await downloadThumbnail(thumbnail, thumbnailPath);
    //   await SizeReducer(thumbnailPath, OutputPath);
    //   await youtube.thumbnails.set({
    //     videoId: streamData.broadcast.id,
    //     media: {
    //       mimeType: 'image/jpeg',
    //       body: fs.createReadStream(OutputPath),
    //     },
    //   });
    //   fs.unlinkSync(thumbnailPath);
    //   fs.unlinkSync(OutputPath);
    // }

    const videoID = streamData.broadcast.id;
    const stream = new Stream({
      title: req.body.title,
      video: JSON.stringify(req.body.videos), 
      audio: JSON.stringify(req.body.audios),
      description: req.body.description,
      thumbnail: req.body.thumbnail,
      resolution: req.body.resolution,
      stream_url: req.body.stream_url,
      streamKey: streamKey,
      user: req.user._id,
      status: '1',
      radio : req.body.radio,
      streamId: videoID,
      playlistId: req.body.playlistId,
      stream_type:type,
      ordered:req.body.ordered,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    const savedStream = await stream.save();
    if (savedStream) {
      const video = req.body.video;
      if (activeStreams[videoID]) {
        return res.status(400).send('Stream already active.');
      } 
      const payload = {
        streamKey : streamKey, 
        audio : audio, 
        video : video, 
        res: req.body.resolution, 
        videoID : videoID
      }
      await start_ffmpeg(payload);
      res.json({
        status: true,
        message: 'Stream started.',
        stream: savedStream,
        streamUrl: `https://www.youtube.com/watch?v=${videoID}`,
      });
    } else {
      res.json({
        status: false,
        message: 'Failed to create stream.',
      });
    }
  } catch (err) {
    JSONerror(res, err, next);
    console.error(`Stream creation error: ${err}`);
    logger(err);
    await deleteFilesStartingWithName(req.body.playlistId);
  }
});

const stop_stream = async (req, res, next) => {
  try {
    const streamId  = req.params.streamId;
    if(streamId == "" || streamId == null || streamId == undefined){
      res.json({
        status : false,
        message: 'Stream ID is required.'
      });
      return false;
    }

    const stop = await stopDbStream(streamId);
    await stopffmpegstream(streamId);
    console.log("stop",stop)
    if(stop){
      return res.status(200).json({
        status: true,
        message: 'Live stream stopped successfully.',
        stream : stop
      });
    } else {
      return res.status(200).json({
        status: false,
        message: 'Failed to stop live stream.',
        stream : stop
      });
    }
  } catch(err) {
    console.error(`Stream stop error: ${err}`);
    JSONerror(res, err, next);
  }
};

const admin_stop_stream = async (req, res, next) => {
  try {
    const streamId  = req.params.streamId;
    if(streamId == "" || streamId == null || streamId == undefined){
      res.json({
        status : false,
        message: 'Stream ID is required.'
      });
      return false;
    }
    const stop = await stopDbStream(streamId);
    await stopffmpegstream(streamId);
    if(stop){
      return res.status(200).json({
        status: true,
        message: 'Live stream stopped successfully.',
        stream : stop
      });
    } else {
      return res.status(200).json({
        status: false,
        message: 'Failed to stop live stream.',
        stream : stop
      });
    }
  } catch(err) {
    console.error(`Stream stop error: ${err}`);
    JSONerror(res, err, next);
  }
};

const checkStreamStatus = async () => {
  try {
    const activeStreams = await Stream.find({ status: 1 });
    logger("Youtube status checker is running to check is any stream is live on Youtube or not.");
    if (activeStreams && activeStreams.length < 1) {
      console.log(`Currently there are not any live streams active.`);
    }
    for (const stream of activeStreams) {
      const videoId = stream.streamId;
      const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'snippet,liveStreamingDetails',
          id: videoId,
          key: API_KEY,
        },
      });
      if (response.data.items.length === 0) {
        console.log(`No video found for video ID: ${videoId}`);
        continue;
      }
      const videoDetails = response.data.items[0];
      console.log("videoDetails", videoDetails);
      if (videoDetails && videoDetails.liveStreamingDetails && videoDetails.liveStreamingDetails.actualEndTime) {
        logger(`Live stream has ended for video ID: ${videoId} via cron job status check is live on Youtube. ??`);
        await stopDbStream(videoId);
        await stopffmpegstream(videoId);
      } else { 
        console.log(`Live stream is live: ${videoId}`);
      }
    }
  } catch (error) {
    console.error('Error checking live stream status:', error);
  }
};


const checkStreamStatusAndSubscription = async () => {
  try {
    const activeStreams = await Stream.find({ status: 1 }).populate("user");
    logger('check all streams status if any of user has active subscription =>>>>>>>>>>>>>>>>');
    if (activeStreams && activeStreams.length < 1) {
      console.log(`Currently there are not any live streams active.`);
      return;
    }
    for (const stream of activeStreams) {
      const user = stream.user;
      const userSubscription = await Subscription.findOne({ user: user, status: 'paid' }).populate("plan");
      if (!userSubscription) {
        console.log(`User ${user} does not have an active subscription.`);
        logger(`User ${user} does not have an active subscription.`);
        continue;
      }
      const maxStreamsAllowed = userSubscription && userSubscription.plan && userSubscription.plan.allowed_streams || 0;
      const userActiveStreams = await Stream.find({ user: user, status: 1 });
      if (userActiveStreams.length >= maxStreamsAllowed) {
        console.log(`User ${user} has reached the maximum allowed live streams (${maxStreamsAllowed}).`);
        logger(`User ${user} has reached the maximum allowed live streams (${maxStreamsAllowed}).`);
        const excessStreams = userActiveStreams.slice(maxStreamsAllowed);
        for (const excessStream of excessStreams) {
          logger(`Stopping excess stream: ${excessStream.streamId}`);
          await stopDbStream(excessStream.streamId);
          await stopffmpegstream(excessStream.streamId);
        }
        continue;
      }
    }
  } catch (error) {
    console.error('Error checking live stream status and subscription:', error);
  }
};
 
const createPlaylist = catchAsync (async (req, res, next) => {
  const playlistId = Date.now().toString();
  try {
    const { audios, videos, radio, thumbnail, type, loop  } = req.body;
    let videoPath = null;
    let audiosPath = null;
    if(type == 'video'){
      console.log('Processing video type');
      if(videos && videos.length > 1){
        videoPath = await downloadAndMergeVideos(videos, playlistId);
        console.log('Merged video created:', videoPath);
      } else {
        videoPath = videos[0];
        console.log('Single video created:', videoPath);
      }
      if(radio){
        audiosPath = radio;
      } else {
        if(audios && audios.length > 0){
          console.log('Processing audio for video');
          if(audios && audios.length > 1){
            audiosPath = await downloadAndMergeAudios(audios, playlistId, loop);
          } else{
            audiosPath = audios[0];
          } 
          console.log('Video audio created:', audiosPath);
        } 
      }
    }

    if(type == 'image'){
      console.log('Processing GIF type');
      if(thumbnail){
        const downloadDir = path.join(__dirname, '..', 'downloads');
        const imageVideoPath = path.join(downloadDir, `${playlistId}-image-to-video.mp4`);
        const thumbvideo = await convertImageToVideo(thumbnail, imageVideoPath, playlistId);
        videoPath = thumbvideo;
        console.log('GIF video created:', videoPath);
      }
      if(radio){
        audiosPath = radio;
      } else {
        if(audios && audios.length > 0){
          console.log('Processing audio for GIF');
          if(audios && audios.length > 1){
            audiosPath = await downloadAndMergeAudios(audios, playlistId);
          } else{
            audiosPath = audios[0];
          } 
          console.log('GIF audio created:', audiosPath);
        } 
      }
    }
   
    console.log('Playlist created successfully:', { 
      message: 'Video playlist created successfully.',
      audio : audiosPath,
      video : videoPath,
      playlistId:playlistId
    });

    res.json({ 
      status:true,
      message: 'Video playlist created successfully.',
      audio : audiosPath,
      video : videoPath,
      playlistId:playlistId
    });

  } catch (err) {
    console.error('Error creating playlist:', err);
    await deleteFilesStartingWithName(playlistId);
    next(err);
  }
});

const force_start_stream = async (req, res, next) => {
  try {
    const { streamKey, audios, thumbnail, playMode, radio, videos, resolution = '1080p' } = req.body;
    const downloadsDir = path.join(__dirname, '..', 'downloads');
    const mergedAudioPath = path.join(downloadsDir, `${'6654b7ae3f6a8fea0ffa35c5'}-merged.mp3`);
    const imageToVideoPath = path.join(downloadsDir, `${'6654b7ae3f6a8fea0ffa35c5'}-image-to-video.mp4`);
    
    const payload = {
      streamKey : 'kxfb-udcp-wjrb-pp0g-e7j6', 
      audio : "/Users/naveentehrpariya/Work/upstream/livecall/downloads/1719331616657-merged.mp3", 
      video : 'https://runstream.b-cdn.net/1719331574146-6727e20eeb3bc0cf5f44fce044a733a4-doctor-video.mp4', 
      res: resolution || "1080p", 
      videoID : null
    }
    await start_ffmpeg(payload);
    res.json({ message: 'Stream started successfully' });
  } catch (error) {
    next(error);
  }
};
  

cron.schedule('0 */3 * * *', async () => {
  console.log('Running scheduled task to check live stream status =>>>>>>>>>>>>>>>>');
  logger('Running scheduled task to check live stream status =>>>>>>>>>>>>>>>>');
  checkStreamStatus();
});

cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled task to check live stream status and subscriptions =>>>>>>>>>>>>>>>>');
  logger('Running scheduled task to check live stream status and subscriptions =>>>>>>>>>>>>>>>>');
  // checkStreamStatusAndSubscription();
});
module.exports = { createPlaylist, admin_stop_stream, getOAuth2Client, loadClientSecrets, force_start_stream, start_stream, stop_stream, oauth, oauth2callback } 
// "videos": [
//   "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
//   "https://www.shutterstock.com/shutterstock/videos/1093044355/preview/stock-footage-generic-d-car-crash-test-car-destruction-realistic-animation-d-illustration.webm"
// ],


