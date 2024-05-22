const { ObjectId } = require("mongodb");
const Stream = require("../db/Stream");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const { spawn } = require('child_process');
const JSONerror = require("../utils/jsonErrorHandler");
const Subscription = require("../db/Subscription");

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

const checkUserStreamLimit = async (req, res, next) => {
  const user = req.user._id;
  const userStreams = await Stream.find({ user: user});
  const userSubscription = await Subscription.findOne({ user: user, status: 'paid' }).populate('plan');
  if (userSubscription && userSubscription._id) {
      if ((userStreams.length+1) > userSubscription.plan.allowed_streams) {
        return res.json({
          status: false,
          message: 'You have reached your allowed stream limit.Please upgrade to higher plan.'
        });
      } else { 
        next();
      }
  } else {
    if (req.user.freeTrialStatus == 'active') {
      if (userStreams.length > 0) {
        return res.json({
          status: false,
          message: 'You are allowed only 1 stream in free trial. Please upgrade subscription to create another stream.'
        });
      } else { 
        next();
      }
    } else {

    }
  }
};


let activeStreams = {}; 
const start_stream = catchAsync ( async (req, res, next)=>{
  try {

    // const isAlready = await Stream.findOne({streamkey: req.body.streamkey});
    // console.log(isAlready)
    // if(isAlready){ 
    //   res.json({
    //     status : false,
    //     message: 'Stream already active.',
    //   });
    // }
    
    const stream = new Stream({
      title: req.body.title,
      video: req.body.video, // 
      audio: req.body.audio,
      thumbnail: req.body.thumbnail,
      resolution: req.body.resolution,
      stream_url: req.body.stream_url,
      streamkey: req.body.streamkey,
      user : req.user._id
    });

   const savedStream = await stream.save();
   if(savedStream){
      const audio = req.body.audio // "./video.mp4"
      const video = req.body.video // "https://stream.zeno.fm/ez4m4918n98uv"
      const streamKey = req.body.streamkey;

     if (activeStreams[streamKey]) {
         return res.status(400).send('Stream already active.');
     }

    const { resolution, videoBitrate, maxrate, bufsize, preset, gop } = resolutionSettings[req.body.resolution];
    const ffmpegCommand = [
      'ffmpeg',
      '-stream_loop', '-1',
      '-re',
      '-i', video,
      '-stream_loop', '-1',
      '-re',
      '-i', audio,
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
 
module.exports = { start_stream, stop_stream, active_stream_lists, checkUserStreamLimit } 