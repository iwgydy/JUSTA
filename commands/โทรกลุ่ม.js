module.exports = {
  config: {
    name: "เปลี่ยนตัวเองสุ่ม",
    description: "สุ่มชื่อใหม่ให้ผู้ใช้",
    usage: "/เปลี่ยนตัวเองสุ่ม",
    aliases: ["สุ่มชื่อ", "เปลี่ยนชื่อ"],
    permissions: {
      user: [],
      bot: ["SEND_MESSAGES"],
    },
    cooldown: 5,
  },

  run: async ({ api, event }) => {
    const { threadID, messageID, senderID } = event;

    // รายการชื่อสุ่ม
    const randomNames = [
      "นักรบแห่งความมืด",
      "เจ้าชายสายลม",
      "แมวน้อยขี้เซา",
      "นางฟ้าทะเลทราย",
      "ดาบแห่งแสงสว่าง",
      "เงาสะท้อนแห่งความฝัน",
      "เสือดาวแห่งราตรี",
      "เจ้าหญิงน้ำแข็ง",
      "หมาป่าหลงทาง",
      "ภูตแห่งป่าเขียว",
    ];

    // สุ่มชื่อใหม่
    const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];

    try {
      // เปลี่ยนชื่อในแชทของผู้ใช้
      await api.changeNickname(randomName, threadID, senderID);

      // แจ้งผู้ใช้ว่าชื่อถูกเปลี่ยนแล้ว
      return api.sendMessage(
        `✨ ชื่อของคุณถูกเปลี่ยนเป็น "${randomName}" แล้ว! ✨`,
        threadID,
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการเปลี่ยนชื่อ:", error.message);
      return api.sendMessage(
        "❗ ไม่สามารถเปลี่ยนชื่อของคุณได้ กรุณาลองใหม่ภายหลัง",
        threadID,
        messageID
      );
    }
  },
};