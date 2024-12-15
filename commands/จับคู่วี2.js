const axios = require("axios");
const fs = require("fs-extra");

module.exports.config = {
  name: "จับคู่วี2",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "ปรับปรุงโดย Xuyên get",
  description: "จับคู่ความรักเวอร์ชัน 2 พร้อมดึงภาพโปรไฟล์",
  commandCategory: "ความรัก",
  usages: "จับคู่วี2",
  cooldowns: 15
};

module.exports.run = async function({ api, event }) {
    try {
        const accessToken = "EAAPr8hvPWZAwBOypXzsvSKEXLZAenktWP4iFbb6AWprqAEIMkbFZBewZC1r1JOhXqTEYozBZAzDA9NtSZBFDETJRf8yKFClE05KyOfEcwHF5UazpdtjALeC9GKGD0t1d7DpCIAmnzKjyuZCs2Nb95EvaPvOpd9vdyebdvt4ZAgYZBJyVFhIrLZAOa5lIvX8W44ei6fFP8ZD"; // ใส่ Access Token ของคุณที่นี่
        const participantIDs = event.participantIDs.filter(id => id !== api.getCurrentUserID());
        const senderID = event.senderID;

        // ตรวจสอบว่ามีผู้เข้าร่วมอื่นในกลุ่ม
        if (participantIDs.length === 0) {
            return api.sendMessage("❌ ไม่มีผู้เข้าร่วมในกลุ่มเพื่อจับคู่!", event.threadID, event.messageID);
        }

        // สุ่มคู่จากผู้เข้าร่วม
        const randomID = participantIDs[Math.floor(Math.random() * participantIDs.length)];
        const tle = Math.floor(Math.random() * 101); // สุ่มเปอร์เซ็นต์ความเข้ากันได้

        // ดึงชื่อผู้ส่งและผู้ที่ถูกจับคู่
        const senderName = (await api.getUserInfo(senderID))[senderID].name;
        const pairName = (await api.getUserInfo(randomID))[randomID].name;

        // ดึงภาพโปรไฟล์ผ่าน Facebook Graph API
        const senderAvatarURL = `https://graph.facebook.com/${senderID}/picture?width=512&height=512&access_token=${accessToken}`;
        const pairAvatarURL = `https://graph.facebook.com/${randomID}/picture?width=512&height=512&access_token=${accessToken}`;

        const senderAvatar = (await axios.get(senderAvatarURL, { responseType: "arraybuffer" })).data;
        const pairAvatar = (await axios.get(pairAvatarURL, { responseType: "arraybuffer" })).data;

        // บันทึกภาพโปรไฟล์ลงไฟล์
        fs.writeFileSync(__dirname + "/cache/sender.png", Buffer.from(senderAvatar, "utf-8"));
        fs.writeFileSync(__dirname + "/cache/pair.png", Buffer.from(pairAvatar, "utf-8"));

        // ดึง GIF หัวใจ
        const gifLove = (await axios.get("https://i.ibb.co/wC2JJBb/trai-tim-lap-lanh.gif", { responseType: "arraybuffer" })).data;
        fs.writeFileSync(__dirname + "/cache/giflove.png", Buffer.from(gifLove, "utf-8"));

        // เตรียมไฟล์แนบ
        const attachments = [
            fs.createReadStream(__dirname + "/cache/sender.png"),
            fs.createReadStream(__dirname + "/cache/giflove.png"),
            fs.createReadStream(__dirname + "/cache/pair.png")
        ];

        // ส่งข้อความ
        const msg = {
            body: `❤️ จับคู่วี2 สำเร็จ! ❤️\n💌 ขอให้ทั้งคู่รักกันยืนยาว\n💕 ความเข้ากันได้: ${tle}%\n` +
                  `${senderName} 💓 ${pairName}`,
            attachment: attachments,
            mentions: [
                { id: senderID, tag: senderName },
                { id: randomID, tag: pairName }
            ]
        };

        return api.sendMessage(msg, event.threadID, event.messageID);

    } catch (err) {
        console.error(err);
        return api.sendMessage("❌ เกิดข้อผิดพลาดในการจับคู่ ลองใหม่อีกครั้ง!", event.threadID, event.messageID);
    }
};
