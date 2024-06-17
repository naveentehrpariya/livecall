const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const fetch = require('node-fetch');

/**
 * Generates a video list file for FFmpeg concatenation.
 * @param {string[]} videos - Array of video file paths.
 * @param {string} listPath - Path where the video list file should be saved.
 */
function generateVideoList(videos, listPath) {
  const listContent = videos.map(videoPath => `file '${videoPath}'`).join('\n');
  fs.writeFileSync(listPath, listContent, 'utf8');
  console.log(`Video list created at ${listPath}`);
}

/**
 * Downloads a video from the given URL and saves it locally.
 * @param {string} url - URL of the video to download.
 * @param {string} downloadDir - Directory where the video will be saved.
 * @returns {Promise<string>} - The local path of the downloaded video.
 */
async function downloadVideo(url, downloadDir) {
  const response = await fetch(url);
  const fileName = path.basename(url);
  const filePath = path.join(downloadDir, Date.now().toString()+fileName);
  await fs.ensureDir(downloadDir);
  const fileStream = fs.createWriteStream(filePath);
  await new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
  return filePath;
}

/**
 * Creates an HLS playlist from a list of video URLs using FFmpeg.
 * @param {string[]} videoUrls - Array of video URLs.
 */
async function createHLSPlaylist(videoUrls, id) {
  const downloadDir = path.join(__dirname, '..', 'downloads');
  const videoPaths = [];
  for (const url of videoUrls) {
    const videoPath = await downloadVideo(url, downloadDir);
    videoPaths.push(videoPath);
  }

  const listName = `list-${id}-${Date.now().toString()}.txt`;
  const playlistName = `playlist-${id}-${Date.now().toString()}.m3u8`;
  const listPath = path.join(downloadDir, listName);
  const outputPath = path.join(downloadDir, playlistName);
  generateVideoList(videoPaths, listPath);
  console.log("listPath",listPath)
  console.log("outputPath",outputPath)
  const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${listPath}" -codec copy -hls_time 10 -hls_list_size 0 -f hls "${outputPath}"`;

  exec(ffmpegCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`FFmpeg stderr: ${stderr}`);
      return;
    }
    console.log(`FFmpeg stdout: ${stdout}`);
    console.log('HLS playlist created successfully.');
    return
  });
  return outputPath
}

module.exports = createHLSPlaylist;
