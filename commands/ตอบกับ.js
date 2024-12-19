const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "reply_image",
    description: "ดาวน์โหลดภาพจากข้อความที่ตอบกลับ",
    usage: "ตอบกลับข้อความที่มีภาพแล้วพิมพ์คำสั่ง",
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, messageReply } = event;

    // ตรวจสอบว่าผู้ใช้ตอบกลับข้อความที่มีภาพ
    if (!messageReply || !messageReply.attachments) {
      return api.sendMessage("❌ กรุณาตอบกลับข้อความที่มีภาพ", threadID, messageID);
    }

    // ดึงไฟล์แนบที่เป็นภาพ
    const imageAttachment = messageReply.attachments.find(
      (attachment) => attachment.type === "photo"
    );

    if (!imageAttachment) {
      return api.sendMessage("❌ ไม่มีภาพในข้อความที่ตอบกลับ", threadID, messageID);
    }

    // URL ของภาพ
    const imageUrl = imageAttachment.url;

    // สร้างโฟลเดอร์สำหรับเก็บภาพ
    const downloadFolder = path.join(__dirname, "downloads");
    if (!fs.existsSync(downloadFolder)) {
      fs.mkdirSync(downloadFolder, { recursive: true });
    }

    // ดาวน์โหลดภาพ
    try {
      const response = await axios.get(imageUrl, { responseType: "stream" });
      const fileName = `downloaded_${Date.now()}.jpg`;
      const filePath = path.join(downloadFolder, fileName);

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

      writer.on("error", (err) => {
        console.error("❌ เกิดข้อผิดพลาดในการบันทึกภาพ:", err.message);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการบันทึกภาพ", threadID, messageID);
      });
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาดในการดาวน์โหลดภาพ:", err.message);
      api.sendMessage("❌ ไม่สามารถดาวน์โหลดภาพได้", threadID, messageID);
    }
  },
};
