// const express = require('express');
// const  { spawn } = require('child_process');
// require('dotenv/config');
// const server = express();
import youtube from "youtube-live-streaming";
const streamkey = '4zw0-pfpr-u7bm-yemc-5kad'
const video = "./live.mp4"
const audio = "https://stream.zeno.fm/ez4m4918n98uv";
youtube(streamkey, video, audio); 

// server.listen(3000, () => {
//   console.log('live stream is ready')
// })


