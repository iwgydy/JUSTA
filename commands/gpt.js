const axios = require("axios");

module.exports = {
  name: "gpt",
  description: "พูดคุยกับ AI ผ่าน API GPT-4",
  author: "Rized",

  async execute(senderId, args, pageAccessToken) {
    const userQuery = args.join(" ").trim();

    if (!userQuery) {
      return sendMessage(
        senderId,
        { text: "❌ กรุณาระบุข้อความที่ต้องการคุยกับ AI" },
        pageAccessToken
      );
    }

    sendMessage(
      senderId,
      { text: "⌛ AI กำลังตอบกลับ กรุณารอสักครู่..." },
      pageAccessToken
    );

    try {
      // เรียก API GPT-4
      const apiUrl = `https://nash-api.onrender.com/api/gpt4`;
      const response = await axios.get(apiUrl, {
        params: { query: userQuery }
      });

      const aiResponse = response.data.response || "❌ AI ไม่สามารถตอบคำถามได้ในขณะนี้";

      // สร้างข้อความตอบกลับที่สวยงาม
      const formattedResponse = `✨ คำตอบจาก AI ✨
━━━━━━━━━━━━━━━━━━
${aiResponse}
━━━━━━━━━━━━━━━━━━
🤖 ขอให้สนุกกับการใช้งาน!`;

      // ส่งข้อความตอบกลับจาก AI
      await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
    } catch (error) {
      console.error("❌ Error in คุยกับai command:", error);
      sendMessage(
        senderId,
        { text: `❌ เกิดข้อผิดพลาด: ${error.message || "ไม่สามารถเชื่อมต่อกับ AI ได้"}` },
        pageAccessToken
      );
    }
  }
};

async function sendMessage(senderId, message, pageAccessToken) {
  await axios.post(`https://graph.facebook.com/v11.0/me/messages`, {
    recipient: { id: senderId },
    message
  }, {
    params: { access_token: pageAccessToken }
  });
}
