const axios = require("axios");
const fs = require("fs-extra");

module.exports.config = {
  name: "จับคู่วี2",
  version: "2.0.0",
  hasPermssion: 0,
  credits: "D-Jukie (ปรับโดย Xuyên get)",
  description: "จับคู่ความรักเวอร์ชัน 2",
  commandCategory: "ความรัก",
  usages: "จับคู่วี2",
  cooldowns: 15
};

module.exports.run = async function({ api, event }) {
    try {
        // ดึงข้อมูลผู้เข้าร่วมจาก event โดยตรง
        const participantIDs = event.participantIDs || [];
        const botID = api.getCurrentUserID();
        const userID = event.senderID;

        // กรอง ID ไม่ให้ซ้ำกับบอทหรือผู้ส่งเอง
        const listUserID = participantIDs.filter(ID => ID != botID && ID != userID);

        // สุ่มคู่
        if (listUserID.length === 0) {
            return api.sendMessage("❌ ไม่พบผู้เข้าร่วมคนอื่นในกลุ่มเพื่อจับคู่!", event.threadID, event.messageID);
        }

        const randomID = listUserID[Math.floor(Math.random() * listUserID.length)];
        const tle = Math.floor(Math.random() * 101); // สุ่มเปอร์เซ็นต์ความรัก

        // ดึงชื่อผู้ส่งและผู้ที่ถูกจับคู่
        const senderName = (await api.getUserInfo(userID))[userID].name;
        const pairName = (await api.getUserInfo(randomID))[randomID].name;

        // จัดการแท็ก
        const arraytag = [
            { id: userID, tag: senderName },
            { id: randomID, tag: pairName }
        ];

        // ดึงรูปโปรไฟล์
        const senderAvatar = (await axios.get(`https://graph.facebook.com/${userID}/picture?width=512&height=512`, { responseType: "arraybuffer" })).data;
        const pairAvatar = (await axios.get(`https://graph.facebook.com/${randomID}/picture?width=512&height=512`, { responseType: "arraybuffer" })).data;

        fs.writeFileSync(__dirname + "/cache/sender.png", Buffer.from(senderAvatar, "utf-8"));
        fs.writeFileSync(__dirname + "/cache/pair.png", Buffer.from(pairAvatar, "utf-8"));

        // GIF หัวใจ
        const gifLove = (await axios.get(`https://i.ibb.co/wC2JJBb/trai-tim-lap-lanh.gif`, { responseType: "arraybuffer" })).data;
        fs.writeFileSync(__dirname + "/cache/giflove.png", Buffer.from(gifLove, "utf-8"));

        // แนบไฟล์
        const attachments = [
            fs.createReadStream(__dirname + "/cache/sender.png"),
            fs.createReadStream(__dirname + "/cache/giflove.png"),
            fs.createReadStream(__dirname + "/cache/pair.png")
        ];

        // ส่งข้อความ
        const msg = {
            body: `❤️ จับคู่วี2 สำเร็จ! ❤️\n💌 ขอให้ทั้งคู่รักกันยืนยาวเป็นร้อยปี\n💕 ความเข้ากันได้: ${tle}%\n` + senderName + " 💓 " + pairName,
            mentions: arraytag,
            attachment: attachments
        };

        return api.sendMessage(msg, event.threadID, event.messageID);
    } catch (err) {
        console.error(err);
        return api.sendMessage("❌ เกิดข้อผิดพลาดในการจับคู่ ลองใหม่อีกครั้ง!", event.threadID, event.messageID);
    }
};
