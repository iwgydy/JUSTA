const fs = require("fs");
const path = require("path");

module.exports = {
    config: {
        name: "ดูเงิน",
        version: "1.0.0",
        description: "ตรวจสอบยอดเงินของตัวเองหรือผู้ใช้ที่ถูกแท็ก พร้อมแสดงชื่อและยอดเงิน",
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
        } else {
            // หากไม่มีการแท็ก ให้แสดงยอดเงินของตัวเอง
            targetID = senderID;
        }

        // ตรวจสอบว่าผู้ใช้เป้าหมายมีข้อมูลเงินหรือไม่
        if (!moneyData[targetID]) {
            moneyData[targetID] = 0; // ตั้งค่าเริ่มต้นเป็น 0 บาท
        }

        // ดึงยอดเงินของผู้ใช้เป้าหมาย
        const userMoney = moneyData[targetID];

        // ดึงชื่อผู้ใช้เป้าหมาย
        api.getUserInfo(targetID, (err, info) => {
            if (err) {
                return api.sendMessage("เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้", threadID, messageID);
            }

            const targetName = info[targetID].name || "ผู้ใช้ไม่ทราบชื่อ";

            // ส่งข้อความแจ้งยอดเงินพร้อมตกแต่ง
            const message = `🧑‍🎄 ${targetName}\n💸 ${userMoney.toLocaleString()}`;
            api.sendMessage(message, threadID, messageID);
        });

        // บันทึกข้อมูลกลับไปที่ไฟล์
        fs.writeFileSync(filePath, JSON.stringify(moneyData, null, 2), "utf8");
    }
};
