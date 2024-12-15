module.exports = {
    config: {
        name: "spam",
        description: "สแปมข้อความที่ต้องการจำนวนที่กำหนด",
    },
    run: async ({ api, event, args }) => {
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

        // ตรวจสอบว่า senderID เป็นแอดมินของบอทนี้หรือไม่
        if (senderID !== currentBot.adminID) {
            return api.sendMessage("❗ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้", threadID, messageID);
        }

        const [message, count] = args;
        const times = parseInt(count);

        if (!message || isNaN(times) || times <= 0) {
            return api.sendMessage("❗ กรุณาใช้รูปแบบคำสั่งให้ถูกต้อง เช่น /spam รักน่ะ 5", threadID, messageID);
        }

        for (let i = 0; i < times; i++) {
            await api.sendMessage(message, threadID);
        }

        return api.sendMessage(`✅ สแปมข้อความ "${message}" จำนวน ${times} ครั้งแล้ว`, threadID, messageID);
    }
};
