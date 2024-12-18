// commands/ตั้งค่าบอท.js
module.exports = {
    config: {
        name: "ตั้งค่าบอท",
        description: "คำสั่งเปิด/ปิดการทำงานของบอทในกลุ่ม",
        usage: "/ตั้งค่าบอท [เปิดบอท | ปิดบอท]",
        aliases: ["botsettings", "togglebot"],
    },
    run: async ({ api, event, args }) => {
        const { senderID, threadID, messageID } = event;

        // ตรวจสอบสิทธิ์แอดมินบอท
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

        if (senderID !== currentBot.adminID) {
            return api.sendMessage("❗ คุณไม่มีสิทธิ์ใช้คำสั่งนี้", threadID, messageID);
        }

        // ตั้งค่าคำสั่งเปิด/ปิดบอท
        const command = args[0]?.toLowerCase();
        global.botStatus = global.botStatus || {};

        if (command === "ปิดบอท") {
            global.botStatus[threadID] = false;
            return api.sendMessage("🛑 บอทถูกปิดในกลุ่มนี้แล้ว", threadID, messageID);
        }

        if (command === "เปิดบอท") {
            global.botStatus[threadID] = true;
            return api.sendMessage("✅ บอทเปิดการทำงานในกลุ่มนี้แล้ว", threadID, messageID);
        }

        // หากคำสั่งไม่ถูกต้อง
        return api.sendMessage(
            "❓ โปรดระบุคำสั่งที่ถูกต้อง เช่น /ตั้งค่าบอท เปิดบอท หรือ /ตั้งค่าบอท ปิดบอท",
            threadID,
            messageID
        );
    },
};
