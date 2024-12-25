const axios = require("axios");

module.exports.config = {
    name: "ตัดต่อป้ายพิพิธภัณฑ์",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "คุณ",
    description: "สร้างภาพป้ายในพิพิธภัณฑ์จาก API",
    commandCategory: "ทั่วไป",
    usages: "ตัดต่อป้ายพิพิธภัณฑ์ [@ชื่อคน | ไม่ต้องแท็กก็ได้]",
    cooldowns: 0
};

module.exports.run = async function({ api, event, args }) {
    const mentions = Object.keys(event.mentions); // ดึง UserID จากคนที่ถูกแท็ก
    const userID = mentions.length > 0 ? mentions[0] : event.senderID; // ใช้ UserID ที่ถูกแท็ก หรือคนส่งข้อความ

    const apiUrl = `https://api-canvass.vercel.app/melbourne?userid=${userID}`; // URL API สำหรับตัดต่อป้ายในห้องพิพิธภัณฑ์

    try {
        // เรียก API เพื่อสร้างภาพ
        const attachment = await axios({
            url: apiUrl,
            method: "GET",
            responseType: "stream"
        }).then(res => res.data);

        // ส่งเฉพาะรูปภาพกลับไป
        return api.sendMessage({ attachment }, event.threadID, event.messageID);
    } catch (error) {
        console.error("Error:", error);
        return api.sendMessage("❌ เกิดข้อผิดพลาดในการสร้างภาพ กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
