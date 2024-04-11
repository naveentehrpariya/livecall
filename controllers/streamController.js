const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");

const activeStreams = {};
app.post('/start-stream', (req, res) => {
  
});


const start_stream = catchAsync ( async (req, res)=>{
   const { streamKey, video, audio } = req.body;
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
  child.on('close', () => {
    delete activeStreams[streamKey];
  });
  res.send('Stream started.');
});


app.post('/stop-stream', (req, res) => {
  const { streamKey } = req.body;

  const stream = activeStreams[streamKey];
  if (stream) {
    stream.kill('SIGINT'); // Sends the interrupt signal to ffmpeg, stopping the stream
    delete activeStreams[streamKey];
    res.send('Stream stopped.');
  } else {
    res.status(404).send('Stream not found.');
  }
});


module.exports = { addproducts, listProducts, productDetail, tour_stats } 