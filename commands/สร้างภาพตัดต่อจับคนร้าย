const axios = require("axios");

module.exports.config = {
    name: "จับคนร้าย",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "ต้นสุดหล่อ",
    description: "จับคนร้ายโดยใช้รูป Canvas พร้อมระบุ ID ของผู้ใช้งาน",
    commandCategory: "ทั่วไป",
    usages: "",
    cooldowns: 0
};

module.exports.run = async function({ api, event }) {
    const userID = event.senderID; // ดึง ID เฟซบุ๊กของผู้ใช้งาน

    try {
        // ดึงข้อมูลจาก API
        const response = await axios.get(`https://api-canvass.vercel.app/art-expert`, {
            params: {
                userid: userID
            }
        });

        // ตรวจสอบว่ามีการตอบกลับข้อมูล
        if (response.data && response.data.canvasURL) {
            // ส่งข้อความพร้อมรูปภาพจาก Canvas
            const canvasImageURL = response.data.canvasURL;

            // ดึงรูปจาก URL แล้วส่งกลับไปในแชท
            const getImage = await axios.get(canvasImageURL, { responseType: "arraybuffer" });
            const imageBuffer = Buffer.from(getImage.data, "binary");

            return api.sendMessage({
                body: "จับคนร้ายสำเร็จ! นี่คือรูปที่ได้จาก Canvas",
                attachment: [imageBuffer]
            }, event.threadID, event.messageID);
        } else {
            return api.sendMessage("⏰ ไม่พบรูป Canvas ที่ต้องการ กรุณาลองใหม่!", event.threadID, event.messageID);
        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการจับคนร้าย:", error);
        api.sendMessage("⏰ เกิดข้อผิดพลาดในการเชื่อมต่อกับ API กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
