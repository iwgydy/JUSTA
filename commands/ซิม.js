const axios = require("axios");

module.exports = {
  config: {
    name: "ซิม",
    description: "พูดคุยกับ SimSimi AI",
    usage: "/ซิม [ข้อความ]",
    aliases: ["sim", "simsimi"],
    permissions: {
      user: [],
      bot: ["SEND_MESSAGES"],
    },
    cooldown: 3,
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    if (!args.length) {
      return api.sendMessage("❗ กรุณาระบุข้อความที่ต้องการพูดคุย เช่น: /ซิม สวัสดี", threadID, messageID);
    }

    const userMessage = args.join(" "); // ข้อความที่ผู้ใช้พิมพ์
    const apiKey = "oi7UxmhwAPPEKR.DQvSe0gA_qLaCseaaGOZBwlAt"; // ใส่ API Key ของคุณ

    try {
      // เรียก API SimSimi
      const response = await axios.post(
        "https://wsapi.simsimi.com/190410/talk",
        {
          utext: userMessage,
          lang: "th", // ภาษาไทย
          country: ["TH"], // ประเทศไทย
          atext_bad_prob_max: 0.9, // อนุญาตคำตอบทุกระดับความหยาบ
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
        }
      );

      const reply = response.data.atext; // ข้อความที่ SimSimi ตอบกลับ

      // ส่งข้อความตอบกลับโดยตรง
      return api.sendMessage(reply, threadID, messageID);
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับ SimSimi API:", error.message);

      // แสดงข้อความแจ้งเตือน
      if (error.response) {
        return api.sendMessage(
          `❗ ข้อผิดพลาดจาก API: ${error.response.status} - ${error.response.statusText}`,
          threadID,
          messageID
        );
      } else if (error.request) {
        return api.sendMessage(
          "❗ ไม่สามารถเชื่อมต่อกับ API ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือ API Key",
          threadID,
          messageID
        );
      } else {
        return api.sendMessage(`❗ เกิดข้อผิดพลาด: ${error.message}`, threadID, messageID);
      }
    }
  },
};
