const axios = require("axios");

module.exports = {
  config: {
    name: "gpt4o",
    description: "โต้ตอบกับ GPT-4o หรือสร้างภาพตามคำสั่ง",
    usage: "/gpt4o [ข้อความหรือคำสั่ง]",
    aliases: ["ai", "gpt"],
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const query = args.join(" ");

    if (!query) {
      return api.sendMessage("❗ กรุณาป้อนข้อความหรือคำสั่งที่ต้องการถาม AI", threadID, messageID);
    }

    try {
      const response = await axios.get(`https://kaiz-apis.gleeze.com/api/gpt-4o-pro`, {
        params: { q: query, uid: senderID, imageUrl: "" },
      });

      const { response: aiResponse } = response.data;

      if (aiResponse.includes("TOOL_CALL: generateImage")) {
        const urlMatch = aiResponse.match(/https?:\/\/[^\s]+/);
        const imageUrl = urlMatch ? urlMatch[0] : null;

        if (!imageUrl) {
          return api.sendMessage("❗ เกิดข้อผิดพลาด: ไม่พบ URL ของภาพในผลลัพธ์", threadID, messageID);
        }

        // ตรวจสอบว่า URL ใช้งานได้หรือไม่
        try {
          const imageStream = await axios({
            url: imageUrl,
            responseType: "stream",
          }).then((res) => res.data);

          return api.sendMessage(
            { body: `✅ สร้างภาพสำเร็จ!`, attachment: imageStream },
            threadID,
            messageID
          );
        } catch (error) {
          return api.sendMessage(
            "❗ เกิดข้อผิดพลาด: ไม่สามารถดึง URL ภาพจากผลลัพธ์ได้ กรุณาลองใหม่อีกครั้ง",
            threadID,
            messageID
          );
        }
      } else {
        return api.sendMessage(`💬 AI ตอบกลับ:\n${aiResponse}`, threadID, messageID);
      }
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาด:", error.message);

      return api.sendMessage(
        "❗ เกิดข้อผิดพลาดในการติดต่อกับ API กรุณาลองใหม่ภายหลัง",
        threadID,
        messageID
      );
    }
  },
};
