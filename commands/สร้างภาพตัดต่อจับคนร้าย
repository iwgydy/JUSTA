const axios = require("axios");
const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");

module.exports.config = {
    name: "จับคนร้าย",
    version: "1.0.1",
    hasPermssion: 0,
    credits: "ต้นสุดหล่อ",
    description: "จับคนร้ายพร้อมแสดง ID ในรูปแบบ Canvas และแท็กคนอื่น",
    commandCategory: "ภาพ",
    usages: "[ชื่อผู้ใช้หรือ @mention]",
    cooldowns: 5
};

module.exports.run = async function({ api, event, args }) {
    const mentionIDs = Object.keys(event.mentions);
    const userID = mentionIDs.length > 0 ? mentionIDs[0] : event.senderID;
    const userName = mentionIDs.length > 0 ? Object.values(event.mentions)[0] : "คุณ";

    if (!userID) {
        return api.sendMessage("💬 ไม่สามารถจับข้อมูลของผู้ใช้ได้!", event.threadID, event.messageID);
    }

    const startTime = Date.now();

    try {
        // เรียก API
        const response = await axios.get(`https://api-canvass.vercel.app/art-expert`, {
            params: { userid: userID }
        });

        if (!response.data || !response.data.success) {
            return api.sendMessage("❌ ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่!", event.threadID, event.messageID);
        }

        // ดึงรูปภาพจาก API
        const userImageURL = response.data.image;
        const userImage = await loadImage(userImageURL);

        // สร้าง Canvas
        const canvas = createCanvas(800, 600);
        const ctx = canvas.getContext("2d");

        // วาดพื้นหลัง
        const background = await loadImage("https://your-image-link.com/police-background.png");
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // วาดรูปผู้ใช้
        ctx.drawImage(userImage, 300, 200, 200, 200);

        // เพิ่มข้อความ
        ctx.font = "30px Kanit";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`คนร้าย ID: ${userID}`, 250, 500);

        // แปลงเป็น Buffer และส่งรูป
        const buffer = canvas.toBuffer();
        const filePath = `จับคนร้าย-${userID}.png`;
        fs.writeFileSync(filePath, buffer);

        // คำนวณเวลา
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        // ส่งรูปและข้อความตอบกลับ พร้อมแท็ก
        api.sendMessage({
            body: `⏰ ใช้เวลา: ${processingTime} วินาที\n📸 นี่คือภาพของ ${userName} คนร้ายในกลุ่ม!`,
            mentions: [{
                tag: userName,
                id: userID
            }],
            attachment: fs.createReadStream(filePath)
        }, event.threadID, () => {
            fs.unlinkSync(filePath); // ลบไฟล์หลังส่ง
        });
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการจับคนร้าย:", error);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
