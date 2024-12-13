const axios = require("axios");

module.exports.config = {
    name: "ยินดีต้อนรับ",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "ยินดีต้อนรับสมาชิกใหม่เมื่อเข้ากลุ่ม",
    eventType: ["log:subscribe"], // ตรวจจับเหตุการณ์สมาชิกใหม่เข้ากลุ่ม
    dependencies: {
        "axios": ""
    }
};

module.exports.run = async function({ api, event, axios }) {
    const { logMessageData, threadID } = event;

    // กำหนดคำนำหน้า
    const prefix = "/";

    // ตรวจสอบว่าเป็นการเพิ่มสมาชิกใหม่เข้ากลุ่มหรือไม่
    if (!logMessageData || !logMessageData.addedParticipants) return;

    const user = logMessageData.addedParticipants[0];
    const userName = user.fullName || "สมาชิกใหม่";

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

    // ฟังก์ชันเพื่อดึงข้อมูลผู้เชิญ (ถ้ามี)
    const getInviter = async () => {
        // ในกรณีนี้ เราจะตั้งค่าผู้เชิญเป็น "คุณเข้ากลุ่มด้วยตัวเอง" เนื่องจากข้อมูลผู้เชิญไม่ชัดเจนจาก event
        return "คุณเข้ากลุ่มด้วยตัวเอง";
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
    const inviter = await getInviter();
    const groupName = await getGroupName();

    // ข้อความต้อนรับ
    const welcomeMessage = `
✨━━━━━━━━━━━━━━━✨

🚀 **ยินดีต้อนรับคุณ ${userName} สู่ ${groupName}!** 🚀

🌐 เราดีใจที่คุณเข้าร่วมกับเราวันนี้! 🌐

📊 **จำนวนสมาชิกในกลุ่ม:** ${memberCount} คน

👤 **ผู้เชิญ:** ${inviter}

🔧 **กฎระเบียบของกลุ่ม:**
1. **ปฏิบัติตามกฎของกลุ่ม**
2. **เคารพผู้อื่น**
3. **หลีกเลี่ยงการส่งสแปม**
4. **ห้ามโพสต์เนื้อหาที่ไม่เหมาะสม**

💡 **คำสั่งที่น่าสนใจ:**
- **${prefix}help** : ดูคำสั่งทั้งหมด
- **${prefix}info** : ข้อมูลเกี่ยวกับกลุ่ม
- **${prefix}rules** : ดูกฎระเบียบของกลุ่ม

🔥 **คำแนะนำในการใช้งาน:**
- เรียนรู้คำสั่งพื้นฐานเพื่อใช้งานบอทได้อย่างเต็มที่
- แชร์ความรู้และประสบการณ์ของคุณกับสมาชิกอื่นๆ

💡 หากคุณมีคำถามหรือต้องการความช่วยเหลือ กรุณาติดต่อแอดมินของกลุ่ม

🎉 หวังว่าคุณจะสนุกและมีความสุขกับการอยู่ในกลุ่มของเรา! 🎉

✨━━━━━━━━━━━━━━━✨
`;

    try {
        // ส่งข้อความต้อนรับพร้อม GIF ในข้อความเดียว
        await api.sendMessage({
            body: welcomeMessage,
            attachment: (await axios.get(gifURL, { responseType: "stream" })).data
        }, threadID);
        console.log(`ส่งข้อความต้อนรับพร้อม GIF ให้กับ ${userName}`);
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการส่งข้อความต้อนรับ:", error);
    }
};
