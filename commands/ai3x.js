const axios = require('axios');
const stringSimilarity = require('string-similarity');
const ytdl = require("@distube/ytdl-core");
const yts = require("yt-search");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
    config: {
        name: 'เจอไนท์',
        description: 'คุยกับเจอไนท์และขอเพลงในธีมคริสต์มาส 2025 🎄',
        usage: 'เจอไนท์ [ข้อความ] หรือ เจอไนท์ เพลง [ชื่อเพลง]',
    },
    run: async ({ api, event, args }) => {
        const start = Date.now();
        const command = args.join(' ').trim();
        const firebaseURL = "https://goak-71ac8-default-rtdb.firebaseio.com/responses.json";

        // ตรวจสอบว่าคำสั่งคือ "เพลง"
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

        // ตรวจสอบคำถามและตอบกลับ
        try {
            const response = await axios.get(firebaseURL);
            const data = response.data;

            if (data) {
                const questions = Object.keys(data);
                const bestMatch = stringSimilarity.findBestMatch(command, questions);

                if (bestMatch.bestMatch.rating > 0.6) {
                    const matchedQuestion = bestMatch.bestMatch.target;
                    const answers = data[matchedQuestion];

                    const botResponse = Array.isArray(answers)
                        ? answers[Math.floor(Math.random() * answers.length)]
                        : answers;

                    const end = Date.now();
                    const elapsedTime = ((end - start) / 1000).toFixed(2);

                    return api.sendMessage(
                        `⏰ ${elapsedTime}\n\n🎄 *Merry Christmas 2025!*\n🎅 เจอไนท์: ${botResponse}`,
                        event.threadID
                    );
                }
            }

            const end = Date.now();
            const elapsedTime = ((end - start) / 1000).toFixed(2);

            return api.sendMessage(
                `⏰ ${elapsedTime}\n\n🎄 *Merry Christmas 2025!*\n🎅 เจอไนท์: ผมไม่เข้าใจคำนี้ 🎁\n🎀 คุณสามารถสอนผมได้โดยใช้คำสั่ง: "เจอไนท์ สอน [คำถาม] = [คำตอบ]"`,
                event.threadID
            );
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาด:", error.message || error);
            return api.sendMessage(
                `❌ ไม่สามารถติดต่อฐานข้อมูลได้ โปรดลองอีกครั้ง 🎄`,
                event.threadID
            );
        }
    },
};
