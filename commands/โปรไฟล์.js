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

    try {
      // เรียก API เพื่อดึงข้อมูลโปรไฟล์
      const response = await axios.get(
        "https://kaiz-apis.gleeze.com/api/rank?level=102&rank=563&xp=71032&requiredXP=95195&nickname=Kaizenji&status=online&avatar=https://i.imgur.com/P36dq5j.jpeg"
      );

      const { level, rank, xp, requiredXP, nickname, status, avatar } = response.data;

      // สร้างข้อความแสดงผล
      const message = `
🎖️ โปรไฟล์ผู้ใช้:
- ชื่อเล่น: ${nickname}
- ระดับ: ${level}
- อันดับ: ${rank}
- ค่าประสบการณ์: ${xp} / ${requiredXP}
- สถานะ: ${status === "online" ? "🟢 ออนไลน์" : "🔴 ออฟไลน์"}
      `;

      // ส่งข้อความพร้อมรูปโปรไฟล์
      return api.sendMessage(
        {
          body: message,
          attachment: await axios({
            url: avatar,
            responseType: "stream",
          }).then((res) => res.data),
        },
        threadID,
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการเรียก API:", error.message);
      return api.sendMessage("❗ ไม่สามารถดึงข้อมูลโปรไฟล์ได้ในขณะนี้", threadID, messageID);
    }
  },
};
