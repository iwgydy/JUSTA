module.exports = {
    config: {
        name: "พิมตามผม",
        version: "1.0.0",
        description: "บอทจะพิมตามคำที่ผู้ใช้พิม โดยสามารถเปิด/ปิดการทำงานได้ (เฉพาะแอดมิน)",
        commandCategory: "fun",
        usages: "<เปิด/ปิด>",
        cooldowns: 5
    },
    run: async ({ api, event, args }) => {
        const { senderID, threadID, messageID } = event;

        // ดึงสถานะเปิด/ปิด จาก args
        const toggle = args[0]?.toLowerCase();
        if (!toggle || (toggle !== "เปิด" && toggle !== "ปิด")) {
            return api.sendMessage("❌ กรุณาระบุคำสั่งที่ถูกต้อง (เปิด/ปิด)", threadID, messageID);
        }

        // เปิด/ปิดโหมดพิมตาม
        global.followMode = global.followMode || {};
        global.followMode[threadID] = toggle === "เปิด";

        // แจ้งสถานะการเปิด/ปิด
        api.sendMessage(
            `📣 โหมดพิมตาม ${toggle === "เปิด" ? "เปิดใช้งานแล้ว" : "ถูกปิดแล้ว"}!`,
            threadID,
            messageID
        );
    },

    handleEvent: async ({ api, event }) => {
        const { threadID, body, senderID } = event;

        // ตรวจสอบว่าโหมดพิมตามเปิดอยู่หรือไม่
        if (global.followMode && global.followMode[threadID]) {
            // บอทไม่ตอบสนองตัวเอง
            if (!body || senderID === api.getCurrentUserID()) return;

            // บอทจะพิมข้อความตามที่ผู้ใช้พิม
            api.sendMessage(body, threadID);
        }
    }
};
