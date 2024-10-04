const User = require("../db/Users");
const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync");
const {promisify} = require("util");
const AppError = require("../utils/AppError");
const SendEmail = require("../utils/Email");
const crypto = require("crypto");
const JSONerror = require("../utils/jsonErrorHandler");
const logger = require("../utils/logger");
const Inquiry = require("../db/Inquiry");
const SECRET_ACCESS = process.env && process.env.SECRET_ACCESS || "MYSECRET";
const signToken = async (id) => {
  const token = jwt.sign(
    {id}, 
    SECRET_ACCESS, 
    {expiresIn:'14400m'}
  );
  return token
}

const validateToken = catchAsync ( async (req, res, next) => {
  let authHeader = req.headers.Authorization || req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer")) {
    let token = authHeader.split(" ")[1];
    if (!token) {
      res.status(400).json({
        status : false,
        message:"User is not authorized or Token is missing",
      }); 
    } else {
      try {
        const decode = await promisify(jwt.verify)(token, SECRET_ACCESS);
        if(decode){ 
          let result = await User.findById(decode.id);
          req.user = result;
          next();
        } else { 
          res.status(401).json({
            status : false,
            message:'Uauthorized',
          })
        }
      } catch (err) {
        res.status(401).json({
          status : false,
          message:'Invalid or expired token',
          error : err
        });
      }
    }
  } else { 
    res.status(400).json({
      status : false,
      message:"User is not authorized or Token is missing",
    })
  }
});

const sendVerifyEmail = catchAsync ( async (req, res, next) => {
  const user = req.user;
  if(!user){
    res.status(200).json({
      status:false,
      message:"No account found with this email address."
    })
  }
  const mailToken = await user.createMailVerificationToken();
  await user.save({validateBeforeSave:false});
  const mailTokenUrl = `${process.env.DOMAIN_URL}/verify-email/${mailToken}`;
  const message = `<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="content-type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0;">
  <meta name="format-detection" content="telephone=no" />

  <style>
    body {
      margin: 0;
      padding: 0;
      min-width: 100%;
      width: 100% !important;
      height: 100% !important;
    }

    body,
    table,
    td,
    div,
    p,
    a {
      -webkit-font-smoothing: antialiased;
      text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      -webkit-text-size-adjust: 100%;
      line-height: 100%;
    }

    table,
    td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      border-collapse: collapse !important;
      border-spacing: 0;
    }

    img {
      border: 0;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }

    #outlook a {
      padding: 0;
    }

    .ReadMsgBody {
      width: 100%;
    }

    .ExternalClass {
      width: 100%;
    }

    .ExternalClass,
    .ExternalClass p,
    .ExternalClass span,
    .ExternalClass font,
    .ExternalClass td,
    .ExternalClass div {
      line-height: 100%;
    }

    @media all and (min-width: 560px) {
      body {
        margin-top: 30px;
      }
    }
    
    /* Rounded corners */
    @media all and (min-width: 560px) {
      .container {
        border-radius: 8px;
        -webkit-border-radius: 8px;
        -moz-border-radius: 8px;
        -khtml-border-radius: 8px;
      }
    }
    /* Links */
    a,
    a:hover {
      color: #127DB3;
    }

    .footer a,
    .footer a:hover {
      color: #999999;
    }
  </style>
  <title>🔑 Verify Your Email Address</title>
</head>

<!-- BODY -->
<body topmargin="0" rightmargin="0" bottommargin="0" leftmargin="0" marginwidth="0" marginheight="0" width="100%" style="border-collapse: collapse; border-spacing: 0;  padding: 0; width: 100%; height: 100%; -webkit-font-smoothing: antialiased; text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; line-height: 100%;
	background-color: #ffffff;
	color: #000000;" bgcolor="#ffffff" text="#000000">
  <table width="100%" align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; width: 100%;" class="background">
    <tr>
      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0;" bgcolor="#ffffff">
        <table border="0" cellpadding="0" cellspacing="0" align="center" bgcolor="#FFFFFF" width="560" style="border-collapse: collapse; border-spacing: 0; padding: 0; width: inherit;
	max-width: 560px;" class="container">
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 24px; font-weight: bold; line-height: 130%;padding-top: 25px;color: #000000;font-family: sans-serif;" class="header">
              <img border="0" vspace="0" hspace="0" src="https://runstream.co/logo-white.png" style="max-width: 250px;" alt="The Idea" title="Runstream" />
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%;
			padding-top: 25px;" class="line">
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 17px; font-weight: 400; line-height: 160%;
			padding-top: 25px; 
			color: #000000;
			font-family: sans-serif;" class="paragraph">
              Hi ${user.name || ""},<br> You've entered ${user.email} as the email address of your runstream account.
              <br>
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; padding-top: 25px;padding-bottom: 5px;" class="button">
                <table border="0" cellpadding="0" cellspacing="0" align="center" style="max-width: 240px; min-width: 120px; border-collapse: collapse; border-spacing: 0; padding: 0;">
                  <tr>
                    <td align="center" valign="middle" >
                      <a target="_blank" style="background-color: #df3939; padding: 12px 24px; margin: 0; text-decoration: none; border-collapse: collapse; border-spacing: 0; border-radius: 10px; -webkit-border-radius: 10px; -moz-border-radius: 10px; -khtml-border-radius: 10px; text-decoration: none;
                        color: #FFFFFF; font-family: sans-serif; font-size: 17px; font-weight: 400; line-height: 120%;" href=${mailTokenUrl}>
                          Verify email
                      </a>
                    </td>
                  </tr>
                </table>
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%;
			padding-top: 25px;" class="line">
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 17px; font-weight: 400; line-height: 160%;
			padding-top: 20px;
			padding-bottom: 25px;
			color: #000000;
			font-family: sans-serif;" class="paragraph">
              If you have any questions or need assistance, feel free to reach out to our support team at <a href="mailto:Support@runstream.co" target="_blank" style=" color: #4b57ff; ">support@runstream.co</a>. We’re here to help!.
              If you did not sign up for this account you can ignore this email and the account will be deleted.
            </td>
          </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" align="center" width="560" style="border-collapse: collapse; border-spacing: 0; padding: 0; width: inherit;
	max-width: 560px;" class="wrapper">
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 13px; font-weight: 400; line-height: 150%;
			padding-top: 20px;
			padding-bottom: 20px;
			color: #999999;
			font-family: sans-serif;" class="footer">
              For more information <a href="https://runstream.co/contact" target="_blank" style=" color: #999999; ">contact us</a>. Our support
              team is available to help you 24 hours a day, seven days a week.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  try {
    const send = await SendEmail({
      email:user.email,
      subject:"🔑 Verify Your Email Address",
      message
    });
    console.log('send', send);
    res.status(200).json({
      status:true,
      message:"Mail verification link has been send. Please verify your email address."
    })
  } catch (err){
    console.log("err",err)
    user.mailVerificationToken = undefined;
    user.mailTokenExpire = undefined;
    await user.save({ validateBeforeSave:false });
    next(
      res.status(200).json({
        status:false,
        message:"Failed to send verification mail. Please try again later."
      })
    )
  }
});

const verifymail = catchAsync ( async (req, res, next) => {
  const hashToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({
    mailVerificationToken:hashToken,
    mailTokenExpire : { $gt: Date.now()}
  });
  if(!user){ 
    res.json({
      status:false,
      message:"Link expired or invalid token",
      error:user
    });
  }
  user.mailVerifiedAt = Date.now();
  user.mailVerificationToken = undefined;
  user.mailTokenExpire = undefined;
  await user.save({validateBeforeSave:false});
  
  res.json({
    status:true,
    message:"Mail verified successfully.",
  }); 
});

const signup = catchAsync(async (req, res, next) => {
  const { name, username, email, avatar, password, confirmPassword } = req.body;
  const isEmailUsed  =  await User.findOne({email : email});
  if(isEmailUsed){
    res.json({
      status : false,
      message : "Your given email address is already used."
    })
  }
  await User.syncIndexes();
  User.create({
    name: name,
    username: username,
    email: email,
    avatar: avatar,
    password: password,
    confirmPassword: confirmPassword,
    country: req.body.country,
    country_code: req.body.country_code,
    currency: req.body.currency
  }).then(result => {
    res.send({
      status: true,
      user: result,
      message: "Signup Successfully",
    });
  }).catch(err => {
    JSONerror(res, err, next);
    logger(err);
  });
});

const login = catchAsync ( async (req, res, next) => { 
   const { email, password, admin } = req.body;
   if(!email || !password){
      return next(new AppError("Email and password is required !!", 401))
   }
   const user = await User.findOne({email}).select('+password');
   if(admin && user && user.role !== '1'){
    res.status(200).json({
      status : false,
      message:"Invalid credentials.", 
     });
   }
   if(user && user.status === 'inactive'){
    res.status(200).json({
      status : false,
      message:"Your account is suspended !!",
     });
   }
   if(!user || !(await user.checkPassword(password, user.password))){
    res.status(200).json({
      status : false, 
      message:"Email or password is invalid !!",
     });   
   }
   const token = await signToken(user._id);
   res.cookie('jwt', token, {
    expires:new Date(Date.now() + 30*24*60*60*1000),
    httpOnly:true,
   });

   res.status(200).json({
    status :true,
    message:"Login Successfully !!",
    user : user,
    token
   });
});

const profile = catchAsync ( async (req, res) => {
  if(req.user){
     res.status(200).json({
      status:true,
      user : req.user,
    });
  } else {
    res.status(200).json({
     status:false,
     message:"Unauthorized",
    });
  }
});


const forgotPassword = catchAsync ( async (req, res, next) => {
  // 1. Check is email valid or not
  const user = await User.findOne({email:req.body.email});
  if(!user){
    res.json({
      status:false,
      message:"No user found associated with this email.",
    }); 
  } 
  // 2. Generate randow token string
  const resetToken = await user.createPasswordResetToken();
  await user.save({validateBeforeSave:false});
  // 3. send token to email using nodemailer
  const resetTokenUrl = `${process.env.DOMAIN_URL}/user/resetpassword/${resetToken}`;
 
  const message = `<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="content-type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0;">
  <meta name="format-detection" content="telephone=no" />

  <style>
    body{margin:0;padding:0;min-width:100%;width:100% !important;height:100% !important;}
body,table,td,div,p,a{-webkit-font-smoothing:antialiased;text-size-adjust:100%;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;line-height:100%;}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse !important;border-spacing:0;}
img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
#outlook a{padding:0;}
.ReadMsgBody{width:100%;}
.ExternalClass{width:100%;}
.ExternalClass,.ExternalClass p,.ExternalClass span,.ExternalClass font,.ExternalClass td,.ExternalClass div{line-height:100%;}
@media all and (min-width:560px){body{margin-top:30px;}
}
/* Rounded corners */
 @media all and (min-width:560px){.container{border-radius:8px;-webkit-border-radius:8px;-moz-border-radius:8px;-khtml-border-radius:8px;}
}
/* Links */
 a,a:hover{color:#127DB3;}
.footer a,.footer a:hover{color:#999999;}

  </style>
  <title>🔒 Reset Your Password</title>
</head>

<!-- BODY -->
<body topmargin="0" rightmargin="0" bottommargin="0" leftmargin="0" marginwidth="0" marginheight="0" width="100%" style="border-collapse: collapse; border-spacing: 0;  padding: 0; width: 100%; height: 100%; -webkit-font-smoothing: antialiased; text-size-adjust: 100%; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; line-height: 100%;
	background-color: #ffffff;
	color: #000000;" bgcolor="#ffffff" text="#000000">
  <table width="100%" align="center" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; width: 100%;" class="background">
    <tr>
      <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0;" bgcolor="#ffffff">
        <table border="0" cellpadding="0" cellspacing="0" align="center" bgcolor="#FFFFFF" width="560" style="border-collapse: collapse; border-spacing: 0; padding: 0; width: inherit;
	max-width: 560px;" class="container">
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 24px; font-weight: bold; line-height: 130%;padding-top: 25px;color: #000000;font-family: sans-serif;" class="header">
              <img border="0" vspace="0" hspace="0" src="https://runstream.co/logo-white.png" style="max-width: 250px;" alt="The Idea" title="Runstream" />
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%;
			padding-top: 25px;" class="line">
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 17px; font-weight: 400; line-height: 160%;
			padding-top: 25px; 
			color: #000000;
			font-family: sans-serif;" class="paragraph">
              Hi ${user.name || ""},<br> We received a request to reset your password for your runstream account. No worries, it happens to the best of us!
              <br>
              To reset your password, please click the button below:
              <br>
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; padding-top: 25px;padding-bottom: 5px;" class="button">
                <table border="0" cellpadding="0" cellspacing="0" align="center" style=" min-width: 120px; border-collapse: collapse; border-spacing: 0; padding: 0;">
                  <tr>
                    <td align="center" valign="middle" style="border-collapse: collapse;"  >
                      <a target="_blank" style="padding: 12px 24px; margin: 0; border-collapse: collapse; text-decoration: none; border-spacing: 0; border-radius: 10px; -webkit-border-radius: 10px; -moz-border-radius: 10px; -khtml-border-radius: 10px; background: #df3939; text-decoration: none; max-width: 240px;
                        color: #FFFFFF; font-family: sans-serif; font-size: 17px; font-weight: 400; line-height: 120%;"  href=${resetTokenUrl}>
                          Reset Password
                      </a>
                    </td>
                  </tr>
                </table>
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%;
			padding-top: 25px;" class="line">
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 17px; font-weight: 400; line-height: 160%;
			padding-top: 20px;
			padding-bottom: 25px;
			color: #000000;
			font-family: sans-serif;" class="paragraph">
              If you have any questions or need assistance, feel free to reach out to our support team at <a href="mailto:Support@runstream.co" target="_blank" style=" color: #4b57ff; ">support@runstream.co</a>. We’re here to help!. 
            </td>
          </tr>
        </table>
        <table border="0" cellpadding="0" cellspacing="0" align="center" width="560" style="border-collapse: collapse; border-spacing: 0; padding: 0; width: inherit;
	max-width: 560px;" class="wrapper">
          <tr>
            <td align="center" valign="top" style="border-collapse: collapse; border-spacing: 0; margin: 0; padding: 0; padding-left: 6.25%; padding-right: 6.25%; width: 87.5%; font-size: 13px; font-weight: 400; line-height: 150%;
			padding-top: 20px;
			padding-bottom: 20px;
			color: #999999;
			font-family: sans-serif;" class="footer">
              For more information <a href="https://runstream.co/contact" target="_blank" style=" color: #999999; ">contact us</a>. Our support
              team is available to help you 24 hours a day, seven days a week.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  try {
    const send = await SendEmail({
      email:user.email,
      subject:"🔒 Reset Your Password",
      message
    });
    console.log('send', send);
    res.status(200).json({
      status:true,
      message:"Password Reset link sent your email address."
    })
  } catch (err){
    console.log("err",err)
    user.passwordResetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save({ validateBeforeSave:false });
    next(
      res.status(200).json({
        status:false,
        message:"Failed to reset your password. Please try again later."
      })
    )
  }
});


const resetpassword = catchAsync ( async (req, res, next) => {
  // 1. get user token
  if(req.body.password !== req.body.confirmPassword){ 
    res.json({
      status:false,
      message:"Confirm password is incorrect. Please try again later.",
    }); 
  }
  const hashToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  // 2. Find token user and set new password 
  const user = await User.findOne({
    passwordResetToken:hashToken,
    resetTokenExpire : { $gt: Date.now()}
  });
  if(!user){ 
    res.json({
      status:false,
      message:"Link expired or invalid token.",
    }); 
  }
  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordResetToken = undefined;
  user.resetTokenExpire = undefined;
  await user.save({validateBeforeSave:false});

  // 3. Update changedPassswordAt Property

  // 4. login user in send JWT 
  // const token = await signToken(user._id);
  res.json({
    status:true,
    message:"Password changed successfully.",
  }); 
});

const contact_us = async (req, res, next) => {
    try {
      const { name, email, message } = req.body;
      const request =  await Inquiry.create({
        name : name,
        email : email,
        message : message
      });
      const result = await request.save();
      if(result){
        res.json({
          status : true,
          message : "Your request has been sent successfully."
        });
      } else {
        res.json({
          status : false,
          message : "Your request has been failed.",
          error : result
        });
      }
    } catch (err){
      JSONerror(res, err, next);
    }
};

const inquiries = async (req, res, next) => {
  try{ 
    const lists =  await Inquiry.find({});
      if(lists){
        res.json({
          status : true,
          result : lists || []
        });
      } else {
        res.json({
          error : lists,
          status : true,
          result : []
        });
      }
    } catch (err){
      JSONerror(res, err, next);
    }
};


module.exports = { inquiries, verifymail, sendVerifyEmail, contact_us, signup, login, validateToken, profile, forgotPassword, resetpassword };
