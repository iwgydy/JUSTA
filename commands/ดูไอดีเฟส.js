module.exports = {
  config: {
    name: "ดูไอดี",
    version: "1.0.0",
    description: "ดู Facebook ID ของคุณ",
    usage: "/ดูไอดี",
    aliases: ["myid", "fbid"],
  },

  run: async ({ api, event }) => {
    const { senderID, threadID, messageID } = event;

    try {
      const userInfo = await api.getUserInfo(senderID); // ดึงข้อมูลผู้ใช้
      const userName = userInfo[senderID].name; // ชื่อผู้ใช้

      // ส่งข้อความแจ้ง ID และชื่อของผู้ใช้
      return api.sendMessage(
        `🆔 Facebook ID ของคุณ: ${senderID}\n👤 ชื่อ: ${userName}`,
        threadID,
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการดึงข้อมูล:", error.message);

      // แจ้งข้อผิดพลาดให้ผู้ใช้ทราบ
      return api.sendMessage(
        "❗ ไม่สามารถดึงข้อมูล Facebook ID ได้ กรุณาลองใหม่ภายหลัง",
        threadID,
        messageID
      );
    }
  },
};
