const axios = require("axios");
const ytdl = require("ytdl-core");
const fs = require("fs");
const path = require("path");

module.exports = {
    config: {
        name: "ดูวิดีโอยูทูป",
        description: "ค้นหาและส่งวิดีโอ YouTube เป็นไฟล์",
        usage: "!ดูวิดีโอยูทูป <ชื่อวิดีโอ>",
        permissions: "everyone",
    },
    run: async ({ api, event, args }) => {
        if (args.length < 1) {
            return api.sendMessage(
                "❗ กรุณาระบุข้อความที่ต้องการค้นหา\nตัวอย่างการใช้งาน: !ดูวิดีโอยูทูป ปรารถนาสิ่งใดฤๅ",
                event.threadID,
                event.messageID
            );
        }

        const query = args.join(" ");
        const apiUrl = `https://nethwieginedev.vercel.app/api/ytsearch3?name=${encodeURIComponent(query)}`;

        try {
            // ค้นหาวิดีโอ
            const response = await axios.get(apiUrl);
            const videos = response.data.result;

            if (!videos || videos.length === 0) {
                return api.sendMessage(
                    "❗ ไม่พบวิดีโอที่คุณค้นหา",
                    event.threadID,
                    event.messageID
                );
            }

            // เลือกรายการแรก
            const video = videos[0];
            const videoUrl = video.url;

            // แจ้งสถานะการดาวน์โหลด
            api.sendMessage(
                `🎬 กำลังดาวน์โหลดวิดีโอ: ${video.title}\n⏱️ ระยะเวลา: ${video.duration}`,
                event.threadID,
                event.messageID
            );

            // ดาวน์โหลดวิดีโอ
            const videoPath = path.join(__dirname, `../../downloads/${video.id}.mp4`);
            const videoStream = ytdl(videoUrl, { quality: "highest" });

            videoStream.pipe(fs.createWriteStream(videoPath));

            videoStream.on("end", async () => {
                // ส่งวิดีโอหลังจากดาวน์โหลดเสร็จ
                api.sendMessage(
                    {
                        body: `🎬 นี่คือวิดีโอ: ${video.title}`,
                        attachment: fs.createReadStream(videoPath),
                    },
                    event.threadID,
                    () => {
                        // ลบไฟล์หลังส่งเสร็จ
                        fs.unlinkSync(videoPath);
                    }
                );
            });

            videoStream.on("error", (err) => {
                console.error("❌ Error downloading video:", err.message);
                api.sendMessage(
                    "❗ เกิดข้อผิดพลาดในการดาวน์โหลดวิดีโอ",
                    event.threadID,
                    event.messageID
                );
            });
        } catch (error) {
            console.error("❌ Error fetching YouTube data:", error.message);
            return api.sendMessage(
                "❗ เกิดข้อผิดพลาดในการเชื่อมต่อกับ API",
                event.threadID,
                event.messageID
            );
        }
    },
};
