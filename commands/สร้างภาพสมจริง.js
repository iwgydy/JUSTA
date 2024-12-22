const fs = require("fs");
const axios = require("axios");
const stream = require("stream");
const path = require("path");

module.exports = {
    config: {
        name: "สร้างภาพสมจริง",
        version: "1.7.0",
        description: "สร้างภาพสมจริงจาก AI API โดยคิดค่าบริการ 1 บาทต่อภาพ",
        commandCategory: "image",
        usages: "<คำอธิบายภาพ>",
        cooldowns: 5
    },
    run: async ({ api, event, args }) => {
        const { senderID, threadID, messageID } = event;

        // รับคำอธิบายภาพ
        const prompt = args.join(" ");
        if (!prompt) {
            return api.sendMessage("❌ กรุณาใส่คำอธิบายสำหรับภาพ!", threadID, messageID);
        }

        // เส้นทางไฟล์จัดเก็บยอดเงิน
        const filePath = path.resolve(__dirname, "moneyData.json");

        // ตรวจสอบและสร้างไฟล์หากไม่มี
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}, null, 2), "utf8");
        }

        // อ่านข้อมูลยอดเงิน
        let moneyData = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // ตรวจสอบยอดเงินของผู้ใช้
        if (!moneyData[senderID]) {
            moneyData[senderID] = 0; // ตั้งค่าเริ่มต้น
        }

        if (moneyData[senderID] < 1) {
            return api.sendMessage("❌ คุณมีเงินไม่เพียงพอ (1 บาทต่อการสร้างภาพ)!", threadID, messageID);
        }

        // แจ้งสถานะระหว่างรอ
        const statusMessage = await api.sendMessage(
            `⏰ กำลังสร้างภาพ 0.0.0.0\n💸 ยอดเงินก่อนหัก: ${moneyData[senderID]} บาท\n🎨 โปรดรอสักครู่...`,
            threadID
        );

        try {
            // เรียก API เพื่อสร้างภาพ
            const apiUrl = `https://kaiz-apis.gleeze.com/api/flux-1.1-pro?prompt=${encodeURIComponent(prompt)}`;
            const response = await axios.get(apiUrl);

            if (!response || !response.data) {
                throw new Error("❌ API ไม่ได้ส่งข้อมูลภาพกลับมา");
            }

            // ดาวน์โหลดภาพจาก URL ที่ส่งกลับ
            const imageResponse = await axios.get(response.data, { responseType: "arraybuffer" });
            const imageBuffer = Buffer.from(imageResponse.data, "binary");
            const readableStream = new stream.PassThrough();
            readableStream.end(imageBuffer);

            // หักเงินผู้ใช้ 1 บาท
            moneyData[senderID] -= 1;

            // บันทึกข้อมูลกลับไปที่ไฟล์
            fs.writeFileSync(filePath, JSON.stringify(moneyData, null, 2), "utf8");

            // ส่งภาพให้ผู้ใช้
            return api.sendMessage(
                {
                    body: `🎉 ภาพของคุณพร้อมแล้ว!\nคำอธิบาย: ${prompt}\n💸 ยอดเงินคงเหลือ: ${moneyData[senderID]} บาท`,
                    attachment: readableStream
                },
                threadID,
                () => api.unsendMessage(statusMessage.messageID)
            );
        } catch (error) {
            console.error(error);

            // แจ้งข้อผิดพลาดและลบข้อความสถานะ
            api.sendMessage(
                "❌ เกิดข้อผิดพลาดในการสร้างภาพ กรุณาลองใหม่อีกครั้ง!",
                threadID,
                () => api.unsendMessage(statusMessage.messageID)
            );
        }
    }
};
