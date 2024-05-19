const Files = require("../db/Files");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");

// all/ image / video / audio
const myMedia = catchAsync(async (req, res) => {
   const mimeTypes = {
     image: 'image/',
     video: 'video/',
     audio: 'audio/'
   };
   const { type } = req.params;
   let mimeFilter;
   if (type === 'all') {
     mimeFilter = { $regex: '.*' }; 
   } else if (mimeTypes[type]) {
     mimeFilter = { $regex: `^${mimeTypes[type]}` };
   } else {
     return res.status(400).json({
       status: false,
       message: "Invalid type parameter"
     });
   }
   const Query = new APIFeatures(
     Files.find({
       user: req.user._id,
       mime: mimeFilter
     }),
     req.query
   ).sort();
   const files = await Query.query;
   res.json({
     status: true,
     files: files.length ? files : [],
     message: files.length ? undefined : "No files found"
   });
 });
 

module.exports = { myMedia } 