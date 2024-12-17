module.exports = {
    config: {
        name: "ออกกลุ่ม",
        description: "คำสั่งให้บอทออกจากกลุ่ม ใช้ได้เฉพาะแอดมินบอทเท่านั้น",
    },
    run: async ({ api, event }) => {
        const { senderID, threadID, messageID } = event;

        // ดึงข้อมูลบอทที่กำลังใช้งานอยู่
        const botSessions = global.botSessions || {};

        // หาบอทที่ส่งคำสั่งนี้
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

        // แจ้งเตือนก่อนออกจากกลุ่ม
        await api.sendMessage("📢 บอทกำลังออกจากกลุ่มนี้ ขอบคุณที่ใช้งาน!", threadID, messageID);

        // ทำให้บอทออกจากกลุ่ม
        return api.removeUserFromGroup(api.getCurrentUserID(), threadID, (err) => {
            if (err) {
                return api.sendMessage("❗ เกิดข้อผิดพลาดในการออกจากกลุ่ม", threadID, messageID);
            }
        });
    }
};
