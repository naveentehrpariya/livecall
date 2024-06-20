const path = require('path');
const fs = require('fs-extra');
const fetch = require('node-fetch');

function sanitizeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9-_\.]/g, '_'); // Replace invalid characters with underscores
}

async function downloadAudio(url, downloadDir, id) {
    const fileName = sanitizeFileName(path.basename(url));
    const filePath = path.join(downloadDir, `${id}_${Date.now().toString()}.mp3`);
    await fs.ensureDir(downloadDir);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const fileStream = fs.createWriteStream(filePath);
    response.body.pipe(fileStream);
    await new Promise((resolve, reject) => {
        fileStream.on('finish', () => {
            resolve();
        });
        fileStream.on('error', (err) => {
            reject(err);
        });
    });
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
        throw new Error(`Downloaded file ${filePath} is empty`);
    }

    return filePath;
}
module.exports = downloadAudio;
