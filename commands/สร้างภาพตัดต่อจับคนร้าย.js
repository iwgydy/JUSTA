const axios = require("axios");

module.exports.config = {
    name: "จับคนร้าย",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "คุณ",
    description: "สร้างภาพจับคนร้ายพร้อมรายละเอียด",
    commandCategory: "ทั่วไป",
    usages: "[id ผู้ใช้]",
    cooldowns: 0
};

module.exports.run = async function({ api, event, args }) {
    const userID = args[0];

    if (!userID) {
        return api.sendMessage("❌ กรุณาระบุ UserID ที่ต้องการ", event.threadID, event.messageID);
    }

    try {
        const response = await axios.get(`https://api-canvass.vercel.app/art-expert`, {
            params: {
                userid: userID
            }
        });

        if (response.data) {
            const imageUrl = `https://api-canvass.vercel.app/art-expert?userid=${userID}`;
            const message = {
                body: "📌 ข้อมูลภาพที่ได้:",
                attachment: await axios({
                    url: imageUrl,
                    method: "GET",
                    responseType: "stream"
                }).then(res => res.data)
            };
            return api.sendMessage(message, event.threadID, event.messageID);
        } else {
            return api.sendMessage("❌ ไม่สามารถสร้างภาพได้ กรุณาลองใหม่!", event.threadID, event.messageID);
        }
    } catch (error) {
        console.error("Error:", error);
        return api.sendMessage("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ API", event.threadID, event.messageID);
    }
};
