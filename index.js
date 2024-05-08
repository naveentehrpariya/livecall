const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan')
const { spawn } = require('child_process');


app.use(morgan('dev')); 
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, 
}; 
app.use(cors(corsOptions));


const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const errorHandler = require("./middlewares/errorHandler");
const AppError = require('./utils/AppError');
const Stream = require('./db/Stream');
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

const { spawn } = require('child_process');
const { validateToken } = require('./controllers/authController')
const activeStreams = {}; 
app.post('/stream/add', validateToken, async (req, res)=>{ 
    const isAlready = await Stream.findOne({streamkey: req.body.streamkey});
    if(isAlready){ 
      res.json({
        status : false,
        message: 'Stream already active.',
      });
    }
    const stream = new Stream({
      title: req.body.title,
      video: req.body.video,
      audio: req.body.audio,
      thumbnail: req.body.thumbnail,
      resolution: req.body.resolution,
      streamkey: req.body.streamkey,
      user : req.user._id
    });
    
   const savedStream = await stream.save();
   if(savedStream){
     const streamKey = req.body.streamkey;
     const video = "./video.mp4";
     const audio = req.body.audio;
     if (activeStreams[stream._id]) {
         return res.status(400).send('Stream already active.');
     }
     console.log("ffmped is gooing to 'start");
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
     activeStreams[stream._id] = child;
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
}); 



app.get('/startlive', (req, res)=>{ 

  const streamKey = '4zw0-pfpr-u7bm-yemc-5kad'
  const video = "./video.mp4"
  const audio = "https://stream.zeno.fm/ez4m4918n98uv";

  const ffmpegCommand = [
    'ffmpeg',
    '-stream_loop', '-1', // Loop video input
    '-re',
    '-i', video,
    // '-stream_loop', '-1', // Removed for output
    // '-re',
    // '-i', audio,
    '-vcodec', 'libx264',
    '-pix_fmt', 'yuv420p', // Specify pixel format
    '-maxrate', '300k', // Further reduce video bitrate
    '-bufsize', '300k',
    '-preset', 'fast', // Balance speed and quality
    '-r', '1', // Lower frame rate
    '-framerate', '1',
    '-g', '25', // Reduce keyframe interval
    '-crf', '51', // Adjust for acceptable quality  
    '-c:a', 'aac',
    '-b:a', '32k', // Reduce audio bitrate
    '-ar', '44100',
    '-threads', '0',
    '-strict', 'experimental',
    '-video_track_timescale', '100',
    '-b:v', '250k', // Further reduce video bitrate
    '-f', 'flv',
    `rtmp://a.rtmp.youtube.com/live2/${streamKey}`,
  ];

  const child = spawn(ffmpegCommand[0], ffmpegCommand.slice(1));
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

  res.send({
    status:"stream started",  
    Status :200
});
}); 


app.all('*', (req, res, next) => { 
  next(new AppError("Endpoint not found !!", 404    ));         
});

const port = 8080;
app.listen(port, ()=>{ console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });