const axios = require("axios");

module.exports = {
    config: {
        name: "เปลี่ยนชื่อกลุ่มรั่ว",
        version: "1.2.0",
        description: "เปลี่ยนชื่อกลุ่มแบบรั่วๆ ทุก 5 วินาที (เฉพาะแอดมินบอท)",
        commandCategory: "utility",
        usages: "/เปลี่ยนชื่อกลุ่มรั่ว <จำนวนครั้ง>",
        cooldowns: 5
    },
    run: async ({ api, event, args }) => {
        const { senderID, threadID, messageID } = event;

        // ดึงข้อมูลบอทที่กำลังใช้งานอยู่
        const botSessions = global.botSessions || {};
        let currentBot = null;

        for (const token in botSessions) {
            if (botSessions[token].api === api) {
                currentBot = botSessions[token];
                break;
            }
        }

        if (!currentBot) {
            return api.sendMessage("❗ ไม่พบบอทที่กำลังใช้งานอยู่", threadID, messageID);
        }

        // ตรวจสอบสิทธิ์ว่าเป็นแอดมินบอทหรือไม่
        if (senderID !== currentBot.adminID) {
            return api.sendMessage("❗ คุณไม่มีสิทธิ์ใช้คำสั่งนี้", threadID, messageID);
        }

        // ตรวจสอบจำนวนครั้ง
        const count = parseInt(args[0]);
        if (isNaN(count) || count <= 0) {
            return api.sendMessage("❌ กรุณาระบุจำนวนครั้งที่ถูกต้อง เช่น /เปลี่ยนชื่อกลุ่มรั่ว 5", threadID, messageID);
        }

        // เริ่มเปลี่ยนชื่อกลุ่ม
        for (let i = 0; i < count; i++) {
            try {
                // ดึงชื่อใหม่จาก API
                const response = await axios.get("https://api.xncly.xyz/toxic.php");
                const newName = response.data.random_word || "ชื่อกลุ่มสุดรั่ว";

                // เปลี่ยนชื่อกลุ่ม
                await api.setTitle(newName, threadID);

                // หน่วงเวลา 5 วินาที
                if (i < count - 1) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            } catch (error) {
                console.error("❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อกลุ่ม:", error);
                return api.sendMessage("❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อกลุ่ม กรุณาลองใหม่!", threadID, messageID);
            }
        }

        // แจ้งเตือนเมื่อเสร็จ
        api.sendMessage("👩‍💻 เปลี่ยนชื่อกลุ่มรั่วๆ เสร็จเรียบร้อย!", threadID);
    }
};
