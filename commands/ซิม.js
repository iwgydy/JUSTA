// commands/sim.js
const axios = require("axios");

module.exports.config = {
  name: "sim",
  description: "พูดคุยกับ SimSimi AI (ตัวอย่างคำสั่ง)",
  usage: "/sim [ข้อความ]",
  aliases: ["simsimi", "ซิม"],
};

module.exports.run = async ({ api, event, args }) => {
  const { threadID, messageID } = event;
  const apiKey = "oi7UxmhwAPPEKR.DQvSe0gA_qLaCseaaGOZBwlAt"; // ใส่ API Key ของคุณเอง

  if (!args.length) {
    return api.sendMessage(
      "❗ กรุณาระบุข้อความที่ต้องการพูดคุย เช่น: /sim สวัสดี",
      threadID,
      messageID
    );
  }

  const userMessage = args.join(" ");

  try {
    // เรียก API ของ SimSimi
    const response = await axios.post(
      "https://wsapi.simsimi.com/190410/talk",
      {
        utext: userMessage,
        lang: "th",
        country: ["TH"],
        atext_bad_prob_max: 0.9,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
      }
    );

    const reply = response.data.atext || "SimSimi ไม่สามารถตอบได้ในตอนนี้";
    return api.sendMessage(reply, threadID, messageID);

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับ SimSimi API:", error.message);

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
};
