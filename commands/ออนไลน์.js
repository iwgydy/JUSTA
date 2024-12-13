const os = require("os");

module.exports.config = {
    name: "ออนไลน์",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "แสดงระยะเวลาที่บอทออนไลน์และสถานะเซิร์ฟเวอร์",
    commandCategory: "ข้อมูลระบบ",
    usages: "",
    cooldowns: 0
};

module.exports.run = async function({ api, event }) {
    try {
        // คำนวณเวลาที่บอทออนไลน์
        const uptime = process.uptime();
        const days = Math.floor(uptime / (24 * 3600));
        const hours = Math.floor((uptime % (24 * 3600)) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        // ข้อมูลเซิร์ฟเวอร์
        const cpuUsage = os.loadavg()[0].toFixed(2); // CPU load average (1 นาที)
        const ramUsage = (os.totalmem() - os.freemem()) / (1024 * 1024); // RAM ที่ใช้ (MB)
        const totalRam = os.totalmem() / (1024 * 1024); // RAM ทั้งหมด (MB)
        const platform = os.platform(); // ระบบปฏิบัติการ
        const architecture = os.arch(); // สถาปัตยกรรม CPU

        // สร้างข้อความ
        const message = `
        𝗦𝗲𝗿𝘃𝗲𝗿 𝗥𝘂𝗻𝗻𝗶𝗻𝗴 𝗙𝗼𝗿:
        ❖ ${days} วัน, ${hours} ชั่วโมง, ${minutes} นาที, ${seconds} วินาที
        
        ❖ 𝗖𝗣𝗨 𝗨𝘀𝗮𝗴𝗲: ${cpuUsage}%
        ❖ 𝗥𝗔𝗠 𝗨𝘀𝗮𝗴𝗲: ${ramUsage.toFixed(2)} MB / ${totalRam.toFixed(2)} MB
        ❖ 𝗣𝗹𝗮𝘁𝗳𝗼𝗿𝗺: ${platform}
        ❖ 𝗔𝗿𝗰𝗵𝗶𝘁𝗲𝗰𝘁𝘂𝗿𝗲: ${architecture}
        `;

        // ส่งข้อความ
        api.sendMessage(message.trim(), event.threadID, event.messageID);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลระบบ:", error);
        api.sendMessage("ไม่สามารถแสดงสถานะบอทได้ กรุณาลองใหม่อีกครั้ง", event.threadID, event.messageID);
    }
};