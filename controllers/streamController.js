const { ObjectId } = require("mongodb");
const Stream = require("../db/Stream");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const { spawn } = require('child_process');
const JSONerror = require("../utils/jsonErrorHandler");

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

    const streamKey = req.body.streamkey;
    const audio = req.body.audio || "https://stream.zeno.fm/ez4m4918n98uv";
    const stream = new Stream({
      title: req.body.title,
      video: "./video.mp4", // req.body.video
      audio: audio,
      thumbnail: req.body.thumbnail,
      resolution: req.body.resolution,
      stream_url: req.body.stream_url,
      streamkey: req.body.streamkey,
      user : req.user._id
    });

   const savedStream = await stream.save();
   if(savedStream){
     const video = "./video.mp4"
     if (activeStreams[streamKey]) {
         return res.status(400).send('Stream already active.');
     }
     const ffmpegCommand = [
        'ffmpeg',
        '-stream_loop', '-1',
        '-re',
        '-i', video,
        '-stream_loop', '-1',
        '-re',
        '-i', audio,
        '-vcodec', 'libx264',
        '-pix_fmt', 'yuv420p', // Specify pixel format
        '-maxrate', '2048k',
        '-bufsize', '2048k',
        '-preset', 'ultrafast',
        '-r', '12',
        '-framerate', '1',
        '-g', '50',
        '-crf', '51',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-strict', 'experimental',
        '-video_track_timescale', '100',
        '-b:v', '1500k',
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

 
module.exports = { start_stream, stop_stream, active_stream_lists } 