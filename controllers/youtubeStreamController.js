const Stream = require("../db/Stream");
const catchAsync  = require("../utils/catchAsync");
const Subscription = require("../db/Subscription");
const Token = require("../db/Token");

const checkUserStreamLimit = catchAsync ( async (req, res, next) => {
  const user = req.user._id;
  const userStreams = await Stream.find({ user: user, status: 1 }).populate('user');
  console.log("userStreams",userStreams)
  const userSubscription = await Subscription.findOne({ user: user, status: 'active' }).populate('plan');
  if (userSubscription && userSubscription._id) {
      if ((userStreams.length+1) > user.streamLimit) {
        return res.json({ 
          status: false,
          message: 'You have reached your allowed stream limit. Please upgrade to higher plan.'
        }); 
      } else { 
        next();
      }
  } else {
    if (req.user.trialStatus === 'active') {
        if (userStreams.length > 0) {
          return res.json({
            status: false,
            message: 'You are allowed only 1 stream in free trial. Please upgrade subscription to create another stream.'
          });
        }
        next();
    } else {
      return res.json({
        status: false,
        message: "You free trial has been ended. You don't have any active subscription plan to start a live stream."
      });
  }
  }
});

const active_stream_lists = catchAsync ( async (req, res)=>{

  let queryObj = {
    $or: [{ deletedAt: null }]
  };
  queryObj.user = req.user._id;
  const records = await Stream.find(queryObj).populate('user').sort({createdAt: -1});

  if (records) {
    res.json({
      status : true,
      streams : records
    });
  } else {
    res.json({
      status : false,
      streams : [],
      error : records
    });
  }
});

const streamDetails = catchAsync ( async (req, res)=>{
  const streamId  = req.params.streamId;
  const record = await Stream.findById(streamId);
  if (record) {
    res.json({
      status : true,
      stream : record
    });
  } else {
    res.json({
      status : false,
      stream : null,
      message:"Stream not found.",
      error:record
    });
  }
});

const deleteStream = catchAsync ( async (req, res)=>{
  const streamId  = req.params.streamId;
  const record = await Stream.findById(streamId);
  record.deletedAt = Date.now();
  const saved = await record.save();

  if (saved) {
    res.json({
      status : true,
      message:"Stream deleted successfully.",
      stream : saved
    });
  } else {
    res.json({
      status : false,
      stream : null,
      message:"Stream not found.",
      error:record
    });
  }
});

const checkIsYoutubeLinked = catchAsync ( async (req, res)=>{
  const tokens = await Token.findOne({user: req.user._id, status:"active"});
  if (tokens) {
    res.json({
      status : true,
      token : tokens
    });
  } else {
    res.json({
      status : false,
      message : "Youtube account is not linked yet."
    });
  }
});
 
const unLinkYoutube = catchAsync ( async (req, res)=>{
  const tokens = await Token.findOne({user: req.user._id, status :"active"});
  tokens.status = "notactive";
  const saved = await tokens.save();
  if (saved){
    res.json({
      status : true,
      message : "Youtube account is unlinked successfully."
    });
  } else {
    res.json({
      status : false,
      message : "Youtube account is not unlinked."
    });
  }
});
 
module.exports = {  deleteStream, streamDetails, unLinkYoutube, checkIsYoutubeLinked, active_stream_lists, checkUserStreamLimit  } 