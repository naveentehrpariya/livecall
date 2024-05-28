const crypto = require('crypto');
const YoutubeNotification = require('../db/YoutubeNotification');
const axios = require('axios');

const generateSecret = () => {
   return crypto.randomBytes(32).toString('hex');
};

const SubscribeYouTubeNotifications = async (userId, channelId, streamKey) => {
   try {
      const hubUrl = 'https://pubsubhubbub.appspot.com/subscribe';
      const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;
      const callbackUrl = `http://localhost:8080/notification/youtube/callback/${streamKey}`;
      const secret = generateSecret();

      await axios.post(hubUrl, null, {
         params: {
            'hub.mode': 'subscribe',
            'hub.topic': topicUrl,
            'hub.callback': callbackUrl,
            'hub.secret': secret,
            'hub.verify': 'async',
         },
      });
      const subscription = new YoutubeNotification ({
         userId,
         channelId,
         callbackUrl,
         secret,
         streamKey
      });

      const saved = await subscription.save();
      if(!saved){
         return {
            success: false,
            message: 'Failed to susbscribe youtube notifications.',
         }
      }
      return ({
         success: true,
         subscription : subscription
      });
   } catch (err) {
      console.error(`Error subscribing to YouTube notifications for channel ${channelId}:`, err);
   }
};
   
module.exports = SubscribeYouTubeNotifications;