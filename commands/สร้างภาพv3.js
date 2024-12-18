const axios = require("axios");
const fs = require("fs-extra");
const { loadImage, createCanvas } = require("canvas");

module.exports = {
  config: {
    name: "จับคู่วี1",
    version: "1.0.0",
    description: "จับคู่สุ่มกับสมาชิกในกลุ่ม",
    usage: "/จับคู่วี1",
    aliases: ["pairv1", "คู่รัก"],
  },

  run: async ({ api, event, Users }) => {
    const { threadID, senderID, messageID } = event;

    try {
      // ดึงข้อมูลผู้ใช้และกลุ่ม
      const userInfo = await api.getThreadInfo(threadID);
      const allMembers = userInfo.userInfo;
      const botID = api.getCurrentUserID();
      const senderGender =
        allMembers.find((u) => u.id === senderID)?.gender || "UNKNOWN";

      // คัดกรองสมาชิกเพื่อตั้งค่าการจับคู่
      let candidates = allMembers.filter(
        (u) => u.id !== senderID && u.id !== botID && !u.isGroupAdmin
      );

      if (senderGender === "FEMALE") {
        candidates = candidates.filter((u) => u.gender === "MALE");
      } else if (senderGender === "MALE") {
        candidates = candidates.filter((u) => u.gender === "FEMALE");
      }

      if (candidates.length === 0) {
        return api.sendMessage(
          "❌ ไม่พบสมาชิกที่สามารถจับคู่ได้ในขณะนี้",
          threadID,
          messageID
        );
      }

      // เลือกคู่แบบสุ่ม
      const randomIndex = Math.floor(Math.random() * candidates.length);
      const pairedUser = candidates[randomIndex];
      const pairedUserID = pairedUser.id;

      // ดึงชื่อผู้ใช้
      let pairedUserName;
      try {
        pairedUserName = await Users.getNameUser(pairedUserID);
      } catch (error) {
        console.warn("⚠️ ไม่สามารถดึงชื่อผู้ใช้ได้:", error.message);
        pairedUserName = pairedUser?.name || "สมาชิกนิรนาม";
      }

      // ดาวน์โหลดภาพโปรไฟล์
      const firstUserProfile = `https://graph.facebook.com/${senderID}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
      const secondUserProfile = `https://graph.facebook.com/${pairedUserID}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

      const pathFirstUser = `${__dirname}/cache/firstUser.png`;
      const pathSecondUser = `${__dirname}/cache/secondUser.png`;
      const pathBackground = `${__dirname}/cache/background.png`;

      // ดาวน์โหลดไฟล์
      const [firstUserBuffer, secondUserBuffer] = await Promise.all([
        axios.get(firstUserProfile, { responseType: "arraybuffer" }).then((res) => res.data),
        axios.get(secondUserProfile, { responseType: "arraybuffer" }).then((res) => res.data),
      ]);
      fs.writeFileSync(pathFirstUser, Buffer.from(firstUserBuffer));
      fs.writeFileSync(pathSecondUser, Buffer.from(secondUserBuffer));

      // ดาวน์โหลดภาพพื้นหลัง
      const backgroundUrl = "https://i.postimg.cc/wjJ29HRB/background1.png";
      const backgroundBuffer = await axios
        .get(backgroundUrl, { responseType: "arraybuffer" })
        .then((res) => res.data);
      fs.writeFileSync(pathBackground, Buffer.from(backgroundBuffer));

      // สร้างภาพจับคู่
      const baseImage = await loadImage(pathBackground);
      const firstAvatar = await loadImage(pathFirstUser);
      const secondAvatar = await loadImage(pathSecondUser);

      const canvas = createCanvas(baseImage.width, baseImage.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(firstAvatar, 100, 150, 300, 300); // วางโปรไฟล์ผู้เรียกคำสั่ง
      ctx.drawImage(secondAvatar, 900, 150, 300, 300); // วางโปรไฟล์คู่ที่จับคู่

      const resultPath = `${__dirname}/cache/pair_result.png`;
      const imageBuffer = canvas.toBuffer();
      fs.writeFileSync(resultPath, imageBuffer);

      // ส่งข้อความและภาพกลับในแชท
      return api.sendMessage(
        {
          body: `💞 ขอแสดงความยินดี! คุณถูกจับคู่กับ ${pairedUserName}\nโอกาสที่เหมาะสมคือ ${Math.floor(Math.random() * 101)}%`,
          mentions: [
            {
              tag: pairedUserName,
              id: pairedUserID,
            },
          ],
          attachment: fs.createReadStream(resultPath),
        },
        threadID,
        () => {
          fs.unlinkSync(pathFirstUser);
          fs.unlinkSync(pathSecondUser);
          fs.unlinkSync(pathBackground);
          fs.unlinkSync(resultPath);
        },
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการจับคู่:", error.message);
      return api.sendMessage("❗ ไม่สามารถจับคู่ได้ในขณะนี้", threadID, messageID);
    }
  },
};
