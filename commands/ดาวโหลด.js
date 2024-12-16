const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

module.exports.config = {
    name: "sharpen",
    version: "1.1.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "ทำให้ภาพคมชัดขึ้น รองรับทุกประเภทของภาพยกเว้น GIF และวิดีโอ",
    commandCategory: "image",
    usages: "[ตอบกลับภาพ]",
    cooldowns: 5
};

module.exports.run = async function({ api, event }) {
    try {
        // ตรวจสอบว่ามีการตอบกลับข้อความที่แนบภาพ
        if (event.type !== "message_reply" || !event.messageReply.attachments || event.messageReply.attachments.length === 0) {
            return api.sendMessage("❌ กรุณาตอบกลับภาพที่ต้องการทำให้คมชัดขึ้นด้วยคำสั่งนี้", event.threadID, event.messageID);
        }

        const attachment = event.messageReply.attachments[0];
        console.log("Attachment Debug:", attachment); // ตรวจสอบการดีบัก attachments

        if (!attachment.url) {
            return api.sendMessage("❌ ไม่พบ URL ของภาพที่แนบมา", event.threadID, event.messageID);
        }

        // ตรวจสอบประเภทของไฟล์ภาพที่รองรับ
        const allowedTypes = ["photo"];
        if (!allowedTypes.includes(attachment.type)) {
            return api.sendMessage("❌ กรุณาแนบไฟล์ภาพเท่านั้น", event.threadID, event.messageID);
        }

        const imageUrl = attachment.url;
        const tmpDir = path.join(__dirname, "tmp");
        fs.ensureDirSync(tmpDir); // สร้างโฟลเดอร์ tmp หากไม่มี

        // สร้างเส้นทางสำหรับเก็บภาพต้นฉบับและภาพที่ปรับปรุงแล้ว
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
                sigma: 1.0, // ปรับความแรงของการชาร์ป
                flat: 1.0,
                jagged: 1.0
            })
            .toFile(sharpenedImagePath);

        // ส่งภาพที่ปรับปรุงแล้วกลับไปยังผู้ใช้
        api.sendMessage({
            body: "✅ ทำให้ภาพคมชัดขึ้นเรียบร้อยแล้ว!",
            attachment: fs.createReadStream(sharpenedImagePath)
        }, event.threadID, () => {
            // ลบไฟล์ชั่วคราวหลังจากส่งเสร็จ
            fs.unlinkSync(originalImagePath);
            fs.unlinkSync(sharpenedImagePath);
        }, event.messageID);
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในคำสั่ง sharpen:", error.message || error);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการทำให้ภาพคมชัดขึ้น กรุณาลองใหม่อีกครั้ง!", event.threadID, event.messageID);
    }
};
