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

        if (senderID !== adminID) {
            return api.sendMessage("⚠️ คุณไม่มีสิทธิ์ใช้คำสั่งนี้", threadID);
        }

        const count = parseInt(args[0]);

        if (isNaN(count) || count <= 0 || count > 1000) {
            return api.sendMessage("⚠️ จำนวนครั้งต้องเป็นตัวเลขและไม่เกิน 1000 ครั้ง", threadID);
        }

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

        for (let i = 0; i < count; i++) {
            const randomInsult = insults[Math.floor(Math.random() * insults.length)];
            await api.sendMessage(randomInsult, threadID);
        }

        api.sendMessage(`✅ สแปมด่าโหดๆ สำเร็จ ${count} ครั้ง`, threadID);
    }
};
commands["สแปมด่าโหด"] = spamInsultHardCommand;
