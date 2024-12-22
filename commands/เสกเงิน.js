const fs = require("fs");
const path = require("path");

module.exports = {
    config: {
        name: "เสกเงิน",
        version: "1.1.0",
        description: "เสกเงินให้ตัวเองหรือผู้ใช้คนอื่น (เฉพาะแอดมินบอท)",
        commandCategory: "admin",
        usages: "<@mention หรือ 'me'> <จำนวนเงิน>",
        cooldowns: 5
    },
    run: async ({ api, event, args, mentions }) => {
        const { senderID, threadID, messageID } = event;

        // ดึงข้อมูลบอทที่กำลังใช้งานอยู่
        const botSessions = global.botSessions || {};
        let currentBot = null;

        for (const token in botSessions) {
            if (botSessions[token].api === api) {
                currentBot = botSessions[token];
                break;
            }
        }

        if (!currentBot) {
            return api.sendMessage("❗ ไม่พบบอทที่กำลังใช้งานอยู่", threadID, messageID);
        }

        // ตรวจสอบสิทธิ์ว่าเป็นแอดมินบอทหรือไม่
        if (senderID !== currentBot.adminID) {
            return api.sendMessage("❗ คุณไม่มีสิทธิ์ใช้คำสั่งนี้", threadID, messageID);
        }

        // ตรวจสอบจำนวนเงิน
        const amount = parseInt(args[args.length - 1]);
        if (isNaN(amount) || amount <= 0) {
            return api.sendMessage("❌ กรุณาใส่จำนวนเงินที่เป็นตัวเลขและมากกว่า 0!", threadID, messageID);
        }

        // ตรวจสอบว่าเสกให้ตัวเองหรือคนอื่น
        let targetID;
        let targetName;
        if (args[0] === "me") {
            targetID = senderID;
            targetName = "คุณ";
        } else if (Object.keys(mentions).length > 0) {
            targetID = Object.keys(mentions)[0];
            targetName = mentions[targetID];
        } else {
            return api.sendMessage("❌ กรุณาแท็กผู้ใช้หรือใช้ 'me' เพื่อเสกเงินให้ตัวเอง!", threadID, messageID);
        }

        // กำหนดเส้นทางไฟล์เก็บข้อมูลเงิน
        const filePath = path.resolve(__dirname, "moneyData.json");

        // ตรวจสอบและสร้างไฟล์ JSON อัตโนมัติหากไม่มีไฟล์
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}, null, 2), "utf8");
        }

        // อ่านข้อมูลจากไฟล์
        let moneyData = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // เพิ่มเงินให้เป้าหมาย
        if (!moneyData[targetID]) {
            moneyData[targetID] = 0; // ตั้งค่าเริ่มต้นเป็น 0 บาท
        }
        moneyData[targetID] += amount;

        // บันทึกข้อมูลกลับไปที่ไฟล์
        fs.writeFileSync(filePath, JSON.stringify(moneyData, null, 2), "utf8");

        // ส่งข้อความแจ้งผล
        api.sendMessage(
            `✅ เสกเงินสำเร็จ! 🧙‍♂️\n💸 ${targetName} ได้รับเงินเพิ่ม ${amount.toLocaleString()} บาท\n💰 ยอดเงินใหม่: ${moneyData[targetID].toLocaleString()} บาท`,
            threadID,
            messageID
        );
    }
};
