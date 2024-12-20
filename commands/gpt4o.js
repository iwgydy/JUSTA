const axios = require('axios');

module.exports = {
    config: {
        name: "gpt4o", // ชื่อคำสั่ง
        description: "พูดคุยกับ GPT-4O API",
        autoReplyEnabled: false, // ค่าเริ่มต้นของการตอบกลับอัตโนมัติ
    },
    run: async ({ api, event, args }) => {
        const { threadID, messageID } = event;
        const command = args[0]?.toLowerCase();

        // เปิด/ปิดตอบกลับอัตโนมัติ
        if (command === "autoon") {
            this.config.autoReplyEnabled = !this.config.autoReplyEnabled;
            const status = this.config.autoReplyEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน";
            return api.sendMessage(`✅ การตอบกลับอัตโนมัติ${status}เรียบร้อยแล้ว`, threadID, messageID);
        }

        // ส่งข้อความไปยัง GPT-4O API
        const query = args.join(" ");
        if (!query) {
            return api.sendMessage("❗ กรุณาพิมพ์ข้อความเพื่อส่งไปยัง GPT-4O", threadID, messageID);
        }

        try {
            const uid = event.senderID; // ใช้ senderID เป็น UID
            const response = await axios.get(`https://kaiz-apis.gleeze.com/api/gpt-4o-pro`, {
                params: {
                    q: query,
                    uid,
                    imageUrl: "", // ถ้าไม่ต้องการส่งภาพ ให้ปล่อยว่าง
                },
            });

            const reply = response.data.response;
            return api.sendMessage(reply, threadID, messageID);
        } catch (error) {
            console.error(`❌ เกิดข้อผิดพลาด: ${error.message}`);
            return api.sendMessage("❌ ไม่สามารถติดต่อ GPT-4O API ได้", threadID, messageID);
        }
    },
    autoReplyHandler: async ({ api, event }) => {
        if (this.config.autoReplyEnabled) {
            const { threadID, messageID, body, senderID } = event;

            try {
                const query = body.trim(); // ใช้ข้อความทั้งหมดในข้อความที่ส่ง
                const response = await axios.get(`https://kaiz-apis.gleeze.com/api/gpt-4o-pro`, {
                    params: { q: query, uid: senderID, imageUrl: "" },
                });

                const reply = response.data.response;
                api.sendMessage(reply, threadID, messageID);
            } catch (error) {
                console.error(`❌ เกิดข้อผิดพลาดใน Auto Reply: ${error.message}`);
            }
        }
    },
};
