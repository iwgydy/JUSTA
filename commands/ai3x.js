const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const stringSimilarity = require('string-similarity');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');

module.exports = {
    config: {
        name: 'เจอไนท์',
        description: 'คุยกับเจอไนท์, ขอเพลง และขอรูปภาพ',
        usage: 'เจอไนท์ [ข้อความ] หรือ เจอไนท์ เพลง [ชื่อเพลง] หรือ เจอไนท์ ขอรูป18+',
    },
    run: async ({ api, event, args }) => {
        const command = args.join(' ').trim();

        // คำสั่ง "ขอรูป18+"
        if (command.startsWith('ขอรูป18+')) {
            try {
                const response = await axios.get('https://api.sumiproject.net/images/lon');
                if (response.data && response.data.url) {
                    const imageUrl = response.data.url;

                    // ดาวน์โหลดรูปภาพ
                    const imagePath = path.join(__dirname, 'cache', `image-${Date.now()}.jpg`);
                    const writer = fs.createWriteStream(imagePath);
                    const downloadResponse = await axios({
                        url: imageUrl,
                        method: 'GET',
                        responseType: 'stream',
                    });
                    downloadResponse.data.pipe(writer);

                    // รอให้ดาวน์โหลดเสร็จ
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    // ส่งรูปภาพ
                    const message = {
                        body: `🔞 เจอไนท์ได้เตรียมรูปภาพ 18+ สำหรับคุณแล้ว!`,
                        attachment: fs.createReadStream(imagePath),
                    };

                    api.sendMessage(message, event.threadID, () => {
                        fs.unlinkSync(imagePath); // ลบไฟล์หลังส่งสำเร็จ
                    });
                } else {
                    return api.sendMessage("❗ ไม่พบข้อมูลรูปภาพในขณะนี้", event.threadID);
                }
            } catch (error) {
                console.error("❌ เกิดข้อผิดพลาดในการดึงรูปภาพ:", error.message || error);
                return api.sendMessage("❌ ไม่สามารถดึงข้อมูลรูปภาพได้ โปรดลองอีกครั้ง", event.threadID);
            }
            return;
        }

        // คำสั่ง "ขอรูปหี"
        if (command.startsWith('ขอรูปหี') || command.startsWith('รูปสาว')) {
            try {
                const response = await axios.get('https://api.sumiproject.net/images/lon');
                if (response.data && response.data.url) {
                    const imageUrl = response.data.url;

                    // ดาวน์โหลดรูปภาพ
                    const imagePath = path.join(__dirname, 'cache', `image-${Date.now()}.jpg`);
                    const writer = fs.createWriteStream(imagePath);
                    const downloadResponse = await axios({
                        url: imageUrl,
                        method: 'GET',
                        responseType: 'stream',
                    });
                    downloadResponse.data.pipe(writer);

                    // รอให้ดาวน์โหลดเสร็จ
                    await new Promise((resolve, reject) => {
                        writer.on('finish', resolve);
                        writer.on('error', reject);
                    });

                    // ส่งรูปภาพ
                    const message = {
                        body: `🎨 เจอไนท์ได้เตรียมรูปภาพสำหรับคุณแล้ว!`,
                        attachment: fs.createReadStream(imagePath),
                    };

                    api.sendMessage(message, event.threadID, () => {
                        fs.unlinkSync(imagePath); // ลบไฟล์หลังส่งสำเร็จ
                    });
                } else {
                    return api.sendMessage("❗ ไม่พบข้อมูลรูปภาพในขณะนี้", event.threadID);
                }
            } catch (error) {
                console.error("❌ เกิดข้อผิดพลาดในการดึงรูปภาพ:", error.message || error);
                return api.sendMessage("❌ ไม่สามารถดึงข้อมูลรูปภาพได้ โปรดลองอีกครั้ง", event.threadID);
            }
            return;
        }

        // คำสั่ง "เพลง"
        if (command.startsWith('เพลง') || command.startsWith('ขอเพลง') || command.startsWith('เปิดเพลง')) {
            const songName = command.replace(/^(เพลง|ขอเพลง|เปิดเพลง)/, '').trim();

            if (!songName) {
                return api.sendMessage("❗ กรุณาใส่ชื่อเพลง เช่น 'เจอไนท์ เพลง รักเธอทั้งหมดของหัวใจ'", event.threadID, event.messageID);
            }

            const tempDir = path.join(__dirname, "cache");
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            try {
                const searchingMessage = await api.sendMessage(`⌛ กำลังค้นหาเพลง 🔎 "${songName}"`, event.threadID);

                const searchResults = await yts(songName);
                if (!searchResults.videos || searchResults.videos.length === 0) {
                    return api.sendMessage("❗ ไม่พบเพลงที่คุณต้องการค้นหา", event.threadID, event.messageID);
                }

                const video = searchResults.videos[0];
                const videoUrl = video.url;
                const videoTitle = video.title;
                const videoAuthor = video.author.name;
                const filePath = path.join(tempDir, `music-${Date.now()}.mp3`);

                const stream = ytdl(videoUrl, { filter: "audioonly" });
                const writeStream = fs.createWriteStream(filePath);
                stream.pipe(writeStream);

                stream.on("end", async () => {
                    await api.unsendMessage(searchingMessage.messageID);

                    if (fs.statSync(filePath).size > 26214400) { // 25MB
                        fs.unlinkSync(filePath);
                        return api.sendMessage("❗ ไฟล์มีขนาดใหญ่เกิน 25MB ไม่สามารถส่งได้", event.threadID, event.messageID);
                    }

                    const message = {
                        body: `🎵 **ชื่อเพลง**: ${videoTitle}\n🎤 **ศิลปิน**: ${videoAuthor}`,
                        attachment: fs.createReadStream(filePath),
                    };

                    api.sendMessage(message, event.threadID, () => {
                        fs.unlinkSync(filePath);
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
            return;
        }

        // ส่วนอื่น ๆ ของคำสั่ง (เช่น ถามตอบ) สามารถเพิ่มได้ตามต้องการ
    },
};
