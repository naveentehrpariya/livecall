
async function deleteFilesStartingWithName(dirPath, name) {
   try {
     const files = await fs.readdir(dirPath);
     for (const file of files) {
       if (file.startsWith(name)) {
         const filePath = path.join(dirPath, file);
         await fs.remove(filePath);
         console.log(`Deleted file starting with "list": ${filePath}`);
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
