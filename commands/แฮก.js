const axios = require("axios");

module.exports.config = {
    name: "ค้นหารูป",
    version: "1.1.0",
    hasPermssion: 0,
    credits: "ต้นสุดหล่อ",
    description: "ค้นหารูปภาพในธีมหิมะคริสต์มาส 2025 พร้อมแสดงภาพ",
    commandCategory: "ค้นหา",
    usages: "[คำค้นหา]",
    cooldowns: 5
};

module.exports.run = async function({ api, event, args }) {
    const searchQuery = args.join(" ");
    if (!searchQuery) {
        return api.sendMessage("❄️ กรุณาระบุคำค้นหา เช่น: /ค้นหารูป 8k ❄️", event.threadID, event.messageID);
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

        // ส่งรูปพร้อมข้อความธีมคริสต์มาส 2025
        let message = `
❄️🎅━━━━━━━━━━━━━━━━━━━━━━━━━🎅❄️
         🎁 **𝑪𝒉𝒓𝒊𝒔𝒕𝒎𝒂𝒔 2025 𝑰𝒎𝒂𝒈𝒆 𝑺𝒆𝒂𝒓𝒄𝒉** 🎁
     🌟 **ผลลัพธ์การค้นหา: "${searchQuery}"** 🌟
❄️🎅━━━━━━━━━━━━━━━━━━━━━━━━━🎅❄️
🎀 **เพลิดเพลินกับรูปภาพด้านล่าง!** 🎀
`;

        api.sendMessage(message, event.threadID, event.messageID, async () => {
            for (const url of imageUrls) {
                await api.sendMessage({ body: "", attachment: await axios({ url, responseType: 'stream' }).then(res => res.data) }, event.threadID);
            }
        });
    } catch (error) {
        console.error("เกิดข้อผิดพลาด:", error);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการค้นหารูปภาพ กรุณาลองใหม่อีกครั้ง ❌", event.threadID, event.messageID);
    }
};
