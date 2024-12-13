module.exports.config = {
    name: "เพลง",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "ค้นหาและดาวน์โหลดเพลงจาก YouTube",
    commandCategory: "เพลง",
    usages: "[ชื่อเพลง]",
    cooldowns: 5
};

module.exports.run = async function({ api, event, args }) {
    const ytdl = require("@distube/ytdl-core");
    const yts = require("yt-search");
    const fs = require("fs-extra");
    const path = require("path");

    // ตรวจสอบว่าใส่ชื่อเพลงมาหรือไม่
    const songName = args.join(" ");
    if (!songName) {
        return api.sendMessage("❗ กรุณาใส่ชื่อเพลงที่ต้องการค้นหา เช่น /เพลง รักเธอทั้งหมดของหัวใจ", event.threadID, event.messageID);
    }

    // สร้างโฟลเดอร์ `cache` หากไม่มี
    const tempDir = path.join(__dirname, "cache");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    try {
        // แจ้งผู้ใช้ว่ากำลังค้นหาเพลง
        const searchingMessage = await api.sendMessage(`⌛ กำลังค้นหาเพลง 🔎 "${songName}"`, event.threadID);

        // ค้นหาเพลงบน YouTube
        const searchResults = await yts(songName);
        if (!searchResults.videos || searchResults.videos.length === 0) {
            return api.sendMessage("❗ ไม่พบเพลงที่คุณต้องการค้นหา", event.threadID, event.messageID);
        }

        const video = searchResults.videos[0];
        const videoUrl = video.url;
        const videoTitle = video.title;
        const videoAuthor = video.author.name;
        const filePath = path.join(tempDir, `music-${Date.now()}.mp3`);

        // ดาวน์โหลดเพลง
        const stream = ytdl(videoUrl, { filter: "audioonly" });
        const writeStream = fs.createWriteStream(filePath);
        stream.pipe(writeStream);

        stream.on("end", async () => {
            console.log(`ดาวน์โหลดเพลง "${videoTitle}" เสร็จสิ้น`);
            await api.unsendMessage(searchingMessage.messageID);

            // ตรวจสอบขนาดไฟล์ก่อนส่ง
            if (fs.statSync(filePath).size > 26214400) { // 25MB
                fs.unlinkSync(filePath);
                return api.sendMessage("❗ ไฟล์มีขนาดใหญ่เกิน 25MB ไม่สามารถส่งได้", event.threadID, event.messageID);
            }

            // ส่งเพลงให้ผู้ใช้ทันที
            const message = {
                body: `🎵 **ชื่อเพลง**: ${videoTitle}\n🎤 **ศิลปิน**: ${videoAuthor}`,
                attachment: fs.createReadStream(filePath),
            };

            api.sendMessage(message, event.threadID, () => {
                fs.unlinkSync(filePath); // ลบไฟล์หลังส่งสำเร็จ
            });
        });

        stream.on("error", (error) => {
            console.error("เกิดข้อผิดพลาดในการดาวน์โหลดเพลง:", error);
            api.sendMessage("❗ เกิดข้อผิดพลาดในการดาวน์โหลดเพลง", event.threadID, event.messageID);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    } catch (error) {
        console.error("เกิดข้อผิดพลาด:", error);
        api.sendMessage("❗ เกิดข้อผิดพลาดในการค้นหาและดาวน์โหลดเพลง", event.threadID, event.messageID);
    }
};