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
        "❗ กรุณาป้อนข้อความหรือคำสั่งที่ต้องการถาม AI\n\nตัวอย่าง: /gpt4o สวัสดี",
        threadID,
        messageID
      );
    }

    const startTime = Date.now();

    try {
      // เรียก API GPT-4o
      const response = await axios.get("https://kaiz-apis.gleeze.com/api/gpt-4o-pro", {
        params: {
          q: query,
          uid: senderID,
          imageUrl: encodeURIComponent(query), // ส่งคำสั่งสร้างภาพ
        },
      });

      const aiResponse = response.data.response;
      console.log("AI Response Full:", aiResponse);

      // ตรวจสอบว่าเป็นคำสั่งสร้างภาพ
      if (aiResponse.includes("TOOL_CALL: generateImage")) {
        let imageUrl = null;

        // พยายามจับคู่ URL ภาพจากรูปแบบ Markdown
        const markdownMatch = aiResponse.match(/!.*?(https?:\/\/[^]+)/);
        if (markdownMatch && markdownMatch[1]) {
          imageUrl = markdownMatch[1];
        }

        // ถ้าไม่พบในรูปแบบ Markdown ให้ลองจับคู่ URL อื่นๆ ที่เป็นภาพ
        if (!imageUrl) {
          const urlMatch = aiResponse.match(/https?:\/\/[^\s)]+(?:\.png|\.jpg|\.jpeg|\.gif)/i);
          if (urlMatch && urlMatch[0]) {
            imageUrl = urlMatch[0];
          }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log("Image URL:", imageUrl);

        if (imageUrl) {
          // ส่งภาพผ่าน URL โดยตรง
          return api.sendMessage(
            {
              body: `✅ สร้างภาพสำเร็จ!\n📂 ใช้เวลาทั้งหมด: ${duration} วินาที`,
              attachment: imageUrl, // ส่ง URL เป็นแนบ
            },
            threadID,
            messageID
          );
        } else {
          // กรณีไม่พบ URL ในผลลัพธ์
          return api.sendMessage(
            "❗ เกิดข้อผิดพลาด: ไม่พบ URL ของภาพในผลลัพธ์ กรุณาลองใหม่อีกครั้ง",
            threadID,
            messageID
          );
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
      console.error("❌ เกิดข้อผิดพลาดในการเรียก API:", error.message);

      return api.sendMessage(
        "❗ เกิดข้อผิดพลาดในการติดต่อกับ AI กรุณาลองใหม่อีกครั้ง",
        threadID,
        messageID
      );
    }
  },
};
