const ffmpeg = require('fluent-ffmpeg');
const express = require('express');
const app = express();
const port = 5000


// create a function two ass two numbers





  


  


// Function to start streaming
function startStreaming() {
  const streamURL = 'YOUR_YOUTUBE_STREAM_URL'; // Replace with your YouTube Stream URL
  const streamKey = 'YOUR_YOUTUBE_STREAM_KEY'; // Replace with your YouTube Stream Key
  const videoPath = '/video.mp4'; // Path to the video you want to stream

  ffmpeg(videoPath)
    .addOptions([
      '-re',
      '-f lavfi -i anullsrc', // This adds a dummy audio track. Remove if your video has audio.
      '-c:v libx264',
      '-preset veryfast',
      '-maxrate 3000k',
      '-bufsize 6000k',
      '-pix_fmt yuv420p',
      '-g 50',
      '-c:a aac',
      '-b:a 160k',
      '-ac 2',
      '-ar 44100',
    ])
    .output(`${streamURL}/${streamKey}`)
    .on('start', () => {
      console.log('Stream started');
    })
    .on('error', (err) => {
      console.error('Streaming error:', err.message);
    })
    .on('end', () => {
      console.log('Stream ended, restarting...');
      startStreaming(); // Restart streaming once the current stream ends
    })
    .run();
}
startStreaming(); // Call the function to start streaming

app.get('/start-stream', (req, res) => {
  res.send('Streaming started in loop');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});