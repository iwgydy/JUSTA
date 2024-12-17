const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: "สแปมgif",
        description: "สแปมคลิปวิดีโอแบบรัวๆ ตามลิงก์ที่กำหนด",
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

        // ตั้งค่า URL และจำนวนครั้ง
        const gifURL = "https://i.imgur.com/eIImlF7.mp4";
        const times = parseInt(args[0] || 50); // ค่าเริ่มต้น 50 ครั้ง

        if (isNaN(times) || times <= 0) {
            return api.sendMessage("❗ ใส่จำนวนครั้งให้ถูกต้อง เช่น /สแปมgif 50", threadID, messageID);
        }

        try {
            // ดาวน์โหลดไฟล์ล่วงหน้า
            const response = await axios({
                method: "GET",
                url: gifURL,
                responseType: "stream",
            });

            const tempPath = path.resolve(__dirname, "temp_spam_clip.mp4");
            const writer = fs.createWriteStream(tempPath);
            response.data.pipe(writer);

            writer.on("finish", async () => {
                // ส่งแบบรัวๆ โดยไม่หยุดพัก
                for (let i = 0; i < times; i++) {
                    api.sendMessage({
                        attachment: fs.createReadStream(tempPath),
                    }, threadID);
                }

                // แจ้งเมื่อเสร็จ
                return api.sendMessage(`✅ สแปมคลิปแบบรัวๆ จำนวน ${times} ครั้งเสร็จสิ้น`, threadID, messageID);
            });

            writer.on("error", () => {
                return api.sendMessage("❗ เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์", threadID, messageID);
            });
        } catch (error) {
            console.error(error);
            return api.sendMessage("❗ ไม่สามารถโหลดคลิปจาก URL นี้ได้", threadID, messageID);
        }
    },
};
