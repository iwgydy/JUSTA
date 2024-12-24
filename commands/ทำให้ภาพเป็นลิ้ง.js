const axios = require("axios");
const fs = require("fs");

module.exports.config = {
    name: "เปลี่ยนภาพเป็นลิงค์",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "Sumiproject API",
    description: "แปลงภาพที่ผู้ใช้ส่งให้กลายเป็นลิงก์",
    commandCategory: "ทั่วไป",
    usages: "[ส่งภาพก่อนพิมพ์คำสั่ง]",
    cooldowns: 5
};

module.exports.run = async function({ api, event }) {
    if (!event.attachments || event.attachments.length === 0) {
        return api.sendMessage(
            "❌ กรุณาส่งภาพก่อนแล้วพิมพ์คำสั่งนี้อีกครั้ง!",
            event.threadID,
            event.messageID
        );
    }

    try {
        // ดาวน์โหลดไฟล์ภาพที่แนบมา
        const image = event.attachments[0];
        const imageResponse = await axios.get(image.url, { responseType: "arraybuffer" });

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

        // เช็คผลลัพธ์และส่งกลับ
        if (response.data.error) {
            return api.sendMessage(`❌ เกิดข้อผิดพลาด: ${response.data.error}`, event.threadID, event.messageID);
        }

        // ส่งลิงก์ภาพกลับ
        api.sendMessage(`✅ ลิงก์ภาพของคุณ: ${response.data.link}`, event.threadID, event.messageID);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการอัพโหลดภาพ:", error);
        api.sendMessage("❌ ไม่สามารถเปลี่ยนภาพเป็นลิงก์ได้ กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
