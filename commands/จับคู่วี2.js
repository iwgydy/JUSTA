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

module.exports.run = async function({ api, event, Threads, Users }) {
        const axios = global.nodemodule["axios"];
        const fs = global.nodemodule["fs-extra"];

        var { participantIDs } = (await Threads.getData(event.threadID)).threadInfo;
        var tle = Math.floor(Math.random() * 101); // สุ่มเปอร์เซ็นต์ความรัก
        var namee = (await Users.getData(event.senderID)).name;
        const botID = api.getCurrentUserID();
        const listUserID = event.participantIDs.filter(ID => ID != botID && ID != event.senderID); // กรองรายชื่อผู้ใช้
        var id = listUserID[Math.floor(Math.random() * listUserID.length)];
        var name = (await Users.getData(id)).name;

        var arraytag = [];
        arraytag.push({id: event.senderID, tag: namee});
        arraytag.push({id: id, tag: name});

        // ดึง Facebook ID ของผู้ส่งผ่าน API
        let senderData = await axios.get(`https://api.joshweb.click/api/findid?url=https://facebook.com/${event.senderID}`);
        let senderID = senderData.data.result;

        // ดึง Facebook ID ของผู้ที่ถูกจับคู่ผ่าน API
        let pairData = await axios.get(`https://api.joshweb.click/api/findid?url=https://facebook.com/${id}`);
        let pairID = pairData.data.result;

        // ดึงรูปโปรไฟล์ของผู้ส่ง
        let Avatar = (await axios.get(`https://graph.facebook.com/${senderID}/picture?width=512&height=512`, { responseType: "arraybuffer" })).data; 
        fs.writeFileSync(__dirname + "/cache/avt.png", Buffer.from(Avatar, "utf-8"));

        // ดึงรูป GIF หัวใจ
        let gifLove = (await axios.get(`https://i.ibb.co/wC2JJBb/trai-tim-lap-lanh.gif`, { responseType: "arraybuffer" })).data; 
        fs.writeFileSync(__dirname + "/cache/giflove.png", Buffer.from(gifLove, "utf-8"));

        // ดึงรูปโปรไฟล์ของผู้ที่ถูกจับคู่
        let Avatar2 = (await axios.get(`https://graph.facebook.com/${pairID}/picture?width=512&height=512`, { responseType: "arraybuffer" })).data;
        fs.writeFileSync(__dirname + "/cache/avt2.png", Buffer.from(Avatar2, "utf-8"));

        var imglove = [];
        imglove.push(fs.createReadStream(__dirname + "/cache/avt.png"));
        imglove.push(fs.createReadStream(__dirname + "/cache/giflove.png"));
        imglove.push(fs.createReadStream(__dirname + "/cache/avt2.png"));

        // ข้อความส่งกลับ
        var msg = { 
          body: `❤️ จับคู่วี2 สำเร็จ! ❤️\n💌 ขอให้ทั้งคู่รักกันยืนยาวเป็นร้อยปี\n💕 ความเข้ากันได้: ${tle}%\n` + namee + " 💓 " + name, 
          mentions: arraytag, 
          attachment: imglove 
        };

        return api.sendMessage(msg, event.threadID, event.messageID);
}
