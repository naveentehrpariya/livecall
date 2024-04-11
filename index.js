const express = require('express');
const app = express();

const morgan = require('morgan')
app.use(morgan('dev')); 

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const globalErrorHandler = require("./middlewares/gobalErrorHandler");
const cors = require('cors');
const AppError = require('./utils/AppError');
require('./db/config');
 
// MIDDLE-WARES 
app.use(cors()); 
app.use(express.json()); 
// app.use(errorHandler);  

// ROUTES
app.use("/user", require('./routes/authRoutes'));
app.use("/product", require('./routes/productsRoutes'));
app.use("/user", require('./routes/userRoutes'));

// TEST CHECK
app.get('/', (req, res)=>{ 
    res.send({
        status:"Active",  
        Status :200
    });   
}); 


const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAPI,
});
const openai = new OpenAIApi(configuration);

app.post('/chat', async (req, res) => { 
    const chatCompletion = await openai.createChatCompletion({
      model: "text-davinci-002",
      messages: [{role: "user", content: "Hello world"}],
    });
    res.status(200).json({
        "status":true,
        "message":chatCompletion.data.choices[0].message
    })
});

app.all('*', (req, res, next) => { 
    next(new AppError("page not found !!", 404    ));         
});

app.use(globalErrorHandler); 
  
const port = 8080;
app.listen(port, ()=>{ console.log(`On PORT ${port} SERVER RUNNINGGGGG.....`) });