const fs = require("fs");
const path = require("path");
const axios = require("axios");

module.exports = {
    config: {
        name: "สร้างภาพสมจริง",
        version: "1.3.0",
        description: "สร้างภาพสมจริงด้วย AI และหักเงิน 1 บาทต่อภาพ พร้อมข้อความแสดงผลที่กำลังสร้าง",
        commandCategory: "image",
        usages: "<คำอธิบายภาพ>",
        cooldowns: 5
    },
    run: async ({ api, event, args }) => {
        const { senderID, threadID, messageID } = event;

        // กำหนดเส้นทางไฟล์เก็บข้อมูลเงิน
        const filePath = path.resolve(__dirname, "moneyData.json");

        // ตรวจสอบและสร้างไฟล์ JSON อัตโนมัติหากไม่มีไฟล์
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}, null, 2), "utf8");
        }

        // อ่านข้อมูลจากไฟล์
        let moneyData = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // ตรวจสอบยอดเงินของผู้ใช้
        if (!moneyData[senderID]) {
            moneyData[senderID] = 0; // ตั้งค่าเริ่มต้นเป็น 0 บาท
        }

        if (moneyData[senderID] < 1) {
            return api.sendMessage("❌ คุณมีเงินไม่เพียงพอ (ต้องมีอย่างน้อย 1 บาท) เพื่อสร้างภาพ!", threadID, messageID);
        }

        // ดึงคำอธิบายภาพ
        const prompt = args.join(" ");
        if (!prompt) {
            return api.sendMessage("❌ กรุณาใส่คำอธิบายสำหรับภาพที่ต้องการสร้าง!", threadID, messageID);
        }

        // แจ้งสถานะระหว่างรอ
        const statusMessage = await api.sendMessage(
            `⏰ 0.0.0.0\n\n💸 เงินคงเหลือ: ${moneyData[senderID] - 1} บาท`,
            threadID
        );

        // สร้างภาพโดยใช้ API
        const apiUrl = `https://kaiz-apis.gleeze.com/api/flux?prompt=${encodeURIComponent(prompt)}`;
        try {
            const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
            const imageBuffer = Buffer.from(response.data, "binary");

            // หักเงินผู้ใช้
            moneyData[senderID] -= 1;

            // บันทึกข้อมูลกลับไปที่ไฟล์
            fs.writeFileSync(filePath, JSON.stringify(moneyData, null, 2), "utf8");

            // ส่งภาพกลับให้ผู้ใช้
            api.sendMessage(
                {
                    body: `🎉 ภาพของคุณพร้อมแล้ว!\n\n💸 เงินคงเหลือ: ${moneyData[senderID]} บาท`,
                    attachment: [imageBuffer]
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
