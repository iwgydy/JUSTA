const axios = require("axios");

module.exports.config = {
    name: "จับคนร้าย",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "ต้นสุดหล่อ",
    description: "จับคนร้ายและสร้างภาพแสดงในแชท",
    commandCategory: "ทั่วไป",
    usages: "[@mention]",
    cooldowns: 0
};

module.exports.run = async function({ api, event, args }) {
    const mentions = Object.keys(event.mentions); // รายชื่อคนที่ถูกแท็ก
    const userID = mentions.length > 0 ? mentions[0] : event.senderID; // ใช้ ID คนที่ถูกแท็กหรือผู้ส่ง
    const taggedName = mentions.length > 0 ? event.mentions[userID] : "คุณ";

    try {
        // ดึงข้อมูลจาก API
        const response = await axios.get(`https://api-canvass.vercel.app/art-expert`, {
            params: { userid: userID }
        });

        if (response.data && response.data.image) {
            const imageURL = response.data.image;

            // ดาวน์โหลดภาพเพื่อนำไปแสดง
            const imageResponse = await axios.get(imageURL, { responseType: "arraybuffer" });
            const imageBuffer = Buffer.from(imageResponse.data, "binary");

            // ส่งข้อความพร้อมแท็กและรูปภาพ
            api.sendMessage(
                {
                    body: `👮‍♂️ จับคนร้ายได้แล้ว! ${taggedName} ถูกจับได้ว่าเป็นผู้ต้องสงสัย!`,
                    mentions: [{ id: userID, tag: taggedName }],
                    attachment: [imageBuffer]
                },
                event.threadID,
                event.messageID
            );
        } else {
            throw new Error("ไม่พบข้อมูลภาพ");
        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาด:", error.message);
        api.sendMessage("❌ ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
