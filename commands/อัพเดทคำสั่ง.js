/************************************
 * อัพเดทคำสั่ง.js
 * คำสั่ง: /อัพเดทคำสั่ง <raw_url>
 ************************************/
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

module.exports.config = {
    name: "อัพเดทคำสั่ง",
    description: "อัปโหลดคำสั่งใหม่จาก Pastebin (เฉพาะแอดมิน)",
    adminOnly: true // ตั้งค่าให้คำสั่งนี้ใช้ได้เฉพาะแอดมิน
};

module.exports.run = async ({ api, event, args }) => {
    try {
        /**********************************************
         * 1) ตรวจสอบพารามิเตอร์
         **********************************************/
        if (!args[0]) {
            return api.sendMessage(
                "❌ โปรดระบุลิงก์ Pastebin ที่ต้องการอัปโหลดในรูปแบบ `https://pastebin.com/raw/<รหัส>`\n\nตัวอย่าง:\n/อัพเดทคำสั่ง https://pastebin.com/raw/Xhh6UWYD",
                event.threadID, 
                event.messageID
            );
        }

        /**********************************************
         * 2) ตรวจสอบว่าเป็นแอดมินบอทหรือไม่
         **********************************************/
        const senderID = event.senderID;
        let isAdmin = false;

        for (const [token, botObj] of Object.entries(global.botSessions)) {
            if (botObj && botObj.adminID && botObj.adminID === senderID) {
                isAdmin = true;
                break;
            }
        }

        if (!isAdmin) {
            return api.sendMessage(
                "❌ คำสั่งนี้ใช้ได้เฉพาะแอดมินบอทเท่านั้น",
                event.threadID, 
                event.messageID
            );
        }

        /**********************************************
         * 3) ดาวน์โหลดไฟล์จาก Pastebin
         **********************************************/
        const pastebinURL = args[0];
        if (!pastebinURL.startsWith('https://pastebin.com/raw/')) {
            return api.sendMessage(
                "❌ ลิงก์ที่ให้มาไม่ถูกต้อง กรุณาใช้ลิงก์ในรูปแบบ `https://pastebin.com/raw/<รหัส>`",
                event.threadID, 
                event.messageID
            );
        }

        // ใช้ dynamic import() เพื่อดึง node-fetch
        const { default: fetch } = await import('node-fetch');

        const response = await fetch(pastebinURL);
        if (!response.ok) {
            return api.sendMessage(
                `❌ ไม่สามารถดาวน์โหลดไฟล์จากลิงก์ที่ระบุได้ (HTTP ${response.status})`,
                event.threadID,
                event.messageID
            );
        }

        const codeContent = await response.text();

        /**********************************************
         * 4) ตรวจสอบว่าเป็นโค้ดคำสั่งที่ถูกต้องหรือไม่
         **********************************************/
        const isCommandValid = codeContent.includes('module.exports.config') && codeContent.includes('module.exports.run');
        if (!isCommandValid) {
            return api.sendMessage(
                "❌ ไฟล์ที่อัปโหลดไม่ใช่โค้ดคำสั่งที่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง",
                event.threadID, 
                event.messageID
            );
        }

        /**********************************************
         * 5) สร้างชื่อไฟล์แบบสุ่ม
         **********************************************/
        const timestamp = Date.now(); 
        const randomString = Math.random().toString(36).substring(2, 7); // สุ่ม 5 ตัวอักษร
        const newFileName = `cmd_${timestamp}_${randomString}.js`;

        /**********************************************
         * 6) บันทึกไฟล์ลงโฟลเดอร์ commands
         **********************************************/
        const commandsFolderPath = __dirname; // โฟลเดอร์ commands
        const targetFilePath = path.join(commandsFolderPath, newFileName);
        fs.writeFileSync(targetFilePath, codeContent, "utf-8");

        /**********************************************
         * 7) นำเข้าคำสั่งใหม่เข้าสู่ระบบ
         **********************************************/
        delete require.cache[require.resolve(targetFilePath)];
        const newCommand = require(targetFilePath);

        if (newCommand.config && newCommand.config.name) {
            const cmdName = newCommand.config.name.toLowerCase();
            global.commands[cmdName] = newCommand;

            // อัปเดต commandUsage หากมี
            if (global.commandUsage && typeof global.commandUsage[cmdName] === 'undefined') {
                global.commandUsage[cmdName] = 0;
            }

            // อัปเดต commandDescriptions หากมี
            if (global.commandDescriptions) {
                const idx = global.commandDescriptions.findIndex(i => 
                    i.name.toLowerCase() === cmdName
                );
                if (idx !== -1) {
                    global.commandDescriptions.splice(idx, 1);
                }
                global.commandDescriptions.push({
                    name: newCommand.config.name,
                    description: newCommand.config.description || "ไม่มีคำอธิบาย",
                });
            }
        } else {
            return api.sendMessage(
                `❌ อัปโหลดไฟล์สำเร็จ แต่ไม่พบ "config.name" จึงไม่สามารถบรรจุคำสั่งลงระบบได้\n\nไฟล์: ${newFileName}`,
                event.threadID,
                event.messageID
            );
        }

        /**********************************************
         * 8) แจ้งเตือนผู้ใช้และรีสตาร์ทบอท
         **********************************************/
        await api.sendMessage(
            `✅ อัปโหลดคำสั่งใหม่สำเร็จ!\n\n📂 ไฟล์: ${newFileName}\n🔄 บอทกำลังรีสตาร์ทตัวเองเพื่อรับคำสั่งใหม่...`,
            event.threadID,
            event.messageID
        );

        console.log(chalk.green(`✅ อัปโหลดไฟล์สำเร็จ: ${newFileName}`));
        console.log(chalk.blue(`🔄 บอทกำลังรีสตาร์ทเพื่อรับคำสั่งใหม่...`));

        // รีสตาร์ทบอท (สมมติว่าคุณใช้ PM2 หรือ process manager อื่น ๆ ที่จะรีสตาร์ทอัตโนมัติเมื่อบอทปิดตัวเอง)
        process.exit(1);

    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดขณะอัปโหลดคำสั่ง: ${err.message}`));
        return api.sendMessage(
            `❌ เกิดข้อผิดพลาดขณะอัปโหลดคำสั่ง:\n${err.message}`,
            event.threadID,
            event.messageID
        );
    }
};
