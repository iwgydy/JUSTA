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

      // ตรวจสอบว่าเป็นคำสั่งสร้างภาพ
      if (aiResponse.includes("TOOL_CALL: generateImage")) {
        // ใช้ regex เพื่อดึง URL ภาพจากข้อความในรูปแบบ Markdown
        const urlMatch = aiResponse.match(/!.*?(https?:\/\/[^]+)/);
        const imageUrl = urlMatch ? urlMatch[1] : null;
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log("Image URL:", imageUrl); // สำหรับการดีบัก

        if (imageUrl) {
          try {
            // ตรวจสอบว่า URL สามารถเข้าถึงได้
            const imageResponse = await axios.get(imageUrl, { responseType: "stream" });
            if (imageResponse.status !== 200) {
              throw new Error(`Image URL responded with status code ${imageResponse.status}`);
            }

            // ส่งภาพพร้อมแสดงเวลาที่ใช้
            return api.sendMessage(
              {
                body: `✅ สร้างภาพสำเร็จ!\n📂 ใช้เวลาทั้งหมด: ${duration} วินาที`,
                attachment: imageResponse.data,
              },
              threadID,
              messageID
            );
          } catch (error) {
            console.error("❌ เกิดข้อผิดพลาดในการดึงภาพ:", error.message);
            return api.sendMessage(
              "❗ เกิดข้อผิดพลาด: ไม่สามารถดึง URL ภาพจากผลลัพธ์ได้ กรุณาลองใหม่อีกครั้ง",
              threadID,
              messageID
            );
          }
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

      // แจ้งข้อผิดพลาดให้ผู้ใช้ทราบ
      return api.sendMessage(
        "❗ เกิดข้อผิดพลาดในการติดต่อกับ AI หรือสร้างภาพ กรุณาลองใหม่ภายหลัง",
        threadID,
        messageID
      );
    }
  },
};
