const fs = require('fs');
const sharp = require('sharp');

const MAX_SIZE = 2 * 1024 * 1024; // 2MB in bytes

/**
 * Reduce image size to within 2MB if it exceeds the limit.
 * @param {string} inputFilePath - Path to the input image file.
 * @param {string} outputFilePath - Path to save the resized image file.
 * @returns {Promise<void>}
 */
async function SizeReducer(inputFilePath, outputFilePath) {
  try {
    let image = sharp(inputFilePath);
    let metadata = await image.metadata();
    let { width, height } = metadata;

    let resizedImage = image;
    let fileSize = (await image.toBuffer()).length;

    while (fileSize > MAX_SIZE) {
      width = Math.floor(width * 0.9);
      height = Math.floor(height * 0.9);
      resizedImage = image.resize({ width, height });
      fileSize = (await resizedImage.toBuffer()).length;
      console.log(`Resizing to ${width}x${height}, new size: ${fileSize} bytes`);
    }

    await resizedImage.toFile(outputFilePath);
    console.log(`Image resized and saved to ${outputFilePath}`);
  } catch (err) {
    console.error('Error resizing image:', err);
  }
}


module.exports = SizeReducer;
