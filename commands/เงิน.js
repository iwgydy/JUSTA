const fs = require("fs");
const path = require("path");

module.exports = {
    config: {
        name: "ดูเงิน",
        version: "1.0.0",
        description: "ตรวจสอบยอดเงินของตัวเองหรือผู้ใช้ที่ถูกแท็ก",
        commandCategory: "economy",
        usages: "[@mention]",
        cooldowns: 5
    },
    run: async ({ api, event, args }) => {
        const { senderID, threadID, messageID, mentions } = event;

        // กำหนดเส้นทางไฟล์เก็บข้อมูล
        const filePath = path.resolve(__dirname, "moneyData.json");

        // ตรวจสอบและสร้างไฟล์ JSON อัตโนมัติหากไม่มีไฟล์
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}, null, 2), "utf8");
        }

        // อ่านข้อมูลจากไฟล์
        let moneyData = JSON.parse(fs.readFileSync(filePath, "utf8"));

        let targetID;
        let targetName;

        // ถ้าผู้ใช้มีการแท็กคนอื่น
        if (Object.keys(mentions).length > 0) {
            targetID = Object.keys(mentions)[0]; // ใช้ ID ของคนแรกที่ถูกแท็ก
            targetName = mentions[targetID];    // ชื่อของคนที่ถูกแท็ก
        } else {
            // หากไม่มีการแท็ก ให้แสดงยอดเงินของตัวเอง
            targetID = senderID;
            targetName = "คุณ";
        }

        // ตรวจสอบว่าผู้ใช้เป้าหมายมีข้อมูลเงินหรือไม่
        if (!moneyData[targetID]) {
            moneyData[targetID] = 0; // ตั้งค่าเริ่มต้นเป็น 0 บาท
        }

        // ดึงยอดเงินของผู้ใช้เป้าหมาย
        const userMoney = moneyData[targetID];

        // บันทึกข้อมูลกลับไปที่ไฟล์
        fs.writeFileSync(filePath, JSON.stringify(moneyData, null, 2), "utf8");

        // ส่งข้อความแจ้งยอดเงิน
        const message = `💸  ${userMoney.toLocaleString()} บาท`;
        api.sendMessage(message, threadID, messageID);
    }
};
