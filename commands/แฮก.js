const axios = require('axios');
const fs = require('fs-extra');

module.exports.config = {
  name: 'imgbb',
  version: '1.0.0',
  role: 0,
  aliases: ['uploadimg'],
  description: 'Upload an image to IMGBB and get the link',
  usage: '<reply to an image>',
  credits: 'Rized',
  cooldown: 3,
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID, messageReply } = event;
  const imageUrl = messageReply?.attachments?.[0]?.url;

  if (!imageUrl) {
    api.sendMessage(
      '❌ Please reply to an image to upload it to IMGBB!',
      threadID,
      messageID
    );
    return;
  }

  const apiUrl = `https://kaiz-apis.gleeze.com/api/imgbb?url=${encodeURIComponent(imageUrl)}`;

  api.sendMessage(
    '🌐 Uploading the image to IMGBB, please wait...',
    threadID,
    async (err, info) => {
      if (err) return;

      try {
        const response = await axios.get(apiUrl);
        const { link } = response.data;

        if (link) {
          api.sendMessage(
            `✅ Image uploaded successfully!\n\n🌐 Link: ${link}`,
            threadID,
            messageID
          );
        } else {
          api.editMessage(
            '❌ Failed to upload the image. Please try again.',
            info.messageID
          );
        }
      } catch (error) {
        console.error('Error during image upload:', error);
        api.editMessage(
          '❌ An error occurred while processing your request. Please try again later.',
          info.messageID
        );
      }
    }
  );
};
