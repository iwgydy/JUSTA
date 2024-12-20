const fs = require("fs");

module.exports.config = {
    name: "ดูคำสั่ง",
    version: "3.0.0",
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

        // เก็บข้อมูลคำสั่ง
        const commands = commandFiles.map(file => {
            const command = require(`./${file}`);
            return {
                name: command.config.name,
                category: command.config.commandCategory || "อื่นๆ"
            };
        });

        // จัดกลุ่มคำสั่งตามหมวดหมู่
        const groupedCommands = commands.reduce((groups, command) => {
            const category = command.category || "อื่นๆ";
            if (!groups[category]) groups[category] = [];
            groups[category].push(command.name);
            return groups;
        }, {});

        // สร้างข้อความแสดงผลในธีมคริสต์มาส
        let message = `
🎅🎄❄️━━━━━━━━━━━━━━━━━━━━━━━❄️🎄🎅
        🎁 **𝐌𝐄𝐑𝐑𝐘 𝐂𝐇𝐑𝐈𝐒𝐓𝐌𝐀𝐒** 🎁
🎄 **𝐒𝐓𝐄𝐋𝐋𝐘 𝐂𝐇𝐀𝐓 𝐁𝐎𝐓** 🎄
🎅🎄❄️━━━━━━━━━━━━━━━━━━━━━━━❄️🎄🎅

🎀 **คำสั่งทั้งหมดพร้อมให้ใช้งาน** 🎀
`;

        for (const [category, cmds] of Object.entries(groupedCommands)) {
            message += `
✨🎄 **${category.toUpperCase()}** 🎄✨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${cmds.map(cmd => `🎁 /${cmd}`).join("\n")}
`;
        }

        message += `
🎁❄️━━━━━━━━━━━━━━━━━━━━━━━━━━━❄️🎁
        🌟 **สุขสันต์วันคริสต์มาส!** 🌟
🎅 **𝐒𝐓𝐄𝐋𝐋𝐘 𝐂𝐇𝐀𝐓 𝐁𝐎𝐓 ขอบคุณที่ใช้บริการ** 🎅
🎁❄️━━━━━━━━━━━━━━━━━━━━━━━━━━━❄️🎁
`;

        // ส่งข้อความกลับไป
        api.sendMessage(message, event.threadID, event.messageID);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่ง:", error);
        api.sendMessage("❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", event.threadID, event.messageID);
    }
};
