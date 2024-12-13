module.exports.config = {
    name: "ไอดี",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "แสดง ID ของบอท",
    commandCategory: "ทดสอบ",
    usages: "",
    cooldowns: 5
};

module.exports.run = async function({ api, event }) {
    try {
        // วิธีการดึง ID ของบอทขึ้นอยู่กับไลบรารีที่ใช้
        // ลองใช้ `api.getCurrentUserID()` ถ้ามี หรือวิธีอื่น ๆ ที่ไลบรารีรองรับ
        const botID = await api.getCurrentUserID();
        if (!botID) {
            api.sendMessage("ไม่สามารถดึง ID ของบอทได้", event.threadID, event.messageID);
            return;
        }
        api.sendMessage(`ID ของบอทคือ: ${botID}`, event.threadID, event.messageID);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึง ID ของบอท:", error);
        api.sendMessage("❌ ไม่สามารถดึง ID ของบอทได้", event.threadID, event.messageID);
    }
};
