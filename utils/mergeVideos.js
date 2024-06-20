const ffmpeg = require('fluent-ffmpeg');
/**
 * Function to merge multiple videos into one.
 * @param {string[]} videoPaths - Array of input video file paths.
 * @param {string} outputPath - Output file path for the merged video.
 * @returns {Promise<void>} - Promise resolved when the merging is complete.
 */
function mergeVideos(videoPaths, outputPath) {
    return new Promise((resolve, reject) => {
        const ffmpegCommand = ffmpeg();
        videoPaths.forEach(videoPath => {
            ffmpegCommand.input(videoPath);
        });
        ffmpegCommand
            .on('error', (err) => {
                console.error('Error during merging videos:', err);
                reject(err);
            })
            .on('end', () => {
                console.log('Merging videos finished');
                resolve();
            })
            .on('progress', (progress) => {
                console.log('Merging progress:', progress.percent);
            })
            .on('start', (commandLine) => {
                console.log('Starting ffmpeg with command:', commandLine);
            }).mergeToFile(outputPath, './temp');
    });
}

module.exports = {
    mergeVideos
};
