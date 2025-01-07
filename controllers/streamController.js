const Stream = require("../db/Stream");
const catchAsync  = require("../utils/catchAsync");
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const Token = require("../db/Token");
const axios = require("axios");
const logger = require("../utils/logger");
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
const User = require("../db/Users");
const { youtube } = require("googleapis/build/src/apis/youtube");
const sendEmail = require("../utils/Email");
const SizeReducer = require("../utils/SizeReducer");
const Pricing = require("../db/Pricing");
const CLIENT_SECRETS_FILE = 'client_secret.json';
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];

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
const createAndBindLiveBroadcast = async (youtube, title, description, res) => {
  try{
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
  } catch(err){
    res.json({
      status:false,
      message: "Your youtube token has been expired please relink youtube account.",
      error: err  
    })
  }
};

let activeStreams = {};
const stopFlags = {}; 
const stopffmpegstream = async (streamObjectID) => {
  console.log(`streamObjectID for stopping stream`, streamObjectID);  
  const child = activeStreams[streamObjectID];
  if(child){
    console.log(`stopping child ID`, streamObjectID);
    stopFlags[streamObjectID] = true;
    child.kill('SIGINT');
    delete activeStreams[streamObjectID]; 
    logger(`Ffmpeg stream stopped ${streamObjectID}`);
  }else {
    logger(`there is no any ffmpeg proccess running - ${streamObjectID}`);
  }
  return true
}
  
const stopDbStream = async (streamObjectId) => {
  try {
    const streamlast = await Stream.findById(streamObjectId);
    if (!streamlast){
      console.log("Stream not found !!");
      return false;
    }
    console.log("Found stream: " + streamlast);
    logger(`Database Stopping stream ${streamObjectId}`);
    streamlast.status = '0';
    streamlast.endedAt = Date.now();
    const savedStream = await streamlast.save();
    if (!savedStream) {
      console.log("Stream not saved.");
      return false;
    }
    console.log("Updated stream: ", savedStream);
    deleteFilesStartingWithName(streamlast.playlistId);
    return savedStream;
  } catch (error) {
    console.error("Error saving stream:", error);
    return false;
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

async function start_ffmpeg(data) {
  const allpayload = data;
  const { streamkey, audio, video, res, objectID, platformtype, stream_url } = data;
  const StreamURL =  platformtype === 'youtube' ? `rtmp://a.rtmp.youtube.com/live2/${streamkey}` : `${stream_url}/${streamkey}`;
  console.log(`Starting ffmpeg stream`, data);
  try {
    const { resolution, videoBitrate, maxrate, bufsize, preset, gop } = resolutionSettings[res || '1080p'];
    let ffmpegCommand = [
      '-loglevel', 'verbose',  // Increase logging level
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
      `rtmp://a.rtmp.youtube.com/live2/${streamkey}`,
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '2',
    ];

    if (audio && audio !== null && audio !== 'null' && audio !== '[]' && audio !== '') {
      console.log("ENTERED STREAM WITH AUDIO INPUT");
      ffmpegCommand = [
        '-loglevel', 'verbose',  // Increase logging level
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
        `${StreamURL}`
      ];
    } else {
      ffmpegCommand = [
        '-loglevel', 'verbose',  // Increase logging level
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
        `${StreamURL}`
      ];
    }

    const startFFmpegProcess = async () => {
      if (!streamkey) {
        throw new Error('Required parameters missing');
      }
      stopFlags[objectID] = false;
      const child = execFile('ffmpeg', ffmpegCommand, { detached: true }); 
      activeStreams[objectID] = child; 
      
      child.on('close', (code) => {
          console.log(`FFmpeg process exited with code ${code}`);
          logger(`code for stopped stream ${child.pid} : ${code}`);
          start_ffmpeg(allpayload);
      });
      
      child.stdout.on('data', (data) => console.log(`stdout: ${data}`));
      child.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
        if (data.includes('HTTP error 404 Not Found')) {
          console.error('The provided video URL returned a 404 error');
        }
      });
      child.on('error', (err) => {
        const lerr = `Child process error: ${err}`;
        console.error(lerr);
        logger(lerr);
        stopffmpegstream(objectID);
      });
    };
    startFFmpegProcess();
  } catch (err) {
    console.log("ffmpeg stopping error =>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", err);
  }
} 

const start_stream = catchAsync(async (req, res, next) => {
  try {
    const { title, description, audio, thumbnail, type } = req.body;
    const userId = req.user._id;
    const { token } = await getStoredToken(userId);
    const credentials = loadClientSecrets();
    const oAuth2Client = getOAuth2Client(credentials, redirectUri);
    oAuth2Client.setCredentials(token);
    logger("oAuth2Client",oAuth2Client);
    
    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
    const streamData = await createAndBindLiveBroadcast(youtube, title, description, res);
    if(!streamData){
      res.json({
        status: false, 
        streamData: streamData,
        message: "Stream details not found or unable to create stream."
      })
      return false;
    }
    const streamkey = streamData && streamData.stream.cdn.ingestionInfo.streamName;
    if (thumbnail) {
      const thumbnailPath = path.resolve(__dirname, `${title}-thumbnail.jpg`);
      const OutputPath = path.resolve(__dirname, `${title}-output-thumbnail.jpg`);
      
      const removeUploadedFile = () => {
        try {
          fs.unlinkSync(thumbnailPath); // Ensure file is not in use
          fs.unlinkSync(OutputPath);
        } catch (error) {
          console.error("Failed to delete files:", error);
        }
      }
    
      await downloadThumbnail(thumbnail, thumbnailPath);
      await SizeReducer(thumbnailPath, OutputPath);
      logger("OutputPath",OutputPath);
      await youtube.thumbnails.set({
        videoId: streamData.broadcast.id,
        media: {
          mimeType: 'image/jpeg',
          body: fs.createReadStream(OutputPath).on('close', () => {
            removeUploadedFile();
          }),
        },
      });
    }
    const videoID = streamData.broadcast.id;
    const videos = req.body.videos;
    const audios = req.body.audios;

    const stream = new Stream({
      title: req.body.title,
      video: videos && videos.length ? JSON.stringify(videos) : '', 
      audio: audios && audios.length ? JSON.stringify(audios) : '', 
      description: req.body.description,
      thumbnail: req.body.thumbnail,
      resolution: req.body.resolution,
      stream_url: req.body.stream_url,
      platformtype : req.body.platformtype || 'youtube',
      streamkey: streamkey,
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
    logger("savedStream",savedStream);

    if (savedStream) {
      const video = req.body.video;
      if (activeStreams[videoID]) {
        return res.status(400).send('Stream already active.');
      } 
      const payload = {
        streamkey : streamkey, 
        audio : audio, 
        video : video, 
        res: req.body.resolution, 
        videoID : videoID,
        objectID: savedStream._id,
        platformtype : 'youtube',
        stream_url : null
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
    logger(err);
    console.error(`Stream creation error: ${err}`);
    await deleteFilesStartingWithName(req.body.playlistId);
  }
});


const edit_stream = catchAsync(async (req, res, next) => {
  try {
    const { video, audio,
      id, description, thumbnail, resolution, stream_url, title,
      videos, audios, radio, ordered, type, playlistId,
      enableMonitorStream, enableDvr, enableContentEncryption, enableEmbed,
      enableAutoStart, enableAutoStop, broadcastStreamDelayMs
    } = req.body;

    if (!id) {
      return res.status(404).json({ status: false, message: 'Stream ID is required.' });
    }

    const userId = req.user._id;
    const stream = await Stream.findById(id);
    if (!stream) {
      return res.status(404).json({ status: false, message: 'Stream not found.' });
    }

    const { token } = await getStoredToken(userId);
    const credentials = loadClientSecrets();
    const oAuth2Client = getOAuth2Client(credentials, redirectUri);
    oAuth2Client.setCredentials(token);
    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });

    const updateResource = {
      id: stream.streamId,
      snippet: {
        title: title || stream.title,
        description: description || stream.description,
        scheduledStartTime: new Date(Date.now() + 1000).toISOString(),
      },
      contentDetails: {
        resolution: resolution || stream.resolution,
        monitorStream: {
          enableMonitorStream: enableMonitorStream !== undefined ? enableMonitorStream : false,
          broadcastStreamDelayMs: broadcastStreamDelayMs || 1000,
        },
        enableDvr: enableDvr !== undefined ? enableDvr : true,
        enableContentEncryption: enableContentEncryption !== undefined ? enableContentEncryption : false,
        enableEmbed: false,
        // enableAutoStart: stream.status === 'active' ? undefined : (enableAutoStart !== undefined ? enableAutoStart : false),
        // enableAutoStop: enableAutoStop !== undefined ? enableAutoStop : false,
        closedCaptionsType: 'closedCaptionsDisabled',
        enableLowLatency: false,
        latencyPreference: 'normal',
        projection: 'rectangular'
      },
      status: {
        streamStatus: 'active',
      },
    };

    console.log("Updating YouTube stream with resource:", updateResource);
    await youtube.liveBroadcasts.update({
      part: 'snippet,contentDetails,status',
      resource: updateResource,
    });

    if (thumbnail) {
      await handleThumbnail(thumbnail, title, youtube, streamId);
    }

    // Update local database
    stream.title = title || stream.title;
    stream.description = description || stream.description;
    stream.thumbnail = thumbnail || stream.thumbnail;
    stream.resolution = resolution || stream.resolution;
    stream.stream_url = stream_url || stream.stream_url;
    stream.updatedAt = Date.now();
    stream.video = JSON.stringify(videos) || stream.video;
    stream.audio = JSON.stringify(audios) || stream.audio;
    stream.radio = radio || stream.radio;
    stream.ordered = ordered || stream.ordered;
    stream.stream_type = type || stream.stream_type;
    stream.playlistId = playlistId || stream.playlistId;
    const updatedStream = await stream.save();

    stopffmpegstream(stream._id);
    setTimeout(() => {
      const payload = {
        streamkey : stream.streamkey, 
        audio : audio, 
        video : video, 
        res: req.body.resolution, 
        videoID : stream.streamId,
        objectID: stream._id,
        platformtype : 'youtube',
      }
      start_ffmpeg(payload);
    }, 1000);

    res.json({
      status: true,
      message: 'Stream updated successfully.',
      stream: updatedStream,
    });
  } catch (err) {
    console.error(`Stream update error: ${err}`);
    logger(err);
    JSONerror(res, err, next);
  }
});


const start_rmtp_stream = catchAsync(async (req, res, next) => {
  try {
    const videoID = req.body.streamkey;
    const isAlready = await Stream.find({ streamkey: videoID });

    if(isAlready && isAlready.length > 0){
      return res.status(200).json({
        status: false,
        isAlready : isAlready,
        message: 'Stream already created with this stream key. Please reset your stream key.',
      });
    }
    const videos = req.body.videos;
    const audios = req.body.audios;
    const stream = new Stream({
      title: req.body.title,
      video: videos && videos.length ? JSON.stringify(videos) : '', 
      audio: audios && audios.length ? JSON.stringify(audios) : '', 
      description: req.body.description,
      thumbnail: req.body.thumbnail,
      resolution: req.body.resolution,
      stream_url: req.body.stream_url,
      streamkey: req.body.streamkey,
      user: req.user._id,
      status: '1',
      platformtype : 'rtmp',
      radio : req.body.radio,
      streamId: req.body.streamkey,
      playlistId: req.body.playlistId,
      stream_type:req.body.type,
      ordered:req.body.ordered,
      createdAt: Date.now(),
    });
    
    const savedStream = await stream.save();
    if (savedStream) {
      const payload = {
        streamkey : req.body.streamkey, 
        audio : req.body.audio !== '' ? req.body.audio : false, 
        video : req.body.video !== '' ? req.body.video : false, 
        res: req.body.resolution, 
        objectID: savedStream._id,
        stream_url : req.body.stream_url,
        platformtype : 'rtmp'
      }
      console.log("payload =>>>>>>>>>>>", payload)
      await start_ffmpeg(payload);
      res.json({
        status: true,
        message: 'Stream started.',
        stream: savedStream,
        streamUrl: `${req.body.stream_url}/${req.body.streamkey}`,
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



const edit_rtmp_stream = catchAsync(async (req, res, next) => {
  try { 
    const { id, video, audio, streamkey, title, resolution, stream_url } = req.body;
    if (!id) {
      return res.status(400).json({ status: false, message: 'Stream ID is required.' });
    }
    const videos = req.body.videos;
    const audios = req.body.audios;
    const stream = await Stream.findById(id);
    if (!stream) {
      return res.status(404).json({ status: false, message: 'Stream not found.' });
    }

    stream.title = title || stream.title;
    stream.resolution = resolution || stream.resolution;
    stream.stream_url = stream_url || stream.stream_url;
    stream.video = JSON.stringify(videos) || stream.video;
    stream.audio = JSON.stringify(audios) || stream.audio;
    stream.updatedAt = Date.now();

    const updatedStream = await stream.save();
    if(video || audio){
      console.log("Stopping FFmpeg for stream ID:", stream._id);
      await stopffmpegstream(stream._id);
      const payload = {
        streamkey: streamkey || stream.streamkey,
        audio : audio, 
        video : video,
        res: stream.resolution,
        objectID: stream._id,
        stream_url: stream.stream_url, 
        platformtype: 'rtmp',
      };
      console.log("payload EDIT", payload)
      setTimeout(() => {
        start_ffmpeg(payload);
      }, 2000);
    }

    res.json({
      status: true,
      message: 'Stream updated successfully.',
      stream: updatedStream,
    });
  } catch (err) { 
    console.error(`Stream update error: ${err}`);
    logger(err);
    JSONerror(res, err, next);
  }
});


const stop_stream = async (req, res, next) => {
  try {
    const objectID  = req.params.streamId;
    if(objectID == "" || objectID == null || objectID == undefined){
      res.json({
        status : false,
        message: 'Stream ID is required.'
      });
      return false;
    }

    const stop = await stopDbStream(objectID);
    await stopffmpegstream(objectID);
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
    const activeStreams = await Stream.find({ status: 1, platformtype: 'youtube' }).populate("user");
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
      const dbstream = await Stream.findOne({ streamId: videoId });
      
      if (videoDetails && videoDetails.liveStreamingDetails && videoDetails.liveStreamingDetails.actualEndTime) {
        const message = `<html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="content-type" content="text/html; charset=utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0;">
          <meta name="format-detection" content="telephone=no" />
          <title>🚨 Your Plan Has Expired</title>
        </head>
        <body topmargin="0" rightmargin="0" bottommargin="0" leftmargin="0" marginwidth="0" marginheight="0" width="100%" style="border-collapse: collapse; border-spacing: 0;  padding: 0; width: 100%; height: 100%; -webkit-font-smoothing: antialiased; text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; line-height: 100%;
          background-color: #ffffff;
          color: #000000;" bgcolor="#ffffff" text="#000000">
          ${JSON.stringify(videoDetails)}
        </body>
        </html>`;
          await sendEmail({
            email: 'naveen@internetbusinesssolutionsindia.com',
            subject: "🚨 Live Stream Stopped",
            message
          });
          logger(`Live stream has ended for video ID: ${videoId} /n ${JSON.stringify(videoDetails)} /n via cron job status check is live on Youtube. ${stream}`);
          console.log(`Live stream has ended for video ID: ${videoId} /n ${videoDetails} /n via cron job status check is live on Youtube. ${stream}`);
          await stopDbStream(dbstream._id);
          await stopffmpegstream(dbstream._id);
      } else {  
        console.log(`Live stream is live: ${videoId}`);
      }
    }
  } catch (error) {
    console.error('Error checking live stream status:', error);
  }
};  

const youtubeStreamStatusCron = async (req, res, next) => {
  try {
    checkStreamStatus();
    return res.status(200).json({
      status: false,
      message: 'Cron has been run.',
    });
  } catch(err) {
    console.error(`Stream stop error: ${err}`);
    JSONerror(res, err, next);
  }
};



const checkStreamStatusAndSubscription = async () => {
  try {
    const activeStreams = await Stream.find({ status: 1 }).populate("user");
    logger('check all streams status if any of user has active subscription =>>>>>>>>>>>>>>>>');
    
    console.log("All activeStreams", activeStreams);

    if (activeStreams && activeStreams.length < 1) {
      console.log(`Currently there are not any live streams active.`);
      return; 
    }
    for (const stream of activeStreams) {
      const user = stream.user;
      const maxStreamsAllowed = user.streamLimit || 0;
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
const checkAvailableStreamLimit = async (req, res, next) => {
  try {
    checkStreamStatusAndSubscription();
    return res.status(200).json({
      status: false,
      message: 'Check availbale stream limit has been run.',
    });
  } catch(err) {
    console.error(`Stream stop error: ${err}`);
    JSONerror(res, err, next);
  }
};

const force_start_stream = async (req, res, next) => {
  try {
    const { streamkey, audios, thumbnail, playMode, radio, videos, resolution = '1080p' } = req.body;
    const downloadsDir = path.join(__dirname, '..', 'downloads');
    const mergedAudioPath = path.join(downloadsDir, `${'6654b7ae3f6a8fea0ffa35c5'}-merged.mp3`);
    const imageToVideoPath = path.join(downloadsDir, `${'6654b7ae3f6a8fea0ffa35c5'}-image-to-video.mp4`);
    
    const payload = {
      streamkey : 'kxfb-udcp-wjrb-pp0g-e7j6', 
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

cron.schedule('0 * * * *', async () => {
  logger('Running scheduled task to check live stream status and subscriptions =>>>>>>>>>>>>>>>>');
  // checkStreamStatusAndSubscription();
});


// Cron job to status any stream has been ended from youtube but on our system has status of running.
// Job will stop the ffmpeg process and make stream status ended
cron.schedule('0 */3 * * *', async () => {
  console.log('Running scheduled task to check live stream status =>>>>>>>>>>>>>>>>');
  if(process.env.CHECK_STREAM_STATUS === 'production') {
    checkStreamStatus();
    logger('Running scheduled task to check live stream status =>>>>>>>>>>>>>>>>');
  }
});

 
cron.schedule('0 * * * *', async () => {
  console.log('Running hourly job to remove expired plans');
  const currentDate = new Date();
  try {
    const subscriptions = await Subscription.find({endOn: { $lt: currentDate }, status: 'active'}).populate("user").populate("plan");
    const updates = subscriptions.map(async (sub) => {
      const planname = sub.plan.name;
      const message = `<html xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <meta http-equiv="content-type" content="text/html; charset=utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0;">
            <meta name="format-detection" content="telephone=no" />

            <style>
              body {
                margin: 0;
                padding: 0;
                min-width: 100%;
                width: 100% !important;
                height: 100% !important;
              }

              body,
              table,
              td,
              div,
              p,
              a {
                -webkit-font-smoothing: antialiased;
                text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
                -webkit-text-size-adjust: 100%;
                line-height: 100%;
              }

              table,
              td {
                mso-table-lspace: 0pt;
                mso-table-rspace: 0pt;
                border-collapse: collapse !important;
                border-spacing: 0;
              }

              img {
                border: 0;
                line-height: 100%;
                outline: none;
                text-decoration: none;
                -ms-interpolation-mode: bicubic;
              }

              #outlook a {
                padding: 0;
              }

              .ReadMsgBody {
                width: 100%;
              }

              .ExternalClass {
                width: 100%;
              }

              .ExternalClass,
              .ExternalClass p,
              .ExternalClass span,
              .ExternalClass font,
              .ExternalClass td,
              .ExternalClass div {
                line-height: 100%;
              }

              @media all and (min-width: 560px) {
                body {
                  margin-top: 30px;
                }
              }
              
              /* Rounded corners */
              @media all and (min-width: 560px) {
                .container {
                  border-radius: 8px;
                  -webkit-border-radius: 8px;
                  -moz-border-radius: 8px;
                  -khtml-border-radius: 8px;
                }
              }
              /* Links */
              a,
              a:hover {
                color: #127DB3;
              }

              .footer a,
              .footer a:hover {
                color: #999999;
              }
            </style>
            <title>🚨 Your Plan Has Expired</title>
          </head>

          <!-- BODY -->
          <body topmargin="0" rightmargin="0" bottommargin="0" leftmargin="0" marginwidth="0" marginheight="0" width="100%" style="border-collapse: collapse; border-spacing: 0;  padding: 0; width: 100%; height: 100%; -webkit-font-smoothing: antialiased; text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; line-height: 100%;
            background-color: #ffffff;
            color: #000000;" bgcolor="#ffffff" text="#000000">
            <table width="100%" align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; width: 100%;" class="background">
              <tr>
                <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0;" bgcolor="#ffffff">
                  <table border="0" cellpadding="0" cellspacing="0" align="center" bgcolor="#FFFFFF" width="560" style="border-collapse: collapse; border-spacing: 0; padding: 0; width: inherit;
            max-width: 560px;" class="container">
                    <tr>
                      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 24px; font-weight: bold; line-height: 130%;padding-top: 25px;color: #000000;font-family: sans-serif;" class="header">
                        <img border="0" vspace="0" hspace="0" src="https://runstream.co/logo-white.png" style="max-width: 250px;" alt="The Idea" title="Runstream" />
                      </td>
                    </tr>
                    <tr>
                      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%;
                padding-top: 25px;" class="line">
                      </td>
                    </tr>
                    <tr>
                      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 17px; font-weight: 400; line-height: 160%;
                padding-top: 25px; 
                color: #000000;
                font-family: sans-serif;" class="paragraph">
                        Hi ${sub.user.name || ""},<br> We wanted to let you know that your ${planname} plan expired today. We’re sorry to see you go, but we’re here to help you get back on track!
                      </td>
                    </tr>
                    <tr>
                      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; padding-top: 25px;padding-bottom: 5px;" class="button">
                          <table border="0" cellpadding="0" cellspacing="0" align="center" style="max-width: 240px; min-width: 120px; border-collapse: collapse; border-spacing: 0; padding: 0;">
                            <tr>
                              <td align="center" valign="middle"  >
                                <a target="_blank" style=" background-color: #df3939; padding: 12px 24px; margin: 0; text-decoration: none; border-collapse: collapse; border-spacing: 0; border-radius: 10px; -webkit-border-radius: 10px; -moz-border-radius: 10px; -khtml-border-radius: 10px;text-decoration: none;
                                  color: #FFFFFF; font-family: sans-serif; font-size: 17px; font-weight: 400; line-height: 120%;" href="https://runstream.co">
                                    Reactivate My Plan
                                </a>
                              </td>
                            </tr>
                          </table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%;
                padding-top: 25px;" class="line">
                      </td>
                    </tr>
                    <tr>
                      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 17px; font-weight: 400; line-height: 160%;
                padding-top: 20px;
                padding-bottom: 25px;
                color: #000000;
                font-family: sans-serif;" class="paragraph">
                        If you have any questions or need assistance, feel free to reach out to our support team at <a href="mailto:Support@runstream.co" target="_blank" style=" color: #4b57ff; ">support@runstream.co</a>. We’re here to help!
                      </td>
                    </tr>
                  </table>
                  <table border="0" cellpadding="0" cellspacing="0" align="center" width="560" style="border-collapse: collapse; border-spacing: 0; padding: 0; width: inherit;
            max-width: 560px;" class="wrapper">
                    <tr>
                      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 13px; font-weight: 400; line-height: 150%;
                padding-top: 20px;
                padding-bottom: 20px;
                color: #999999;
                font-family: sans-serif;" class="footer">
                        For more information <a href="https://runstream.co/contact" target="_blank" style=" color: #999999; ">contact us</a>. Our support
                        team is available to help you 24 hours a day, seven days a week.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>`; 

      // Send email notification
      await sendEmail({
        email: sub.user.email,
        subject: "🚨 Your Plan Has Expired",
        message
      });
      
      console.log(`Email sent to ${sub.user.email}`);
      sub.status = 'expired';
      await sub.save(); 
      console.log(`Subscription for ${sub.user.email} marked as inactive`);
      logger(`Subscription for ${sub.user.email} marked as inactive`);

      // Adjust user stream limits and resolutions
      const currentuser = await User.findById(sub.user._id);
      let allowedResolutions = new Set();
      let streamLimit = 0;
      let storage = 0;
      
      for (const sub of subscriptions) {
        const plan = await Pricing.findById(sub.plan);
        const rs = JSON.parse(plan.resolutions);
        streamLimit += plan.allowed_streams;
        allowedResolutions = new Set([...allowedResolutions, ...rs]);
        storage = parseInt(storage) + parseInt(plan.storage);
      }
 
      currentuser.streamLimit = streamLimit;
      currentuser.allowed_resolutions = Array.from(allowedResolutions);
      currentuser.storageLimit = storage;
      await currentuser.save();
      console.log(`Updated user ${currentuser.email} stream limit and resolutions`);

      // Check and stop excess streams
      const userActiveStreams = await Stream.find({ user: currentuser._id, status: 1 });
      let totalstream = userActiveStreams.length;

      for (const excessStream of userActiveStreams) {
        if (totalstream > streamLimit) {
          totalstream--; 
          await stopDbStream(excessStream.streamId);
          await stopffmpegstream(excessStream.streamId);
          console.log(`Stopped excess stream: ${excessStream.streamId}`); 
          logger(`Stopped excess stream: ${excessStream.streamId}`); 
        }
      }
    });
    await Promise.all(updates);
    console.log(`Processed ${subscriptions.length} users with expired plans.`);
  } catch (err) {
    console.error('Error running the cron job:', err);
  }
});


module.exports = {checkAvailableStreamLimit, youtubeStreamStatusCron, edit_rtmp_stream, start_rmtp_stream, edit_stream, createPlaylist, admin_stop_stream, getOAuth2Client, loadClientSecrets, force_start_stream, start_stream, stop_stream, oauth, oauth2callback } 

