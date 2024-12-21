const axios = require('axios');
const fs = require('fs');
const https = require('https');
const googleTTS = require('google-tts-api'); // ไลบรารีสำหรับสร้างเสียง

module.exports = {
    config: {
        name: 'เจอไนท์',
        description: 'คุยกับเจอไนท์ในธีมคริสต์มาส 2025 🎄 พร้อมส่งเสียง',
        usage: 'เจอไนท์ [ข้อความ]',
    },
    run: async ({ api, event, args }) => {
        const start = Date.now();

        if (args.length === 0) {
            return api.sendMessage("🎅 กรุณาพิมพ์คำถามหรือคำสั่งสำหรับเจอไนท์ 🎄", event.threadID);
        }

        const command = args.join(' ').trim();
        const firebaseURL = "https://goak-71ac8-default-rtdb.firebaseio.com/responses.json";

        try {
            const response = await axios.get(firebaseURL);
            const data = response.data;

            if (data) {
                const questions = Object.keys(data);
                const matchedQuestion = questions.find(q => q === command);
                const botResponse = matchedQuestion ? data[matchedQuestion] : "ผมไม่เข้าใจคำนี้ 🎁";

                const end = Date.now();
                const elapsedTime = ((end - start) / 1000).toFixed(2);

                // ส่งข้อความก่อน
                const messageText = `⏰ ${elapsedTime}\n\n🎄 *Merry Christmas 2025!*\n🎅 เจอไนท์: ${botResponse}`;
                api.sendMessage(messageText, event.threadID, async () => {
                    // สร้าง URL สำหรับไฟล์เสียง
                    const url = googleTTS.getAudioUrl(botResponse, {
                        lang: 'th',
                        slow: false,
                        host: 'https://translate.google.com',
                    });

                    // ดาวน์โหลดไฟล์เสียง
                    const filePath = './response.mp3';
                    const file = fs.createWriteStream(filePath);
                    https.get(url, (res) => {
                        res.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            console.log('✅ สร้างเสียงสำเร็จ!');
                            // ส่งไฟล์เสียง
                            const voiceMessage = {
                                attachment: fs.createReadStream(filePath),
                            };
                            api.sendMessage(voiceMessage, event.threadID);
                        });
                    });
                });
            }
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาด:", error.message || error);
            return api.sendMessage(
                `❌ ไม่สามารถติดต่อฐานข้อมูลได้ โปรดลองอีกครั้ง 🎄`,
                event.threadID
            );
        }
    },
};
