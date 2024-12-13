const axios = require("axios");

module.exports = {
  config: {
    name: "createimage", // ชื่อคำสั่ง
    description: "สร้างภาพจากคำอธิบายที่กำหนด",
    usage: "/createimage [คำอธิบาย]",
    aliases: ["สร้างภาพ", "imagegen"],
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    // ตรวจสอบว่าผู้ใช้ป้อนคำอธิบายหรือไม่
    if (!args.length) {
      return api.sendMessage(
        "❗ กรุณาใส่คำอธิบายของภาพ เช่น: /createimage แมวในทุ่งหญ้า",
        threadID,
        messageID
      );
    }

    const userPrompt = args.join(" "); // คำอธิบายที่ผู้ใช้ป้อน

    try {
      // เรียก API
      const response = await axios.get(
        `https://rest-api-faris.onrender.com/ai/dalle?prompt=${encodeURIComponent(userPrompt)}`
      );

      if (!response.data.Links || response.data.Links.length === 0) {
        return api.sendMessage("❗ ไม่พบภาพที่สร้างจากคำอธิบาย กรุณาลองใหม่อีกครั้ง", threadID, messageID);
      }

      const imageLinks = response.data.Links;

      // ดาวน์โหลดภาพทั้งหมด
      const attachments = await Promise.all(
        imageLinks.map(async (link) => {
          const res = await axios({ url: link, responseType: "stream" });
          return res.data;
        })
      );

      // ส่งข้อความพร้อมภาพทั้งหมด
      return api.sendMessage(
        {
          body: `✨ ภาพที่สร้างจากคำอธิบาย: "${userPrompt}"`,
          attachment: attachments,
        },
        threadID,
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการสร้างภาพ:", error.message);

      // แจ้งข้อผิดพลาดให้ผู้ใช้ทราบ
      return api.sendMessage("❗ ไม่สามารถสร้างภาพได้ กรุณาลองใหม่ในภายหลัง", threadID, messageID);
    }
  },
};