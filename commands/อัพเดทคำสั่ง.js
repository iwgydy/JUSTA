const axios = require('axios');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

module.exports = {
    config: {
        name: "อัพโหลดคำสั่ง",
        description: "อัปโหลดคำสั่งใหม่จาก URL",
        usage: "/อัพโหลดคำสั่ง <URL>",
        access: "admin"
    },
    run: async ({ api, event, args }) => {
        const adminID = botSessions[event.senderID]?.adminID;

        // ตรวจสอบว่าเป็นแอดมิน
        if (event.senderID !== adminID) {
            return api.sendMessage("❌ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้", event.threadID, event.messageID);
        }

        const url = args[0];
        if (!url) {
            return api.sendMessage("❌ กรุณาระบุ URL ของคำสั่งที่ต้องการอัปโหลด\nตัวอย่าง: /อัพโหลดคำสั่ง https://pastebin.com/raw/XXXXXX", event.threadID, event.messageID);
        }

        try {
            // ดึงโค้ดจาก URL
            const response = await axios.get(url);
            const code = response.data;

            // ประเมินโค้ดเพื่อให้แน่ใจว่าเป็นคำสั่งที่ถูกต้อง
            let commandModule;
            try {
                commandModule = eval(code);
            } catch (err) {
                return api.sendMessage("❌ โค้ดที่อัปโหลดไม่สามารถประมวลผลได้ โปรดตรวจสอบโค้ดอีกครั้ง", event.threadID, event.messageID);
            }

            // ตรวจสอบโครงสร้างของคำสั่ง
            if (!commandModule.config || !commandModule.config.name || typeof commandModule.run !== "function") {
                return api.sendMessage("❌ โค้ดที่อัปโหลดไม่ถูกต้อง โปรดตรวจสอบให้แน่ใจว่าไฟล์คำสั่งมีโครงสร้างที่ถูกต้อง", event.threadID, event.messageID);
            }

            const commandName = commandModule.config.name.toLowerCase();

            // ตรวจสอบว่าคำสั่งนี้มีอยู่แล้วหรือไม่
            if (commands[commandName]) {
                return api.sendMessage(`❌ คำสั่ง \`${commandModule.config.name}\` มีอยู่แล้วในระบบ`, event.threadID, event.messageID);
            }

            // บันทึกไฟล์คำสั่งใหม่
            const commandPath = path.join(__dirname, `${commandModule.config.name}.js`);
            fs.writeFileSync(commandPath, code, 'utf-8');

            // โหลดคำสั่งใหม่เข้าไปในระบบ
            const newCommand = require(commandPath);
            commands[commandName] = newCommand;
            commandDescriptions.push({
                name: newCommand.config.name,
                description: newCommand.config.description || "ไม่มีคำอธิบาย",
            });
            commandUsage[commandName] = commandUsage[commandName] || 0;

            console.log(chalk.green(`✅ อัปโหลดคำสั่งใหม่สำเร็จ: ${newCommand.config.name}`));

            // ส่งข้อความแจ้งเตือน
            api.sendMessage(`✅ อัปโหลดคำสั่ง \`${newCommand.config.name}\` สำเร็จ\n🔄 กำลังรีสตาร์ทบอทเพื่อรับคำสั่งใหม่...`, event.threadID, event.messageID);

            // รีสตาร์ทบอทเพื่อโหลดคำสั่งใหม่
            setTimeout(() => {
                process.exit(0);
            }, 3000);

        } catch (error) {
            console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการอัปโหลดคำสั่ง: ${error.message}`));
            api.sendMessage("❌ เกิดข้อผิดพลาดในการอัปโหลดคำสั่ง กรุณาลองใหม่อีกครั้ง", event.threadID, event.messageID);
        }
    }
};
