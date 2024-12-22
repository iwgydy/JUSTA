const axios = require("axios");

module.exports = {
    config: {
        name: "พิมตามผม",
        version: "1.0.0",
        description: "บอทจะพิมตามคำที่ผู้ใช้พิม โดยสามารถเปิด/ปิดการทำงานได้ (เฉพาะแอดมิน)",
        commandCategory: "fun",
        usages: "<เปิด/ปิด>",
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

        // ดึงสถานะเปิด/ปิด จาก args
        const toggle = args[0]?.toLowerCase();
        if (!toggle || (toggle !== "เปิด" && toggle !== "ปิด")) {
            return api.sendMessage("❌ กรุณาระบุคำสั่งที่ถูกต้อง (เปิด/ปิด)", threadID, messageID);
        }

        // เปิด/ปิดโหมดพิมตาม
        global.followMode = global.followMode || {};
        global.followMode[threadID] = toggle === "เปิด";

        // แจ้งสถานะการเปิด/ปิด
        api.sendMessage(
            `📣 โหมดพิมตาม ${toggle === "เปิด" ? "เปิดใช้งานแล้ว" : "ถูกปิดแล้ว"}!`,
            threadID,
            messageID
        );
    },

    // ฟังก์ชันนี้จะถูกเรียกเมื่อมีข้อความใหม่
    handleEvent: async ({ api, event }) => {
        const { threadID, body } = event;

        // ตรวจสอบว่าโหมดพิมตามเปิดอยู่หรือไม่
        if (global.followMode && global.followMode[threadID]) {
            if (body) {
                // บอทจะพิมข้อความตามที่ผู้ใช้พิม
                api.sendMessage(`บอท: ${body}`, threadID);
            }
        }
    }
};
