const axios = require("axios");

module.exports.config = {
  name: "อิโมจิเป็นgif",
  version: "1.0",
  hasPermssion: 0,
  credits: "YourName",
  description: "แปลงอิโมจิเป็น GIF ผ่าน API",
  commandCategory: "fun",
  usages: "อิโมจิเป็นgif [อิโมจิ]",
  cooldowns: 3,
};

module.exports.run = async function ({ api, event, args }) {
  try {
    // ตรวจสอบว่าผู้ใช้ใส่อิโมจิหรือไม่
    if (args.length === 0) {
      return api.sendMessage("❌ กรุณาใส่อิโมจิที่ต้องการแปลงเป็น GIF เช่น 😝", event.threadID, event.messageID);
    }

    const emoji = args.join(" "); // ดึงอิโมจิที่ผู้ใช้ส่งมา
    const apiUrl = `https://api.joshweb.click/emoji2gif?q=${encodeURIComponent(emoji)}`;

    api.sendMessage("🔄 กำลังแปลงอิโมจิเป็น GIF...", event.threadID, event.messageID);

    // เรียก API และดึง URL GIF
    const response = await axios.get(apiUrl);
    const gifUrl = response.data.url;

    if (!gifUrl) {
      return api.sendMessage("❌ ไม่พบ GIF สำหรับอิโมจินี้ ลองใช้อิโมจิอื่นดูนะ!", event.threadID, event.messageID);
    }

    // ดาวน์โหลด GIF ชั่วคราว
    const path = __dirname + `/cache/emoji_${Date.now()}.gif`;
    const gifResponse = await axios({
      url: gifUrl,
      method: "GET",
      responseType: "stream",
    });

    await new Promise((resolve, reject) => {
      const writer = gifResponse.data.pipe(require("fs").createWriteStream(path));
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // ส่ง GIF กลับไปที่แชท
    api.sendMessage(
      {
        body: `✨ นี่คือ GIF สำหรับอิโมจิ "${emoji}" ที่คุณเลือก!`,
        attachment: require("fs").createReadStream(path),
      },
      event.threadID,
      () => require("fs").unlinkSync(path), // ลบไฟล์หลังส่งเสร็จ
      event.messageID
    );
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error.message);
    api.sendMessage("❌ ไม่สามารถแปลงอิโมจิเป็น GIF ได้ในขณะนี้ ลองใหม่อีกครั้งนะ!", event.threadID, event.messageID);
  }
};
