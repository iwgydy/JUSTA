const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

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
        const downloadsDir = path.join(__dirname, "../../downloads");

        // ตรวจสอบและสร้างโฟลเดอร์ downloads
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

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
            const videoPath = path.join(downloadsDir, `${video.id}.mp4`);

            // แจ้งสถานะการดาวน์โหลด
            api.sendMessage(
                `🎬 กำลังดาวน์โหลดวิดีโอ: ${video.title}\n⏱️ ระยะเวลา: ${video.duration}`,
                event.threadID,
                event.messageID
            );

            // ดาวน์โหลดวิดีโอด้วย yt-dlp
            await downloadYouTubeVideo(videoUrl, videoPath);

            // ส่งวิดีโอ
            api.sendMessage(
                {
                    body: `🎬 นี่คือวิดีโอ: ${video.title}`,
                    attachment: fs.createReadStream(videoPath),
                },
                event.threadID,
                () => {
                    // ลบไฟล์หลังจากส่งเสร็จ
                    fs.unlinkSync(videoPath);
                }
            );
        } catch (error) {
            console.error("❌ Error:", error.message);
            return api.sendMessage(
                "❗ เกิดข้อผิดพลาดในการดาวน์โหลดวิดีโอ",
                event.threadID,
                event.messageID
            );
        }
    },
};

// ฟังก์ชันสำหรับดาวน์โหลดวิดีโอด้วย yt-dlp
function downloadYouTubeVideo(url, output) {
    return new Promise((resolve, reject) => {
        const command = `yt-dlp -o "${output}" ${url}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ Error running yt-dlp:", stderr);
                return reject(new Error("ดาวน์โหลดวิดีโอไม่สำเร็จ"));
            }
            resolve(output);
        });
    });
}
