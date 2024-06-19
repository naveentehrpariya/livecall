const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const fetch = require('node-fetch');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

async function convertImageToVideo(imageUrl, videoPath) {
    try {
        // Download image from URL
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image from ${imageUrl}`);
        }

        console.log("Response status:", response.status);

        // Create a temporary file path for the image
        const tempImagePath = path.join(__dirname, 'downloads', 'image.jpg');
        
        // Ensure the directory exists
        await fs.ensureDir(path.dirname(tempImagePath));
        
        // Pipe the image data to a writable stream
        const fileStream = fs.createWriteStream(tempImagePath);
        await new Promise((resolve, reject) => {
            response.body.pipe(fileStream);
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });

        console.log("Image downloaded to", tempImagePath);

        // Get image dimensions
        const { width, height } = await getImageDimensions(tempImagePath);

        console.log(`Original dimensions: ${width}x${height}`);

        // Adjust dimensions if necessary
        const adjustedWidth = width % 2 === 0 ? width : width - 1;
        const adjustedHeight = height % 2 === 0 ? height : height - 1;

        console.log(`Adjusted dimensions: ${adjustedWidth}x${adjustedHeight}`);

        // Execute FFmpeg command to convert image to video
        const ffmpegCommand = `"${ffmpegPath}" -loop 1 -i "${tempImagePath}" -vf "scale=${adjustedWidth}:${adjustedHeight},setsar=1" -c:v libx264 -pix_fmt yuv420p -t 5 "${videoPath}"`;
        
        console.log("Executing FFmpeg command:", ffmpegCommand);

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error converting ${imageUrl} to video: ${error.message}`);
                    console.error("FFmpeg stderr:", stderr);
                    reject(error);
                } else {
                    console.log(`Conversion of ${imageUrl} to video finished successfully.`);
                    resolve(videoPath);
                }
            });
        });
        console.log("FFmpeg command executed successfully");
        // Remove the temporary image file after conversion
        await fs.unlink(tempImagePath);

        return videoPath;
    } catch (err) {
        console.error(`Error processing image to video: ${err.message}`);
        throw err;
    }
}

async function getImageDimensions(imagePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(imagePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                // Ensure metadata contains width and height
                const stream = metadata.streams[0];
                if (stream && stream.width && stream.height) {
                    resolve({ width: stream.width, height: stream.height });
                } else {
                    reject(new Error('Unable to determine image dimensions.'));
                }
            }
        });
    });
}
module.exports = convertImageToVideo;
