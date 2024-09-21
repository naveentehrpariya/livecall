const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const downloadVideo = require('./downloadVideo');
const convertImageToVideo = require('./convertImageToVideo');

ffmpeg.setFfmpegPath(ffmpegPath);

function generateVideoList(videoPaths, listPath) {
    const listContent = videoPaths.map(videoPath => `file '${videoPath.replace(/\\/g, '\\\\')}'`).join('\n');
    fs.writeFileSync(listPath, listContent, 'utf8');
    console.log(`Video list created at ${listPath}`);
}

async function createHLSPlaylist(audioFilePaths, id, imageFilePath) {
    if (!Array.isArray(audioFilePaths)) {
        throw new Error("audioFilePaths should be an array");
    }

    const downloadDir = path.join(__dirname, '..', 'downloads');
    await fs.ensureDir(downloadDir);  // Ensure the download directory exists
    const listPath = path.join(downloadDir, `${id}-audio.txt`);
    const outputPath = path.join(downloadDir, `${id}-audioplaylist.m3u8`);

    try {
        const audioPaths = [];
        for (const url of audioFilePaths) {
            try {
                console.log("item", url);
                const videoPath = await downloadVideo(url, downloadDir, id);
                console.log("videoPath",videoPath);
                console.log(`Video is valid for streaming: ${videoPath}`);
                audioPaths.push(videoPath);
            } catch (downloadErr) {
                console.error(`Error downloading video from ${url}: ${downloadErr.message}`);
            }
        }

        // Convert image to video
        console.log("Image video path:", imageVideoPath);
        const imageVideoPath = path.join(downloadDir, `${id}-image-video.mp4`);
        const thumbvideo = await convertImageToVideo(imageFilePath, imageVideoPath);
        console.log("Converted thumb video:", thumbvideo);
        audioPaths.push(thumbvideo);

        if (audioPaths.length === 0) {
            throw new Error("No valid videos available to create HLS playlist");
        }

        generateVideoList(audioPaths, listPath);
        const ffmpegCommand = `"${ffmpegPath}" -f concat -safe 0 -i "${listPath}" -c:v copy -c:a aac -b:a 128k -hls_time 10 -hls_list_size 0 -f hls "${outputPath}"`;
        console.log("Executing FFmpeg command: ", ffmpegCommand);

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error creating HLS playlist: ${error.message}`);
                    reject(error);
                } else {
                    if (stderr) {
                        console.error(`FFmpeg stderr: ${stderr}`);
                    }
                    console.log(`FFmpeg stdout: ${stdout}`);
                    console.log(`HLS playlist-${id}.m3u8 created successfully.`);
                    resolve(outputPath);
                }
            });
        });
        return outputPath;
    } catch (err) {
        console.error(`Error processing videos: ${err.message}`);
        throw err;
    }
}

module.exports = createHLSPlaylist;
