const channelDetails = async (youtube, tt) => {
     try {
      const token = {
         "access_token":"ya29.a0AXooCgvMepbnw_9yjkCrMvEXWJuNxQF1zmJBAsg2u0KgiLI75NhZX4O14xYkgT732RmF1vcwbrd_bAEMNRrfcVMK9oYJk_j-k6OgCDAIJ5IWPL_q4LQaNUdgdGoPAe0rntoFZQ3tDPgAw2nCjcPRf-CTVkVqah0--wizaCgYKAeASAQ8SFQHGX2MioLqPMT-N79sy7cElj0IDFg0171",
         "refresh_token":"1//0gDtHJIlPJdreCgYIARAAGBASNwF-L9IrPyyke9T9yGElY3QdQCuC6AvOjyX_o2mJStqyjbY0W64ONUzkwQqU2eJTpsDkovTkwSI",
         "scope":"https://www.googleapis.com/auth/youtube.force-ssl",
         "token_type":"Bearer",
         "expiry_date":1716728162598
      }
      const response = await youtube.channels.list({
         part: 'nippet,contentDetails,statistics',
         mine: true,
         auth: token,
       });
       const channel = response.data.items[0];
       return channel;
     } catch (error) {
       console.error('Error retrieving channel details:', error);
       throw error;
     }
 };

 module.exports = channelDetails;
