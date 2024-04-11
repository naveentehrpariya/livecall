const User = require("../db/Users");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync");
const {promisify} = require("util");
const AppError = require("../utils/AppError");
const SendEmail = require("../utils/Email");
const crypto = require("crypto");

const SECRET_ACCESS = process.env && process.env.SECRET_ACCESS;
const key = process && process.env && process.env.SECRET_ACCESS;

const signToken = async (id) => {
  const token = jwt.sign(
    {id}, 
    SECRET_ACCESS, 
    {expiresIn:'58m'}
  );
  return token
}

const signup = catchAsync(async (req, res) => {
  const { name, username, email, avatar, password, confirmPassword } = req.body;
  await User.syncIndexes();
  const result = await User.create({
    name: name,
    username: username,
    email: email,
    avatar: avatar,
    password: password,
    confirmPassword: confirmPassword
  });
  if(result){
    res.send({
        status: true,
        user: result,
        msg: "Signup Successfully",
    });
  } else {
    res.send({
        status: false,
        error: result,
        msg: "Failed to create user.",
    });
  }
});




const login = catchAsync ( async (req, res, next) => { 
   const { email, password } = req.body;
   if(!email || !password){
      return next(new AppError("Email and password is required !!", 401))
   }
   const user = await User.findOne({email}).select('+password');
   if(!user || !(await user.checkPassword(password, user.password))){
      return next(new AppError("Email or password is invalid !!", 401))
   }
   const token = await signToken(user._id);
   
   // Send jwt via cookie
   res.cookie('jwt', token, {
    expires:new Date(Date.now() + 30*24*60*60*1000),
    httpOnly:true,
   });

   res.status(200).json({
    message:"Login Successfully !!",
    user : user,
    token
   });
});


const validateToken = catchAsync ( async (req, res, next) => {

  let authHeader = req.headers.Authorization || req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer")) {
    let token = authHeader.split(" ")[1];
    if (!token) {
      next( new AppError("User is not authorized or token is missing", 403));
    }
    const decode = await promisify(jwt.verify)(token, key);
    if(decode){ 
      let result = await User.findById(decode.id);
      req.user = result;
      next(); 
    } else { 
      next(new AppError('User is not authorized', 401)); 
    }
  } else { 
    next( new AppError("Token is missing", 401));
  }
});


const profile = catchAsync ( async (req, res) => {
    res.json(req.user);
});


const forgotPassword = catchAsync ( async (req, res, next) => {
  // 1. Check is email valid or not
  const user = await User.findOne({email:req.body.email});
  if(!user){
     return next(new AppError("no user found associated with this email.", 404));
  } 
  // 2. Generate randow token string
  const resetToken = await user.createPasswordResetToken();
  await user.save({validateBeforeSave:false});
  // 3. send token to email using nodemailer
  const resetTokenUrl = `${req.protocol}://${req.get('host')}/user/resetpassword/${resetToken}`
  const message = `Forgot your password. Click ${resetTokenUrl} the link to reset your password.`
  console.log("resetTokenUrl", resetTokenUrl);
  console.log("message", message);
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






module.exports = {  signup, login, validateToken, profile, forgotPassword,resetpassword };
