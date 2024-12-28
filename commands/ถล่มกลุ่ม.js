const axios = require('axios');

let spamInterval = null;

module.exports = {
    config: {
        name: "สแปมโหด",
        description: "สแปมโหดแบบไม่หยุดจนกว่าจะสั่งหยุด",
    },
    run: async ({ api, event, args }) => {
        const { senderID, threadID, messageID } = event;

        // ตรวจสอบคำสั่งว่าต้องการเริ่มหรือหยุด
        const command = args[0]?.toLowerCase();
        if (command === "หยุด") {
            if (spamInterval) {
                clearInterval(spamInterval);
                spamInterval = null;
                return api.sendMessage("✅ สั่งหยุดการสแปมสำเร็จ!", threadID, messageID);
            } else {
                return api.sendMessage("❗ ไม่มีการสแปมที่กำลังทำงานอยู่", threadID, messageID);
            }
        }

        // ตรวจสอบว่ามีการสแปมอยู่หรือไม่
        if (spamInterval) {
            return api.sendMessage("❗ การสแปมกำลังทำงานอยู่ กรุณาหยุดก่อนด้วยคำสั่ง /สแปมโหด หยุด", threadID, messageID);
        }

        // เริ่มการสแปม
        try {
            // ดึงข้อมูลสมาชิกในกลุ่ม
            const threadInfo = await api.getThreadInfo(threadID);
            const mentions = threadInfo.participantIDs
                .filter(id => id !== senderID) // ไม่แท็กตัวเอง
                .map(id => ({
                    id,
                    tag: "@" + (threadInfo.nicknames?.[id] || "คุณ"),
                }));

            if (mentions.length === 0) {
                return api.sendMessage("❗ ไม่มีใครในกลุ่มให้แท็ก", threadID, messageID);
            }

            // ฟังก์ชันดึงคำด่าจาก API
            const getToxicWord = async () => {
                try {
                    const response = await axios.get('https://api.xncly.xyz/toxic.php');
                    return response.data?.random_word || "🔥 ด่ารัวๆ 🔥";
                } catch (error) {
                    console.error("❗ เกิดข้อผิดพลาดในการดึงคำด่า:", error);
                    return "🔥 ด่ารัวๆ 🔥"; // ข้อความสำรอง
                }
            };

            // เริ่มการสแปมแบบไม่หยุด
            spamInterval = setInterval(async () => {
                const insultMessage = await getToxicWord();
                api.sendMessage({
                    body: insultMessage,
                    mentions,
                }, threadID);
            }, 100); // ส่งข้อความทุก 100 มิลลิวินาที

            return api.sendMessage("🔥 เริ่มสแปมโหดแล้ว! ใช้คำสั่ง /สแปมโหด หยุด เพื่อหยุด", threadID, messageID);
        } catch (error) {
            console.error(error);
            return api.sendMessage("❗ เกิดข้อผิดพลาดในการเริ่มสแปม", threadID, messageID);
        }
    },
};
