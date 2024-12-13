const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "texttospeech",
    description: "แปลงข้อความเป็นเสียง (ฟรี)",
    usage: "/texttospeech [ข้อความ]",
    aliases: ["tts", "เสียง"],
    permissions: {
      user: [],
      bot: ["SEND_MESSAGES", "ATTACH_FILES"],
    },
    cooldown: 3,
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    if (!args.length) {
      return api.sendMessage(
        "❗ กรุณาระบุข้อความที่ต้องการแปลงเป็นเสียง เช่น: /texttospeech สวัสดี",
        threadID,
        messageID
      );
    }

    const text = args.join(" ");
    const lang = "th"; // ภาษาไทย
    const tempFilePath = path.join(__dirname, "temp.mp3");

    try {
      // สร้าง URL สำหรับ Google Translate TTS
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(
        text
      )}&tl=${lang}`;

      // ดึงข้อมูลเสียงจาก URL
      const response = await axios.get(url, {
        responseType: "arraybuffer",
      });

      // บันทึกไฟล์เสียงลงในไฟล์ชั่วคราว
      fs.writeFileSync(tempFilePath, response.data);

      // ส่งไฟล์เสียงกลับไปในแชท
      await api.sendMessage(
        {
          body: `🔊 เสียงที่แปลงจากข้อความ "${text}"`,
          attachment: fs.createReadStream(tempFilePath),
        },
        threadID,
        messageID
      );

      // ลบไฟล์ชั่วคราว
      fs.unlinkSync(tempFilePath);
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการแปลงข้อความเป็นเสียง:", error);
      return api.sendMessage(
        "❗ ไม่สามารถแปลงข้อความเป็นเสียงได้ในขณะนี้ กรุณาลองใหม่ภายหลัง",
        threadID,
        messageID
      );
    }
  },
};