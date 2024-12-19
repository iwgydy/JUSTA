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
      return api.sendMessage(
        "❗ กรุณาป้อนข้อความหรือคำสั่งที่ต้องการถาม AI",
        threadID,
        messageID
      );
    }

    const startTime = Date.now();

    try {
      const response = await axios.get(
        `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(query)}&uid=${senderID}&imageUrl=`
      );

      const { response: aiResponse } = response.data;

      if (aiResponse.includes("TOOL_CALL: generateImage")) {
        const urlMatch = aiResponse.match(/https?:\/\/[^\s]+/);
        const imageUrl = urlMatch ? urlMatch[0] : null;
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (imageUrl) {
          return api.sendMessage(
            {
              body: `✅ สร้างภาพสำเร็จ!\n📂 ใช้เวลาทั้งหมด: ${duration} วินาที`,
              attachment: await axios({
                url: imageUrl,
                responseType: "stream",
              }).then((res) => res.data),
            },
            threadID,
            messageID
          );
        } else {
          return api.sendMessage(
            "❗ เกิดข้อผิดพลาด: ไม่พบ URL ของภาพในผลลัพธ์ กรุณาลองใหม่อีกครั้ง",
            threadID,
            messageID
          );
        }
      } else {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        return api.sendMessage(
          `💬 AI ตอบกลับ:\n${aiResponse}\n\n⌛ ใช้เวลาทั้งหมด: ${duration} วินาที`,
          threadID,
          messageID
        );
      }
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาด:", error.message);

      return api.sendMessage(
        "❗ เกิดข้อผิดพลาดในการติดต่อกับ AI หรือสร้างภาพ กรุณาลองใหม่ภายหลัง",
        threadID,
        messageID
      );
    }
  },
};
