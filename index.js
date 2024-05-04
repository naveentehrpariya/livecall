const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan')
app.use(morgan('dev')); 
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, 
}; 
app.use(cors(corsOptions));
const { spawn } = require('child_process');


const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const errorHandler = require("./middlewares/errorHandler");
const AppError = require('./utils/AppError');
require('./db/config');
 
app.use(express.json()); 
app.use(errorHandler);  
app.use(globalErrorHandler); 

// ROUTES
app.use("/user", require('./routes/authRoutes'));
app.use("/product", require('./routes/productsRoutes'));
app.use("/user", require('./routes/userRoutes'));

app.use("", require('./routes/streamRoutes'));

app.use("", require('./routes/stripeRoutes'));

 
app.get('/', (req, res)=>{ 
  res.send({
      status:"Active",  
      Status :200
  });   
}); 


app.get('/startlive', (req, res) => {

  const streamKey = '4zw0-pfpr-u7bm-yemc-5kad';
  const video = "./video.mp4";
  const audio = "https://stream.zeno.fm/ez4m4918n98uv";

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
    // '-maxrate', '2048k', // Reduce bitrate significantly
    // '-bufsize', '2048k',
    '-preset', 'veryfast', // Balance speed and quality
    '-r', '12',
    '-framerate', '1',
    '-g', '50',
    '-crf', '51', // Adjust for acceptable quality
    '-c:a', 'aac',
    '-b:a', '64k', // Reduce audio bitrate
    '-ar', '44100',
    '-strict', 'experimental',
    '-video_track_timescale', '100',
    '-b:v', '500k', // Reduce video bitrate significantly
    '-f', 'flv',
    `rtmp://a.rtmp.youtube.com/live2/${streamKey}`,
  ];

  const child = spawn(ffmpegCommand[0], ffmpegCommand.slice(1));
  // ... rest of your code remains the same
});



app.all('*', (req, res, next) => { 
  next(new AppError("Endpoint not found !!", 404    ));         
});

const port = 8080;
app.listen(port, ()=>{ console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });