const axios = require("axios");

module.exports = {
    config: {
        name: "gpt4o",
        description: "คุยกับ GPT-4O และสร้างภาพจากข้อความพร้อมตอบกลับ หรือเปิด/ปิดระบบตอบสนองอัตโนมัติ",
        aliases: ["gpt4o-pro"],
        usage: "!gpt4o [คำถาม | on | off]",
        cooldown: 5,
        permissions: ["ADMIN"], // จำกัดการใช้งานสำหรับแอดมินเท่านั้น
    },
    /**
     * ฟังก์ชันที่ทำงานเมื่อคำสั่งถูกเรียกใช้
     * @param {Object} param0 - อ็อบเจ็กต์ที่ส่งเข้ามา
     * @param {Object} param0.api - ตัวจัดการ API ของบอท
     * @param {Object} param0.event - อีเวนต์ข้อความ
     * @param {Array} param0.args - อาร์กิวเมนต์ที่ส่งมาพร้อมกับคำสั่ง
     * @param {String} param0.token - โทเค็นของบอท
     */
    run: async ({ api, event, args, token }) => {
        const option = args[0] ? args[0].toLowerCase() : null;

        // ตรวจสอบว่าเป็นคำสั่งเปิด/ปิดการตอบสนองอัตโนมัติ
        if (option === "on" || option === "off") {
            if (!global.botSessions[token]) {
                return api.sendMessage("❗ ไม่พบบอทที่ต้องการตั้งค่า", event.threadID, event.messageID);
            }

            global.botSessions[token].aiEnabled = option === "on";

            const status = option === "on" ? "เปิด" : "ปิด";
            return api.sendMessage(`✅ การตอบสนองอัตโนมัติด้วย AI ถูก ${status} เรียบร้อยแล้ว`, event.threadID, event.messageID);
        }

        // หากไม่ใช่คำสั่งเปิด/ปิด ให้ทำงานปกติ
        const query = args.join(" ");
        if (!query) {
            return api.sendMessage("⛔ กรุณากรอกข้อความที่ต้องการถาม GPT-4O หรือใช้ `!gpt4o on/off` เพื่อเปิด/ปิดระบบอัตโนมัติ", event.threadID, event.messageID);
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
