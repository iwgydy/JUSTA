// commands/ดูข้อมูลบอท.js
const os = require('os');
const process = require('process');
const figlet = require('figlet');

module.exports = {
    config: {
        name: "ดูข้อมูลบอท",
        description: "แสดงข้อมูลเกี่ยวกับบอท",
        usage: "/ดูข้อมูลบอท",
    },
    run: async ({ api, event }) => {
        // ข้อมูลทั่วไปเกี่ยวกับบอท
        const botName = "เจอไนท์ 3S Bot 2025";
        const botVersion = "1.0.0";
        const developer = "https://www.facebook.com/profile.php?id=61555184860915";
        const githubRepo = "ไม่แจกเว้ย";

        // เวลาทำงานของบอท (uptime)
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeString = `${hours} ชั่วโมง ${minutes} นาที ${seconds} วินาที`;

        // ข้อมูลระบบ
        const platform = os.platform();
        const arch = os.arch();
        const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
        const freeMem = (os.freemem() / 1024 / 1024).toFixed(2);

        // สร้างข้อความ
        const infoMessage = `
${figlet.textSync("Bot Info", { horizontalLayout: "full" })}

🎄 **ชื่อบอท**: ${botName}
🎅 **เวอร์ชัน**: ${botVersion}
👨‍💻 **ผู้พัฒนา**: ${developer}
📂 **GitHub**: ${githubRepo}

⏱️ **เวลาทำงาน**: ${uptimeString}

💻 **ระบบปฏิบัติการ**: ${platform} (${arch})
🧠 **หน่วยความจำ**: ${freeMem} MB / ${totalMem} MB

✨ **คำสั่งพิเศษ**: /ดูคำสั่ง เพื่อดูคำสั่งทั้งหมด
        `;

        // ส่งข้อความ
        api.sendMessage(infoMessage, event.threadID);
    }
};
