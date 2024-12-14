const axios = require('axios');

module.exports = {
    config: {
        name: "gpt",
        description: "ส่งคำถามไปยัง GPT และรับคำตอบ",
        usage: "/gpt <คำถาม>",
        access: "ทุกคน"
    },
    run: async ({ api, event, args }) => {
        const threadID = event.threadID;
        const messageID = event.messageID;

        if (!args.length) {
            return api.sendMessage("❗ โปรดระบุคำถามของคุณหลังคำสั่งด้วย เช่น `/gpt สวัสดี`", threadID, messageID);
        }

        const query = args.join(' ');

        try {
            const response = await axios.get(`https://nash-api.onrender.com/api/gpt4`, {
                params: { query: query },
                timeout: 10000 // ตั้งเวลา timeout เป็น 10 วินาที
            });

            if (response.data && response.data.answer) {
                api.sendMessage(response.data.answer, threadID, messageID);
            } else {
                api.sendMessage("❗ ไม่สามารถรับคำตอบจาก GPT ได้ในขณะนี้ โปรดลองใหม่อีกครั้งภายหลัง", threadID, messageID);
            }
        } catch (error) {
            console.error(`❌ เกิดข้อผิดพลาดในการติดต่อกับ GPT API: ${error.message}`);
            api.sendMessage("❗ เกิดข้อผิดพลาดในการติดต่อกับ GPT API โปรดลองใหม่อีกครั้งภายหลัง", threadID, messageID);
        }
    }
};
