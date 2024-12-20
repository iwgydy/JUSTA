const axios = require("axios");
const fs = require("fs");

module.exports.config = {
    name: "ค้นหารูป",
    version: "1.2.0",
    hasPermssion: 0,
    credits: "ต้นสุดหล่อ",
    description: "ค้นหารูปภาพในธีมหิมะคริสต์มาส 2025 พร้อมแสดงภาพในข้อความเดียว",
    commandCategory: "ค้นหา",
    usages: "[คำค้นหา]",
    cooldowns: 5
};

module.exports.run = async function({ api, event, args }) {
    const searchQuery = args.join(" ");
    if (!searchQuery) {
        return api.sendMessage("❄️ กรุณาระบุคำค้นหา เช่น: /ค้นหารูป Christmas ❄️", event.threadID, event.messageID);
    }

    try {
        // เรียก API เพื่อค้นหารูป
        const response = await axios.get(`https://api.sumiproject.net/pinterest?search=${encodeURIComponent(searchQuery)}`);
        const { data } = response.data;

        if (!data || data.length === 0) {
            return api.sendMessage(`🎄 ไม่พบรูปภาพสำหรับ "${searchQuery}" 🎄`, event.threadID, event.messageID);
        }

        // จำกัดจำนวนรูปที่ส่ง (ตัวอย่าง: ส่ง 5 รูปแรก)
        const imageUrls = data.slice(0, 5);

        // ดาวน์โหลดรูปภาพและเก็บในไฟล์ชั่วคราว
        const attachments = await Promise.all(
            imageUrls.map(async (url, index) => {
                const path = `/tmp/image${index}.jpg`;
                const writer = fs.createWriteStream(path);
                const response = await axios({ url, method: "GET", responseType: "stream" });
                response.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });
                return fs.createReadStream(path);
            })
        );

        // ส่งข้อความพร้อมภาพ
        api.sendMessage(
            {
                body: `
❄️🎅━━━━━━━━━━━━━━━━━━━━━━━━━🎅❄️
         🎁 **𝑪𝒉𝒓𝒊𝒔𝒕𝒎𝒂𝒔 2025 𝑰𝒎𝒂𝒈𝒆 𝑺𝒆𝒂𝒓𝒄𝒉** 🎁
     🌟 **ผลลัพธ์การค้นหา: "${searchQuery}"** 🌟
❄️🎅━━━━━━━━━━━━━━━━━━━━━━━━━🎅❄️
🎀 **เพลิดเพลินกับรูปภาพด้านล่าง!** 🎀
                `,
                attachment: attachments
            },
            event.threadID,
            () => {
                // ลบไฟล์ชั่วคราวหลังส่งสำเร็จ
                attachments.forEach((file) => fs.unlinkSync(file.path));
            },
            event.messageID
        );
    } catch (error) {
        console.error("เกิดข้อผิดพลาด:", error);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการค้นหารูปภาพ กรุณาลองใหม่อีกครั้ง ❌", event.threadID, event.messageID);
    }
};
