const axios = require('axios');
const stringSimilarity = require('string-similarity');

module.exports = {
    config: {
        name: 'เจอไนท์',
        description: 'คุยกับเจอไนท์ในธีมคริสต์มาส 2025 🎄',
        usage: 'เจอไนท์ [ข้อความ]',
    },
    run: async ({ api, event, args }) => {
        const start = Date.now();

        if (args.length === 0) {
            return api.sendMessage("🎅 กรุณาพิมพ์คำถามหรือคำสั่งสำหรับเจอไนท์ 🎄", event.threadID);
        }

        const command = args.join(' ').trim();
        const firebaseURL = "https://goak-71ac8-default-rtdb.firebaseio.com/responses.json";

        if (command.startsWith('สอน')) {
            const [_, input] = command.split('สอน').map(str => str.trim());
            if (!input.includes('=')) {
                return api.sendMessage("🎁 กรุณาพิมพ์ในรูปแบบ: เจอไนท์ สอน [คำถาม] = [คำตอบ] 🎀", event.threadID);
            }

            const [question, answer] = input.split('=').map(str => str.trim());
            if (!question || !answer) {
                return api.sendMessage("❌ คำถามหรือคำตอบไม่ครบถ้วน โปรดลองใหม่ 🎅", event.threadID);
            }

            try {
                const response = await axios.get(firebaseURL);
                const data = response.data || {};

                if (!data[question]) {
                    data[question] = [];
                }

                if (!Array.isArray(data[question])) {
                    data[question] = [data[question]];
                }

                data[question].push(answer);

                await axios.put(firebaseURL, data);

                return api.sendMessage(`✅ สอนเจอไนท์สำเร็จ! คำว่า "${question}" จะตอบแบบสุ่ม 🎄`, event.threadID);
            } catch (error) {
                console.error("❌ เกิดข้อผิดพลาด:", error.message || error);
                return api.sendMessage("❌ ไม่สามารถบันทึกข้อมูลได้ 🎅", event.threadID);
            }
        }

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
