const axios = require("axios");
const fs = require("fs");

module.exports.config = {
  name: "โหลดtiktok",
  version: "1.0",
  hasPermssion: 0,
  credits: "YourName",
  description: "ดาวน์โหลดวิดีโอ TikTok แบบไม่มีลายน้ำ",
  commandCategory: "ดาวน์โหลด",
  usages: "โหลดtiktok [ลิ้งค์ TikTok]",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event, args }) {
  try {
    // ตรวจสอบว่าผู้ใช้ใส่ลิ้งค์มาหรือไม่
    if (args.length === 0) {
      return api.sendMessage("❌ กรุณาใส่ลิ้งค์ TikTok ที่ต้องการดาวน์โหลด เช่น: โหลดtiktok https://vm.tiktok.com/ZS6Rts7R4/", event.threadID, event.messageID);
    }

    const tiktokUrl = args[0];
    const apiUrl = `https://nethwieginedev.vercel.app/api/tiktokdl?link=${encodeURIComponent(tiktokUrl)}`;

    api.sendMessage("🔄 กำลังดาวน์โหลดวิดีโอจาก TikTok แบบไม่มีลายน้ำ โปรดรอสักครู่...", event.threadID, event.messageID);

    // เรียก API เพื่อดึงลิ้งค์วิดีโอ
    const response = await axios.get(apiUrl);
    const { success, link } = response.data;

    if (!success || !link) {
      return api.sendMessage("❌ ไม่สามารถดาวน์โหลดวิดีโอได้ โปรดตรวจสอบลิ้งค์และลองใหม่อีกครั้ง!", event.threadID, event.messageID);
    }

    // ดาวน์โหลดวิดีโอ
    const filePath = __dirname + `/cache/tiktok_${Date.now()}.mp4`;
    const videoResponse = await axios({
      url: link,
      method: "GET",
      responseType: "stream",
    });

    const writer = fs.createWriteStream(filePath);
    videoResponse.data.pipe(writer);

    writer.on("finish", () => {
      api.sendMessage(
        {
          body: "✨ ดาวน์โหลดวิดีโอ TikTok เสร็จเรียบร้อยแล้ว!",
          attachment: fs.createReadStream(filePath),
        },
        event.threadID,
        () => fs.unlinkSync(filePath), // ลบไฟล์หลังส่งเสร็จ
        event.messageID
      );
    });

    writer.on("error", () => {
      api.sendMessage("❌ เกิดข้อผิดพลาดในการดาวน์โหลดวิดีโอ", event.threadID, event.messageID);
    });

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    api.sendMessage("❌ ไม่สามารถดาวน์โหลดวิดีโอ TikTok ได้ โปรดลองใหม่อีกครั้ง!", event.threadID, event.messageID);
  }
};
