const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const { spawn } = require('child_process');

const activeStreams = {}; 
const start_stream = catchAsync ( async (req, res)=>{
  //  const { streamKey, video, audio } = req.body;
  const streamKey = '4zw0-pfpr-u7bm-yemc-5kad'
  const video = "./video.mp4"
  const audio = "https://stream.zeno.fm/ez4m4918n98uv";
  if (activeStreams[streamKey]) {
      return res.status(400).send('Stream already active.');
  }
  console.log("ffmped is gooing to start");
  const ffmpegCommand = [
    'ffmpeg',
    '-stream_loop', '-1',
    '-re',
    '-i', video,
    '-stream_loop', '-1',
    '-re',
    '-i', audio,
    '-vcodec', 'libx264',
    '-pix_fmt', 'yuvj420p',
    '-maxrate', '2048k',
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

  child.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  child.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  child.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });

  child.on('error', (err) => {
    console.error(`Child process error: ${err}`);
  });

  child.on('close', () => {
    delete activeStreams[streamKey];
  });
  console.log("ffmped passed");
  res.json({
    status : true,
    msg: 'Stream started.'
  });

});

const stop_stream = catchAsync ( async (req, res)=>{
  // const { streamKey } = req.body;
  const streamKey = '4zw0-pfpr-u7bm-yemc-5kad'
  const stream = activeStreams[streamKey];
  if (stream) {
    stream.kill('SIGINT'); // Sends the interrupt signal to ffmpeg, stopping the stream
    delete activeStreams[streamKey];
    res.send('Stream stopped.');
  } else {
    res.status(404).send('Stream not found.');
  }
});
 
module.exports = { start_stream, stop_stream } 