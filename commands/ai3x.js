const axios = require('axios');

module.exports = {
    config: {
        name: 'ai3x', // คำสั่งที่ใช้เรียก
        description: 'คุยกับ AI 3X',
        usage: 'ai3x [ข้อความ]',
    },
    run: async ({ api, event, args }) => {
        const start = Date.now(); // เริ่มจับเวลาประมวลผล

        // ตรวจสอบว่ามีการส่งข้อความมาหรือไม่
        if (args.length === 0) {
            return api.sendMessage("กรุณาส่งข้อความเพื่อถาม AI", event.threadID);
        }

        const prompt = args.join(' '); // รวมข้อความทั้งหมด
        const senderID = event.senderID; // ID ของผู้ส่ง

        try {
            // ส่งคำขอไปยัง API
            const response = await axios.get(`https://kaiz-apis.gleeze.com/api/gpt-4o-pro`, {
                params: {
                    q: prompt,
                    uid: senderID,
                    imageUrl: "สวัสดี", // เพิ่ม URL ของภาพถ้าต้องการ
                },
            });

            const end = Date.now(); // จับเวลาสิ้นสุด
            const elapsedTime = ((end - start) / 1000).toFixed(2); // คำนวณเวลาที่ใช้ในหน่วยวินาที

            // ตรวจสอบว่าข้อมูลจาก API มี `response` หรือไม่
            const aiResponse = response.data.response || "ไม่สามารถรับคำตอบจาก AI ได้";

            // ส่งข้อความตอบกลับพร้อมเวลา
            api.sendMessage(
                `🤖 ตอบจาก AI: ${aiResponse}\n\n⏳ ใช้เวลาประมวลผลทั้งหมด: ${elapsedTime} วินาที`,
                event.threadID
            );
        } catch (error) {
            const end = Date.now();
            const elapsedTime = ((end - start) / 1000).toFixed(2);

            // ส่งข้อความเมื่อเกิดข้อผิดพลาด
            console.error("❌ เกิดข้อผิดพลาด:", error.message || error);
            api.sendMessage(
                `❌ ไม่สามารถติดต่อ AI ได้\n⏳ ใช้เวลาประมวลผลทั้งหมด: ${elapsedTime} วินาที`,
                event.threadID
            );
        }
    },
};
