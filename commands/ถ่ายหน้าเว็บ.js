const axios = require("axios");

module.exports.config = {
    name: "ถ่ายรูปหน้าเว็บ",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "Kaizenji",
    description: "ถ่ายภาพหน้าจอจากเว็บไซต์ที่ระบุ",
    commandCategory: "ทั่วไป",
    usages: "[URL ของเว็บไซต์]",
    cooldowns: 0
};

module.exports.run = async function({ api, event, args }) {
    const url = args[0]; // รับ URL จากคำสั่งที่พิมพ์

    if (!url) {
        return api.sendMessage("💬 กรุณาระบุ URL ของเว็บไซต์ที่ต้องการถ่ายรูป!", event.threadID, event.messageID);
    }

    try {
        // แจ้งข้อความกำลังเข้าเว็บ
        api.sendMessage(`🔄 กำลังเข้าเว็บ: ${url}`, event.threadID);

        // เรียก API เพื่อถ่ายรูปหน้าเว็บ
        const response = await axios.get(`https://kaiz-apis.gleeze.com/api/screenshot`, {
            params: { url: url },
            responseType: "arraybuffer" // รับข้อมูลภาพเป็นบัฟเฟอร์
        });

        // ส่งภาพที่ได้กลับไปในแชท
        api.sendMessage(
            {
                body: `📸 นี่คือภาพหน้าจอของเว็บไซต์: ${url}`,
                attachment: Buffer.from(response.data, "binary")
            },
            event.threadID,
            event.messageID
        );
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการถ่ายรูปหน้าเว็บ:", error);
        api.sendMessage("❌ ไม่สามารถถ่ายภาพหน้าจอของเว็บไซต์นี้ได้ กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
