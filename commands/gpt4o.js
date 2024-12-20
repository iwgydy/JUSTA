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

            // ส่งข้อความตอบกลับหลัก
            await api.sendMessage(`${replyTime}\n\n✨ GPT-4O ตอบกลับ:\n${replyText}`, event.threadID, () => {
                // ลบข้อความสถานะทันทีหลังจากข้อความหลักถูกส่ง
                if (statusMsg && statusMsg.messageID) {
                    api.deleteMessage(statusMsg.messageID, (err) => {
                        if (err) {
                            console.error("ไม่สามารถลบข้อความสถานะได้:", err);
                        } else {
                            console.log("ข้อความสถานะถูกลบสำเร็จ");
                        }
                    });
                }
            });
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการประมวลผล:", error);
            const endTime = Date.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            const replyTime = `🕒 ${processingTime}`;

            // ส่งข้อความข้อผิดพลาด
            await api.sendMessage(`${replyTime}\n\n❗ เกิดข้อผิดพลาดในการประมวลผล`, event.threadID, () => {
                // ลบข้อความสถานะ
                if (statusMsg && statusMsg.messageID) {
                    api.deleteMessage(statusMsg.messageID, (err) => {
                        if (err) {
                            console.error("ไม่สามารถลบข้อความสถานะได้:", err);
                        } else {
                            console.log("ข้อความสถานะถูกลบสำเร็จ");
                        }
                    });
                }
            });
        }
    },
};
