const axios = require("axios");
const fs = require("fs");

module.exports.config = {
  name: "อิโมจิเป็นgif",
  version: "1.1",
  hasPermssion: 0,
  credits: "YourName",
  description: "แปลงอิโมจิเป็น GIF ผ่าน API",
  commandCategory: "fun",
  usages: "อิโมจิเป็นgif [อิโมจิ]",
  cooldowns: 3,
};

module.exports.run = async function ({ api, event, args }) {
  try {
    if (args.length === 0) {
      return api.sendMessage("❌ กรุณาใส่อิโมจิที่ต้องการแปลงเป็น GIF เช่น 😝", event.threadID, event.messageID);
    }

    const emoji = args.join(" ");
    const apiUrl = `https://api.joshweb.click/emoji2gif?q=${encodeURIComponent(emoji)}`;

    api.sendMessage("🔄 กำลังแปลงอิโมจิเป็น GIF...", event.threadID, event.messageID);

    // ตรวจสอบผลลัพธ์จาก API
    const response = await axios.get(apiUrl);
    const gifUrl = response.request.res.responseUrl; // ดึง URL ปลายทาง

    console.log("📌 ตรวจสอบ URL ที่ได้:", gifUrl); // ตรวจสอบใน console

    if (!gifUrl) {
      return api.sendMessage("❌ ไม่พบ GIF สำหรับอิโมจินี้ ลองใช้อิโมจิอื่นดูนะ!", event.threadID, event.messageID);
    }

    // ดาวน์โหลด GIF
    const filePath = __dirname + `/cache/emoji_${Date.now()}.gif`;
    const gifResponse = await axios({
      url: gifUrl,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(filePath);
    gifResponse.data.pipe(writer);

    writer.on("finish", () => {
      api.sendMessage(
        {
          body: `✨ นี่คือ GIF สำหรับอิโมจิ "${emoji}" ที่คุณเลือก!`,
          attachment: fs.createReadStream(filePath),
        },
        event.threadID,
        () => fs.unlinkSync(filePath), // ลบไฟล์หลังส่งเสร็จ
        event.messageID
      );
    });
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    api.sendMessage("❌ ไม่สามารถแปลงอิโมจิเป็น GIF ได้ในขณะนี้ ลองใหม่อีกครั้งนะ!", event.threadID, event.messageID);
  }
};
