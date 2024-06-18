const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const fetch = require('node-fetch');
const logger = require('./logger');
const ffmpeg = require('fluent-ffmpeg');
const ffprobePath = require('ffprobe-static').path;
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
 
async function downloadVideo(url, downloadDir, id) {
    const response = await fetch(url);
    const fileName = path.basename(url);
    const filePath = path.join(downloadDir, `${id}_${fileName}`);
    await fs.ensureDir(downloadDir);
    const fileStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
    return filePath;
}

async function checkVideoFile(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                resolve({ valid: false, message: err.message });
            } else {
                const codec = metadata.streams[0].codec_name;
                const format = metadata.format.format_name;
                if (codec === 'h264' && format === 'mpegts') {
                    resolve({ valid: true });
                } else {
                    resolve({ valid: false, message: 'Video does not meet codec/format criteria' });
                }
            }
        });
    });
}

async function convertVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .on('end', () => {
                console.log(`Conversion of ${inputPath} finished successfully.`);
                  return {
                      status:true
                  }
            })
            .on('error', (err) => {
                console.error(`Error converting ${inputPath}: ${err.message}`);
                return {
                  status:false
              }
            })
            .save(outputPath);
    });
}

function generateVideoList(videoPaths, listPath) {
    const listContent = videoPaths.map(videoPath => `file '${videoPath.replace(/\\/g, '\\\\')}'`).join('\n');
    fs.writeFileSync(listPath, listContent, 'utf8');
    console.log(`Video list created at ${listPath}`);
}

async function createHLSPlaylist(videoUrls, id) {
    const downloadDir = path.join(__dirname, '..', 'downloads');
    const listPath = path.join(downloadDir, `${id}.txt`);
    const outputPath = path.join(downloadDir, `playlist-${id}.m3u8`);

    try {
        const videoPaths = [];
        for (const url of videoUrls) {
            const videoPath = await downloadVideo(url, downloadDir, id);
            const validation = await checkVideoFile(videoPath);
            if (validation.valid) {
                videoPaths.push(videoPath);
            } else {
                console.log(`Invalid video: ${videoPath}. Reason: ${validation.message}`);
                const convertedPath = path.join(downloadDir, `converted_${path.basename(videoPath)}`);
                const convert = await convertVideo(videoPath, convertedPath);
                if(convert && convert.status){
                  videoPaths.push(convertedPath);
                }
                console.log(`Converted video: ${videoPath} to ${convertedPath}`);
            }
        }
        generateVideoList(videoPaths, listPath);

        const ffmpegCommand = `"${ffmpegPath}" -f concat -safe 0 -i "${listPath}" -c:v copy -c:a aac -b:a 128k -hls_time 10 -hls_list_size 0 -f hls "${outputPath}"`;
        exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error creating HLS playlist: ${error.message}`);
                throw error;
            }
            if (stderr) {
                console.error(`FFmpeg stderr: ${stderr}`);
            }
            console.log(`FFmpeg stdout: ${stdout}`);
            console.log(`HLS playlist-${id}.m3u8 created successfully.`);
        });

        return outputPath;
    } catch (err) {
        console.error(`Error processing videos: ${err.message}`);
        throw err;
    }
}

module.exports = createHLSPlaylist;
