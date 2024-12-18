const axios = require("axios");

module.exports = {
  config: {
    name: "แท็กด่า",
    version: "1.0.0",
    description: "แท็กคนที่ต้องการให้บอทด่า",
    usage: "/แท็กด่า [แท็กชื่อ]",
    aliases: ["ด่า", "ด่าเพื่อน"],
  },

  run: async ({ api, event }) => {
    const { threadID, messageID, mentions } = event;

    // ตรวจสอบว่ามีการแท็กหรือไม่
    const taggedUsers = Object.keys(mentions);
    if (taggedUsers.length === 0) {
      return api.sendMessage(
        "❗ กรุณาแท็กคนที่คุณต้องการให้บอทด่า!",
        threadID,
        messageID
      );
    }

    try {
      // ดึงข้อมูลคำพูดพิษๆ 4 คำจาก API
      const responses = await Promise.all([
        axios.get("https://api.xncly.xyz/toxic.php"),
        axios.get("https://api.xncly.xyz/toxic.php"),
        axios.get("https://api.xncly.xyz/toxic.php"),
        axios.get("https://api.xncly.xyz/toxic.php"),
      ]);

      // รวบรวมข้อความ
      const insults = responses.map((response) => response.data.random_word);

      if (insults.length < 4) {
        return api.sendMessage(
          "❗ ไม่สามารถดึงข้อความด่าได้ครบ 4 คำ กรุณาลองใหม่",
          threadID,
          messageID
        );
      }

      // สร้างข้อความด่า
      const insultText = `💢 ข้อความถึง ${mentions[taggedUsers[0]]}:\n- ${insults.join("\n- ")}`;

      // ส่งข้อความด่าพร้อมแท็ก
      return api.sendMessage(
        { body: insultText, mentions: [{ tag: mentions[taggedUsers[0]], id: taggedUsers[0] }] },
        threadID,
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการเรียก API:", error.message);

      // แจ้งข้อผิดพลาด
      return api.sendMessage(
        "❗ เกิดข้อผิดพลาด ไม่สามารถดึงข้อความด่าได้ในขณะนี้",
        threadID,
        messageID
      );
    }
  },
};
