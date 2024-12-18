const axios = require("axios");
const fs = require("fs-extra");
const { loadImage, createCanvas } = require("canvas");

module.exports = {
  config: {
    name: "แฮก", // ชื่อคำสั่ง
    description: "แฮกโปรไฟล์และสร้างรูปภาพพร้อมข้อความ",
    usage: "/hack [แท็กเพื่อนหรือเว้นว่าง]", // วิธีใช้งานคำสั่ง
    aliases: ["แฮก"], // ชื่อคำสั่งอื่นๆ ที่ใช้เรียกได้
  },

  run: async ({ api, event }) => {
    const { senderID, threadID, messageID, mentions } = event;

    try {
      const id = Object.keys(mentions)[0] || senderID; // ใช้ ID ของผู้ใช้ที่แท็ก หรือของผู้ใช้เอง
      const userInfo = await api.getUserInfo(id);
      const name = userInfo[id]?.name || "ไม่ทราบชื่อ";

      const pathImg = `${__dirname}/cache/background.png`;
      const pathAvatar = `${__dirname}/cache/avatar.png`;

      // ดาวน์โหลดภาพพื้นหลัง
      const backgroundUrl = "https://i.imgur.com/VQXViKI.png";
      const backgroundBuffer = (await axios.get(backgroundUrl, { responseType: "arraybuffer" })).data;
      fs.writeFileSync(pathImg, Buffer.from(backgroundBuffer, "utf-8"));

      // ดาวน์โหลดภาพโปรไฟล์
      const avatarUrl = `https://graph.facebook.com/${id}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
      const avatarBuffer = (await axios.get(avatarUrl, { responseType: "arraybuffer" })).data;
      fs.writeFileSync(pathAvatar, Buffer.from(avatarBuffer, "utf-8"));

      // โหลดภาพพื้นหลังและภาพโปรไฟล์
      const baseImage = await loadImage(pathImg);
      const avatarImage = await loadImage(pathAvatar);

      // สร้างแคนวาส
      const canvas = createCanvas(baseImage.width, baseImage.height);
      const ctx = canvas.getContext("2d");

      // วาดภาพพื้นหลังและภาพโปรไฟล์
      ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(avatarImage, 83, 437, 100, 101);

      // เขียนข้อความ
      ctx.font = "400 23px Arial";
      ctx.fillStyle = "#1878F3";
      ctx.textAlign = "start";
      ctx.fillText(name, 200, 497);

      // บันทึกภาพ
      const finalBuffer = canvas.toBuffer();
      fs.writeFileSync(pathImg, finalBuffer);

      // ส่งภาพในแชท
      return api.sendMessage(
        {
          body: "นี่คือผลลัพธ์จากการแฮกโปรไฟล์!",
          attachment: fs.createReadStream(pathImg),
        },
        threadID,
        () => {
          fs.unlinkSync(pathImg); // ลบไฟล์พื้นหลัง
          fs.unlinkSync(pathAvatar); // ลบไฟล์โปรไฟล์
        },
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการประมวลผลคำสั่ง hack:", error.message);

      // แจ้งข้อผิดพลาดให้ผู้ใช้ทราบ
      return api.sendMessage("❗ เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง", threadID, messageID);
    }
  },
};
