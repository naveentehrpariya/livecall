const express = require('express');
const app = express();
import { spawn } from 'child_process';
const morgan = require('morgan')
app.use(morgan('dev')); 

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const cors = require('cors');
const AppError = require('./utils/AppError');
require('./db/config');
 
// MIDDLE-WARES 
app.use(cors()); 
app.use(express.json()); 
// app.use(errorHandler);  

// ROUTES
app.use("/user", require('./routes/authRoutes'));
app.use("/product", require('./routes/productsRoutes'));
app.use("/user", require('./routes/userRoutes'));

// TEST CHECK
app.get('/', (req, res)=>{ 
    res.send({
        status:"Active",  
        Status :200
    });   
}); 
 
app.all('*', (req, res, next) => { 
    next(new AppError("Endpoint not found !!", 404    ));         
});

const activeStreams = {};
app.post('/start-stream', (req, res) => {
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

app.use(globalErrorHandler); 
const port = 8080;
app.listen(port, ()=>{ console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });