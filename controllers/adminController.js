const Files = require("../db/Files");
const User = require("../db/Users");
const Stream = require("../db/Stream");
const Subscription = require("../db/Subscription");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");

const isAdmin = catchAsync ( async (req, res, next) => {
   // const user = req.user;
   // if (user.role !== '1'){
   //    return res.json({
   //       status: false,
   //       message: 'You dont have permission for this action.'
   //    });
   // }
   next();
});

const dashboard = catchAsync(async (req, res) => {
   const totalUsers = await User.countDocuments();
   const totalStreams = await Stream.countDocuments();
   const totalActiveSubscriptions = await Subscription.countDocuments({ status: 'active' });
   const totalInactiveSubscriptions = await Subscription.countDocuments({ status: 'inactive' });
 
   res.json({
     status: true,
     message: 'Dashboard data retrieved successfully.',
     data: {
       totalUsers,
       totalStreams,
       totalActiveSubscriptions,
       totalInactiveSubscriptions,
     },
   });
});

// all/ image / video / audio
const medias = catchAsync(async (req, res) => {
   const mimeTypes = {
     image: 'image/',
     video: 'video/',
     audio: 'audio/'
   };
   const { type } = req.params;
   let mimeFilter;
   if (type === 'all') {
     mimeFilter = { $regex: '.*' }; 
   } else if (mimeTypes[type]) {
     mimeFilter = { $regex: `^${mimeTypes[type]}` };
   } else {
     return res.status(400).json({
       status: false,
       message: "Invalid type parameter"
     });
   }
   const Query = new APIFeatures(
      Files.find({
         mime: mimeFilter,
      }),
      req.query
   ).sort().paginate();
   const files = await Query.query;
   res.json({
     status: true,
     result: files.length ? files : [],
     message: files.length ? "Files retrieved successfully." : "No files found !!"
   });
});

const users = catchAsync(async (req, res) => {

   const Query = new APIFeatures(
     User.find({}),
     req.query
   ).sort().paginate();
   const users = await Query.query;
   res.json({
     status: true,
     result: users || [],
     message: users.length ? "Users retrieved successfully !!." : "No files found"
   });
});

const EnableDisableUser = catchAsync(async (req, res) => {
   const { id } = req.params;
   const user = await User.findById(id);
   console.log(user);
   if(user && user.status == 'active'){
      user.status = 'inactive';
   } else {
     user.status = 'active';
   }
   const result = await user.save();
   if(result){
      res.json({
         status: true,
         message:result.status == 'active' ? "User marked as active." : "User marked as inactive.",
         result: result
      });
   } else { 
      res.json({
         status: false,
         message: "Failed to update user status."
      });
   }
});

const streams = catchAsync(async (req, res) => {
   const Query = new APIFeatures(
     Stream.find({}),
     req.query
   ).sort().paginate();
   const data = await Query.query;
   res.json({
     status: true,
     result: data || [],
     message: data.length ? "Streams retrieved successfully !!." : "No files found"
   });
});

const subscriptions = catchAsync(async (req, res) => {
   const { type } = req.params;
   const Query = new APIFeatures(
     Subscription.find({ status : type}),
     req.query
   ).sort().paginate();
   const data = await Query.query;
   res.json({
     status: true,
     result: data || [],
     message: data.length ? "Subscriptions retrieved successfully !!." : "No files found"
   });
});

module.exports = { isAdmin, dashboard, medias, users, streams, subscriptions, EnableDisableUser } 