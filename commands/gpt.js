const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
    name: "สร้างคำคม",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "สร้างภาพคำคมจากข้อความที่ป้อน",
    commandCategory: "utility",
    usages: "<ข้อความคำคม>",
    cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
    try {
        const { threadID, messageID } = event;

        // ตรวจสอบว่ามีข้อความคำคมหรือไม่
        if (args.length === 0) {
            return api.sendMessage("❌ กรุณาใส่ข้อความคำคมที่ต้องการสร้างภาพ!", threadID, messageID);
        }

        const quoteText = args.join(" "); // รวมข้อความคำคมทั้งหมดที่ป้อนมา
        const backgroundUrl = "https://i.imgur.com/a4gsUdY.jpeg";
        const tmpPath = path.join(__dirname, "tmp");
        const outputImagePath = path.join(tmpPath, `quote_${Date.now()}.png`);

        if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);

        // ดาวน์โหลดพื้นหลัง
        const backgroundImage = await axios({
            url: backgroundUrl,
            responseType: "arraybuffer"
        });

        // ใช้ sharp สร้างภาพพร้อมคำคม
        const imageBuffer = Buffer.from(backgroundImage.data);
        await sharp(imageBuffer)
            .resize(1280, 720) // ปรับขนาดภาพ
            .composite([{
                input: Buffer.from(`<svg>
                    <rect x="0" y="0" width="1280" height="720" fill="rgba(0, 0, 0, 0.3)" />
                    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
                          font-family="Arial, sans-serif" font-size="50" fill="white">
                        ${quoteText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                    </text>
                </svg>`),
                blend: "over"
            }])
            .toFile(outputImagePath);

        // ส่งภาพที่สร้างเสร็จกลับไปยังแชท
        api.sendMessage({
            body: "✅ คำคมของคุณถูกสร้างเรียบร้อยแล้ว!",
            attachment: fs.createReadStream(outputImagePath)
        }, threadID, () => fs.unlinkSync(outputImagePath), messageID);

    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในคำสั่งสร้างคำคม:", error);
        return api.sendMessage("❌ เกิดข้อผิดพลาดในการสร้างคำคม กรุณาลองใหม่อีกครั้ง!", event.threadID, event.messageID);
    }
};
