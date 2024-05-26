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


const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const createAndBindLiveBroadcast = async (youtube, title) => {
  const scheduledStartTime = new Date(Date.now() + 15000).toISOString();
  
  // Step 1: Create the live broadcast
  const broadcastResponse = await youtube.liveBroadcasts.insert({
    part: 'snippet,status,contentDetails',
    requestBody: {
      snippet: {
        title: title,
        description: 'This is a test broadcast',
        scheduledStartTime: scheduledStartTime,
      },
      status: {
        privacyStatus: 'public',
      },
      contentDetails: {
        monitorStream: {
          enableMonitorStream: true,
        },
      },
    },
  });
  
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
  
  // Step 3: Introduce delay before next API call
  await delay(3000); // 1-second delay

  // Step 3: Bind the broadcast to the stream
  const bindResponse = await youtube.liveBroadcasts.bind({
    part: 'id,contentDetails',
    id: broadcastId,
    streamId: streamId,
  });
  
  return {
    broadcast: broadcastResponse.data,
    stream: streamResponse.data,
    bind: bindResponse.data,
  };
};


const startLiveBroadcast = async (auth, broadcastId) => {
  const youtube = google.youtube({ version: 'v3', auth });
  const response = await youtube.liveBroadcasts.transition({
    part: 'status',
    id: broadcastId,
    broadcastStatus: 'live',
  });
  console.log("response",response)
  return response.data;
};


let activeStreams = {};
const start_streams = catchAsync (async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { title, video, audio, thumbnail } = req.body;
    const token = await getStoredToken(userId);
    if (!token) {
      return res.status(400).json({
        status: false,
        message: 'No linked account found for this user.',
      });
    }

    // const credentials = loadClientSecrets();
    // const oAuth2Client = getOAuth2Client(credentials, redirectUri);
    // await oAuth2Client.setCredentials(token);

    // // Calculate a scheduled start time 15 seconds from now
    // const scheduledStartTime = new Date(Date.now() + 15000).toISOString();

    // // Create live broadcast
    // const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
    // const broadcastResponse = await youtube.liveBroadcasts.insert({
    //   part: 'snippet,status,contentDetails',
    //   requestBody: {
    //     snippet: {
    //       title: title,
    //       description: 'This is a test broadcast',
    //       scheduledStartTime: scheduledStartTime,
    //     },
    //     status: {
    //       privacyStatus: 'public',
    //     },
    //     contentDetails: {
    //       monitorStream: {
    //         enableMonitorStream: true,
    //       },
    //     },
    //   },
    // });
    // const broadcast = broadcastResponse.data;
    // console.log('Broadcast created:', broadcast);

    // // Create live stream
    // const liveStreamResponse = await youtube.liveStreams.insert({
    //   part: 'snippet,cdn',
    //   requestBody: {
    //     snippet: {
    //       title: title,
    //     },
    //     cdn: {
    //       ingestionType: 'rtmp',
    //       resolution: '1080p',
    //       frameRate: '30fps',
    //     },
    //   },
    // });
    // const liveStream = liveStreamResponse.data;
    // console.log('Live stream created:', liveStream);

    // // Bind broadcast to stream
    // youtube.liveBroadcasts.bind({
    //   part: 'id,contentDetails',
    //   id: broadcast.id,
    //   streamId: liveStream.id,
    // });

    // Download and set the thumbnail
    // const thumbnailPath = path.resolve(__dirname, `${title}-thumbnail.jpg`);
    // const OutputPath = path.resolve(__dirname, `${title}-output-thumbnail.jpg`);
    // await downloadThumbnail(thumbnail, thumbnailPath);
    // console.log('Thumbnail downloaded and saved:');
    // await SizeReducer(thumbnailPath, OutputPath);
    // console.log('Thumbnail resized and saved:');

    // await youtube.thumbnails.set({
    //   videoId: broadcast.id,
    //   media: {
    //     mimeType: 'image/jpeg',
    //     body: fs.createReadStream(OutputPath),
    //   },
    // });
    // console.log('Thumbnail set.');

    // await new Promise(resolve => setTimeout(resolve, 20000));
    // const transitionResponse = await youtube.liveBroadcasts.transition({
    //   part: 'status',
    //   id: broadcast.id,
    //   broadcastStatus: 'live',
    // });

    // if (transitionResponse.data.status !== 'live') {
    //   return res.status(500).json({ status: false, message: 'Failed to transition to live.' });
    // }

    // const streamUrl = `https://www.youtube.com/watch?v=${broadcast.id}`;
    // fs.unlinkSync(thumbnailPath);
    // fs.unlinkSync(OutputPath);

    const stream = new Stream({
      title: req.body.title,
      video: req.body.video,
      audio: req.body.audio,
      thumbnail: req.body.thumbnail,
      resolution: req.body.resolution || "1080p",
      stream_url: req.body.stream_url,
      streamkey: req.body.streamkey,
      user: req.user._id,
      // streamId: broadcast.id,
    });

    const savedStream = await stream.save();
    if (activeStreams[req.body.streamkey]) {
      return res.status(400).send('Stream already active.');
    }
    const { resolution, videoBitrate, maxrate, bufsize, preset, gop } = resolutionSettings[req.body.resolution];
    const ffmpegCommand = [
      'ffmpeg',
      '-stream_loop', '-1',
      '-re',
      '-i', video,
      '-vf', `scale=${resolution}`, 
      '-c:v', 'libx264', // Video codec
      '-preset', preset, // Adjust based on your latency vs. quality needs
      '-tune', 'zerolatency', // Tune for low latency
      '-pix_fmt', 'yuv420p', // Pixel format
      '-b:v', videoBitrate, // Video bitrate, adjust based on resolution
      '-maxrate', maxrate, // Max rate
      '-bufsize', bufsize, // Buffer size
      '-g', gop, // GOP size (keyframe interval)
      '-c:a', 'aac', // Audio codec
      '-b:a', '128k', // Audio bitrate
      '-ar', '44100', // Audio sampling rate
      '-strict', 'experimental', // Allow experimental codecs
      '-f', 'flv',
      `rtmp://a.rtmp.youtube.com/live2/${req.body.streamkey}`,
    ];

     const child = spawn(ffmpegCommand[0], ffmpegCommand.slice(1));
     activeStreams[req.body.streamkey] = child;

     child.on('close', () => {
       delete activeStreams[req.body.streamkey];
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

    if (!savedStream) {
      res.json({
        status: false,
        message: 'Failed to create stream.',
        savedStream: savedStream,
      });
    }
    res.json({
      status: true,
      message: 'Stream started.',
      // streamUrl: streamUrl,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});


const start_stream = catchAsync ( async (req, res, next)=>{
  try {
    // const { title, video, audio, thumbnail } = req.body;

    // const userId = req.user._id;
    // const token = await getStoredToken(userId);
    // const credentials = loadClientSecrets();
    // const oAuth2Client = getOAuth2Client(credentials, redirectUri);
    // await oAuth2Client.setCredentials(token);

    // // Create live broadcast
    // const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
    // const streamData = await createAndBindLiveBroadcast(youtube, title);
    // console.log('streamData :', streamData);

    const streamKey = req.body.streamkey;
    const stream = new Stream({
      title: req.body.title,
      video: req.body.video, 
      audio: req.body.audio,
      thumbnail: req.body.thumbnail,
      resolution: req.body.resolution,
      stream_url: req.body.stream_url,
      streamkey: req.body.streamkey,
      user : req.user._id
    });

   const savedStream = await stream.save();
   if(savedStream){
     const video = req.body.video
     if (activeStreams[streamKey]) {
         return res.status(400).send('Stream already active.');
     }

    const { resolution, videoBitrate, maxrate, bufsize, preset, gop } = resolutionSettings[req.body.resolution];
    const ffmpegCommand = [
      'ffmpeg',
      '-stream_loop', '-1',
      '-re',
      '-i', video,
      '-vf', `scale=${resolution}`, 
      '-c:v', 'libx264', // Video codec
      '-preset', preset, // Adjust based on your latency vs. quality needs
      '-tune', 'zerolatency', // Tune for low latency
      '-pix_fmt', 'yuv420p', // Pixel format
      '-b:v', videoBitrate, // Video bitrate, adjust based on resolution
      '-maxrate', maxrate, // Max rate
      '-bufsize', bufsize, // Buffer size
      '-g', gop, // GOP size (keyframe interval)
      '-c:a', 'aac', // Audio codec
      '-b:a', '128k', // Audio bitrate
      '-ar', '44100', // Audio sampling rate
      '-strict', 'experimental', // Allow experimental codecs
      '-f', 'flv',
      `rtmp://a.rtmp.youtube.com/live2/${streamKey}`,
    ];

     const child = spawn(ffmpegCommand[0], ffmpegCommand.slice(1));
     activeStreams[streamKey] = child;

     child.on('close', () => {
       delete activeStreams[streamKey];
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

      res.json({
        status : true,
        message: 'Stream started.',
        stream : savedStream
      });

   } else { 
     res.json({
       status : false,
       message: 'Failed to create stream.',
       errors : savedStream
     });
   }
  } catch (err){
    JSONerror(res, err, next);
  }
});


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

module.exports = { start_stream, stop_stream, oauth, oauth2callback } 