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

        // ตรวจสอบว่า global.moneyData ถูกสร้างไว้หรือไม่
        global.moneyData = global.moneyData || {};

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
        if (!global.moneyData[targetID]) {
            global.moneyData[targetID] = 0; // ตั้งค่าเริ่มต้นเป็น 0 บาท
        }

        // ดึงยอดเงินของผู้ใช้เป้าหมาย
        const userMoney = global.moneyData[targetID];

        // ส่งข้อความแจ้งยอดเงิน
        const message = `💸  ${userMoney.toLocaleString()} บาท`;
        api.sendMessage(message, threadID, messageID);
    }
};
