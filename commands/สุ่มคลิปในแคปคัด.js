const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
    config: {
        name: "/สุ่มคลิปCapCut", // เปลี่ยนชื่อคำสั่งให้รองรับ "/"
        description: "ดึงและส่งคลิปแบบสุ่มจาก CapCut API",
        usage: "/สุ่มคลิปCapCut",
        permissions: "everyone",
    },
    run: async ({ api, event }) => {
        const apiUrl = "https://apis-david-mp-momn.onrender.com/api/edit";
        const downloadsDir = path.join(__dirname, "../../downloads");

        // ตรวจสอบและสร้างโฟลเดอร์ downloads หากไม่มี
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        try {
            // ดึงข้อมูลคลิปจาก API
            const response = await axios.get(apiUrl);
            const clips = response.data;

            if (!clips || clips.length === 0) {
                return api.sendMessage(
                    "❗ ไม่พบคลิปในขณะนี้",
                    event.threadID,
                    event.messageID
                );
            }

            // สุ่มเลือกคลิป
            const randomClip = clips[Math.floor(Math.random() * clips.length)];

            if (!randomClip.video || !randomClip.title) {
                return api.sendMessage(
                    "❗ ข้อมูลคลิปไม่สมบูรณ์",
                    event.threadID,
                    event.messageID
                );
            }

            const videoUrl = randomClip.video;
            const videoPath = path.join(downloadsDir, `capcut_${Date.now()}.mp4`);

            // ดาวน์โหลดวิดีโอ
            const videoResponse = await axios({
                method: "get",
                url: videoUrl,
                responseType: "stream",
            });

            const writer = fs.createWriteStream(videoPath);
            videoResponse.data.pipe(writer);

            writer.on("finish", () => {
                // ส่งวิดีโอให้ผู้ใช้งาน
                api.sendMessage(
                    {
                        body: `🎬 คลิปสุ่มจาก CapCut: ${randomClip.title}`,
                        attachment: fs.createReadStream(videoPath),
                    },
                    event.threadID,
                    () => {
                        // ลบไฟล์หลังส่งสำเร็จ
                        fs.unlinkSync(videoPath);
                    }
                );
            });

            writer.on("error", (err) => {
                console.error("❌ Error writing video file:", err.message);
                return api.sendMessage(
                    "❗ เกิดข้อผิดพลาดในการดาวน์โหลดวิดีโอ",
                    event.threadID,
                    event.messageID
                );
            });
        } catch (error) {
            console.error("❌ Error fetching CapCut clip:", error.message);
            return api.sendMessage(
                "❗ เกิดข้อผิดพลาดในการเชื่อมต่อกับ API",
                event.threadID,
                event.messageID
            );
        }
    },
};
