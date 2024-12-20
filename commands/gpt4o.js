const axios = require("axios");

module.exports = {
    config: {
        name: "gpt4o",
        description: "คุยกับ GPT-4O และสร้างภาพจากข้อความพร้อมตอบกลับ",
    },
    run: async ({ api, event, args }) => {
        const query = args.join(" ");
        if (!query) {
            return api.sendMessage("⛔ กรุณากรอกข้อความที่ต้องการถาม GPT-4O", event.threadID);
        }

        const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(query)}&uid=1&imageUrl=`;
        const startTime = Date.now();

        // ส่งข้อความสถานะ
        let statusMsg = null;
        try {
            statusMsg = await api.sendMessage("⚙️ กำลังดำเนินการ... โปรดรอสักครู่ ⏳", event.threadID);
        } catch (err) {
            console.error("ไม่สามารถส่งข้อความสถานะได้:", err);
            return;
        }

        try {
            // เรียก API
            const response = await axios.get(apiUrl);
            const data = response.data;

            const endTime = Date.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            const replyTime = `🕒 ${processingTime}`;
            const replyText = data.response || "ไม่มีข้อมูลจาก GPT-4O";

            // ส่งข้อความตอบกลับ
            api.sendMessage(`${replyTime}\n\n✨ GPT-4O ตอบกลับ:\n${replyText}`, event.threadID, async (err, info) => {
                if (err) {
                    console.error("ไม่สามารถส่งข้อความหลักได้:", err);
                } else {
                    // ลบข้อความสถานะหลังจากข้อความตอบกลับถูกส่ง
                    if (statusMsg && statusMsg.messageID) {
                        try {
                            await api.deleteMessage(statusMsg.messageID);
                            console.log("ข้อความสถานะถูกลบสำเร็จ");
                        } catch (deleteErr) {
                            console.error("ไม่สามารถลบข้อความสถานะได้:", deleteErr);
                        }
                    }
                }
            });
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการประมวลผล:", error);
            const endTime = Date.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            const replyTime = `🕒 ${processingTime}`;

            // ส่งข้อความข้อผิดพลาด
            api.sendMessage(`${replyTime}\n\n❗ เกิดข้อผิดพลาดในการประมวลผล`, event.threadID, async (err, info) => {
                if (err) {
                    console.error("ไม่สามารถส่งข้อความข้อผิดพลาดได้:", err);
                } else {
                    // ลบข้อความสถานะหลังจากข้อความข้อผิดพลาดถูกส่ง
                    if (statusMsg && statusMsg.messageID) {
                        try {
                            await api.deleteMessage(statusMsg.messageID);
                            console.log("ข้อความสถานะถูกลบสำเร็จ");
                        } catch (deleteErr) {
                            console.error("ไม่สามารถลบข้อความสถานะได้:", deleteErr);
                        }
                    }
                }
            });
        }
    },
};
