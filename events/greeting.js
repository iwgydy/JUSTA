// events/greeting.js

module.exports = {
    config: {
        name: "Greeting",
        eventType: ["1"], // ปรับให้ตรงกับ logMessageType ที่พบ
    },
    run: async ({ api, event }) => {
        const message = event.body ? event.body.trim() : "";

        // เพิ่มการล็อกเพื่อยืนยันว่าอีเวนต์นี้ถูกเรียกใช้งาน
        console.log(`💬 [Greeting] รับข้อความ: "${message}" จาก threadID: ${event.threadID}`);

        if (message === "สวัสดี") {
            api.sendMessage("สวัสดีครับ! Merry Christmas 2025 🎄", event.threadID);
            console.log(`💬 [Greeting] ส่งข้อความตอบกลับให้ threadID: ${event.threadID}`);
        }
    }
};
