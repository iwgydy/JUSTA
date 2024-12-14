const axios = require('axios');

module.exports = {
    config: {
        name: "gpt",
        description: "ส่งคำถามไปยัง GPT API และรับคำตอบ",
        usage: "/gpt <คำถาม>",
        access: "ทุกคน"
    },
    run: async ({ api, event, args }) => {
        const threadID = event.threadID;
        const messageID = event.messageID;

        if (!args.length) {
            return api.sendMessage("❗ โปรดระบุคำถามของคุณหลังคำสั่ง เช่น `/gpt สวัสดี`", threadID, messageID);
        }

        const query = args.join(' '); // รวบรวมคำถามจากผู้ใช้

        // ตอบกลับทันทีว่า "กำลังถาม..."
        api.sendMessage("⏳ กำลังถาม...", threadID, async () => {
            try {
                // ส่งคำถามไปยัง API
                const response = await axios.get(`https://nash-api.onrender.com/api/gpt4`, {
                    params: { query: query },
                    timeout: 0 // ไม่มีการจำกัดเวลา
                });

                // ตรวจสอบว่ามี `response` ในข้อมูลที่ได้รับ
                if (response.data && response.data.response) {
                    api.sendMessage(response.data.response, threadID);
                } else {
                    api.sendMessage("❗ ไม่สามารถรับคำตอบจาก GPT ได้ โปรดลองใหม่ภายหลัง", threadID);
                }
            } catch (error) {
                console.error(`❌ เกิดข้อผิดพลาดในการติดต่อ GPT API: ${error.message}`);
                api.sendMessage("❗ เกิดข้อผิดพลาดในการติดต่อ GPT API โปรดลองใหม่ภายหลัง", threadID);
            }
        });
    }
};
