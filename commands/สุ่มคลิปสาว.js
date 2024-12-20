const axios = require("axios");

module.exports = {
  config: {
    name: "สุ่มคลิปสาว", // ชื่อคำสั่ง
    description: "ส่งคลิปสุ่มจาก API",
    usage: "/สุ่มคลิปสาว", // วิธีใช้งานคำสั่ง
    aliases: ["randomclip", "คลิปสาว"], // ชื่อคำสั่งอื่นๆ ที่ใช้เรียกได้
  },

  run: async ({ api, event }) => {
    const { threadID, messageID } = event;

    try {
      // เรียก API เพื่อดึงข้อมูลวิดีโอ
      const response = await axios.get("https://betadash-shoti-yazky.vercel.app/shotizxx?apikey=shipazu");

      // ตรวจสอบว่ามี URL ของวิดีโอหรือไม่
      const { shotiurl: videoUrl, username, nickname, duration } = response.data;

      if (!videoUrl) {
        return api.sendMessage("❗ ไม่พบคลิป กรุณาลองใหม่อีกครั้ง", threadID, messageID);
      }

      // ส่งข้อมูลเกี่ยวกับวิดีโอให้ผู้ใช้
      await api.sendMessage(
        `🌸 ชื่อผู้ใช้: ${username}\n💟 ชื่อเล่น: ${nickname}\n⏳ ระยะเวลา: ${duration} วินาที`,
        threadID,
        messageID
      );

      // ส่งวิดีโอให้ผู้ใช้
      return api.sendMessage(
        {
          attachment: await axios({
            url: videoUrl,
            responseType: "stream",
          }).then((res) => res.data),
        },
        threadID,
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการดึงข้อมูลวิดีโอ:", error.message);

      // แจ้งข้อผิดพลาดให้ผู้ใช้ทราบ
      return api.sendMessage(
        "❗ ไม่สามารถดึงข้อมูลวิดีโอได้ กรุณาลองใหม่ภายหลัง",
        threadID,
        messageID
      );
    }
  },
};
