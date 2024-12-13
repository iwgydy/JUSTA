const ytdl = require("ytdl-core");
const fs = require("fs");

module.exports.config = {
    name: "ดูวิดีโอ",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "ต้นสุดหล่อ",
    description: "ดาวน์โหลดวิดีโอจาก YouTube และส่งในแชท (จำกัด 25MB)",
    commandCategory: "ทั่วไป",
    usages: "[ลิงก์ YouTube]",
    cooldowns: 0
};

module.exports.run = async function({ api, event, args }) {
    try {
        const videoURL = args[0]; // รับลิงก์ YouTube จากคำสั่ง
        if (!videoURL || !videoURL.includes("youtube.com")) {
            return api.sendMessage("❌ กรุณาใส่ลิงก์ YouTube ที่ถูกต้อง!", event.threadID, event.messageID);
        }

        // ดึงข้อมูลวิดีโอ
        const videoInfo = await ytdl.getInfo(videoURL);
        const title = videoInfo.videoDetails.title;

        // ตรวจสอบขนาดไฟล์
        const videoFormat = ytdl.chooseFormat(videoInfo.formats, { quality: "lowest" });
        const videoSize = videoFormat.contentLength ? parseInt(videoFormat.contentLength) / (1024 * 1024) : 0; // แปลงขนาดเป็น MB

        if (videoSize > 25) {
            return api.sendMessage(
                `❌ วิดีโอ "${title}" มีขนาด ${videoSize.toFixed(2)}MB ซึ่งเกินขีดจำกัด 25MB!`,
                event.threadID,
                event.messageID
            );
        }

        const videoStream = ytdl(videoURL, { filter: "audioandvideo", quality: "lowest" });
        const path = `./temp/${title}.mp4`; // บันทึกไฟล์ลง temp

        // เขียนวิดีโอไปยังไฟล์ชั่วคราว
        const writeStream = fs.createWriteStream(path);
        videoStream.pipe(writeStream);

        writeStream.on("finish", () => {
            // ส่งวิดีโอในแชท
            api.sendMessage(
                {
                    body: `🎥 **${title}** 🎥\nขนาดไฟล์: ${videoSize.toFixed(2)}MB`,
                    attachment: fs.createReadStream(path)
                },
                event.threadID,
                () => {
                    // ลบไฟล์หลังส่งเสร็จ
                    fs.unlinkSync(path);
                },
                event.messageID
            );
        });
    } catch (error) {
        console.error("เกิดข้อผิดพลาด:", error);
        api.sendMessage("❌ ไม่สามารถดาวน์โหลดวิดีโอได้ กรุณาลองใหม่", event.threadID, event.messageID);
    }
};