const axios = require('axios');

module.exports = {
    config: {
        name: "gpt4o", // ชื่อคำสั่ง
        description: "พูดคุยกับ GPT-4O API",
        autoReplyEnabled: false, // เปิด/ปิดการตอบกลับอัตโนมัติ (ค่าเริ่มต้น)
    },
    run: async ({ api, event, args, bot }) => {
        const { threadID, messageID, senderID } = event;
        const query = args.join(" "); // รับข้อความที่ต้องการส่งไปยัง API

        // หากคำสั่งไม่มีข้อความให้ส่งกลับ
        if (!query) {
            return api.sendMessage(
                "❗ กรุณาระบุข้อความที่ต้องการส่งไปยัง GPT-4O เช่น '!gpt4o สวัสดี'",
                threadID,
                messageID
            );
        }

        try {
            // เรียกใช้งาน API
            const uid = senderID; // ใช้ senderID เป็น UID
            const imageUrl = ""; // เพิ่ม URL รูปภาพถ้าต้องการ (สามารถปล่อยว่าง)
            const response = await axios.get(`https://kaiz-apis.gleeze.com/api/gpt-4o-pro`, {
                params: {
                    q: query,
                    uid,
                    imageUrl,
                },
            });

            const reply = response.data.response; // รับข้อความจาก API
            api.sendMessage(reply, threadID, messageID); // ส่งข้อความตอบกลับไปยังผู้ใช้
        } catch (error) {
            console.error(`❌ เกิดข้อผิดพลาด: ${error.message}`);
            api.sendMessage(
                "❌ ไม่สามารถติดต่อ GPT-4O API ได้ในขณะนี้",
                threadID,
                messageID
            );
        }
    },
    toggleAutoReply: function () {
        this.config.autoReplyEnabled = !this.config.autoReplyEnabled;
        return this.config.autoReplyEnabled;
    },
};

// คำสั่งพิเศษสำหรับเปิด/ปิดการตอบกลับอัตโนมัติ
module.exports.autoReplyHandler = async ({ api, event, bot }) => {
    const { threadID, messageID, body, senderID } = event;

    if (this.config.autoReplyEnabled) {
        try {
            const query = body.trim(); // ใช้ข้อความทั้งหมดในข้อความที่ส่ง
            const uid = senderID;
            const imageUrl = "";

            const response = await axios.get(`https://kaiz-apis.gleeze.com/api/gpt-4o-pro`, {
                params: { q: query, uid, imageUrl },
            });

            const reply = response.data.response;
            api.sendMessage(reply, threadID, messageID);
        } catch (error) {
            console.error(`❌ เกิดข้อผิดพลาดใน Auto Reply: ${error.message}`);
        }
    }
};
