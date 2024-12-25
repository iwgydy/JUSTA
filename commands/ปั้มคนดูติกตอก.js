const axios = require("axios");

module.exports.config = {
    name: "ปั้มวิวติกตอก",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "คุณ",
    description: "ปั้มวิว TikTok ด้วยการส่งลิงก์วิดีโอและชื่อผู้ใช้",
    commandCategory: "ทั่วไป",
    usages: "[username] [link]",
    cooldowns: 5
};

module.exports.run = async function({ api, event, args }) {
    const username = args[0];
    const link = args[1];

    // ตรวจสอบว่ามีการป้อน username และ link หรือไม่
    if (!username || !link) {
        return api.sendMessage("❗ กรุณาระบุชื่อผู้ใช้และลิงก์วิดีโอ TikTok!", event.threadID, event.messageID);
    }

    try {
        const response = await axios.get("https://betadash-search-download.vercel.app/tikboost", {
            params: {
                username: username,
                link: link
            }
        });

        const result = response.data;

        if (result.success) {
            api.sendMessage(`✅ ปั้มวิวสำเร็จ! จำนวนวิวที่เพิ่ม: ${result.viewCount || "N/A"}`, event.threadID, event.messageID);
        } else {
            api.sendMessage(`❌ ไม่สามารถปั้มวิวได้: ${result.error || "Unknown error"}`, event.threadID, event.messageID);
        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาด:", error);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
