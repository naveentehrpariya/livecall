const nodemailer = require('nodemailer');
const sendEmail = async (options) => { 
   try {
      const transporter = nodemailer.createTransport({
         service: "gmail",
         port: 25,
         secure: false,
         auth: {
           user: process.env.EMAIL_USERNAME,
           pass: process.env.EMAIL_PASSWORD,
         },
         tls: {
           rejectUnauthorized: false,
         },
       }) 
      console.log('Transporter created:', transporter);
   
      // Define email options
      const mailOptions = { 
         from: process.env.EMAIL_FROM,
         to: options.email,
         subject: options.subject,
         html: options.message,
      };
      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent:', result);
      return result; 
   } catch (error) {
      console.error('Error sending email:', error);
      throw error; // Rethrow error for higher-level error handling
   }
};

module.exports = sendEmail;
