const axios = require("axios");

module.exports.config = {
    name: "จับคนร้าย",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "คุณ",
    description: "สร้างภาพจับคนร้าย",
    commandCategory: "ทั่วไป",
    usages: "จับคนร้าย [@ชื่อคน | ไม่ต้องแท็กก็ได้]",
    cooldowns: 0
};

module.exports.run = async function({ api, event }) {
    // ตรวจสอบว่ามีการแท็กคนหรือไม่
    const mentions = Object.keys(event.mentions); // ดึง UserID จากคนที่ถูกแท็ก
    const userID = mentions.length > 0 ? mentions[0] : event.senderID; // ใช้ UserID ที่ถูกแท็ก หรือคนส่งข้อความ

    try {
        // เรียก API เพื่อสร้างภาพ
        const imageUrl = `https://api-canvass.vercel.app/art-expert?userid=${userID}`;
        
        const attachment = await axios({
            url: imageUrl,
            method: "GET",
            responseType: "stream"
        }).then(res => res.data);

        // ส่งเฉพาะรูปภาพกลับไป
        return api.sendMessage({ attachment }, event.threadID, event.messageID);
    } catch (error) {
        console.error("Error:", error);
        return api.sendMessage("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ API", event.threadID, event.messageID);
    }
};
