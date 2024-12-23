const axios = require("axios");

module.exports.config = {
    name: "คุยกับลูฟี่",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "ต้นสุดหล่อ",
    description: "พูดคุยกับลูฟี่ พร้อมแสดงเวลาในการประมวลผล!",
    commandCategory: "ทั่วไป",
    usages: "[คำถาม]",
    cooldowns: 0
};

module.exports.run = async function({ api, event, args }) {
    const startTime = Date.now(); // เริ่มจับเวลา
    const question = args.join(" ");
    const userID = event.senderID;

    if (!question) {
        return api.sendMessage("💬 กรุณาพิมพ์คำถามที่ต้องการถามลูฟี่!", event.threadID, event.messageID);
    }

    try {
        // ดึงคำตอบจาก API
        const response = await axios.get(`https://kaiz-apis.gleeze.com/api/luffy-ai`, {
            params: {
                question: question,
                uid: userID
            }
        });

        // คำนวณเวลาในการประมวลผล
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2); // แปลงเป็นวินาที

        // ข้อความตอบกลับกระชับ
        const replyMessage = `
⏰ ${processingTime}
💬 ${response.data.response}
        `;

        // ส่งข้อความกลับไป
        api.sendMessage(replyMessage.trim(), event.threadID, event.messageID);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการคุยกับลูฟี่:", error);
        api.sendMessage("⏰ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
