// events/greeting.js

module.exports = {
    config: {
        name: "Greeting",
        eventType: ["message"], // ระบุว่าอีเวนต์นี้จัดการกับประเภท "message"
    },
    run: async ({ api, event }) => {
        const message = event.body ? event.body.trim() : "";

        // ตรวจสอบว่าข้อความที่ได้รับคือ "สวัสดี"
        if (message === "สวัสดี") {
            // ส่งข้อความตอบกลับ
            api.sendMessage("สวัสดีครับ! Merry Christmas 2025 🎄", event.threadID);
        }
    }
};
