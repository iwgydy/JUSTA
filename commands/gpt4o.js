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
      // เรียก API GPT-4o
      const response = await axios.get(
        `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(query)}&uid=${senderID}&imageUrl=`
      );

      const { response: aiResponse } = response.data;

      // ตรวจสอบว่าเป็นข้อความหรือคำสั่งสร้างภาพ
      if (aiResponse.startsWith("TOOL_CALL: generateImage")) {
        const imageUrl = aiResponse.match(/Generated Image.*(.*)/)?.[1];
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (imageUrl) {
          // ส่งภาพและเวลา
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
          throw new Error("ไม่สามารถดึง URL ภาพได้");
        }
      } else {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        // ส่งข้อความตอบกลับ
        return api.sendMessage(
          `💬 AI ตอบกลับ:\n${aiResponse}\n\n⌛ ใช้เวลาทั้งหมด: ${duration} วินาที`,
          threadID,
          messageID
        );
      }
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาด:", error.message);

      // แจ้งข้อผิดพลาดให้ผู้ใช้
      return api.sendMessage(
        "❗ เกิดข้อผิดพลาดในการติดต่อกับ AI กรุณาลองใหม่ภายหลัง",
        threadID,
        messageID
      );
    }
  },
};
