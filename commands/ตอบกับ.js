const axios = require("axios");
const fs = require("fs");

module.exports.config = {
  name: "reply_image",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Your Name",
  description: "ตอบกลับภาพที่คุณส่งหรือภาพที่คุณตอบกลับ",
  commandCategory: "utility",
  usages: "[คำอธิบาย]",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event, args }) {
  const { messageReply, threadID, messageID } = event;

  // ตรวจสอบว่าเป็นการตอบกลับภาพหรือไม่
  if (!messageReply || !messageReply.attachments || messageReply.attachments[0].type !== "photo") {
    return api.sendMessage("❗ กรุณาตอบกลับภาพที่ต้องการ", threadID, messageID);
  }

  try {
    const imageUrl = messageReply.attachments[0].url;

    // ดาวน์โหลดภาพ
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imagePath = `${__dirname}/cache/replied_image.jpg`;
    fs.writeFileSync(imagePath, Buffer.from(response.data, "binary"));

    // ตอบกลับด้วยภาพเดิม
    return api.sendMessage(
      { body: "✅ นี่คือภาพที่คุณตอบกลับ!", attachment: fs.createReadStream(imagePath) },
      threadID,
      () => fs.unlinkSync(imagePath),
      messageID
    );
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    return api.sendMessage("❗ ไม่สามารถดึงภาพได้ กรุณาลองใหม่อีกครั้ง", threadID, messageID);
  }
};
