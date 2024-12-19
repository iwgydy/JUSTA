const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "reply_image",
    description: "ดาวน์โหลดภาพจากข้อความที่ตอบกลับ",
    usage: "ตอบกลับข้อความที่มีภาพ และพิมพ์คำสั่งนี้",
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, messageReply } = event;

    // ตรวจสอบว่าเป็นข้อความที่ตอบกลับหรือไม่
    if (!messageReply || !messageReply.attachments || messageReply.attachments.length === 0) {
      return api.sendMessage("❌ กรุณาตอบกลับข้อความที่มีภาพแนบ", threadID, messageID);
    }

    // ตรวจสอบว่ามีไฟล์ประเภทภาพในแนบไฟล์หรือไม่
    const imageAttachment = messageReply.attachments.find(
      (attachment) => attachment.type === "photo"
    );

    if (!imageAttachment) {
      return api.sendMessage("❌ ข้อความที่ตอบกลับไม่มีภาพ", threadID, messageID);
    }

    // ดึง URL ของภาพ
    const imageUrl = imageAttachment.url;
    if (!imageUrl) {
      return api.sendMessage("❌ ไม่สามารถดึง URL ของภาพได้", threadID, messageID);
    }

    // ดาวน์โหลดภาพ
    try {
      const response = await axios.get(imageUrl, { responseType: "stream" });
      const fileName = path.basename(imageUrl);
      const filePath = path.join(__dirname, "downloads", fileName);

      // สร้างโฟลเดอร์หากยังไม่มี
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }

      // บันทึกไฟล์ภาพ
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      writer.on("finish", () => {
        api.sendMessage(
          {
            body: "✅ ดาวน์โหลดภาพสำเร็จ!",
            attachment: fs.createReadStream(filePath),
          },
          threadID,
          () => fs.unlinkSync(filePath), // ลบไฟล์หลังส่ง
          messageID
        );
      });

      writer.on("error", () => {
        api.sendMessage("❌ เกิดข้อผิดพลาดในการดาวน์โหลดภาพ", threadID, messageID);
      });
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาด:", error.message);
      api.sendMessage("❌ ไม่สามารถดาวน์โหลดภาพได้ กรุณาลองใหม่", threadID, messageID);
    }
  },
};
