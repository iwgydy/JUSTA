const fs = require("fs");
const path = require("path");
const axios = require("axios");
const stream = require("stream");

module.exports = {
    config: {
        name: "สร้างภาพสมจริง",
        version: "1.3.1",
        description: "สร้างภาพสมจริงด้วย AI และแก้ไขปัญหาการส่ง attachment",
        commandCategory: "image",
        usages: "<คำอธิบายภาพ>",
        cooldowns: 5
    },
    run: async ({ api, event, args }) => {
        const { senderID, threadID, messageID } = event;

        // ดึงคำอธิบายภาพ
        const prompt = args.join(" ");
        if (!prompt) {
            return api.sendMessage("❌ กรุณาใส่คำอธิบายสำหรับภาพที่ต้องการสร้าง!", threadID, messageID);
        }

        // แจ้งสถานะระหว่างรอ
        const statusMessage = await api.sendMessage(
            `⏰ กำลังสร้างภาพ 0.0.0.0\n🎨 โปรดรอสักครู่...`,
            threadID
        );

        // สร้างภาพโดยใช้ API
        const apiUrl = `https://kaiz-apis.gleeze.com/api/flux?prompt=${encodeURIComponent(prompt)}`;
        try {
            const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
            const imageBuffer = Buffer.from(response.data, "binary");

            // แปลง Buffer เป็น Readable Stream
            const readableStream = new stream.PassThrough();
            readableStream.end(imageBuffer);

            // ส่งภาพกลับให้ผู้ใช้
            api.sendMessage(
                {
                    body: `🎉 ภาพของคุณพร้อมแล้ว!`,
                    attachment: readableStream
                },
                threadID,
                () => {
                    // ลบข้อความสถานะระหว่างรอ
                    api.unsendMessage(statusMessage.messageID);
                }
            );
        } catch (error) {
            console.error(error);

            // แจ้งข้อผิดพลาดและลบข้อความสถานะระหว่างรอ
            api.sendMessage("❌ เกิดข้อผิดพลาดในการสร้างภาพ กรุณาลองใหม่อีกครั้ง!", threadID, () => {
                api.unsendMessage(statusMessage.messageID);
            });
        }
    }
};
