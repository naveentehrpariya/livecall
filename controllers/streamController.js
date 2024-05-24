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

const checkUserStreamLimit = async (req, res, next) => {
  const user = req.user._id;
  const userStreams = await Stream.find({ user: user});
  console.log("userStreams",userStreams)
  const userSubscription = await Subscription.findOne({ user: user, status: 'paid' }).populate('plan');
  console.log("userSubscription",userSubscription)
  console.log("req.user.trialStatus",req.user.trialStatus)
  if (userSubscription && userSubscription._id) {
      if ((userStreams.length+1) > userSubscription.plan.allowed_streams) {
        return res.json({
          status: false,
          message: 'You have reached your allowed stream limit. Please upgrade to higher plan.'
        });
      } else { 
        next();
      }
  } else {
    if (req.user.trialStatus === 'active') {
        if (userStreams.length > 0) {
          return res.json({
            status: false,
            message: 'You are allowed only 1 stream in free trial. Please upgrade subscription to create another stream.'
          });
        }
        next();
    } else {
      return res.json({
        status: false,
        message: "You free trial has been ended. You don't have any active subscription plan to start a live stream."
      });
    }
  }
};

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
  '1080x720': {
    resolution: '720x1080',
    videoBitrate: '3000k',
    maxrate: '4000k',
    bufsize: '5000k',
    preset: 'fast',
    gop: '60', // Keyframe interval for this unusual resolution
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
const storeToken = async (token, userId) => {
  try {
    const createToken = new Token({
      token: JSON.stringify(token),
      user: userId,
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
  try {
     const token = await Token.findOne({ user: userId });
     if(!token){
       return null;
     }
     return JSON.parse(token.token);
  } catch (err) {
    console.error('Error getting stored token:', err);
    return null;
  }
};

// Route to initiate OAuth2 flow
const oauth = async (req, res) => {
  try {
    const redirectUri = `http://localhost:8080/oauth2callback`;
    const credentials = loadClientSecrets();
    if (!credentials) {
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
    console.log("Auth URL:", authUrl);
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
    const redirectUri = `http://localhost:8080/oauth2callback`;
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

// Function to create a live broadcast and get the video ID
const createLiveBroadcast = async (auth, title) => {
  const youtube = google.youtube({ version: 'v3', auth });
  const res = await youtube.liveBroadcasts.insert({
    part: 'snippet,status,contentDetails',
    resource: {
      snippet: {
        title: title,
        scheduledStartTime: new Date().toISOString(),
      },
      status: {
        privacyStatus: 'public',
      },
      contentDetails: {
        enableAutoStart: true,
        enableAutoStop: true,
      },
    },
  });
  return res.data.id; // This is the videoId
};

const downloadThumbnail = async (url, dest) => {
  const response = await axios({
    url,
    responseType: 'stream',
  });
  return new Promise((resolve, reject) => {
    const stream = response.data.pipe(fs.createWriteStream(dest));
    stream.on('finish', () => resolve());
    stream.on('error', (err) => reject(err));
  });
};

let activeStreams = {};
const start_stream = async (req, res, next) => {
  const userId = req.user._id; 
  const { title, video, audio, thumbnail, streamkey, resolution = '1080p' } = req.body;
  try {

    // const isAlready = await Stream.findOne({streamkey: req.body.streamkey});
    // console.log(isAlready)
    // if(isAlready){ 
    //   res.json({
    //     status : false,
    //     message: 'Stream already active.',
    //   });
    // }

    const token = await getStoredToken(userId);
    if (!token) {
      return res.status(400).json({
        status: false,
        message: 'No linked account found for this user.',
      });
    }
   
    const credentials = loadClientSecrets();
    const oAuth2Client = getOAuth2Client(credentials, `http://localhost:8080/oauth2callback`);
    oAuth2Client.setCredentials(token);

    // Create a YouTube live broadcast
    const videoId = await createLiveBroadcast(oAuth2Client, title);
    console.log("videoId", videoId);
    const thumbnailPath = path.resolve(__dirname, `${title}-thumbnail.jpg`);
    await downloadThumbnail(thumbnail, thumbnailPath);

    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
    await youtube.thumbnails.set({
      videoId: videoId,
      media: {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(thumbnailPath),
      },
    });

    const streamUrl = `https://www.youtube.com/watch?v=${videoId}`;
    fs.unlinkSync(thumbnailPath);

    const stream = new Stream({
      title: req.body.title,
      video: req.body.video, // 
      audio: req.body.audio,
      thumbnail: req.body.thumbnail,
      resolution: req.body.resolution || "1080p",
      stream_url: req.body.stream_url,
      streamkey: req.body.streamkey,
      user : req.user._id,
      streamId: videoId
    });

    const savedStream = await stream.save();
    if (activeStreams[streamKey]) {
        return res.status(400).send('Stream already active.');
    }
   
    // Start ffmpeg stream
    const ffmpegCommand = [
      'ffmpeg',
      '-stream_loop', '-1',
      '-re',
      '-i', video,
      '-stream_loop', '-1',
      '-re',
      '-i', audio,
      '-vf', `scale=${resolutionSettings[resolution].resolution}`,
      '-c:v', 'libx264',
      '-preset', resolutionSettings[resolution].preset,
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p',
      '-b:v', resolutionSettings[resolution].videoBitrate,
      '-maxrate', resolutionSettings[resolution].maxrate,
      '-bufsize', resolutionSettings[resolution].bufsize,
      '-g', resolutionSettings[resolution].gop,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-strict', 'experimental',
      '-f', 'flv',
      `rtmp://a.rtmp.youtube.com/live2/${streamkey}`,
    ];

    const child = spawn(ffmpegCommand[0], ffmpegCommand.slice(1));
    activeStreams[streamkey] = child;

    child.on('close', () => {
      delete activeStreams[streamkey];
    });

    child.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    child.on('error', (err) => {
      console.error(`Child process error: ${err}`);
    });

    if(!savedStream){
      res.json({
        status: false,
        message: 'Failed to create stream.',
        savedStream: savedStream,
      });
    }
    res.json({
      status: true,
      message: 'Stream started.',
      streamUrl: streamUrl,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};


const stop_stream = catchAsync(async (req, res) => {
  const { id } = req.body;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      status: false,
      message: 'Invalid stream id',
    });
  }

  const stream = await Stream.findOne({ _id: ObjectId(id) });
  if (!stream) {
    return res.status(404).json({
      status: false,
      message: 'Stream not found',
    });
  }

  if (stream.status === '0') {
    return res.status(400).json({
      status: false,
      message: 'Stream is already stopped',
    });
  }

  stream.endedAt = Date.now();
  stream.status = '0';

  const result = await stream.save();
  if (!result) {
    return res.status(500).json({
      status: false,
      message: 'Failed to stop the stream',
    });
  }

  const active = activeStreams[stream.streamkey];
  if (!active) {
    return res.status(400).json({
      status: false,
      message: 'Stream is not currently active',
    });
  }

  delete activeStreams[stream.streamkey];
  active.kill('SIGINT');

  res.json({
    status: true,
    message: 'Stream has been stopped',
  });
});


const active_stream_lists = catchAsync ( async (req, res)=>{
  const records = await Stream.find({user: req.user._id}).populate('user').sort({createdAt: -1});
  if (records) {
    res.json({
      status : true,
      streams : records
    });
  } else {
    res.json({
      status : false,
      streams : [],
      error : records
    });
  }
});


module.exports = { start_stream, stop_stream, active_stream_lists, checkUserStreamLimit, oauth, oauth2callback } 