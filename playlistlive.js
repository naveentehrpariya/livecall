const youtubeStreamKey = "p7m0-bxyj-msrj-8h2f-5ffb"; // Replace with your actual YouTube stream key
const playlistFile = "playlist.txt";  
const { exec } = require('child_process');
const readline = require('readline');
const fs = require('fs');

 

function streamVideo(videoUrl, streamKey, callback) {
  const ffmpegCommand = `ffmpeg -re -i "${videoUrl}" -c:v libx264 -preset fast -maxrate 4500k -bufsize 9000k -pix_fmt yuv420p -g 50 -c:a aac -b:a 128k -ar 44100 -f flv "rtmp://a.rtmp.youtube.com/live2/${streamKey}"`;

  const ffmpegProcess = exec(ffmpegCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing FFmpeg: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`FFmpeg stderr: ${stderr}`);
    }
    if (stdout) {
      console.log(`FFmpeg stdout: ${stdout}`);
    }
    callback();
  });

  ffmpegProcess.on('exit', (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
  });
}

function streamPlaylist(playlistFile, streamKey) {
  const fileStream = fs.createReadStream(playlistFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const videoUrls = [];

  rl.on('line', (line) => {
    const videoUrl = line.trim();
    if (videoUrl) {
      videoUrls.push(videoUrl);
    }
  });

  rl.on('close', () => {
    let index = 0;

    const streamNext = () => {
      if (index < videoUrls.length) {
        const videoUrl = videoUrls[index];
        console.log(`Streaming video: ${videoUrl}`);
        streamVideo(videoUrl, streamKey, () => {
          index++;
          streamNext();
        });
      } else {
        console.log("All videos in the playlist have been streamed.");
      }
    };

    streamNext();
  });
}

streamPlaylist(playlistFile, youtubeStreamKey);
