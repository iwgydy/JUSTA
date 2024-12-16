const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");

module.exports.config = {
    name: "สร้างคำคม",
    version: "2.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "สร้างคำคมพร้อมฟอนต์น่ารัก",
    commandCategory: "image",
    usages: "สร้างคำคม <ข้อความ>",
    cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
    try {
        const userText = args.join(" "); // รวมข้อความที่ส่งมาพร้อมคำสั่ง
        if (!userText) {
            return api.sendMessage("❗ กรุณาใส่ข้อความสำหรับสร้างคำคม", event.threadID, event.messageID);
        }

        // พื้นหลังที่ใช้
        const backgroundImageURL = "https://i.imgur.com/a4gsUdY.jpeg";

        // โหลดภาพพื้นหลัง
        const response = await axios({
            url: backgroundImageURL,
            method: "GET",
            responseType: "arraybuffer"
        });

        // ฟอนต์ที่ติดตั้ง
        const fontPath = "/usr/share/fonts/truetype/custom/305PANITheFoxDemo-Regular.ttf";
        const outputImagePath = path.join(__dirname, "tmp", `quote_${Date.now()}.png`);

        // สร้าง SVG สำหรับข้อความ
        const svgText = `
            <svg width="1280" height="720">
                <style>
                    @font-face {
                        font-family: 'CustomFont';
                        src: url('file://${fontPath}');
                    }
                    text {
                        font-family: 'CustomFont', Arial, sans-serif;
                        fill: #ffffff;
                        font-size: 50px;
                    }
                </style>
                <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">
                    ${userText}
                </text>
            </svg>
        `;

        const svgBuffer = Buffer.from(svgText);

        // ใช้ Sharp คอมโพส SVG กับภาพพื้นหลัง
        await sharp(Buffer.from(response.data))
            .composite([{ input: svgBuffer, blend: "over" }])
            .toFile(outputImagePath);

        // ส่งภาพกลับไปในแชท
        api.sendMessage({
            body: "✨ คำคมสุดพิเศษของคุณมาแล้ว!",
            attachment: fs.createReadStream(outputImagePath)
        }, event.threadID, () => {
            // ลบไฟล์หลังจากส่งเสร็จ
            fs.unlinkSync(outputImagePath);
        }, event.messageID);
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในคำสั่งสร้างคำคม:", error);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการสร้างคำคม กรุณาลองใหม่อีกครั้ง", event.threadID, event.messageID);
    }
};
