const Files = require("../db/Files");
const User = require("../db/Users");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const handleFileUpload = require('../utils/file-upload-util');
const B2 = require('backblaze-b2');

const bucket_name = process.env.BUCKET_NAME;
const bucket_id = process.env.BUCKET_ID;
const APP_ID = process.env.CLOUD_APPLICATION_ID;
const APP_KEY = process.env.CLOUD_APPLICATION_KEY;
const b2 = new B2({
  applicationKeyId: APP_ID,
  applicationKey: APP_KEY
});

async function authorizeB2() {
  try {
    await b2.authorize();
    console.log('conncted B2:');
  } catch (error) {
    console.error('Error authorizing B2:', error);
  }
}
authorizeB2();

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

    const { query, totalDocuments, page, limit, totalPages } = await Query.paginate();
    const data = await query;

   res.json({
     status: true,
     files: data,
     page : page,
     totalPages : totalPages,
     message: data.length ? undefined : "No files found"
   });
});


const deleteMedia = async (req, res) => {
  try{
    const { id } = req.params;
    const file = await Files.findById(id);
    if (!file) {
      return res.status(404).json({
        status: false,
        message: "File not found"
      });
    }
    b2.deleteFileVersion({
      fileId: file.fileId,
      fileName: file.filename
    }).then(response => {
        console.log('File deleted:', response.data);
    }).catch(error => {
      console.error('Error deleting file:', error);
    });
 
    file.deletedAt = Date.now();
    await file.save();
      res.json({
        status: true,
        info:info,
        message: "File deleted successfully"
      }); 
  } catch(err){ 
    res.json({
      status: false,
      message: "Unable to remove file at this moment.",
      error : err
    });
  }
};

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


const totalFileUploaded = catchAsync(async (req, res) => {
      const userId = req.user._id;
      try {
          const userFiles = await Files.find({ user:userId, deletedAt: null || '' });
          const totalSize = userFiles.reduce((acc, file) => acc + parseInt(file.size), 0);
          res.json({
              status:true,
              totalSize: totalSize,
          });
      } catch (error) {
          res.status(500).json({ 
            status: false,
            error:error,
            message: 'Server error'
          });
      }
});

const checkUploadLimit = catchAsync ( async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate("plan");
    const fileSize = req.file.size;  // Assuming you're using multer for file uploads
    // Get the user's upload limit in bytes
    // const uploadLimit = parseInt(user.plan.storage) * 1024 * 1024 * 1024;
    const uploadLimit = 6000;
    console.log("uploadLimit",uploadLimit)

    const uploadedFiles = await Files.find({ user:userId });
    const totalUploadedSize = uploadedFiles.reduce((total, file) => total + file.size, 0);

    console.log("totalUploadedSize",totalUploadedSize)

    const remainingLimit = uploadLimit - totalUploadedSize;
    
    console.log("remainingLimit",remainingLimit)

    if (fileSize > remainingLimit) {
      return res.status(200).json({ 
        status: false,
        message: 'Upload limit exceeded. You cannot upload more files.'
       });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error checking upload limit', error });
  }
 



});


module.exports = { checkUploadLimit, totalFileUploaded, uploadMedia, myMedia, deleteMedia } 