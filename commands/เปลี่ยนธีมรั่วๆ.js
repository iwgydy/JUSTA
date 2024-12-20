const themes = [
    "theme1", // Replace with actual theme IDs
    "theme2",
    "theme3",
    "theme4",
    "theme5"
]; // เพิ่มธีมที่คุณต้องการ

module.exports = {
    config: {
        name: "เปลี่ยนธีมรั่ว",
        version: "1.1.0",
        description: "เปลี่ยนธีมแชทรัวๆ แบบไม่หยุด จนกว่าจะพิมพ์ 'หยุด' (เฉพาะแอดมิน)",
        commandCategory: "utility",
        usages: "/เปลี่ยนธีมรั่ว",
        cooldowns: 5
    },
    run: async ({ api, event }) => {
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

        // เริ่มกระบวนการเปลี่ยนธีม
        let isChangingThemes = true;

        api.sendMessage("🎨 เริ่มเปลี่ยนธีมแชทรัวๆ! พิมพ์ 'หยุด' เพื่อยกเลิก", threadID, () => {
            const changeTheme = async () => {
                if (!isChangingThemes) return;

                // สุ่มธีมจากรายการ
                const randomTheme = themes[Math.floor(Math.random() * themes.length)];

                try {
                    await api.changeThreadColor(randomTheme, threadID);
                } catch (error) {
                    console.error("❌ ไม่สามารถเปลี่ยนธีมได้:", error);
                }

                // หน่วงเวลา 1 วินาทีแล้วเปลี่ยนธีมใหม่ (ให้รั่วหน่อย)
                setTimeout(changeTheme, 1000);
            };

            // เริ่มเปลี่ยนธีม
            changeTheme();

            // รอคำสั่ง "หยุด" เพื่อยกเลิก
            const listener = async (reply) => {
                if (reply.senderID === senderID && reply.body.toLowerCase() === "หยุด") {
                    isChangingThemes = false;
                    api.removeListener("message", listener);
                    api.sendMessage("⛔ การเปลี่ยนธีมแชทหยุดลงแล้ว", threadID);
                }
            };

            api.listenMqtt(listener);
        });
    }
};
