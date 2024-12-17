module.exports.config = {
  name: "ดาวน์โหลดติ๊กตอก",
  version: "1.0.0",
  description: "ดาวน์โหลดวิดีโอ TikTok แบบไม่มีลายน้ำ",
  commandCategory: "video",
  usages: "[ลิงก์ TikTok]",
  cooldowns: 10,
};

module.exports.run = async ({ api, event, args }) => {
  const https = require("https");
  const fs = require("fs");
  const path = require("path");

  const videoUrl = args.join(" ");
  if (!videoUrl || !videoUrl.includes("tiktok.com")) {
    return api.sendMessage(
      "❌ กรุณาใส่ลิงก์ TikTok ที่ถูกต้อง!\n\nตัวอย่าง: ดาวน์โหลดติ๊กตอก https://www.tiktok.com/@user/video/123456789",
      event.threadID,
      event.messageID
    );
  }

  const options = {
    method: "GET",
    hostname: "tiktok-video-downloader-api.p.rapidapi.com",
    path: `/media?videoUrl=${encodeURIComponent(videoUrl)}`,
    headers: {
      "x-rapidapi-key": "d135e7c350msh72a1738fece929ap11d731jsn0012262e1cd5",
      "x-rapidapi-host": "tiktok-video-downloader-api.p.rapidapi.com",
    },
  };

  const startTime = Date.now();

  try {
    api.sendMessage(`⏳ กำลังดาวน์โหลดวิดีโอจากลิงก์ที่ให้มา...`, event.threadID, event.messageID);

    const req = https.request(options, function (res) {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", async () => {
        const body = JSON.parse(Buffer.concat(chunks).toString());

        if (!body.data || !body.data.play) {
          return api.sendMessage("❌ ไม่พบวิดีโอในลิงก์นี้ กรุณาลองใหม่!", event.threadID, event.messageID);
        }

        const videoLink = body.data.play;
        const filePath = path.join(__dirname, "cache", `tiktok_${Date.now()}.mp4`);

        // ดาวน์โหลดไฟล์วิดีโอ
        const file = fs.createWriteStream(filePath);
        https.get(videoLink, (response) => {
          response.pipe(file);
          file.on("finish", () => {
            file.close();

            const endTime = Date.now();
            const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

            const message = {
              body: `🎥 ดาวน์โหลดเสร็จสิ้น!\n✅ ใช้เวลา: ${timeTaken} วินาที\n\n📌 ลิงก์: ${videoUrl}`,
              attachment: fs.createReadStream(filePath),
            };

            api.sendMessage(message, event.threadID, () => fs.unlinkSync(filePath), event.messageID);
          });
        });
      });
    });

    req.on("error", (error) => {
      console.error("❌ เกิดข้อผิดพลาด:", error);
      api.sendMessage("❌ เกิดข้อผิดพลาดในการดาวน์โหลดวิดีโอ!", event.threadID, event.messageID);
    });

    req.end();
  } catch (error) {
    console.error("❌ ข้อผิดพลาด:", error);
    api.sendMessage("❌ ไม่สามารถประมวลผลได้ในขณะนี้ โปรดลองอีกครั้ง!", event.threadID, event.messageID);
  }
};
