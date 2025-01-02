/************************************
 * uploadCommands.js
 * คำสั่ง: /อัพโหลคำสั่ง <raw_url>
 ************************************/
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); 
const chalk = require('chalk'); 

module.exports.config = {
    name: "อัพโหลคำสั่ง",
    description: "อัปโหลด (เพิ่ม/อัปเดต) ไฟล์คำสั่งจากลิงก์ภายนอก (เฉพาะแอดมิน)",
};

module.exports.run = async ({ api, event, args }) => {
    try {
        /**********************************************
         * 1) ตรวจสอบพารามิเตอร์
         **********************************************/
        if (!args[0]) {
            return api.sendMessage(
                "โปรดใส่ลิงก์ไฟล์ raw ที่ต้องการอัปโหลด\n\n" + 
                "ตัวอย่าง: /อัพโหลคำสั่ง https://pastebin.com/raw/xxxxx",
                event.threadID, 
                event.messageID
            );
        }

        /**********************************************
         * 2) ตรวจสอบว่าเป็นแอดมินหรือไม่
         **********************************************/
        const senderID = event.senderID;
        let isAdmin = false;
        for (const [token, botObj] of Object.entries(global.botSessions)) {
            if (botObj && botObj.adminID && botObj.adminID == senderID) {
                isAdmin = true;
                break;
            }
        }
        if (!isAdmin) {
            return api.sendMessage(
                "คำสั่งนี้ใช้ได้เฉพาะแอดมินบอทเท่านั้น",
                event.threadID, 
                event.messageID
            );
        }

        /**********************************************
         * 3) ดาวน์โหลดไฟล์
         **********************************************/
        const rawUrl = args[0];
        const response = await fetch(rawUrl);
        if (!response.ok) {
            return api.sendMessage(
                `ไม่สามารถดาวน์โหลดไฟล์จากลิงก์ที่ระบุได้ (HTTP ${response.status})`,
                event.threadID,
                event.messageID
            );
        }
        const fileData = await response.text();

        /**********************************************
         * 4) ตรวจสอบว่าเป็นโค้ดคำสั่งหรือไม่
         **********************************************/
        const isCommandValid = fileData.includes("module.exports.config") && fileData.includes("module.exports.run");
        if (!isCommandValid) {
            return api.sendMessage(
                "❌ ไฟล์ที่อัปโหลดไม่ใช่โค้ดคำสั่งที่ถูกต้อง\nโปรดตรวจสอบและลองใหม่อีกครั้ง",
                event.threadID, 
                event.messageID
            );
        }

        /**********************************************
         * 5) สร้างชื่อไฟล์แบบสุ่ม
         **********************************************/
        const timestamp = Date.now(); 
        const randomString = Math.random().toString(36).substring(2, 7); 
        const newFileName = `cmd_${timestamp}_${randomString}.js`;

        /**********************************************
         * 6) บันทึกไฟล์และนำเข้าระบบ
         **********************************************/
        const commandsFolderPath = __dirname;
        const targetFilePath = path.join(commandsFolderPath, newFileName);
        fs.writeFileSync(targetFilePath, fileData, "utf-8");

        delete require.cache[require.resolve(targetFilePath)];
        const newCommand = require(targetFilePath);

        if (newCommand.config && newCommand.config.name) {
            const cmdName = newCommand.config.name.toLowerCase();
            global.commands[cmdName] = newCommand;

            if (global.commandUsage && typeof global.commandUsage[cmdName] === 'undefined') {
                global.commandUsage[cmdName] = 0;
            }

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
                `❌ อัปโหลดไฟล์สำเร็จ แต่ไม่พบ "config.name" จึงไม่บรรจุคำสั่งลงระบบ\n\nไฟล์: ${newFileName}`,
                event.threadID,
                event.messageID
            );
        }

        /**********************************************
         * 7) แจ้งเตือนผู้ใช้และรีสตาร์ท
         **********************************************/
        api.sendMessage(
            `✅ อัปโหลดคำสั่งใหม่สำเร็จ!\n\n📂 ไฟล์: ${newFileName}\n🎉 บอทกำลังรีสตาร์ทตัวเองเพื่อรับคำสั่งใหม่...`,
            event.threadID,
            event.messageID
        );

        console.log(chalk.green(`✅ อัปโหลดไฟล์สำเร็จ: ${newFileName}`));
        console.log(chalk.blue(`🔄 บอทกำลังรีสตาร์ทเพื่อรับคำสั่งใหม่...`));

        // รีสตาร์ทบอท
        process.exit(1);

    } catch (err) {
        console.error(err);
        return api.sendMessage(
            "❌ เกิดข้อผิดพลาดขณะอัปโหลดไฟล์:\n" + err.message,
            event.threadID,
            event.messageID
        );
    }
};
