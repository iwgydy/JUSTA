const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');

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
                    // สร้างเสียง
                    const ttsText = `เจอไนท์: ${botResponse}`;
                    const ttsCommand = `gtts-cli "${ttsText}" --lang th --output response.mp3`;

                    exec(ttsCommand, (error) => {
                        if (error) {
                            console.error("❌ การสร้างเสียงล้มเหลว:", error.message);
                            return;
                        }

                        // ส่งไฟล์เสียง
                        const voiceMessage = {
                            attachment: fs.createReadStream('response.mp3'),
                        };
                        api.sendMessage(voiceMessage, event.threadID);
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
