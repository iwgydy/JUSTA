const ultraFastInsultSpamCommand = {
    config: {
        name: "😈",
        description: "ด่าเร็วๆ และยับเยอะๆ",
        usage: "/😈 [จำนวนครั้ง]",
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
            "โง่",
            "ปัญญาอ่อน",
            "สมองกลวง",
            "ไอ้โง่",
            "ไอ้ปัญญาอ่อน",
            "ไอ้สมองกลวง",
            "ไอ้ขี้แพ้",
            "ไอ้ขี้เกียจ",
            "ไอ้ขี้หลี",
            "ไอ้ขี้เหร่"
        ];

        for (let i = 0; i < count; i++) {
            const randomInsult = insults[Math.floor(Math.random() * insults.length)];
            await api.sendMessage(randomInsult, threadID);
        }

        api.sendMessage(`✅ ด่าเร็วๆ และยับเยอะๆ สำเร็จ ${count} ครั้ง`, threadID);
    }
};
commands["ultrafastinsult"] = ultraFastInsultSpamCommand;
