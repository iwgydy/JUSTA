const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: "สแปมgif",
        description: "สแปม GIF แบบรัวๆ เท่ๆ จำนวนครั้งที่กำหนด",
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

        // ตั้งค่า URL GIF และจำนวนครั้ง
        const gifURL = "https://i.imgur.com/PfgRIGM.gif"; // ลิงก์ใหม่ที่กำหนด
        const times = parseInt(args[0] || 50); // ค่าเริ่มต้น 50 ครั้ง

        if (isNaN(times) || times <= 0) {
            return api.sendMessage("❗ ใส่จำนวนครั้งให้ถูกต้อง เช่น /สแปมgif 50", threadID, messageID);
        }

        try {
            // ดาวน์โหลด GIF ไฟล์ล่วงหน้า
            const response = await axios({
                method: "GET",
                url: gifURL,
                responseType: "stream",
            });

            const tempPath = path.resolve(__dirname, "temp_spam_gif.gif");
            const writer = fs.createWriteStream(tempPath);
            response.data.pipe(writer);

            writer.on("finish", async () => {
                for (let i = 0; i < times; i++) {
                    // ส่ง GIF แบบรัวๆ โดยไม่หน่วงเวลา
                    api.sendMessage({
                        attachment: fs.createReadStream(tempPath),
                    }, threadID);
                }

                // แจ้งเตือนเมื่อเสร็จ
                return api.sendMessage(`✅ สแปม GIF แบบเท่ๆ จำนวน ${times} ครั้งเสร็จสิ้น`, threadID, messageID);
            });

            writer.on("error", () => {
                return api.sendMessage("❗ เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์", threadID, messageID);
            });
        } catch (error) {
            console.error(error);
            return api.sendMessage("❗ ไม่สามารถโหลด GIF จากลิงก์นี้ได้", threadID, messageID);
        }
    },
};
