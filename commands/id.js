const https = require("https");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

module.exports.config = {
  name: "ดาวน์โหลดติ๊กตอก",
  version: "1.1.0",
  description: "ดาวน์โหลดวิดีโอ TikTok แบบไม่มีลายน้ำ",
  commandCategory: "video",
  usages: "[ลิงก์ TikTok]",
  cooldowns: 10,
};

module.exports.run = async ({ api, event, args }) => {
  const videoUrl = args.join(" ");
  if (!videoUrl || !videoUrl.includes("tiktok.com")) {
    return api.sendMessage(
      "❌ กรุณาใส่ลิงก์ TikTok ที่ถูกต้อง!\n\nตัวอย่าง: ดาวน์โหลดติ๊กตอก https://www.tiktok.com/@user/video/123456789",
      event.threadID,
      event.messageID
    );
  }

  const startTime = Date.now();

  try {
    api.sendMessage(`⏳ กำลังดาวน์โหลดวิดีโอจากลิงก์ที่ให้มา...`, event.threadID, event.messageID);

    // ขยายลิงก์ย่อ TikTok
    const expandedUrl = await axios.head(videoUrl, { maxRedirects: 10 }).then((response) => response.request.res.responseUrl);

    // เรียก API จาก RapidAPI
    const options = {
      method: "GET",
      url: "https://tiktok-video-downloader-api.p.rapidapi.com/media",
      params: { videoUrl: expandedUrl },
      headers: {
        "x-rapidapi-key": "d135e7c350msh72a1738fece929ap11d731jsn0012262e1cd5",
        "x-rapidapi-host": "tiktok-video-downloader-api.p.rapidapi.com",
      },
    };

    const response = await axios.request(options);
    if (!response.data || !response.data.data || !response.data.data.play) {
      return api.sendMessage("❌ ไม่พบวิดีโอในลิงก์นี้ กรุณาลองใหม่!", event.threadID, event.messageID);
    }

    const videoLink = response.data.data.play;
    const filePath = path.join(__dirname, "cache", `tiktok_${Date.now()}.mp4`);

    // ดาวน์โหลดวิดีโอ
    const writer = fs.createWriteStream(filePath);
    const downloadResponse = await axios({
      url: videoLink,
      method: "GET",
      responseType: "stream",
    });
    downloadResponse.data.pipe(writer);

    writer.on("finish", () => {
      const endTime = Date.now();
      const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

      const message = {
        body: `🎥 ดาวน์โหลดเสร็จสิ้น!\n✅ ใช้เวลา: ${timeTaken} วินาที\n\n📌 ลิงก์: ${expandedUrl}`,
        attachment: fs.createReadStream(filePath),
      };

      api.sendMessage(message, event.threadID, () => fs.unlinkSync(filePath), event.messageID);
    });

    writer.on("error", () => {
      api.sendMessage("❌ เกิดข้อผิดพลาดในการดาวน์โหลดวิดีโอ!", event.threadID, event.messageID);
    });
  } catch (error) {
    console.error("❌ ข้อผิดพลาด:", error);
    api.sendMessage("❌ ไม่สามารถประมวลผลได้ในขณะนี้ โปรดลองอีกครั้ง!", event.threadID, event.messageID);
  }
};
