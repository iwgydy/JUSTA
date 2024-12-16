const axios = require("axios");
const fs = require("fs-extra");
const FormData = require("form-data");

module.exports.config = {
  name: "ถังขยะ",
  version: "1.0",
  hasPermssion: 0,
  credits: "YourName",
  description: "นำภาพของผู้ใช้มาใส่ในเอฟเฟกต์ถังขยะ",
  commandCategory: "fun",
  usages: "ถังขยะ @แท็กผู้ใช้",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event }) {
  try {
    if (!event.mentions || Object.keys(event.mentions).length === 0) {
      return api.sendMessage("❌ กรุณาแท็กผู้ใช้ 1 คนที่คุณต้องการใส่ถังขยะ", event.threadID, event.messageID);
    }

    const mention = Object.keys(event.mentions)[0];
    const imageUrl = `https://graph.facebook.com/${mention}/picture?width=1024&height=1024&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

    api.sendMessage("♻️ กำลังประมวลผลภาพถังขยะ กรุณารอสักครู่...", event.threadID, event.messageID);

    // ดาวน์โหลดภาพโปรไฟล์
    const profileImagePath = __dirname + `/cache/${mention}_avatar.png`;
    const response = await axios({
      url: imageUrl,
      method: "GET",
      responseType: "stream",
    });
    await new Promise((resolve, reject) => {
      response.data.pipe(fs.createWriteStream(profileImagePath)).on("finish", resolve).on("error", reject);
    });

    // เตรียมส่งไป API พร้อมไฟล์
    const form = new FormData();
    form.append("file", fs.createReadStream(profileImagePath));

    const apiUrl = `https://api.joshweb.click/canvas/delete?uid=4`;
    const { data } = await axios.post(apiUrl, form, {
      headers: form.getHeaders(),
      responseType: "stream",
    });

    // บันทึกภาพที่ได้จาก API
    const outputPath = __dirname + `/cache/${mention}_trash.png`;
    await new Promise((resolve, reject) => {
      data.pipe(fs.createWriteStream(outputPath)).on("finish", resolve).on("error", reject);
    });

    // ส่งภาพกลับแชท
    api.sendMessage(
      {
        body: `🗑️ นี่คือภาพถังขยะของผู้ใช้ที่คุณเลือก!`,
        attachment: fs.createReadStream(outputPath),
      },
      event.threadID,
      () => {
        fs.unlinkSync(profileImagePath);
        fs.unlinkSync(outputPath);
      },
      event.messageID
    );
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error.message);
    api.sendMessage("❌ ไม่สามารถสร้างภาพถังขยะได้ กรุณาลองใหม่อีกครั้ง!", event.threadID, event.messageID);
  }
};
