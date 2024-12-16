const axios = require("axios");

module.exports.config = {
  name: "สุ่มgifอนิเมะ",
  version: "1.0",
  hasPermssion: 0,
  credits: "YourName",
  description: "สุ่ม GIF อนิเมะจาก API",
  commandCategory: "fun",
  usages: "สุ่มgifอนิเมะ",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event }) {
  try {
    // ดึงข้อมูลจาก API
    const response = await axios.get("https://nekos.best/api/v2/hug?amount=2");
    const data = response.data.results;

    if (!data || data.length === 0) {
      return api.sendMessage("❌ ไม่พบ GIF อนิเมะในตอนนี้ ลองใหม่อีกครั้ง!", event.threadID, event.messageID);
    }

    // สุ่มเลือก GIF 1 รายการจากผลลัพธ์
    const randomGif = data[Math.floor(Math.random() * data.length)];

    // ส่งข้อความและ GIF กลับไปยังผู้ใช้
    api.sendMessage(
      {
        body: `🎬 GIF จากอนิเมะ: ${randomGif.anime_name}`,
        attachment: await global.utils.getStreamFromURL(randomGif.url),
      },
      event.threadID,
      event.messageID
    );
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    api.sendMessage("❌ เกิดข้อผิดพลาดในการสุ่ม GIF กรุณาลองใหม่อีกครั้ง!", event.threadID, event.messageID);
  }
};
