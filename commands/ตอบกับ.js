const axios = require("axios");
const fs = require("fs");

module.exports.config = {
  name: "reply_image",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Your Name",
  description: "ตอบกลับภาพและส่งภาพกลับ",
  commandCategory: "utility",
  usages: "",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event }) {
  const { messageReply, threadID, messageID } = event;

  // ตรวจสอบว่ามีการตอบกลับข้อความหรือไม่
  if (!messageReply) {
    return api.sendMessage("❗ กรุณาตอบกลับภาพที่ต้องการ", threadID, messageID);
  }

  // ตรวจสอบว่าเป็นภาพหรือไม่
  if (!messageReply.attachments || messageReply.attachments[0].type !== "photo") {
    return api.sendMessage("❗ กรุณาตอบกลับภาพเท่านั้น", threadID, messageID);
  }

  try {
    const imageUrl = messageReply.attachments[0].url; // URL ของภาพที่ตอบกลับ

    // ดาวน์โหลดภาพจาก URL
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imagePath = `${__dirname}/cache/replied_image.jpg`;
    fs.writeFileSync(imagePath, Buffer.from(response.data, "binary"));

    // ส่งภาพกลับ
    return api.sendMessage(
      {
        body: "✅ นี่คือภาพที่คุณตอบกลับ!",
        attachment: fs.createReadStream(imagePath),
      },
      threadID,
      () => fs.unlinkSync(imagePath), // ลบภาพหลังจากส่งเสร็จ
      messageID
    );
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการประมวลผลภาพ:", error);
    return api.sendMessage("❗ ไม่สามารถประมวลผลภาพได้ กรุณาลองใหม่อีกครั้ง", threadID, messageID);
  }
};
