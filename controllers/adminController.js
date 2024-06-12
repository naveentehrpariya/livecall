const Files = require("../db/Files");
const User = require("../db/Users");
const Stream = require("../db/Stream");
const Subscription = require("../db/Subscription");
const APIFeatures  = require("../utils/APIFeatures");
const catchAsync  = require("../utils/catchAsync");
const path = require("path");
const fs = require("fs");
const Inquiry = require("../db/Inquiry");
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
   const activeUsers = await User.countDocuments({ status: 'active' });
   const inactiveUsers = await User.countDocuments({ status: 'inactive' });
   const totalStreams = await Stream.countDocuments();
   const totalliveStreams = await Stream.countDocuments({ status: 1 });
   const totalInactiveStreams = await Stream.countDocuments({ status: 0 });
   const totalSubscriptions = await Subscription.countDocuments();
   const inactiveSubscriptions = await Subscription.countDocuments({ status: 'inactive' });
   const totalActiveSubscriptions = await Subscription.countDocuments({ status: 'paid' });
  //  const totalExpiredSubscriptions = await Subscription.countDocuments({ status: 'expired' });
 
   res.json({
     status: true,
     message: 'Dashboard data retrieved successfully.',
     result: [

      { route:"/admin/users", title : 'Total Users', data: totalUsers },
      { route:"/admin/users/active", title : 'Active Users', data: activeUsers },
      { route:"/admin/users/inactive", title : 'Inactive Users', data: inactiveUsers },

      { route:"/admin/streams/all", title : 'Total Streams', data: totalStreams },
      { route:"/admin/streams/1", title : 'Live Streams', data: totalliveStreams },
      { route:"/admin/streams/0", title : 'Ended Streams', data: totalInactiveStreams },

      { route:"/admin/subscriptions/all", title : 'Total Subscriptions', data: totalSubscriptions },
      { route:"/admin/subscriptions/paid", title : 'Active Subscriptions', data: totalActiveSubscriptions },
      { route:"/admin/subscriptions/inactive", title : 'Inactive Subscriptions', data: inactiveSubscriptions },
     ] 
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
   let mimeFilter = { $regex: `^${mimeTypes[type]}` };
   const Query = new APIFeatures(
      Files.find({mime: mimeFilter}),
      req.query
   ).sort();
   const { query, totalDocuments, page, limit, totalPages } = await Query.paginate();
   const data = await query;
   res.json({
      status: true,
      total: totalDocuments,
      current_page: page,
      total_pages: totalPages,
      limit:limit,
      result: data || [],
      message: data.length ? "Files retrieved successfully." : "No files found !!"
   });
});

const users = catchAsync(async (req, res) => {
  const {status} = req.params;
  let Query = new APIFeatures(
    User.find({status : status}).populate("plan"),
    req.query
  ).sort();
  const { query, totalDocuments, page, limit, totalPages } = await Query.paginate();
  const users = await query;
  res.json({
    status: true,
    total: totalDocuments,
    current_page: page,
    total_pages: totalPages,
    limit:limit,
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
   const { type } = req.params;
    let Query;
    if(type === "all"){
      Query = new APIFeatures(
        Stream.find({}).populate('user'),
        req.query
      ).sort();
    } else {  
      Query = new APIFeatures(
        Stream.find({status: type}).populate('user'),
        req.query
      ).sort();
    }

  const { query, totalDocuments, page, limit, totalPages } = await Query.paginate();
    
   const data = await query;
   res.json({
      status: true,
      total: totalDocuments,
      current_page: page,
      total_pages: totalPages,
      limit:limit,
      result: data || [],
      message: data.length ? "Streams retrieved successfully !!." : "No files found"
   });
});

const subscriptions = catchAsync(async (req, res) => {
   const { type } = req.params;
   let Query;
   if(type == 'all'){
     Query = new APIFeatures(
       Subscription.find().populate(["user", 'plan']),
       req.query
     ).sort();
    } else {
      Query = new APIFeatures(
        Subscription.find({ status : type}).populate(["user", 'plan']),
        req.query
      ).sort();
   }
   const { query, totalDocuments, page, limit, totalPages } = await Query.paginate();
   const data = await query;
   res.json({
      status: true,
      total: totalDocuments,
      current_page: page,
      total_pages: totalPages,
      limit:limit,
      result: data || [],
      message: data.length ? "Subscriptions retrieved successfully !!." : "No files found !!"
   });
});

const allinquries = catchAsync(async (req, res) => {
  let Query = new APIFeatures(
    Inquiry.find({}),
    req.query
  ).sort();
  const { query, totalDocuments, page, limit, totalPages } = await Query.paginate();
  const users = await query;
  res.json({
    status: true,
    total: totalDocuments,
    current_page: page,
    total_pages: totalPages,
    limit:limit,
    result: users || [],
    message: users.length ? "All Inquiries retrieved." : "No Inquiries found !!"
  });
});



const readLogs = catchAsync(async (req, res) => {
  const logFile = path.join(__dirname, '..', 'logs', 'app.log');
  fs.readFile(logFile, 'utf8', (err, data) => {
    if (err) {
      res.json({
        status: false,
        message: "Error reading logs file."
      });
    } else {
      const logs = data.split('\n').filter(log => log).map(log => {
        const parts = log.split(' [INFO]:');
        return {
          timestamp: parts[0],
          message: parts[1].replace(/"/g, '')
        };
      });

      res.json({
        status: true,
        result: logs
      });
    }
  });
});

const clearlog = catchAsync(async (req, res) => {
  const logFile = path.join(__dirname, '..', 'logs', 'app.log');
  fs.writeFile(logFile, '', (err) => {
    if (err) {
      res.json({
        status: false,
        message: "Error clearing logs file."
      });
    } else {
      res.json({
        status: true,
        message: "Logs file cleared successfully."
      });
    }
  });
});


module.exports = { allinquries, clearlog, readLogs, isAdmin, dashboard, medias, users, streams, subscriptions, EnableDisableUser } 