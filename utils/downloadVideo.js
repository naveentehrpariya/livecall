const path = require('path');
const fs = require('fs-extra');
const fetch = require('node-fetch'); // Ensure fetch is imported

async function downloadVideo(url, downloadDir, id) {
   const fileName = path.basename(url);
   const filePath = path.join(downloadDir, `${id}_${fileName}`);
   await fs.ensureDir(downloadDir);
   const response = await fetch(url);
   console.log("response",response)
   if (!response.ok) {
       throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
   }
   const fileStream = fs.createWriteStream(filePath);
   await new Promise((resolve, reject) => {
       response.body.pipe(fileStream);
       response.body.on('error', reject);
       fileStream.on('finish', resolve);
   });
   
   const stats = await fs.stat(filePath);
   if (stats.size === 0) {
       throw new Error(`Downloaded file ${filePath} is empty`);
   }
   return filePath;
}
module.exports = downloadVideo;
