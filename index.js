const express = require('express');
const app = express();
const B2 = require('backblaze-b2');
const cors = require('cors');
const fs = require('fs');
const morgan = require('morgan');
const bodyParser = require('body-parser');
require('dotenv').config()
const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const errorHandler = require("./middlewares/errorHandler");
const multer = require('multer');
const handleFileUpload = require('./utils/file-upload-util');
const { validateToken } = require('./controllers/authController');
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


const multerParse = multer({
  dest: "uploads/",
  limits: {
    fileSize: 1024 * 1024 * 2000 
  }
});

app.options("/cloud/upload", cors(corsOptions));
app.post("/cloud/upload", cors(corsOptions), validateToken, multerParse.single("attachment"), async (req, res) => {
  const attachment = req.file;
  if (!attachment) {
    return res.status(400).json({ message: "No file uploaded" });
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
      res.setHeader('Access-Control-Allow-Origin', '*');
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

app.use(express.json()); // To parse incoming JSON requests


// blackblaze cloud
// const b2 = new B2({
//   applicationKeyId: '21f5ab89ec52',
//   applicationKey: '005ea2e8617f76a6401e5edce9186c257383303185'
// });
// const upload = multer({ dest: 'uploads/' });
// async function authorizeB2() {
//   try {
//     await b2.authorize();
//     console.log('B2 authorization successful');
//   } catch (error) {
//     console.error('Error authorizing B2:', error);
//   }
// }
// authorizeB2();


// app.post('/upload', upload.single('file'), async (req, res) => {
//   try {
//     const { file } = req;
//     if (!file) {
//       return res.status(400).json({ message: 'No file uploaded' });
//     }

//     // Sanitize the file name
//     const sanitizedFileName = file.originalname.trim().replace(/\s+/g, '-');

//     // Get the upload URL for the bucket
//     const uploadUrlResponse = await b2.getUploadUrl({
//       bucketId: 'b2a1df757a2bb8c99e1c0512' // Replace with your Bucket ID
//     });

//     // Read the file data
//     const fileData = fs.readFileSync(file.path);

//     // Upload the file with sanitized file name
//     const uploadResponse = await b2.uploadFile({
//       uploadUrl: uploadUrlResponse.data.uploadUrl,
//       uploadAuthToken: uploadUrlResponse.data.authorizationToken,
//       fileName: sanitizedFileName, // Use the sanitized file name
//       data: fileData
//     });

//     // Remove the temporary file
//     fs.unlinkSync(file.path);

//     console.log("uploadResponse", uploadResponse);

//     // Construct the correct file URL
//     const bucketName = 'naveenfpbucket'; // Ensure this is correct and matches your B2 bucket name
//     const fileUrl = `https://f000.backblazeb2.com/file/${bucketName}/${sanitizedFileName}`;

//     // Respond with success message and correct file URL
//     res.json({
//       message: 'File uploaded successfully',
//       fileUrl: fileUrl
//     });
//   } catch (error) {
//     console.error('Error uploading file:', error.message);
//     res.status(500).send('Error uploading file');
//   }
// });
// app.get('/file/:fileName', async (req, res) => {
//   const { fileName } = req.params;
//   try {
//     const response = await b2.downloadFileByName({
//       bucketName: 'naveenfpbucket', // Replace with your Bucket Name
//       fileName: fileName
//     });
//     res.setHeader('Content-Type', response.headers['content-type']);
//     res.send(response.data);
//   } catch (error) {
//     console.error('Error retrieving file:', error.message); // Log only the error message
//     res.status(500).send('Error retrieving file'); // Send a simple message
//   }
// });

 
app.get('/', (req, res) => {
  res.send({
    message: "ACTIVE last2",
    status: 200
  });
});

app.all('*', (req, res, next) => {
  res.status(404).json({
      status: 404,
      message: `NOT FOUND`
  });
});

const port = process.env.PORT;
app.listen(port, () => { console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });
