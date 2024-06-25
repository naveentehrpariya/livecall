const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');``
const downloadVideo = require('./downloadVideo');
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

function mergeAudioFiles(inputFiles, outputFile) {
    return new Promise((resolve, reject) => {
        const command = ffmpeg();

        inputFiles.forEach(file => {
            command.input(file);
        });

        command
            .on('end', () => {
                console.log('Merging finished successfully.');
                resolve({ status: true });
            })
            .on('error', (err) => {
                console.error(`Error merging audio files: ${err.message}`);
                reject({ status: false, error: err.message });
            })
            .outputOptions('-filter_complex', `concat=n=${inputFiles.length}:v=0:a=1`)
            .output(outputFile)
            .run();
    });
}


async function downloadAndMergeAudios(videoUrls, id) {
    const downloadDir = path.join(__dirname, '..', 'downloads');
    const outputPath = path.join(downloadDir, `${id}-merged.mp3`);
    try {
        const videoPaths = [];
        for (const url of videoUrls) {
            try {
                await isValidVideo(url);
                const videoPath = await downloadVideo(url, downloadDir, id);
                videoPaths.push(videoPath);
            } catch (downloadErr) {
                console.error(`Error downloading video from ${url}: ${downloadErr.message}`);
            }
        }
        if (videoPaths.length === 0) {
            throw new Error("No valid videos available to create HLS playlist");
        }
        await mergeAudioFiles(videoPaths, outputPath);
        return outputPath;
    } catch (err) {
        console.error(`Error processing videos: ${err.message}`);
        throw err;
    }
}
module.exports = downloadAndMergeAudios;
