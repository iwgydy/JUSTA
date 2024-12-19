const axios = require("axios");

module.exports = {
  config: {
    name: "gpt4o",
    description: "โต้ตอบกับ GPT-4o หรือสร้างภาพ",
    usage: "/gpt4o [ข้อความหรือคำสั่ง]",
    aliases: ["ai", "gpt"],
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const query = args.join(" ");

    if (!query) {
      return api.sendMessage(
        "❗ กรุณาป้อนข้อความหรือคำสั่งที่ต้องการถาม AI\n\nตัวอย่าง: /gpt4o สวัสดี",
        threadID,
        messageID
      );
    }

    try {
      const response = await axios.get("https://kaiz-apis.gleeze.com/api/gpt-4o-pro", {
        params: {
          q: query,
          uid: senderID,
          imageUrl: encodeURIComponent(query),
        },
      });

      const aiResponse = response.data.response;
      console.log("AI Response Full:", aiResponse);

      // ดึง URL ของภาพ
      const urlMatch = aiResponse.match(/https?:\/\/[^\s]+/);
      const imageUrl = urlMatch ? urlMatch[0] : null;

      if (imageUrl) {
        const imageResponse = await axios.get(imageUrl, { responseType: "stream" });
        return api.sendMessage(
          {
            body: "✅ สร้างภาพสำเร็จ!",
            attachment: imageResponse.data,
          },
          threadID,
          messageID
        );
      } else {
        return api.sendMessage(
          "❗ ไม่สามารถสร้างภาพได้ กรุณาลองใหม่หรือปรับคำถาม",
          threadID,
          messageID
        );
      }
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาด:", error.message);
      return api.sendMessage(
        "❗ เกิดข้อผิดพลาดในการติดต่อ AI กรุณาลองใหม่อีกครั้ง",
        threadID,
        messageID
      );
    }
  },
};
