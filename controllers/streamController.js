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
const ffmpeg = require('fluent-ffmpeg');

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

const start_stream = catchAsync(async (req, res, next) => {
  try {
    const { title, description, audio, thumbnail } = req.body;
    const userId = req.user._id;
    console.log("userId",userId);
    const { token } = await getStoredToken(userId);
    console.log("token",token);
    const credentials = loadClientSecrets();
    const oAuth2Client = getOAuth2Client(credentials, redirectUri);
    oAuth2Client.setCredentials(token);
    console.log("Credentials:", credentials);
    
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

    const videoID = streamData.broadcast.id;
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
      status: '1',
      streamId: videoID,
    });
    
    const savedStream = await stream.save();
    if (savedStream) {
      const video = req.body.video;
      if (activeStreams[videoID]) {
        return res.status(400).send('Stream already active.');
      }
      const audio = "https://stream.zeno.fm/ez4m4918n98uv";
      const { resolution, videoBitrate, maxrate, bufsize, preset, gop } = resolutionSettings[req.body.resolution || '1080p'];
      const ffmpegCommand = [
        'ffmpeg',
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
        `rtmp://a.rtmp.youtube.com/live2/${streamKey}`,
    ];
    
    const child = spawn(ffmpegCommand[0], ffmpegCommand.slice(1));
    activeStreams[videoID] = child;
      
      child.on('close', () => {
        stopffmpegstream(videoID);
      });
      
      child.stdout.on('data', (data) => console.log(`stdout: ${data}`));
      child.stderr.on('data', (data) => console.error(`stderr: ${data}`));
      child.on('error', (err) => {
        stopffmpegstream(videoID);
        console.error(`Child process error: ${err}`);
      });
      
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
    console.error(`Stream creation error: ${err}`);
    logger(`Stream creation error: ${err}`);
    JSONerror(res, err, next);
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

cron.schedule('0 */3 * * *', async () => {
  console.log('Running scheduled task to check live stream status =>>>>>>>>>>>>>>>>');
  logger('Running scheduled task to check live stream status =>>>>>>>>>>>>>>>>');
  checkStreamStatus();
});

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











const force_start_stream = async (req, res, next) => {
  try {
      const { streamkey, audios, thumbnail, resolution, playMode } = req.body;
      let videos = req.body.videos || [];

      if (videos.length === 0) {
          return res.status(400).json({ message: 'No videos provided' });
      }

      const videoListPath = path.join(__dirname, 'video_list.txt');
      const videoListContent = videos.map(videoUrl => `file '${videoUrl}'`).join('\n');
      fs.writeFileSync(videoListPath, videoListContent);

      // Function to detect codecs of all videos
      const detectCodecs = (videoFiles) => {
          return new Promise((resolve, reject) => {
              let codecs = [];
              let promises = [];

              videoFiles.forEach((videoFile) => {
                  promises.push(new Promise((resolveInner, rejectInner) => {
                      ffmpeg.ffprobe(videoFile, (err, metadata) => {
                          if (err) {
                              console.error(`Error detecting codec for ${videoFile}: ${err.message}`);
                              codecs.push(null);
                              resolveInner();
                          } else {
                              if (metadata.streams && metadata.streams.length > 0) {
                                  let codecName = metadata.streams[0].codec_name;
                                  codecs.push(codecName);
                              } else {
                                  console.error(`No streams found for ${videoFile}`);
                                  codecs.push(null);
                              }
                              resolveInner();
                          }
                      });
                  }));
              });

              Promise.all(promises)
                  .then(() => resolve(codecs))
                  .catch((err) => reject(err));
          });
      };

      // Function to convert videos to a common codec
      const convertToCommonCodec = (videoFiles, outputDir) => {
          return new Promise((resolve, reject) => {
              let convertedFiles = [];
              let promises = [];

              videoFiles.forEach((videoFile) => {
                  let outputFileName = `${path.basename(videoFile, path.extname(videoFile))}_converted.mp4`;
                  let outputPath = path.join(outputDir, outputFileName);

                  promises.push(new Promise((resolveInner, rejectInner) => {
                      ffmpeg(videoFile)
                          .videoCodec('libx264')
                          .audioCodec('aac')
                          .on('error', (err) => {
                              console.error(`Error converting ${videoFile}: ${err.message}`);
                              resolveInner();
                          })
                          .on('end', () => {
                              console.log(`Converted ${videoFile} to ${outputPath}`);
                              convertedFiles.push(outputPath);
                              resolveInner();
                          })
                          .save(outputPath);
                  }));
              });

              Promise.all(promises)
                  .then(() => resolve(convertedFiles))
                  .catch((err) => reject(err));
          });
      };

      // Start the process
      const startStreamProcess = async () => {
          try {
              console.log(`Streaming videos: ${videos.join(', ')}`);

              // Detect codecs of all videos
              const codecs = await detectCodecs(videos);
              console.log('Detected Codecs:', codecs);

              // Check if all videos have the same codec
              const allSameCodec = codecs.every((codec, index, array) => codec === array[0]);
              if (!allSameCodec) {
                  console.log('Videos have different codecs. Converting to a common codec...');
                  const outputDir = path.join(__dirname, 'converted_videos');
                  videos = await convertToCommonCodec(videos, outputDir);
              } else {
                  console.log('All videos have the same codec.');
              }

              // FFmpeg command arguments
              const ffmpegArgs = [
                  '-protocol_whitelist', 'file,http,https,tcp,tls',
                  '-stream_loop', '-1',
                  '-f', 'concat',
                  '-safe', '0',
                  '-rw_timeout', '5000000',
                  '-i', videoListPath,
                  '-c:v', 'libx264',
                  '-preset', 'veryfast',
                  '-b:v', '6000k',
                  '-maxrate', '8000k',
                  '-bufsize', '20000k',
                  '-vf', 'scale=1920:1080',
                  '-c:a', 'aac',
                  '-b:a', '128k',
                  '-ac', '2',
                  '-ar', '44100',
                  '-f', 'flv',
                  `rtmp://a.rtmp.youtube.com/live2/${streamkey}`,
                  '-tune', 'zerolatency',
                  '-timeout', '5000000', // RTMP timeout
                  '-loglevel', 'debug'
              ];

              // Execute FFmpeg command
              const child = execFile('ffmpeg', ffmpegArgs, { detached: true });
              child.on('close', (code) => {
                  console.log(`FFmpeg process exited with code ${code}`);
              });

              // Handle FFmpeg output
              child.stdout.on('data', (data) => {
                  console.log(`stdout: ${data}`);
              });

              child.stderr.on('data', (data) => {
                  console.error(`stderr: ${data}`);
              });

              res.json({ message: 'Stream started successfully' });
          } catch (err) {
              console.error('Error starting stream:', err);
              res.status(500).json({ message: 'Failed to start stream' });
          }
      };

      // Start the streaming process
      startStreamProcess();
  } catch (err) {
      next(err); // Use the next middleware for error handling
  }
};

module.exports = { force_start_stream };


// ffmpeg -stream_loop -1 -f concat -safe 0 -i video_list.txt -c:v libx264 -preset veryfast -b:v 6000k -maxrate 8000k -bufsize 10000k -vf scale=1920:1080 -c:a aac -b:a 128k -ac 2 -ar 44100 -f flv rtmp://a.rtmp.youtube.com/live2/y96t-1k4v-t8f9-5f0z-b54y -loglevel debug



module.exports = { force_start_stream };

const shuffleOrOrderPlaylist = (videos, playMode) => {
  if (playMode === 'shuffle') {
    return videos.sort(() => Math.random() - 0.5);
  }
  return videos;
};


cron.schedule('0 * * * *', async () => {
  console.log('Running scheduled task to check live stream status and subscriptions =>>>>>>>>>>>>>>>>');
  logger('Running scheduled task to check live stream status and subscriptions =>>>>>>>>>>>>>>>>');
  // checkStreamStatusAndSubscription();
});

module.exports = { admin_stop_stream, getOAuth2Client, loadClientSecrets, force_start_stream, start_stream, stop_stream, oauth, oauth2callback } 