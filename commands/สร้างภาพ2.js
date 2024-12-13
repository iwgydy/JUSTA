const axios = require("axios");

module.exports = {
  config: {
    name: "สร้างภาพ", // ชื่อคำสั่ง
    description: "สร้างภาพจากคำอธิบายที่กำหนด",
    usage: "/สร้างภาพ [คำอธิบาย]",
    aliases: ["createimage", "imagegen"], // ชื่อคำสั่งอื่นที่สามารถเรียกได้
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    // ตรวจสอบว่าผู้ใช้ป้อนคำอธิบายหรือไม่
    if (!args.length) {
      return api.sendMessage(
        "❗ กรุณาใส่คำอธิบายของภาพ เช่น: /สร้างภาพ ดอกไม้สีรุ้ง",
        threadID,
        messageID
      );
    }

    const userPrompt = args.join(" "); // คำอธิบายที่ผู้ใช้ป้อน

    try {
      // เรียก API
      const response = await axios.get(`https://image.pollinations.ai/prompt/${encodeURIComponent(userPrompt)}`, {
        responseType: "stream", // ทำให้สามารถส่งภาพเป็น attachment ได้
      });

      if (!response) {
        return api.sendMessage(
          "❗ ไม่สามารถสร้างภาพได้ กรุณาลองใหม่ในภายหลัง",
          threadID,
          messageID
        );
      }

      // ส่งภาพให้ผู้ใช้
      return api.sendMessage(
        {
          body: `✨ ภาพที่สร้างจากคำอธิบาย: "${userPrompt}"`,
          attachment: response.data,
        },
        threadID,
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาด:", error.message);

      return api.sendMessage(
        "❗ ไม่สามารถสร้างภาพได้ กรุณาลองใหม่ในภายหลัง",
        threadID,
        messageID
      );
    }
  },
};