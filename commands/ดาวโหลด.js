const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

module.exports.config = {
    name: "sharpen",
    version: "1.2.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "ทำให้ภาพคมชัดขึ้น รองรับเฉพาะภาพเท่านั้น",
    commandCategory: "image",
    usages: "[ตอบกลับภาพ]",
    cooldowns: 5
};

module.exports.run = async function({ api, event }) {
    try {
        // ตรวจสอบว่ามีการตอบกลับข้อความที่แนบภาพ
        if (!event.messageReply || !event.messageReply.attachments || event.messageReply.attachments.length === 0) {
            return api.sendMessage("❌ กรุณาตอบกลับภาพที่ต้องการทำให้คมชัดขึ้นด้วยคำสั่งนี้", event.threadID, event.messageID);
        }

        const attachment = event.messageReply.attachments[0];

        // ตรวจสอบว่าประเภทไฟล์เป็นภาพหรือไม่
        if (attachment.type !== "photo") {
            return api.sendMessage("❌ กรุณาตอบกลับไฟล์ภาพเท่านั้น (ไม่รองรับวิดีโอหรือ GIF)", event.threadID, event.messageID);
        }

        const imageUrl = attachment.url; // URL ของภาพ
        const tmpDir = path.join(__dirname, "tmp");
        fs.ensureDirSync(tmpDir); // ตรวจสอบหรือสร้างโฟลเดอร์ tmp

        // กำหนดเส้นทางไฟล์ชั่วคราว
        const uniqueId = uuidv4();
        const originalImagePath = path.join(tmpDir, `original_${uniqueId}.jpg`);
        const sharpenedImagePath = path.join(tmpDir, `sharpened_${uniqueId}.jpg`);

        // ดาวน์โหลดภาพจาก URL
        const response = await axios({
            url: imageUrl,
            method: "GET",
            responseType: "arraybuffer"
        });

        fs.writeFileSync(originalImagePath, Buffer.from(response.data));

        // ทำให้ภาพคมชัดขึ้นด้วย sharp
        await sharp(originalImagePath)
            .sharpen({
                sigma: 1.0, // ปรับความแรง
                flat: 1.0,
                jagged: 1.0
            })
            .toFile(sharpenedImagePath);

        // ส่งภาพคมชัดกลับไปให้ผู้ใช้
        api.sendMessage({
            body: "✅ ทำให้ภาพคมชัดขึ้นเรียบร้อยแล้ว!",
            attachment: fs.createReadStream(sharpenedImagePath)
        }, event.threadID, () => {
            // ลบไฟล์ชั่วคราวเมื่อส่งสำเร็จ
            fs.unlinkSync(originalImagePath);
            fs.unlinkSync(sharpenedImagePath);
        }, event.messageID);
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาด:", error);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการทำให้ภาพคมชัด กรุณาลองใหม่อีกครั้ง!", event.threadID, event.messageID);
    }
};
