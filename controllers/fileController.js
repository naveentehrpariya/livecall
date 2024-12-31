const deleteFilesStartingWithName = require("../utils/deleteFilesStartingWithName");
const logger = require("../utils/logger");
const Files = require("../db/Files");
const User = require("../db/Users");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const B2 = require('backblaze-b2');
const fs = require('fs');
const cron = require('node-cron');
const Stream = require("../db/Stream");
const AWS = require('aws-sdk');

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
const s3 = new AWS.S3({ 
  endpoint: process.env.CLOUDFLARE_ENDPOINT,
  accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY
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
    const params = {
      Bucket: process.env.BUCKET_NAME || 'runstream',
      Key: file.filename,
      VersionId: file.fileId,
    };

    s3.deleteObject(params, (err, data) => {
      if (err) {
        console.error("Error deleting object version:", err);
      } else {
        console.log("Object version deleted successfully:", data);
      }
    });
    
    // b2.deleteFileVersion({
    //   fileId: file.fileId,
    //   fileName: file.filename
    // }).then(response => {
    //     console.log('File deleted:', response.data);
    // }).catch(error => {
    //   console.error('Error deleting file:', error);
    // });

    file.deletedAt = Date.now();
    await file.save();
    res.json({
      status: true,
      message: "File deleted successfully"
    }); 
  } catch(err){ 
    console.log("err", err)
    res.json({
      status: false,
      message: "Unable to remove file at this moment.",
      error : err
    });
  }
};

const uploadMedia = catchAsync(async (req, res) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ 
        status:false, 
        message: 'No file found to upload.' 
      });
    }
    const sanitizedFileName = file.originalname.trim().replace(/\s+/g, '-');
      const params = {
          Bucket: process.env.BUCKET_NAME || 'runstream',
          Key: sanitizedFileName,
          Body: fs.readFileSync(file.path),
      };
      s3.upload(params, async (err, data) => {
        if (err) {
          console.error("Error uploading file:", err);
          res.status(500).json({
            status:false,
            message: "File failed to upload on cloud. Something went wrong.",
            error: err
          }); 
        } else {
          fs.unlinkSync(file.path);
          console.log("data", data)
          if(data){
            const fileUrl = `${process.env.CLOUDFLARE_URL}${data.Key}`;
            const uploadedfile = new Files({
              name: file.originalname,
              mime: file.mimetype,
              filename: data.Key,
              fileId: data.VersionId,
              url: fileUrl,
              user: req.user?._id,
              size: file.size,
            }); 

            const fileUploaded = await uploadedfile.save();
            res.status(201).json({
              status: true,
              message: "File uploaded to storage.",
              file_data: fileUploaded,
              fileUrl: fileUrl,
            });
          } else { 
            res.status(500).json({
              status:false,
              error: data,
              file_data: null,
              message: data.message ||"File failed to upload on cloud."
            });
          }
        }
      });
  } catch (error) {
    console.log("error",error)
    res.status(500).json({
      status:false,
      message: "File failed to upload on cloud.",
      error: error
    });
  }
  // await authorizeB2();
  // const attachment = req.files?.attachment?.[0];
  // res.setHeader('Access-Control-Allow-Origin', '*');
  // if(!attachment) {
  //   return res.status(400).json({ message: "Nothing uploaded" });
  // }
  // try {
  //   const uploadResponse = await handleFileUpload(attachment);
  //   if (uploadResponse) {
  //     const file = new Files({
  //       name: uploadResponse.file.originalname,
  //       mime: uploadResponse.mime,
  //       filename: uploadResponse.filename,
  //       url: uploadResponse.url,
  //       user: req.user?._id,
  //       size: uploadResponse.size,
  //     });
  //     const fileUploaded = await file.save();
  //     if (!fileUploaded) {
  //       return res.status(500).json({
  //         message: "File upload failed",
  //         error: uploadResponse
  //       });
  //     }
  //     return res.status(201).json({
  //       message: "File uploaded to storage.",
  //       file_data: fileUploaded,
  //     });
   
  //   } else {
  //     res.status(500).json({
  //       message: "File upload failed",
  //       error: uploadResponse
  //     });
  //   }
  // } catch (error) {
  //   console.error(error);
  //   res.status(500).json({
  //     message: "An error occurred during file upload",
  //   });
  // }
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

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

const checkUploadLimit = catchAsync ( async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    const fileSize = req.file.size; 
    const uploadLimit = user && user.storage ? (parseInt(user.storage) * 1024 * 1024 * 1024) : (1* 1024 * 1024 * 1024);
    const uploadedFiles = await Files.find({ user:userId, deletedAt:null || ''});
    const totalUploadedSize = uploadedFiles.reduce((total, file) => total + parseInt(file.size), 0);
    const remainingLimit = uploadLimit - totalUploadedSize;
    if (fileSize > remainingLimit) {
      fs.unlinkSync(req.file.path);
      return res.json({ 
        status: false,
        message: 'Upload limit exceeded. You cannot upload more files.'
        });
    }
    next();
  } catch (error) {
    return res.status(500).json({ 
      message: 'Error checking upload limit', error 
    });
  }
});

// Function to get streams ended and updated in the last 48 hours
const restStreamLimit = catchAsync(async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const totallivestreams = await Stream.find({user : req.user._id, status: '1'}).count();
    res.status(200).json({
      status : true,
      limit : `${user?.streamLimit}/${totallivestreams} Streams available` ,
    });
  } catch (error) {
    res.status(500).json({ 
      status : false,
      error : error,
      message : error.message || "Something went wrong",
     });
  }
});

const getRecentEndedStreams = async () => {
  try {
      const streams = await Stream.find({
          status: 0,
      });
      streams.forEach(stream => {
          logger(`Stream ${stream.streamId} has ended and and all files with this playlist id has been removed ${stream.playlistId}.`);
          deleteFilesStartingWithName(stream.playlistId);
      });
  } catch (error) {
      console.error('Error fetching streams:', error);
  }
};

// REMOVE ALL UNWANTED FILES FROM SYSTEM
// cron.schedule('0 0 * * 0', async () => {
//   await getRecentEndedStreams();
// });


module.exports = { restStreamLimit, checkUploadLimit, totalFileUploaded, uploadMedia, myMedia, deleteMedia } 