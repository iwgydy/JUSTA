const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "ตอบกลับภาพ",
    description: "ตอบกลับหรือดาวน์โหลดภาพที่ผู้ใช้ตอบกลับ",
    usage: "ไม่ต้องใช้คำสั่งเฉพาะ",
    eventType: ["message_reply"], // ระบุประเภทของอีเวนต์ที่ต้องการรับ
  },

  run: async ({ api, event }) => {
    const { threadID, messageID, messageReply, senderID } = event;

    // ตรวจสอบว่ามีการตอบกลับข้อความ
    if (!messageReply) return;

    // ตรวจสอบว่ามี attachments ในข้อความที่ถูกตอบกลับ
    if (messageReply.attachments && messageReply.attachments.length > 0) {
      // กรองเฉพาะไฟล์ภาพ
      const imageAttachments = messageReply.attachments.filter(
        (attachment) => attachment.type === "photo" || attachment.type === "image"
      );

      if (imageAttachments.length === 0) return; // ไม่มีภาพแนบมา

      // ดึง URL ของภาพแรกที่พบ
      const imageUrl = imageAttachments[0].url;

      try {
        // ดาวน์โหลดภาพ
        const response = await axios.get(imageUrl, { responseType: "stream" });

        // สร้างชื่อไฟล์จาก URL
        const fileName = path.basename(imageUrl).split("?")[0];
        const filePath = path.join(__dirname, `../downloads/${fileName}`);

        // สร้างโฟลเดอร์ดาวน์โหลดถ้ายังไม่มี
        if (!fs.existsSync(path.dirname(filePath))) {
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        // เขียนไฟล์ลงดิสก์
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        // รอจนดาวน์โหลดเสร็จสิ้น
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        // ส่งข้อความตอบกลับพร้อมกับภาพที่ดาวน์โหลด
        return api.sendMessage(
          {
            body: `✅ ดาวน์โหลดภาพสำเร็จ!\n📂 ใช้เวลาทั้งหมด: ${(Date.now() - event.timestamp) / 1000} วินาที`,
            attachment: fs.createReadStream(filePath),
          },
          threadID,
          messageID
        );
      } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการดาวน์โหลดภาพ:", error.message);

        // ส่งข้อความแจ้งข้อผิดพลาดให้ผู้ใช้ทราบ
        return api.sendMessage(
          "❗ เกิดข้อผิดพลาดในการดาวน์โหลดภาพ กรุณาลองใหม่อีกครั้ง",
          threadID,
          messageID
        );
      }
    }
  },
};
