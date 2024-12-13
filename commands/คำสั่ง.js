const fs = require("fs");

module.exports.config = {
    name: "ดูคำสั่ง",
    version: "1.0.0",
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
                description: command.config.description,
                category: command.config.commandCategory || "อื่นๆ"
            };
        });

        // จัดกลุ่มคำสั่งตามหมวดหมู่
        const groupedCommands = commands.reduce((groups, command) => {
            const category = command.category || "อื่นๆ";
            if (!groups[category]) groups[category] = [];
            groups[category].push(command);
            return groups;
        }, {});

        // สร้างข้อความแสดงผล
        let message = `
✨━━━━━━━━━━━━━━━✨
        🎉 𝐒𝐓𝐄𝐋𝐋𝐘 𝐂𝐇𝐀𝐓 𝐁𝐎𝐓 🎉
✨━━━━━━━━━━━━━━━✨

📚 **รายการคำสั่งทั้งหมด** 📚

`;

        for (const [category, cmds] of Object.entries(groupedCommands)) {
            message += `
📂 **หมวดหมู่: ${category}** 📂
-----------------------------------
`;
            cmds.forEach(cmd => {
                message += `🔹 **/${cmd.name}**\n   ➜ ${cmd.description}\n\n`;
            });
        }

        message += `
ℹ️ **วิธีใช้งาน:**
พิมพ์ **/ชื่อคำสั่ง** เพื่อใช้งานคำสั่งที่ต้องการ

💡 **ตัวอย่าง:**
- **/ดูคำสั่ง** : แสดงรายการคำสั่งทั้งหมด
- **/ลงทะเบียน** : ลงทะเบียนผู้ใช้ใหม่

✨━━━━━━━━━━━━━━━✨
`;

        // ส่งข้อความกลับไป
        api.sendMessage(message, event.threadID, event.messageID);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลคำสั่ง:", error);
        api.sendMessage("❌ ไม่สามารถแสดงรายการคำสั่งได้ กรุณาลองใหม่อีกครั้ง", event.threadID, event.messageID);
    }
};
