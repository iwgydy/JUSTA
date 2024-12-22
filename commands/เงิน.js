module.exports = {
    config: {
        name: "ดูเงิน",
        version: "1.0.0",
        description: "ตรวจสอบยอดเงินของคุณ",
        commandCategory: "economy",
        usages: "",
        cooldowns: 5
    },
    run: async ({ api, event }) => {
        const { senderID, threadID, messageID } = event;

        // ตรวจสอบว่า global.moneyData ถูกสร้างไว้หรือไม่
        global.moneyData = global.moneyData || {};

        // ตั้งค่าเริ่มต้นเป็น 0 บาท หากผู้ใช้ยังไม่มีข้อมูลในระบบ
        if (!global.moneyData[senderID]) {
            global.moneyData[senderID] = 0;
        }

        // ดึงยอดเงินของผู้ใช้
        const userMoney = global.moneyData[senderID];

        // สร้างข้อความสั้นและเรียบง่าย
        const moneyMessage = `💸 ${userMoney.toLocaleString()}`;

        // ส่งข้อความแจ้งยอดเงิน
        api.sendMessage(moneyMessage, threadID, messageID);
    }
};
