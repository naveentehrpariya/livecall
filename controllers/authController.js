const User = require("../db/Users");
const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync");
const {promisify} = require("util");
const AppError = require("../utils/AppError");
const SendEmail = require("../utils/Email");
const crypto = require("crypto");
const JSONerror = require("../utils/jsonErrorHandler");
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
  });
});

const login = catchAsync ( async (req, res, next) => { 
   const { email, password } = req.body;
   if(!email || !password){
      return next(new AppError("Email and password is required !!", 401))
   }
   const user = await User.findOne({email}).select('+password').populate('plan');
   if(user.status === 'inactive'){
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
  const resetTokenUrl = `${req.protocol}://${req.get('host')}/user/resetpassword/${resetToken}`
  const message = `Forgot your password. Click ${resetTokenUrl} the link to reset your password.`
  try {
    const send = await SendEmail({
      email:user.email,
      subject:"Reset your password.",
      message
    });
    console.log('send', send);
    res.status(200).json({message:"Password Reset link sent your email address."})
  } catch (err){
    user.passwordResetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save({ validateBeforeSave:false });
    next(new AppError("Failed to send mail. Please try again later.", 500))
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
  user.confirmPassword = req.body.password;
  user.passwordResetToken = undefined;
  user.resetTokenExpire = undefined;
  await user.save({validateBeforeSave:false});

  // 3. Update changedPassswordAt Property

  // 4. login user in send JWT 
  const token = await signToken(user._id);
  res.json({
    message:"Password changed successfully.",
    token
  }); 
});

module.exports = { signup, login, validateToken, profile, forgotPassword, resetpassword };
