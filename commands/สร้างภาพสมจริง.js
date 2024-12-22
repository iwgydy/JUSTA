const fs = require("fs");
const axios = require("axios");
const stream = require("stream");

module.exports = {
    config: {
        name: "สร้างภาพสมจริง",
        version: "1.3.2",
        description: "แก้ไขปัญหา uploadAttachment",
        commandCategory: "image",
        usages: "<คำอธิบายภาพ>",
        cooldowns: 5
    },
    run: async ({ api, event, args }) => {
        const { threadID, messageID } = event;

        const prompt = args.join(" ");
        if (!prompt) {
            return api.sendMessage("❌ กรุณาใส่คำอธิบายสำหรับภาพ!", threadID, messageID);
        }

        const statusMessage = await api.sendMessage("⏰ กำลังสร้างภาพ 0.0.0.0\n🎨 โปรดรอสักครู่...", threadID);

        try {
            const apiUrl = `https://kaiz-apis.gleeze.com/api/flux?prompt=${encodeURIComponent(prompt)}`;
            const response = await axios.get(apiUrl, { responseType: "arraybuffer" });

            if (!response || !response.data) {
                throw new Error("❌ API ไม่ได้ส่งข้อมูลภาพกลับมา");
            }

            const imageBuffer = Buffer.from(response.data, "binary");
            const readableStream = new stream.PassThrough();
            readableStream.end(imageBuffer);

            api.sendMessage(
                {
                    body: "🎉 ภาพของคุณพร้อมแล้ว!",
                    attachment: readableStream
                },
                threadID,
                () => api.unsendMessage(statusMessage.messageID)
            );
        } catch (error) {
            console.error(error);
            api.sendMessage(
                "❌ เกิดข้อผิดพลาดในการสร้างภาพ กรุณาลองใหม่อีกครั้ง!",
                threadID,
                () => api.unsendMessage(statusMessage.messageID)
            );
        }
    }
};
