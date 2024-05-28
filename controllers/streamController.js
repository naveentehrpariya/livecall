const crypto = require('crypto');
const { ObjectId } = require("mongodb");
const Stream = require("../db/Stream");
const catchAsync  = require("../utils/catchAsync");
const { spawn } = require('child_process');
const Subscription = require("../db/Subscription");
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');
const Token = require("../db/Token");
const axios = require("axios");
const logger = require("../utils/logger");
const SizeReducer = require("../utils/SizeReducer");
const JSONerror = require("../utils/jsonErrorHandler");
const channelDetails = require("../utils/channelDetails");
const SubscribeYouTubeNotifications = require("../utils/SubscribeYoutubeNotifications");
const YoutubeNotification = require("../db/YoutubeNotification");

const resolutionSettings = {
  '2160p': {
    resolution: '3840x2160',
    videoBitrate: '20000k',
    maxrate: '30000k',
    bufsize: '40000k',
    preset: 'slow', // Higher quality but more CPU usage
    gop: '120', // Keyframe interval for 4K (assuming 30fps, keyframe every 4 seconds)
  },
  '1080p': {
    resolution: '1920x1080',
    videoBitrate: '6000k',
    maxrate: '8000k',
    bufsize: '10000k',
    preset: 'fast', // Good balance between quality and performance
    gop: '60', // Keyframe interval for 1080p (assuming 30fps, keyframe every 2 seconds)
  },
  '720p': {
    resolution: '1280x720',
    videoBitrate: '3000k',
    maxrate: '4000k',
    bufsize: '5000k',
    preset: 'fast',
    gop: '60', // Keyframe interval for 720p
  },
  '720x1080': {
    resolution: '720x1080',
    videoBitrate: '3000k',
    maxrate: '4000k',
    bufsize: '5000k',
    preset: 'fast',
    gop: '60',
  }
};

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
const storeToken = async (token, userId, oAuth2Client) => {
  try {
    const channel = await channelDetails(token);
    console.log("channel",channel);
    const createToken = new Token({
      token: JSON.stringify(token),
      user: userId,
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
  } catch (err) {
    console.error('Error storing token:', err);
  }
};

// Get stored token
const getStoredToken = async (userId) => {
  console.log("userId", userId)
  try {
     const token = await Token.findOne({ user: userId });
     console.log("tokenff", token)
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
    console.log("OAuth2Client:", oAuth2Client);
    if (!oAuth2Client) {
      res.status(500).send('Error creating OAuth2 client');
      return;
    }
    const authUrl = generateAuthUrl(oAuth2Client);
    if (!authUrl) {
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
    console.log(`downloading thumbnail is about to finish.`);
    stream.on('finish', () => resolve());
    stream.on('error', (err) => reject(err));
  });
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const createAndBindLiveBroadcast = async (youtube, title, description) => {
  const scheduledStartTime = new Date(Date.now() + 15000).toISOString();
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
  console.log(`broadcastResponse response `, broadcastResponse);
  
  const broadcastId = broadcastResponse.data.id;
  
  // Step 2: Introduce delay before next API call
  await delay(3000); // 1-second delay

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
  const streamUrl = `https://www.youtube.com/watch?v=${streamId}`;
  console.log(`stream created `, streamUrl);
  await delay(3000);
  
  // Step 3: Bind the broadcast to the stream
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

  return {
    broadcast: broadcastResponse.data,
    stream: streamResponse.data,
    bind: bindResponse.data,
    broadcastId: broadcastId
  };
};

let activeStreams = {};

const stopffmpegstream = async (streamKey) => {
  const active = activeStreams[streamKey];
  if(active){
    delete activeStreams[streamKey];
    active.kill('SIGINT');
  }
  return true
}
  
const stopDbStream = async (streamKey) => {
  const stream = await Stream.findOne({ streamKey: streamKey });
  if (!stream){
    return {
      status: false,
      error: stream
    };
  }
  if (stream.status === '1') {
    stream.status = '0';
    stream.endedAt = Date.now();
    await stream.save();
    return {
      status: true,
      stream: stream
    }
  }
}
  
const start_stream = catchAsync(async (req, res, next) => {
  try {
    const { title, description, audio, thumbnail } = req.body;
    const userId = req.user._id;
    const { token, channel } = await getStoredToken(userId);
    
    const credentials = loadClientSecrets();
    const oAuth2Client = getOAuth2Client(credentials, redirectUri);
    oAuth2Client.setCredentials(token);
    
    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
    const streamData = await createAndBindLiveBroadcast(youtube, title, description);
    const streamKey = streamData.stream.cdn.ingestionInfo.streamName;
    
    if (thumbnail) {
      const thumbnailPath = path.resolve(__dirname, `${title}-thumbnail.jpg`);
      const OutputPath = path.resolve(__dirname, `${title}-output-thumbnail.jpg`);
      await downloadThumbnail(thumbnail, thumbnailPath);
      await SizeReducer(thumbnailPath, OutputPath);
      await youtube.thumbnails.set({
        videoId: streamData.broadcast.id,
        media: {
          mimeType: 'image/jpeg',
          body: fs.createReadStream(OutputPath),
        },
      });
      fs.unlinkSync(thumbnailPath);
      fs.unlinkSync(OutputPath);
    }

    const stream = new Stream({
      title: req.body.title,
      video: req.body.video, 
      audio: req.body.audio,
      description: req.body.description,
      thumbnail: req.body.thumbnail,
      resolution: req.body.resolution,
      stream_url: req.body.stream_url,
      streamkey: streamKey,
      user: req.user._id,
      streamId: streamData.broadcast.id,
    });
    
    const savedStream = await stream.save();
    if (savedStream) {
      const video = req.body.video;
      if (activeStreams[streamKey]) {
        return res.status(400).send('Stream already active.');
      }
      
      const audio = "https://stream.zeno.fm/ez4m4918n98uv";
      const { resolution, videoBitrate, maxrate, bufsize, preset, gop } = resolutionSettings[req.body.resolution || '1080p'];
      const ffmpegCommand = [
        'ffmpeg',
        '-stream_loop', '-1',
        '-re',
        '-i', video,
        // '-an',
        '-stream_loop', '-1',
        '-re',
        '-i', audio,
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
        `rtmp://a.rtmp.youtube.com/live2/${streamKey}`,
      ];

      const susbcribe = await SubscribeYouTubeNotifications(userId, channel.id, streamKey );
      console.log("notifications subscribed ",susbcribe);
    
      const child = spawn(ffmpegCommand[0], ffmpegCommand.slice(1));
      activeStreams[streamKey] = child;
      
      child.on('close', () => {
        stopffmpegstream(streamKey);
      });
      
      child.stdout.on('data', (data) => console.log(`stdout: ${data}`));
      child.stderr.on('data', (data) => console.error(`stderr: ${data}`));
      child.on('error', (err) => {
        stopffmpegstream(streamKey);
        console.error(`Child process error: ${err}`);
      });
      
      res.json({
        status: true,
        message: 'Stream started.',
        stream: savedStream,
        streamUrl: `https://www.youtube.com/watch?v=${streamData.broadcast.id}`,
      });

    } else {
      res.json({
        status: false,
        message: 'Failed to create stream.',
      });
    }
  } catch (err) {
    console.error(`Stream creation error: ${err}`);
    JSONerror(res, err, next);
  }
});

const force_start_stream = catchAsync ( async (req, res, next)=>{
  try {
    const streamKey = "hdkshdfskdjfhks0";
    const susbcribe = await SubscribeYouTubeNotifications(req.user._id, channel.id, streamKey );
    console.log("susbcribe",susbcribe)
    res.send('Notification subscribed !!')
  } catch (err){
    JSONerror(res, err, next);
  }
});

const stop_stream = catchAsync(async (req, res) => {
  const { streamKey } = req.body;
  stopffmpegstream(streamKey);
  const stop = stopDbStream(streamKey);
  if (stop.status === true) {
    return res.status(200).json({
      status: true,
      message: 'Live stream stopped successfully.',
    });
  } else {
    return res.status(200).json({
      status: true,
      message: 'Live stream stopped successfully.',
    });
  }
});

const notificationCallback = catchAsync( async (req, res) => {
  console.log("callback called", req.params )
  const streamKey = req.params.streamKey;
  const subscription = await YoutubeNotification.findOne({ streamKey });

  if (!subscription) {
    return res.status(404).json({
      status : false,
      message :`No youtube subscription found for this stream key ${streamKey}`
    });
  }

  const signature = req.headers['x-hub-signature'];
  console.log("req.body",req.body)
  const computedSignature = 'sha1=' + crypto.createHmac('sha1', subscription.secret).update(req.body).digest('hex');

  if (signature !== computedSignature) {
    return res.status(400).json({
      status: false,
      message: 'Invalid signature',
    });
  }

  const notification = req.body.toString();
  console.log("notification",notification)
  if (notification.includes('<yt:liveBroadcastEvent>')) {
    const eventType = notification.match(/<yt:liveBroadcastEvent type="([^"]+)">/)[1];
    console.log("eventType",eventType)
    if (eventType === 'complete') {
       console.log("STREAM COMPLETE");
       stopffmpegstream(streamKey);
       stopDbStream(streamKey);
    }
  }
  res.status(200).send('OK');
});

module.exports = { notificationCallback, getOAuth2Client, loadClientSecrets, force_start_stream, start_stream, stop_stream, oauth, oauth2callback } 