const axios = require("axios");

module.exports = {
    config: {
        name: "ดูวิดีโอยูทูป",
        description: "ค้นหาและแสดงวิดีโอ YouTube ผลลัพธ์แรก",
        usage: "!ดูวิดีโอยูทูป <ชื่อวิดีโอ>",
        permissions: "everyone",
    },
    run: async ({ api, event, args }) => {
        if (args.length < 1) {
            return api.sendMessage(
                "❗ กรุณาระบุข้อความที่ต้องการค้นหา\nตัวอย่างการใช้งาน: !ดูวิดีโอยูทูป ปรารถนาสิ่งใดฤๅ",
                event.threadID,
                event.messageID
            );
        }

        const query = args.join(" ");
        const apiUrl = `https://nethwieginedev.vercel.app/api/ytsearch3?name=${encodeURIComponent(query)}`;

        try {
            const response = await axios.get(apiUrl);
            const videos = response.data.result;

            if (!videos || videos.length === 0) {
                return api.sendMessage(
                    "❗ ไม่พบวิดีโอที่คุณค้นหา",
                    event.threadID,
                    event.messageID
                );
            }

            // เลือกรายการแรก
            const video = videos[0];

            // ส่งลิงก์วิดีโอโดยตรงเพื่อให้แพลตฟอร์มแสดงตัวอย่างคลิป
            const message = `🎬 ${video.title}\n⏱️ ระยะเวลา: ${video.duration}\n\n${video.url}`;

            return api.sendMessage(message, event.threadID, event.messageID);
        } catch (error) {
            console.error("❌ Error fetching YouTube data:", error.message);
            return api.sendMessage(
                "❗ เกิดข้อผิดพลาดในการเชื่อมต่อกับ API",
                event.threadID,
                event.messageID
            );
        }
    },
};
