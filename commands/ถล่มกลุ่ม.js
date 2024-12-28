// นำเข้า commands จากไฟล์หลัก (index.js)
const { commands } = require('../index');

// กำหนดคำสั่ง "สแปมด่าโหด"
const spamInsultHardCommand = {
    config: {
        name: "สแปมด่าโหด",
        description: "สแปมด่าโหดๆ ในกลุ่ม",
        usage: "/สแปมด่าโหด [จำนวนครั้ง]",
        adminOnly: true
    },
    run: async ({ api, event, args }) => {
        const threadID = event.threadID;
        const senderID = event.senderID;
        const adminID = botSessions[event.token].adminID;

        // ตรวจสอบสิทธิ์ผู้ใช้
        if (senderID !== adminID) {
            return api.sendMessage("⚠️ คุณไม่มีสิทธิ์ใช้คำสั่งนี้", threadID);
        }

        // ตรวจสอบจำนวนครั้งที่ระบุ
        const count = parseInt(args[0]);
        if (isNaN(count) || count <= 0 || count > 1000) {
            return api.sendMessage("⚠️ จำนวนครั้งต้องเป็นตัวเลขและไม่เกิน 1000 ครั้ง", threadID);
        }

        // รายการคำด่า
        const insults = [
            "ไอ้โง่เอ้ย",
            "ปัญญาอ่อนจริงๆ",
            "สมองกลวงมาก",
            "ไอ้ขี้แพ้",
            "ไอ้ขี้เกียจ",
            "ไอ้ขี้หลี",
            "ไอ้ขี้เหร่",
            "ไอ้ตัวเหม็น",
            "ไอ้ขี้ขโมย",
            "ไอ้ขี้โกง",
            "ไอ้ขี้หลอก",
            "ไอ้ขี้ลวง",
            "ไอ้ขี้โม้",
            "ไอ้ขี้บ่น",
            "ไอ้ขี้บ่นมาก",
            "ไอ้ขี้บ่นจริงๆ",
            "ไอ้ขี้บ่นสุดๆ",
            "ไอ้ขี้บ่นเกินไป",
            "ไอ้ขี้บ่นไม่หยุด",
            "ไอ้ขี้บ่นตลอดเวลา"
        ];

        // ส่งข้อความด่าไปเรื่อยๆ ตามจำนวนครั้งที่ระบุ
        for (let i = 0; i < count; i++) {
            const randomInsult = insults[Math.floor(Math.random() * insults.length)];
            await api.sendMessage(randomInsult, threadID);
        }

        // ส่งข้อความยืนยันเมื่อเสร็จสิ้น
        api.sendMessage(`✅ สแปมด่าโหดๆ สำเร็จ ${count} ครั้ง`, threadID);
    }
};

// เพิ่มคำสั่ง "สแปมด่าโหด" ลงในอ็อบเจ็กต์ commands
commands["สแปมด่าโหด"] = spamInsultHardCommand;
