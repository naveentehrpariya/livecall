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
app.use("", require('./routes/webRoutes'));
 

app.use(express.json());
const bucket_name = process.env.BUCKET_NAME;
const bucket_id = process.env.BUCKET_ID;
const APP_ID = process.env.CLOUD_APPLICATION_ID;
const APP_KEY = process.env.CLOUD_APPLICATION_KEY;


// Blackblaze cloud
const b2 = new B2({
  applicationKeyId: APP_ID,
  applicationKey: APP_KEY
});

const upload = multer({ dest: 'uploads/' });
async function authorizeB2() {
  try {
    await b2.authorize();
    console.log('B2 authorization successful');
  } catch (error) {
    console.error('Error authorizing B2:', error);
  }
}

authorizeB2();


app.options("/cloud/upload", cors(corsOptions));
app.post('/cloud/upload', cors(corsOptions), validateToken, upload.single('file'), async (req, res) => {
  try {
    const { file } = req;
    if (!file) {
      return res.status(400).json({ status:false, message: 'No file found to upload.' });
    }
    const sanitizedFileName = file.originalname.trim().replace(/\s+/g, '-');
    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: bucket_id 
    });
    const fileData = fs.readFileSync(file.path);

    const uploadResponse = await b2.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName: sanitizedFileName,
      data: fileData
    });

    fs.unlinkSync(file.path);
    const fileUrl = `https://f003.backblazeb2.com/file/${bucket_name}/${sanitizedFileName}`;
  
    if(uploadResponse){
      const uploadedfile = new Files({
        name: file.originalname,
        mime: uploadResponse.data.contentType,
        filename: uploadResponse.data.fileName,
        url: fileUrl,
        user: req.user?._id,
        size: uploadResponse.data.contentLength,
      });
      const fileUploaded = await uploadedfile.save();
      res.status(201).json({
        message: "File uploaded to storage.",
        file_data: fileUploaded,
        fileUrl: fileUrl,
      });
    } else {
      res.status(500).json({
        message: "File failed to upload on cloud.",
        error: uploadResponse.data
      });
    }
  } catch (error) {
    console.log("error",error)
    res.status(500).json({
      status:false,
      message: "File failed to upload on cloud.",
      error: error
    });
  }
});
 
 
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
