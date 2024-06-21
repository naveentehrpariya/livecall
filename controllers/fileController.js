const Files = require("../db/Files");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const handleFileUpload = require('../utils/file-upload-util');
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
       mime: mimeFilter,
       deletedAt : null || ''
     }),
     req.query
   ).sort();
   const files = await Query.query;
   res.json({
     status: true,
     files: files,
     message: files.length ? undefined : "No files found"
   });
});

const deleteMedia = catchAsync(async (req, res) => {
   const { id } = req.params;
   const file = await Files.findById(id);
   if (!file) {
     return res.status(404).json({
       status: false,
       message: "File not found"
     });
   }

   file.deletedAt = Date.now();
   const saved = file.save();
   if (saved) {
     res.json({
       status: true,
       message: "File deleted successfully"
     }); 
   } else { 
    res.json({
      status: false,
      message: "Unable to remove file at this moment.",
      error : saved
    }); 
   }
});

const uploadMedia = catchAsync(async (req, res) => {
  const attachment = req.files?.attachment?.[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!attachment) {
    return res.status(400).json({ message: "Nothing uploaded" });
  }
  try {
    const uploadResponse = await handleFileUpload(attachment);
    if (uploadResponse) {
      const file = new Files({
        name: uploadResponse.file.originalname,
        mime: uploadResponse.mime,
        filename: uploadResponse.filename,
        url: uploadResponse.url,
        user: req.user?._id,
        size: uploadResponse.size,
      });
      const fileUploaded = await file.save();
      if (!fileUploaded) {
        return res.status(500).json({
          message: "File upload failed",
          error: uploadResponse
        });
      }
      return res.status(201).json({
        message: "File uploaded to storage.",
        file_data: fileUploaded,
      });
   
    } else {
      res.status(500).json({
        message: "File upload failed",
        error: uploadResponse
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "An error occurred during file upload",
    });
  }
});


module.exports = { uploadMedia, myMedia, deleteMedia } 