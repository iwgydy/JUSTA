const { loadImage, createCanvas } = require("canvas");
const fs = require("fs-extra");
const axios = require("axios");

module.exports = {
  name: 'แฮก',
  description: 'แฮกโปรไฟล์และสร้างรูปภาพพร้อมข้อความที่กำหนด',
  author: 'John Lester',
  execute(api, event, args) {
    runCommand(api, event, args);
  },
};

async function runCommand(api, event, args) {
  const { senderID, threadID, messageID } = event;
  const id = Object.keys(event.mentions)[0] || senderID;

  // ดึงข้อมูลผู้ใช้ (ชื่อ)
  const userInfo = await api.getUserInfo(id);
  const name = userInfo[id].name;

  if (!name) {
    return api.sendMessage("กรุณาระบุเนื้อหาของความคิดเห็นบนบอร์ด", threadID, messageID);
  }

  const pathImg = __dirname + '/cache/background.png';
  const pathAvt = __dirname + '/cache/avatar.png';

  // URL ภาพพื้นหลัง
  const background = [
    "https://i.imgur.com/VQXViKI.png"
  ];
  const randomBackground = background[Math.floor(Math.random() * background.length)];

  // ดาวน์โหลดรูปโปรไฟล์ Facebook
  let avatarBuffer = (await axios.get(
    `https://graph.facebook.com/${id}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
    { responseType: "arraybuffer" }
  )).data;
  fs.writeFileSync(pathAvt, Buffer.from(avatarBuffer, "utf-8"));

  // ดาวน์โหลดภาพพื้นหลัง
  let backgroundBuffer = (await axios.get(randomBackground, { responseType: "arraybuffer" })).data;
  fs.writeFileSync(pathImg, Buffer.from(backgroundBuffer, "utf-8"));

  // โหลดภาพ
  const baseImage = await loadImage(pathImg);
  const avatarImage = await loadImage(pathAvt);

  // สร้างแคนวาส
  const canvas = createCanvas(baseImage.width, baseImage.height);
  const ctx = canvas.getContext("2d");

  // วาดภาพพื้นหลังและโปรไฟล์
  ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
  ctx.drawImage(avatarImage, 83, 437, 100, 101);

  // ตั้งค่าฟอนต์และเขียนข้อความ
  ctx.font = "400 23px Arial";
  ctx.fillStyle = "#1878F3";
  ctx.textAlign = "start";

  const lines = await wrapText(ctx, name, 1160);
  ctx.fillText(lines.join('\n'), 200, 497);

  // แปลงผลลัพธ์เป็นไฟล์ภาพ
  const imageBuffer = canvas.toBuffer();
  fs.writeFileSync(pathImg, imageBuffer);

  // ส่งภาพในแชท
  api.sendMessage(
    { body: `นี่คือโปรไฟล์ของคุณ!`, attachment: fs.createReadStream(pathImg) },
    threadID,
    () => {
      fs.unlinkSync(pathImg);
      fs.unlinkSync(pathAvt);
    },
    messageID
  );
}

// ฟังก์ชันตัดคำสำหรับข้อความที่ยาวเกิน
async function wrapText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width < maxWidth) return [text];
  if (ctx.measureText('W').width > maxWidth) return null;

  const words = text.split(' ');
  const lines = [];
  let line = '';

  while (words.length > 0) {
    let split = false;
    while (ctx.measureText(words[0]).width >= maxWidth) {
      const temp = words[0];
      words[0] = temp.slice(0, -1);
      if (split) words[1] = `${temp.slice(-1)}${words[1]}`;
      else {
        split = true;
        words.splice(1, 0, temp.slice(-1));
      }
    }

    if (ctx.measureText(`${line}${words[0]}`).width < maxWidth) {
      line += `${words.shift()} `;
    } else {
      lines.push(line.trim());
      line = '';
    }

    if (words.length === 0) lines.push(line.trim());
  }

  return lines;
}
