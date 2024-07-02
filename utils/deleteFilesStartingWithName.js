const fs = require('fs').promises; // Use fs.promises for promise-based API
const path = require('path');

async function deleteFilesStartingWithName(name) {
  const dirPath = path.join(__dirname, '..', 'downloads');
   try {
     const files = await fs.readdir(dirPath);
     for (const file of files) {
       if (file.startsWith(name)) {
         const filePath = path.join(dirPath, file);
         await fs.unlink(filePath);
         console.log(`Deleted file starting with "${name}": ${filePath}`);
       }
     }
   } catch (err) {
     if (err.code === 'ENOENT') {
       console.log(`Directory not found: ${dirPath}`);
     } else {
       throw err;
     }
   }
}

module.exports = deleteFilesStartingWithName;
