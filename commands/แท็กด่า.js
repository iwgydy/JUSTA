const axios = require("axios");

module.exports = {
    config: {
        name: "แท็กด่า",
        version: "1.3.0",
        description: "แท็กด่าสมาชิกในกลุ่มด้วยคำด่าแบบรัวๆ (เฉพาะแอดมิน)",
        commandCategory: "fun",
        usages: "<@mention> <จำนวนคำด่า>",
        cooldowns: 5
    },
    run: async ({ api, event, args }) => {
        const { senderID, threadID, messageID, mentions } = event;

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

        // ตรวจสอบว่ามีการแท็กบุคคล
        if (Object.keys(mentions).length === 0) {
            return api.sendMessage("❌ กรุณาแท็กคนที่คุณต้องการด่า!", threadID, messageID);
        }

        // ตรวจสอบจำนวนคำด่า
        let count = parseInt(args[args.length - 1]) || 1; // จำนวนคำด่าที่ต้องการ (ดีฟอลต์ 1 คำ)
        if (count < 1 || count > 200) {
            return api.sendMessage("❌ จำนวนคำด่าต้องอยู่ระหว่าง 1 ถึง 200 คำ!", threadID, messageID);
        }

        // ดึง ID ของคนที่ถูกแท็ก
        const mentionIDs = Object.keys(mentions);
        const mentionTags = mentionIDs.map(uid => ({
            id: uid,
            tag: `@${mentions[uid]}`
        }));

        // ดึงคำด่าจาก API
        const getInsult = async () => {
            const response = await axios.get("https://api.xncly.xyz/toxic.php");
            return response.data.random_word || "ด่าคนไม่เป็น!";
        };

        // ส่งข้อความด่าแบบรัวๆ
        for (let i = 0; i < count; i++) {
            const insult = await getInsult(); // ดึงคำด่าใหม่

            api.sendMessage(
                {
                    body: `🔥 ${insult}`,
                    mentions: mentionTags
                },
                threadID
            );
        }
    }
};
