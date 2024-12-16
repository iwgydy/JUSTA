const fs = require("fs-extra");
const ytdl = require("ytdl-core");
const yts = require("yt-search");
const path = require("path");

module.exports.config = {
  name: "ดูวิดีโอยูทูป",
  version: "1.0",
  hasPermssion: 0,
  credits: "kshitiz (ปรับโดยคุณ)", 
  description: "ค้นหาและดาวน์โหลดวิดีโอจาก YouTube",
  commandCategory: "video",
  usages: "ดูวิดีโอยูทูป <ชื่อวิดีโอ>",
  cooldowns: 20,
};

module.exports.run = async function ({ api, event, args }) {
  try {
    // ตรวจสอบว่ามีการส่งข้อความหรือไม่
    const videoName = args.join(" ");
    if (!videoName) {
      return api.sendMessage("❌ กรุณาระบุชื่อวิดีโอที่ต้องการค้นหา เช่น: ดูวิดีโอยูทูป เพลงสบายใจ", event.threadID, event.messageID);
    }

    // แจ้งเตือนผู้ใช้ว่ากำลังค้นหาวิดีโอ
    api.sendMessage(`🔍 กำลังค้นหาวิดีโอสำหรับ "${videoName}"...\nโปรดรอสักครู่ ⏳`, event.threadID, event.messageID);

    // ค้นหาวิดีโอจาก YouTube
    const searchResults = await yts(videoName);
    if (!searchResults.videos.length) {
      return api.sendMessage("❌ ไม่พบวิดีโอที่ตรงกับคำค้นหา กรุณาลองใหม่อีกครั้ง", event.threadID, event.messageID);
    }

    const video = searchResults.videos[0];
    const videoUrl = video.url;

    // ดาวน์โหลดวิดีโอ
    const fileName = `video_${event.senderID}.mp4`;
    const filePath = path.join(__dirname, "cache", fileName);

    const videoStream = ytdl(videoUrl, { filter: "audioandvideo", quality: "lowest" });
    const writeStream = fs.createWriteStream(filePath);

    videoStream.pipe(writeStream);

    // ติดตามสถานะการดาวน์โหลด
    videoStream.on("info", (info) => {
      api.sendMessage(`📹 กำลังดาวน์โหลดวิดีโอ: ${info.videoDetails.title}...\n⏰ ระยะเวลา: ${video.duration.timestamp}`, event.threadID);
    });

    videoStream.on("end", () => {
      console.log("✅ ดาวน์โหลดเสร็จสิ้น!");

      // ตรวจสอบขนาดไฟล์ก่อนส่ง (จำกัด 25MB)
      if (fs.statSync(filePath).size > 26214400) {
        fs.unlinkSync(filePath);
        return api.sendMessage("❌ ไฟล์มีขนาดใหญ่เกิน 25MB ไม่สามารถส่งได้", event.threadID, event.messageID);
      }

      // ส่งวิดีโอไปยังแชท
      api.sendMessage({
        body: `🎥 ดาวน์โหลดวิดีโอสำเร็จ!\n\n🔖 ชื่อวิดีโอ: ${video.title}\n⏳ ระยะเวลา: ${video.duration.timestamp}\n📎 ลิงก์: ${videoUrl}`,
        attachment: fs.createReadStream(filePath),
      }, event.threadID, () => {
        fs.unlinkSync(filePath); // ลบไฟล์หลังจากส่งสำเร็จ
      });
    });

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    api.sendMessage("❌ เกิดข้อผิดพลาดในการประมวลผลคำสั่ง กรุณาลองใหม่อีกครั้ง", event.threadID, event.messageID);
  }
};
