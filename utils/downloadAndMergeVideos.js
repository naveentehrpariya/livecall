const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');``
const downloadVideo = require('./downloadVideo');
const { mergeVideos } = require('./mergeVideos');
ffmpeg.setFfmpegPath(ffmpegPath);

function isValidVideo(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error(`Invalid video: ${videoPath}`, err);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}
async function downloadAndMergeVideos(videoUrls, id) {
    const downloadDir = path.join(__dirname, '..', 'downloads');
    const outputPath = path.join(downloadDir, `${id}-merged.mp4`);
    try {
        const videoPaths = [];
        for (const url of videoUrls) {
            try {
                await isValidVideo(url);
                const videoPath = await downloadVideo(url, downloadDir, id);
                console.log("Checked is this valid url", videoPath);
                videoPaths.push(videoPath);
            } catch (downloadErr) {
                console.error(`Error downloading video from ${url}: ${downloadErr.message}`);
            }
        }
        if (videoPaths.length === 0) {
            throw new Error("No valid videos available to create HLS playlist");
        }
        await mergeVideos(videoPaths, outputPath, id);
        console.log("Merged video output", outputPath)
        return outputPath;
    } catch (err) {
      console.error(`Error processing videos: ${err.message}`);
      throw err;
    }
}
module.exports = downloadAndMergeVideos;
