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
          let result = await User.findById(decode.id).populate('plan');
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
  const message = `<!doctype html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Verify Your Email Address</title>
        <style>
          @media only screen and (max-width: 620px) {
            table[class="body"] h1{font-size:28px !important;margin-bottom:10px !important;}
            table[class="body"] p,table[class="body"] ul,table[class="body"] ol,table[class="body"] td,table[class="body"] span,table[class="body"] a{font-size:16px !important;}
            table[class="body"] .wrapper,table[class="body"] .article{padding:10px !important;}
            table[class="body"] .content{padding:0 !important;}
            table[class="body"] .container{padding:0 !important;width:100% !important;}
            table[class="body"] .main{border-left-width:0 !important;border-radius:0 !important;border-right-width:0 !important;}
            table[class="body"] .btn table{width:100% !important;}
            table[class="body"] .btn a{width:100% !important;}
            table[class="body"] .img-responsive{height:auto !important;max-width:100% !important;width:auto !important;}
          }
          @media all {
            .ExternalClass{width:100%;}
            .ExternalClass,.ExternalClass p,.ExternalClass span,.ExternalClass font,.ExternalClass td,.ExternalClass div{line-height:100%;}
            .apple-link a{color:inherit !important;font-family:inherit !important;font-size:inherit !important;font-weight:inherit !important;line-height:inherit !important;text-decoration:none !important;}
            .btn-primary table td:hover{background-color:#014486 !important;}
            .btn-primary a:hover{background-color:#014486 !important;border-color:#014486 !important;}
          }
        </style>
      </head>
      <body class="" style="background-color: #f5f5f4; font-family: sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; margin: 0; padding: 0; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; background-color: #f5f5f4; width: 100%;" width="100%" bgcolor="#f5f5f4">
          <tr>
            <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;" valign="top">&nbsp;</td>
            <td class="container" style="font-family: sans-serif; font-size: 14px; vertical-align: top; display: block; max-width: 580px; padding: 10px; width: 580px; Margin: 0 auto;" width="580" valign="top">
              
              <div class="content" style="box-sizing: border-box; display: block; Margin: 0 auto; max-width: 580px; padding: 10px;">
                <!-- START CENTERED WHITE CONTAINER -->
                <span class="preheader" style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0;">This is preheader text. Some clients will show this text as a preview.</span>
                <table role="presentation" class="main" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; background: #ffffff; border-radius: 3px; width: 100%;" width="100%">
                  <tr>
                    <td style="list-style:10px;height:10px;" ></td>
                  </tr>
                  <tr>
                     <td class="align-center" width="100%" style="font-family: sans-serif; font-size: 14px; vertical-align: top; text-align: center;" valign="top" align="center">
                       <a href="https://runstream.co" style="color: #0d9dda; text-decoration: underline;"><img src="https://runstream.co/logo-white.png" height="80" alt="Salesforce Marketing Cloud" style="border: none; -ms-interpolation-mode: bicubic; max-width: 100%;"></a>
                     </td>
                   </tr>
                  <tr>
                    <td class="wrapper" style="font-family: sans-serif; font-size: 14px; vertical-align: top; box-sizing: border-box; padding: 20px;" valign="top">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; width: 100%;" width="100%">
                        <tr>
                          <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;" valign="top">
                            <p style="text-align: center; font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; margin-bottom: 10px;">Welcome to runstream</p>
                            <p style="text-align: center; font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; margin-bottom: 10px;">
                              You've entered ${user.email} as the email address of your email account.
                            </p>
                            <p style="text-align: center; font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; margin-bottom: 15px;"><strong>Please verify this email address by clicking button below.</strong></p>
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; box-sizing: border-box; width: 100%;" width="100%">
                              <tbody>
                                <tr>
                                  <td align="center" style="font-family: sans-serif; font-size: 14px; vertical-align: top; padding-bottom: 15px;" valign="top">
                                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: auto; width: auto;">
                                      <tbody>
                                        <tr>
                                          <td style="font-family: sans-serif; font-size: 14px; vertical-align: top; border-radius: 5px; 
                                          text-align: center; background-color: #ffffff;" valign="top" 
                                          align="center" bgcolor="#ffffff"> 
                                          <a href=${mailTokenUrl} target="_blank"  style="border: solid 1px #df3939;border-radius: 13px;box-sizing: border-box;cursor: pointer;display: inline-block;font-size: 14px;font-weight: bold;margin: 0;padding: 10px 33px;text-decoration: none;text-transform: capitalize;background-color: #df3939;border-color: #df3939;color: #ffffff;" >Verify email</a>
                                       </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="list-style:30px;height:30px;" ></td>
                  </tr>
                </table>
                <!-- START FOOTER -->
                <div class="footer" style="clear: both; Margin-top: 10px; text-align: center; width: 100%;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; width: 100%;" width="100%">
                    <tr>
                      <td class="content-block powered-by" style="font-family: sans-serif; vertical-align: top; padding-bottom: 10px; padding-top: 10px; color: #747474; font-size: 11px; text-align: center;" valign="top" align="center">
                        <a href="https://runstream.co" style="color: #747474; font-size: 14px; font-weight: 300; text-align: center; letter-spacing: -.75px; text-decoration: none;">Powered by runstream.co</a>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
            </td>
            <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;" valign="top">&nbsp;</td>
          </tr>
        </table>
      </body>
      </html>`;
  try {
    const send = await SendEmail({
      email:user.email,
      subject:"Verify your email address.",
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
    confirmPassword: confirmPassword
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
   const user = await User.findOne({email}).select('+password').populate('plan');
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
     return next(new AppError("No user found associated with this email.", 404));
  } 
  // 2. Generate randow token string
  const resetToken = await user.createPasswordResetToken();
  await user.save({validateBeforeSave:false});
  // 3. send token to email using nodemailer
  const resetTokenUrl = `${req.protocol}://${req.get('host')}/user/resetpassword/${resetToken}`;
 
  const message = `<!doctype html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Verify Your Email Address</title>
        <style>
          @media only screen and (max-width: 620px) {
            table[class="body"] h1{font-size:28px !important;margin-bottom:10px !important;}
            table[class="body"] p,table[class="body"] ul,table[class="body"] ol,table[class="body"] td,table[class="body"] span,table[class="body"] a{font-size:16px !important;}
            table[class="body"] .wrapper,table[class="body"] .article{padding:10px !important;}
            table[class="body"] .content{padding:0 !important;}
            table[class="body"] .container{padding:0 !important;width:100% !important;}
            table[class="body"] .main{border-left-width:0 !important;border-radius:0 !important;border-right-width:0 !important;}
            table[class="body"] .btn table{width:100% !important;}
            table[class="body"] .btn a{width:100% !important;}
            table[class="body"] .img-responsive{height:auto !important;max-width:100% !important;width:auto !important;}
          }
          @media all {
            .ExternalClass{width:100%;}
            .ExternalClass,.ExternalClass p,.ExternalClass span,.ExternalClass font,.ExternalClass td,.ExternalClass div{line-height:100%;}
            .apple-link a{color:inherit !important;font-family:inherit !important;font-size:inherit !important;font-weight:inherit !important;line-height:inherit !important;text-decoration:none !important;}
            .btn-primary table td:hover{background-color:#014486 !important;}
            .btn-primary a:hover{background-color:#014486 !important;border-color:#014486 !important;}
          }
        </style>
      </head>
      <body class="" style="background-color: #f5f5f4; font-family: sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; margin: 0; padding: 0; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; background-color: #f5f5f4; width: 100%;" width="100%" bgcolor="#f5f5f4">
          <tr>
            <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;" valign="top">&nbsp;</td>
            <td class="container" style="font-family: sans-serif; font-size: 14px; vertical-align: top; display: block; max-width: 580px; padding: 10px; width: 580px; Margin: 0 auto;" width="580" valign="top">
              
              <div class="content" style="box-sizing: border-box; display: block; Margin: 0 auto; max-width: 580px; padding: 10px;">
                <!-- START CENTERED WHITE CONTAINER -->
                <span class="preheader" style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0;">This is preheader text. Some clients will show this text as a preview.</span>
                <table role="presentation" class="main" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; background: #ffffff; border-radius: 3px; width: 100%;" width="100%">
                  <tr>
                    <td style="list-style:10px;height:10px;" ></td>
                  </tr>
                  <tr>
                     <td class="align-center" width="100%" style="font-family: sans-serif; font-size: 14px; vertical-align: top; text-align: center;" valign="top" align="center">
                       <a href="https://runstream.co" style="color: #0d9dda; text-decoration: underline;"><img src="https://runstream.co/logo-white.png" height="80" alt="Salesforce Marketing Cloud" style="border: none; -ms-interpolation-mode: bicubic; max-width: 100%;"></a>
                     </td>
                   </tr>
                  <tr>
                    <td class="wrapper" style="font-family: sans-serif; font-size: 14px; vertical-align: top; box-sizing: border-box; padding: 20px;" valign="top">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; width: 100%;" width="100%">
                        <tr>
                          <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;" valign="top">
                            <p style="text-align: center; font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; margin-bottom: 10px;">Welcome to runstream</p>
                            <p style="text-align: center; font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; margin-bottom: 10px;">
                              You've entered ${user.email} as the email address of your email account.
                            </p>
                            <p style="text-align: center; font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; margin-bottom: 15px;"><strong>Please verify this email address by clicking button below.</strong></p>
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; box-sizing: border-box; width: 100%;" width="100%">
                              <tbody>
                                <tr>
                                  <td align="center" style="font-family: sans-serif; font-size: 14px; vertical-align: top; padding-bottom: 15px;" valign="top">
                                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: auto; width: auto;">
                                      <tbody>
                                        <tr>
                                          <td style="font-family: sans-serif; font-size: 14px; vertical-align: top; border-radius: 5px; 
                                          text-align: center; background-color: #ffffff;" valign="top" 
                                          align="center" bgcolor="#ffffff"> 
                                          <a href=${mailTokenUrl} target="_blank"  style="border: solid 1px #df3939;border-radius: 13px;box-sizing: border-box;cursor: pointer;display: inline-block;font-size: 14px;font-weight: bold;margin: 0;padding: 10px 33px;text-decoration: none;text-transform: capitalize;background-color: #df3939;border-color: #df3939;color: #ffffff;" >Verify email</a>
                                       </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="list-style:30px;height:30px;" ></td>
                  </tr>
                </table>
                <!-- START FOOTER -->
                <div class="footer" style="clear: both; Margin-top: 10px; text-align: center; width: 100%;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; min-width: 100%; width: 100%;" width="100%">
                    <tr>
                      <td class="content-block powered-by" style="font-family: sans-serif; vertical-align: top; padding-bottom: 10px; padding-top: 10px; color: #747474; font-size: 11px; text-align: center;" valign="top" align="center">
                        <a href="https://runstream.co" style="color: #747474; font-size: 14px; font-weight: 300; text-align: center; letter-spacing: -.75px; text-decoration: none;">Powered by runstream.co</a>
                      </td>
                    </tr>
                  </table>
                </div>
              </div>
            </td>
            <td style="font-family: sans-serif; font-size: 14px; vertical-align: top;" valign="top">&nbsp;</td>
          </tr>
        </table>
      </body>
      </html>`;
  try {
    const send = await SendEmail({
      email:user.email,
      subject:"Reset your password.",
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
  const hashToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  // 2. Find token user and set new password 
  const user = await User.findOne({
    passwordResetToken:hashToken,
    resetTokenExpire : { $gt: Date.now()}
  });
  if(!user){ 
      next(new AppError("Link expired or invalid token", 500))
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
          status : false,
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


module.exports = { verifymail, sendVerifyEmail, contact_us, signup, login, validateToken, profile, forgotPassword, resetpassword };
