const fs = require("fs");

module.exports.config = {
    name: "ดูคำสั่ง",
    version: "3.3.0",
    hasPermssion: 0,
    credits: "ต้นสุดหล่อ",
    description: "แสดงรายการคำสั่งทั้งหมด",
    commandCategory: "ทั่วไป",
    usages: "",
    cooldowns: 0
};

module.exports.run = async function({ api, event }) {
    try {
        // ดึงรายการไฟล์คำสั่งในโฟลเดอร์
        const commandFiles = fs.readdirSync("./commands").filter(file => file.endsWith(".js"));

        // ดึงชื่อคำสั่งทั้งหมด
        const commandNames = commandFiles.map(file => {
            const command = require(`./${file}`);
            return command.config.name;
        });

        // สร้างข้อความในธีมคริสต์มาสแบบน่ารัก
        const message = `
🎄✨━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✨🎄
      ❄️🎁 **𝑯𝒐𝒉𝒐𝒉𝒐! 𝑴𝑬𝑹𝑹𝒀 𝑪𝑯𝑹𝑰𝑺𝑻𝑴𝑨𝑺** 🎁❄️
  🎅 **𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐭𝐨 𝐒𝐓𝐄𝐋𝐋𝐘 𝐂𝐡𝐚𝐭 𝐁𝐨𝐭!** 🎅
🎄✨━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✨🎄

🎀 **🎁 รายการคำสั่งสุดพิเศษ 🎁** 🎀

${commandNames.map(cmd => `🎄 ✨ /${cmd}`).join("\n")}

🎅✨━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✨🎅
    🌟 **𝐇𝐚𝐩𝐩𝐲 𝐇𝐨𝐥𝐢𝐝𝐚𝐲𝐬 𝐟𝐫𝐨𝐦 𝐒𝐓𝐄𝐋𝐋𝐘!** 🌟
🎁 **ขอบคุณที่ใช้บริการ ขอให้มีความสุขในทุกวัน!** 🎁
🎄✨━━━━━━━━━━━━━━━━━━━━━━━━━━━━━✨🎄
`;

        // ส่งข้อความกลับไป
        api.sendMessage(message, event.threadID, event.messageID);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่ง:", error);
        api.sendMessage("❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", event.threadID, event.messageID);
    }
};
