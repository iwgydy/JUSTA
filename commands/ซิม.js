const axios = require("axios");

// เก็บสถานะว่าแต่ละห้องเปิด auto-reply หรือไม่
// แนะนำให้คุณประกาศไว้เป็น global ใน index.js เช่น
// global.autoReplySimsimi = {};
// หรือจะประกาศในไฟล์นี้ก็ได้เช่นกัน
if (!global.autoReplySimsimi) {
  global.autoReplySimsimi = {};
}

module.exports = {
  config: {
    name: "ซิม",
    description: "พูดคุยกับ SimSimi AI (รองรับโหมดตอบกลับอัตโนมัติ)",
    usage: "/ซิม [on | off | ข้อความ]",
    aliases: ["sim", "simsimi"],
    permissions: {
      user: [],
      bot: ["SEND_MESSAGES"],
    },
    cooldown: 3,
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const apiKey = "oi7UxmhwAPPEKR.DQvSe0gA_qLaCseaaGOZBwlAt"; // ใส่ API Key ของคุณ

    // 1) เช็คว่าผู้ใช้พิมพ์ /ซิม on หรือ /ซิม off หรือเปล่า
    if (args[0] === "on") {
      global.autoReplySimsimi[threadID] = true;
      return api.sendMessage(
        "เปิดโหมดตอบกลับอัตโนมัติ SimSimi ในห้องนี้แล้ว\n" +
        "ทุกข้อความที่พิมพ์ (ไม่ต้องใช้ /ซิม) จะถูกส่งหาบอท SimSimi",
        threadID,
        messageID
      );
    }
    else if (args[0] === "off") {
      global.autoReplySimsimi[threadID] = false;
      return api.sendMessage(
        "ปิดโหมดตอบกลับอัตโนมัติ SimSimi ในห้องนี้แล้ว",
        threadID,
        messageID
      );
    }

    // 2) กรณีผู้ใช้ไม่ได้พิมพ์ on/off => ถือว่าเป็นการคุยปกติ
    if (!args.length) {
      return api.sendMessage(
        "❗ กรุณาระบุข้อความที่ต้องการพูดคุย เช่น: /ซิม สวัสดี\n" +
        "หรือใช้ /ซิม on /ซิม off เพื่อเปิด/ปิดโหมดอัตโนมัติ",
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
          lang: "th",  // ภาษาไทย
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

      // ส่งข้อความตอบกลับ
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
  },
};
