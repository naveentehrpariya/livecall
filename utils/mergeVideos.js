const { error } = require('console');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

function ensureDirectoryExistence(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function reencodeVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions('-preset', 'fast')
      .outputOptions('-crf', '23')
      .outputOptions('-strict', 'experimental')
      .on('end', () => {
        console.log(`Re-encoding finished for ${inputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`Error during re-encoding of ${inputPath}:`, err);
        reject(err);
      })
      .save(outputPath);
  });
}

async function mergeVideos(videoPaths, outputPath, playlistId) {
  console.log("videoPaths", videoPaths);
  const tempDir = path.join(__dirname,'..', 'downloads');
  ensureDirectoryExistence(tempDir);
  try {
    const reencodedPaths = [];

    for (let i = 0; i < videoPaths.length; i++) {
      const inputPath = videoPaths[i];
      const reencodedPath = path.join(tempDir, `${playlistId}-reencoded-${i}.mp4`);
      console.log(`Processing video and Re-encoding ${inputPath} to ${reencodedPath}`);
      await reencodeVideo(inputPath, reencodedPath);
      reencodedPaths.push(reencodedPath);
    }

    const concatListPath = path.join(tempDir, 'concat_list.txt');
    const concatListContent = reencodedPaths.map(filePath => `file '${filePath}'`).join('\n');
    fs.writeFileSync(concatListPath, concatListContent);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions('-f', 'concat', '-safe', '0')
        .outputOptions('-c', 'copy')
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
        })
        .save(outputPath);
    });

  } catch (err) {
    console.error('Error processing videos:', err);
    return { 
      status : false,
      error : err,
      message : "Error in merging vidoes."
    }
  }
}
 

module.exports = {
    mergeVideos
};
