const axios = require('axios');
const stringSimilarity = require('string-similarity'); // ไลบรารีสำหรับวัดความคล้ายคลึงของข้อความ

module.exports = {
    config: {
        name: 'เจอไนท์',
        description: 'คุยกับเจอไนท์ในธีมคริสต์มาส 2025 🎄',
        usage: 'เจอไนท์ [ข้อความ]',
    },
    run: async ({ api, event, args }) => {
        const start = Date.now(); // เริ่มจับเวลา

        // ตรวจสอบว่ามีข้อความหรือไม่
        if (args.length === 0) {
            return api.sendMessage("🎅 กรุณาพิมพ์คำถามหรือคำสั่งสำหรับเจอไนท์ 🎄", event.threadID);
        }

        const userInput = args.join(' '); // รวมข้อความทั้งหมด
        const firebaseURL = "https://goak-71ac8-default-rtdb.firebaseio.com/responses.json"; // URL ของ Firebase

        try {
            // ดึงข้อมูลคำถาม-คำตอบทั้งหมดจาก Firebase
            const response = await axios.get(firebaseURL);
            const data = response.data;

            if (data) {
                // หา "คำถาม" ที่มีความคล้ายคลึงกับ "คำถามของผู้ใช้"
                const questions = Object.keys(data);
                const bestMatch = stringSimilarity.findBestMatch(userInput, questions);

                if (bestMatch.bestMatch.rating > 0.6) { // กำหนดคะแนนความคล้ายคลึงขั้นต่ำ
                    const matchedQuestion = bestMatch.bestMatch.target;
                    const answers = data[matchedQuestion];

                    // สุ่มคำตอบ (ถ้ามีหลายคำตอบ)
                    const botResponse = Array.isArray(answers)
                        ? answers[Math.floor(Math.random() * answers.length)]
                        : answers;

                    const end = Date.now();
                    const elapsedTime = ((end - start) / 1000).toFixed(2); // เวลาในการประมวลผล

                    return api.sendMessage(
                        `⏰ ${elapsedTime}\n\n🎄 *Merry Christmas 2025!*\n🎅 เจอไนท์: ${botResponse}`,
                        event.threadID
                    );
                }
            }

            const end = Date.now();
            const elapsedTime = ((end - start) / 1000).toFixed(2);

            return api.sendMessage(
                `⏰ ${elapsedTime}\n\n🎄 *Merry Christmas 2025!*\n🎅 เจอไนท์: ผมไม่เข้าใจคำสั่งนี้ 🎁\n🎀 คุณสามารถสอนผมได้โดยใช้คำสั่ง: "สอน คำถาม=คำตอบ"`,
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

// ฟีเจอร์สอน
module.exports.s = async ({ api, event, args }) => {
    const input = args.join(' ');

    if (!input.includes('=')) {
        return api.sendMessage("🎁 กรุณาพิมพ์ในรูปแบบ: สอน คำถาม=คำตอบ 🎀", event.threadID);
    }

    const [question, answer] = input.split('=').map(str => str.trim());
    const firebaseURL = "https://goak-71ac8-default-rtdb.firebaseio.com/responses.json"; // URL ของ Firebase

    try {
        // ดึงคำตอบเก่า
        const response = await axios.get(firebaseURL);
        const data = response.data || {};

        // เพิ่มคำตอบใหม่
        if (!data[question]) {
            data[question] = [];
        }

        if (!Array.isArray(data[question])) {
            data[question] = [data[question]];
        }

        data[question].push(answer);

        // อัปเดตฐานข้อมูล
        await axios.put(firebaseURL, data);

        return api.sendMessage(`✅ สอนเจอไนท์สำเร็จ! คำว่า "${question}" จะตอบแบบสุ่ม 🎄`, event.threadID);
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาด:", error.message || error);
        return api.sendMessage("❌ ไม่สามารถบันทึกข้อมูลได้ 🎅", event.threadID);
    }
};
