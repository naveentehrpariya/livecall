const User = require("../db/Users");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const filterObj = async (obj, ...allowed) => { 
   let newObj = {};
   Object.keys(obj).forEach(el=>{ 
      if(allowed.includes(el)) newObj[el]= obj[el];
   });
   return newObj;
}

exports.updateCurrentUserData = catchAsync( async (req, res, next) => { 
   if(req.body.password || req.body.confirmPassword){
      return next(new AppError('Password can not changed via this request.', 400));
   }
   const allowedFields = await filterObj(req.body, 'name', 'email');
   const user = await User.findByIdAndUpdate(req.user.id, allowedFields, {
      new : true, 
      runValidators : true
   });
   return res.status(200).json({
      status:true,
      user: user,
      message:"User updated !!"
   });
});


exports.deleteCurrentUser = catchAsync( async (req, res, next) => { 
   const user = await User.findByIdAndUpdate(req.user.id, { active:false});
   return res.status(200).json({
      status:true,
      user:user,
      message:"User account is disabled !!"
   });
});