const axios = require("axios");
const fs = require("fs");

let lastImage = null; // ตัวแปรสำหรับเก็บข้อมูลภาพล่าสุด

module.exports.config = {
    name: "เปลี่ยนภาพเป็นลิงค์",
    version: "1.1.1",
    hasPermssion: 0,
    credits: "Sumiproject API",
    description: "แปลงภาพล่าสุดที่ส่งให้กลายเป็นลิงก์",
    commandCategory: "ทั่วไป",
    usages: "[ส่งภาพก่อนพิมพ์คำสั่ง]",
    cooldowns: 5
};

module.exports.handleEvent = function({ event }) {
    // ตรวจสอบว่ามีการแนบไฟล์ภาพหรือไม่
    if (event.attachments && event.attachments.length > 0) {
        // เก็บ URL ของภาพล่าสุดไว้ในตัวแปร lastImage
        lastImage = event.attachments[0];
    }
};

module.exports.run = async function({ api, event }) {
    // ตรวจสอบว่ามีภาพล่าสุดถูกเก็บไว้หรือไม่
    if (!lastImage) {
        return api.sendMessage(
            "❌ กรุณาส่งภาพก่อนแล้วพิมพ์คำสั่ง `/เปลี่ยนภาพเป็นลิงค์` อีกครั้ง!",
            event.threadID,
            event.messageID
        );
    }

    try {
        // ดาวน์โหลดไฟล์ภาพล่าสุด
        const imageResponse = await axios.get(lastImage.url, { responseType: "arraybuffer" });

        // บันทึกไฟล์ภาพชั่วคราว
        const tempFilePath = `${__dirname}/temp_image.jpg`;
        fs.writeFileSync(tempFilePath, imageResponse.data);

        // อัพโหลดไฟล์ภาพไปที่ API
        const formData = new FormData();
        formData.append("file", fs.createReadStream(tempFilePath));
        const response = await axios.post("https://api.sumiproject.net/imgur?link=", formData, {
            headers: {
                ...formData.getHeaders()
            }
        });

        // ลบไฟล์ภาพชั่วคราว
        fs.unlinkSync(tempFilePath);

        // รีเซ็ต lastImage หลังอัพโหลดสำเร็จ
        lastImage = null;

        // เช็คผลลัพธ์และส่งกลับ
        if (response.data.error) {
            return api.sendMessage(`❌ เกิดข้อผิดพลาด: ${response.data.error}`, event.threadID, event.messageID);
        }

        api.sendMessage(`✅ ลิงก์ภาพของคุณ: ${response.data.link}`, event.threadID, event.messageID);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการอัพโหลดภาพ:", error);
        api.sendMessage("❌ ไม่สามารถเปลี่ยนภาพเป็นลิงก์ได้ กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
