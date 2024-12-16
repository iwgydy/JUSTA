const axios = require("axios");

module.exports.config = {
    name: "จับคู่วี2",
    version: "1.1.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "จับคู่สมาชิกในกลุ่ม พร้อมแสดงชื่อและรูปโปรไฟล์",
    commandCategory: "fun",
    usages: "[ไม่มีพารามิเตอร์]",
    cooldowns: 5
};

module.exports.run = async function({ api, event }) {
    try {
        const { threadID, senderID, messageID } = event;

        // ดึงข้อมูลสมาชิกภายในกลุ่ม
        const threadInfo = await api.getThreadInfo(threadID);
        const members = threadInfo.participantIDs;

        // ตรวจสอบจำนวนสมาชิก
        if (members.length < 2) {
            return api.sendMessage("❌ สมาชิกในกลุ่มน้อยเกินไป ไม่สามารถจับคู่ได้!", threadID, messageID);
        }

        // ฟังก์ชันสุ่มสมาชิก
        function getRandomMember(excludeID) {
            const filtered = members.filter(id => id !== excludeID);
            return filtered[Math.floor(Math.random() * filtered.length)];
        }

        // กำหนดคนแรกคือผู้ใช้ที่เรียกคำสั่ง
        const firstUser = senderID;

        // สุ่มหาคนที่สอง
        const secondUser = getRandomMember(firstUser);

        // ดึงข้อมูลโปรไฟล์ (ชื่อและรูป)
        const firstUserInfo = await api.getUserInfo(firstUser);
        const secondUserInfo = await api.getUserInfo(secondUser);

        const firstUserName = firstUserInfo[firstUser].name || "ไม่ทราบชื่อ";
        const secondUserName = secondUserInfo[secondUser].name || "ไม่ทราบชื่อ";

        const firstUserProfile = `https://graph.facebook.com/${firstUser}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        const secondUserProfile = `https://graph.facebook.com/${secondUser}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

        // ส่งข้อความพร้อมโปรไฟล์รูปภาพ
        api.sendMessage({
            body: `💖 จับคู่สำเร็จ!\n\n👤 คนแรก: ${firstUserName}\n👤 คนที่สอง: ${secondUserName}`,
            attachment: [
                await axios.get(firstUserProfile, { responseType: "stream" }).then(res => res.data),
                await axios.get(secondUserProfile, { responseType: "stream" }).then(res => res.data)
            ]
        }, threadID, messageID);

    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในคำสั่งจับคู่:", error);
        return api.sendMessage("❌ เกิดข้อผิดพลาดในการจับคู่ กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
