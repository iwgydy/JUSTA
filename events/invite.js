const axios = require("axios");

module.exports.config = {
    name: "เชิญบอท",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "ส่งข้อความสวัสดีและรายละเอียดการใช้งานเมื่อบอทถูกเชิญไปกลุ่มใหม่",
    eventType: ["log:subscribe"], // ตรวจจับเหตุการณ์สมาชิกใหม่เข้ากลุ่ม
    dependencies: {
        "axios": ""
    }
};

module.exports.run = async function({ api, event, axios }) {
    const { logMessageData, threadID } = event;

    // แทนที่ 'YOUR_BOT_ID' ด้วย ID ของบอทจริงที่คุณได้รับจากคำสั่ง /getid
    const botID = "YOUR_BOT_ID"; // เช่น "1234567890123456"

    // ตรวจสอบว่าเป็นการเพิ่มบอทเข้ากลุ่มหรือไม่
    const addedParticipants = logMessageData.addedParticipants;
    const isBotAdded = addedParticipants.some(user => user.userFbId === botID);

    if (!isBotAdded) return;

    // URL ของ GIF ที่ต้องการแสดง
    const gifURL = "https://img5.pic.in.th/file/secure-sv1/398502724_304556509125422_4209979906563284242_n1471681079abbfbf.gif";

    // ฟังก์ชันเพื่อดึงข้อมูลจำนวนสมาชิกในกลุ่ม
    const getMemberCount = async () => {
        try {
            const threadInfo = await api.getThreadInfo(threadID);
            return threadInfo.participantIDs.length;
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการดึงข้อมูลจำนวนสมาชิก:", error);
            return "ไม่สามารถดึงข้อมูลได้";
        }
    };

    // ฟังก์ชันเพื่อดึงชื่อกลุ่ม
    const getGroupName = async () => {
        try {
            const threadInfo = await api.getThreadInfo(threadID);
            return threadInfo.threadName || "กลุ่มของเรา";
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการดึงข้อมูลชื่อกลุ่ม:", error);
            return "กลุ่มของเรา";
        }
    };

    const memberCount = await getMemberCount();
    const groupName = await getGroupName();

    // ข้อความต้อนรับ
    const welcomeMessage = `
✨━━━━━━━━━━━━━━━✨
        🎉 𝐒𝐓𝐄𝐋𝐋𝐘 𝐂𝐇𝐀𝐓 𝐁𝐎𝐓 🎉
✨━━━━━━━━━━━━━━━✨

🚀 **ยินดีต้อนรับสู่ ${groupName}!** 🚀

🌐 เราดีใจที่คุณเชิญบอทของเราเข้าร่วมกลุ่มนี้! 🌐

📊 **จำนวนสมาชิกในกลุ่ม:** ${memberCount} คน

🔧 **คำสั่งที่น่าสนใจ:**
- **/ดูคำสั่ง** : แสดงรายการคำสั่งทั้งหมด
- **/ลงทะเบียน** : ลงทะเบียนผู้ใช้ใหม่
- **/ช่วยเหลือ** : รับความช่วยเหลือเกี่ยวกับการใช้งานบอท

💡 **คำแนะนำในการใช้งาน:**
1. **พิมพ์คำสั่งที่ต้องการ** โดยเริ่มต้นด้วย "/"
2. **ศึกษาคำสั่งที่มีอยู่** เพื่อใช้งานบอทได้เต็มประสิทธิภาพ
3. **แชร์ความรู้และประสบการณ์** กับสมาชิกอื่นๆ ในกลุ่ม

🔥 **อย่าลืมตรวจสอบกฎระเบียบของกลุ่ม** เพื่อการใช้งานที่ราบรื่นและเป็นมิตรกับทุกคน

🎨 **สนุกกับการใช้งานบอทของเรา!** 🎨

✨━━━━━━━━━━━━━━━✨
`;

    try {
        // ส่งข้อความต้อนรับพร้อม GIF ในข้อความเดียว
        await api.sendMessage({
            body: welcomeMessage,
            attachment: (await axios.get(gifURL, { responseType: "stream" })).data
        }, threadID);
        console.log(`ส่งข้อความต้อนรับพร้อม GIF ให้กับกลุ่ม ${groupName}`);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการส่งข้อความต้อนรับ:", error);
    }
};
