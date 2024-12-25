const axios = require("axios");

module.exports.config = {
    name: "จับคนร้าย",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "คุณ",
    description: "จับภาพคนร้ายจาก API",
    commandCategory: "ทั่วไป",
    usages: "[@mention]",
    cooldowns: 5
};

module.exports.run = async function({ api, event }) {
    try {
        const userID = Object.keys(event.mentions)[0];
        const taggedName = event.mentions[userID] || "ผู้ต้องสงสัย";

        // ดึงภาพจาก API
        const response = await axios.get(`https://api-canvass.vercel.app/art-expert`, {
            params: { userid: userID },
            responseType: "arraybuffer"
        });

        if (!response.data) {
            throw new Error("ไม่พบข้อมูลภาพจาก API");
        }

        // สร้าง Buffer จากภาพ
        const imageBuffer = Buffer.from(response.data, "binary");

        // ส่งข้อความพร้อมแนบภาพ
        api.sendMessage(
            {
                body: `👮‍♂️ จับคนร้ายได้แล้ว! ${taggedName} ถูกจับได้ว่าเป็นผู้ต้องสงสัย!`,
                mentions: [{ id: userID, tag: taggedName }],
                attachment: imageBuffer
            },
            event.threadID,
            event.messageID
        );
    } catch (error) {
        console.error("เกิดข้อผิดพลาด:", error.message);
        api.sendMessage("❌ ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
