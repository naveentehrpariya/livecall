const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs');
const morgan = require('morgan');
const bodyParser = require('body-parser');
require('dotenv').config()
const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const errorHandler = require("./middlewares/errorHandler");
const multer = require('multer');
const { validateToken } = require('./controllers/authController');
const { checkUploadLimit } = require('./controllers/fileController');
const Files = require('./db/Files');
require('./db/config');

const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(errorHandler);
app.use(globalErrorHandler);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({limit:'2000mb'}));
 
// ROUTES
app.use("/admin", require('./routes/adminRoutes'));
app.use("/user", require('./routes/authRoutes'));
app.use("/user", require('./routes/userRoutes'));
app.use("", require('./routes/streamRoutes'));
app.use("", require('./routes/planRoutes'));
app.use("", require('./routes/FilesRoutes'));
app.use("", require('./routes/rajorpayRoutes'));
app.use("", require('./routes/webRoutes'));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });
app.options("/cloud/upload", cors(corsOptions));
const AWS = require('aws-sdk');
const s3 = new AWS.S3({ 
  endpoint: process.env.CLOUDFLARE_ENDPOINT,
  accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
  secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY
});


app.post('/cloud/upload', cors(corsOptions), validateToken, upload.single('file'), checkUploadLimit,  async (req, res) => {
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
});

// app.post('/cloud/upload', cors(corsOptions), validateToken,  upload.single('file'), checkUploadLimit,  async (req, res) => {
//   await authorizeB2();
//   try {
//     const { file } = req;
//     if (!file) {
//       return res.status(400).json({ status:false, message: 'No file found to upload.' });
//     }
//     const sanitizedFileName = file.originalname.trim().replace(/\s+/g, '-');
//     const uploadUrlResponse = await b2.getUploadUrl({
//       bucketId: bucket_id 
//     });
//     const fileData = fs.readFileSync(file.path);

//     const uploadResponse = await b2.uploadFile({
//       uploadUrl: uploadUrlResponse.data.uploadUrl,
//       uploadAuthToken: uploadUrlResponse.data.authorizationToken,
//       fileName: sanitizedFileName,
//       data: fileData
//     });
 
//     fs.unlinkSync(file.path);
//     const fileUrl = `https://files.runstream.cloud/file/${bucket_name}/${sanitizedFileName}`;
   
//     console.log("uploadResponse",uploadResponse)
//     if(uploadResponse){
//       const uploadedfile = new Files({
//         name: file.originalname,
//         mime: uploadResponse.data.contentType,
//         filename: uploadResponse.data.fileName,
//         fileId: uploadResponse.data.fileId,
//         url: fileUrl,
//         user: req.user?._id,
//         size: uploadResponse.data.contentLength,
//       }); 

//       const fileUploaded = await uploadedfile.save();
//       res.status(201).json({
//         status: true,
//         message: "File uploaded to storage.",
//         file_data: fileUploaded,
//         fileUrl: fileUrl,
//       });
//     } else { 
//       res.status(500).json({
//         status:false,
//         message: "File failed to upload on cloud.",
//         error: uploadResponse.data
//       });
//     }
//   } catch (error) {
//     console.log("error",error)
//     res.status(500).json({
//       status:false,
//       message: "File failed to upload on cloud.",
//       error: error
//     });
//   }
// });

// console.log("process.env.CLOUDFLARE_ACCESS_KEY_ID",process.env.CLOUDFLARE_ACCESS_KEY_ID);
// console.log("process.env.CLOUDFLARE_ACCESS_KEY_ID",process.env.CLOUDFLARE_SECRET_ACCESS_KEY);

app.get('/', (req, res) => {
  res.send({
    message: "ACTIVE last 5",
    status: 200
  });
});

app.all('*', (req, res, next) => {
  res.status(404).json({
      status: 404,
      message: `NOT FOUND`
  });
});

app.all('/files', (req, res, next) => {
  res.status(404).json({
      status: 404,
      message: `NOT FOUND`
  });
});

const port = process.env.PORT;
app.listen(port, () => { console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });
