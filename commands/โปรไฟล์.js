const axios = require("axios");

module.exports = {
  config: {
    name: "โปรไฟล์",
    version: "1.0.0",
    description: "แสดงโปรไฟล์ Rank ของผู้ใช้",
    usage: "/โปรไฟล์",
    aliases: ["rank", "profile"],
  },

  run: async ({ api, event }) => {
    const { threadID, messageID } = event;
    const apiUrl = "https://kaiz-apis.gleeze.com/api/rank?level=102&rank=563&xp=71032&requiredXP=95195&nickname=Kaizenji&status=online&avatar=https://i.imgur.com/P36dq5j.jpeg";

    // ตรวจสอบ URL
    if (!/^https?:\/\//i.test(apiUrl)) {
      console.error("❌ Invalid URL:", apiUrl);
      return api.sendMessage("❗ URL ของ API ไม่ถูกต้อง", threadID, messageID);
    }

    try {
      const response = await axios.get(apiUrl);
      const { level, rank, xp, requiredXP, nickname, status, avatar } = response.data;

      const message = `
🎖️ โปรไฟล์ผู้ใช้:
- ชื่อเล่น: ${nickname}
- ระดับ: ${level}
- อันดับ: ${rank}
- ค่าประสบการณ์: ${xp} / ${requiredXP}
- สถานะ: ${status === "online" ? "🟢 ออนไลน์" : "🔴 ออฟไลน์"}
      `;

      return api.sendMessage(
        {
          body: message,
          attachment: await axios({ url: avatar, responseType: "stream" }).then((res) => res.data),
        },
        threadID,
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการเรียก API:", error.message);
      return api.sendMessage("❗ ไม่สามารถเรียกข้อมูลจาก API ได้ในขณะนี้", threadID, messageID);
    }
  },
};
