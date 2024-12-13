const axios = require("axios");

module.exports = {
  config: {
    name: "จับคู่",
    description: "จับคู่ความรักระหว่างผู้ใช้คำสั่งกับสมาชิกในกลุ่ม พร้อมรูปคู่",
    usage: "/matchlove",
    aliases: ["จับคู่", "love", "match"],
    permissions: {
      user: [],
      bot: ["SEND_MESSAGES", "ATTACH_FILES"],
    },
    cooldown: 5,
  },

  run: async ({ api, event }) => {
    const { threadID, messageID, senderID } = event;

    try {
      // ดึงข้อมูลสมาชิกในกลุ่ม
      const threadInfo = await api.getThreadInfo(threadID);
      const participants = threadInfo.participantIDs;

      // ตรวจสอบว่ามีสมาชิกเพียงพอ
      if (participants.length < 2) {
        return api.sendMessage("❗ ต้องมีสมาชิกอย่างน้อย 2 คนในกลุ่มเพื่อเล่นเกมนี้!", threadID, messageID);
      }

      // กำหนดคนแรกเป็นผู้ใช้คำสั่ง
      const person1 = senderID;

      // สุ่มคนที่สองจากสมาชิกในกลุ่ม (ไม่รวมผู้ใช้คำสั่ง)
      let person2 = participants[Math.floor(Math.random() * participants.length)];
      while (person1 === person2) {
        person2 = participants[Math.floor(Math.random() * participants.length)];
      }

      // สุ่มเปอร์เซ็นต์ความรัก
      const lovePercentage = Math.floor(Math.random() * 100) + 1;

      // ดึงชื่อผู้ใช้
      const name1 = await getName(api, person1);
      const name2 = await getName(api, person2);

      // สร้างแถบความรัก
      const loveBar = createLoveBar(lovePercentage);

      // สร้างข้อความตกแต่ง
      const loveMessage = getLoveMessage(lovePercentage);

      // ดึงรูปคู่จาก API
      const response = await axios.get("https://api.joshweb.click/cdp");
      const images = response.data.result;
      const imageOne = images.one;
      const imageTwo = images.two;

      // ส่งข้อความพร้อมรูปภาพ
      return api.sendMessage(
        {
          body: `✨💖 **คู่รักในกลุ่มนี้คือ...** 💖✨\n\n` +
          `❤️ **คนแรก**: [ ${name1} ]\n` +
          `💙 **คนที่สอง**: [ ${name2} ]\n\n` +
          `🔮 **เปอร์เซ็นต์ความรัก**: ${lovePercentage}%\n` +
          `${loveBar}\n\n` +
          `${loveMessage}\n` +
          `💌 *ลองตั้งรูปคู่กันดูสิ!*`,
          attachment: [
            await axios({ url: imageOne, responseType: "stream" }).then((res) => res.data),
            await axios({ url: imageTwo, responseType: "stream" }).then((res) => res.data),
          ],
        },
        threadID,
        messageID
      );

    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการจับคู่:", error);
      return api.sendMessage("❗ ไม่สามารถจับคู่ความรักได้ในขณะนี้ กรุณาลองใหม่ภายหลัง", threadID, messageID);
    }
  },
};

// ฟังก์ชันช่วยดึงชื่อผู้ใช้
async function getName(api, userID) {
  const userInfo = await api.getUserInfo(userID);
  return userInfo[userID]?.name || "ไม่ทราบชื่อ";
}

// ฟังก์ชันสร้างแถบความรัก (Love Bar)
function createLoveBar(percentage) {
  const fullHearts = Math.floor(percentage / 10); // จำนวน ❤️ เต็ม
  const emptyHearts = 10 - fullHearts; // จำนวน ♡ ว่าง
  return `💖 `.repeat(fullHearts) + `🤍 `.repeat(emptyHearts);
}

// ฟังก์ชันสร้างข้อความตามเปอร์เซ็นต์ความรัก
function getLoveMessage(percentage) {
  if (percentage <= 10) return "💔 ความรักนี้ดูเหมือนจะห่างไกล แต่ก็อย่ายอมแพ้!";
  if (percentage <= 30) return "🧡 ยังมีความหวังสำหรับคุณสองคน อย่าลืมสานสัมพันธ์ให้ดี!";
  if (percentage <= 50) return "💛 ความรักนี้ต้องการการดูแลเพิ่มขึ้น!";
  if (percentage <= 70) return "💚 คุณสองคนมีโอกาสไปต่อในอนาคต!";
  if (percentage <= 90) return "💖 ความรักของคุณสองคนกำลังไปได้สวย!";
  return "💞 คุณสองคนคือคู่รักที่สมบูรณ์แบบที่สุด! ขอยินดีด้วย!";
}
