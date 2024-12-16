const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

module.exports = {
  config: {
    name: "imagetext",
    description: "สร้างรูปภาพจากข้อความที่ระบุ",
    usage: "/imagetext [ข้อความที่ต้องการ]",
    aliases: ["imgtext", "itext"],
    permissions: {
      user: [],
      bot: ["SEND_MESSAGES"],
    },
    cooldown: 3,
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    if (!args.length) {
      return api.sendMessage("❗ กรุณาระบุข้อความที่ต้องการใส่ในภาพ เช่น: /imagetext สวัสดีครับ ทำไรอยู่", threadID, messageID);
    }

    // args จะเป็น array ของคำที่ผู้ใช้พิมพ์มา เราจะนำมาสร้างเป็นหลายบรรทัด
    // เช่น ผู้ใช้พิมพ์: /imagetext สวัสดีครับ ทำไรอยู่
    // args = ["สวัสดีครับ", "ทำไรอยู่"]
    // คุณสามารถแยกบรรทัดอย่างอื่นได้ตามต้องการ
    const textLines = args; 

    const width = 1080;
    const height = 720;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // วาดพื้นหลังสี
    ctx.fillStyle = '#2d1c0e'; 
    ctx.fillRect(0, 0, width, height);

    // ตั้งค่าฟอนต์ ขนาด สี
    ctx.font = '48px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    let x = width / 2;
    let y = 100;
    const lineHeight = 60;

    // เขียนข้อความทีละบรรทัด
    textLines.forEach(line => {
      ctx.fillText(line, x, y);
      y += lineHeight;
    });

    // แปลง canvas เป็น buffer
    const buffer = canvas.toBuffer('image/png');
    const imagePath = path.join(__dirname, 'output.png');
    fs.writeFileSync(imagePath, buffer);

    // ส่งรูปกลับไป
    // api.sendMessage สามารถส่งไฟล์ได้โดยใส่ { attachment: fs.createReadStream(path) }
    return api.sendMessage(
      {
        attachment: fs.createReadStream(imagePath)
      }, 
      threadID, 
      (err) => {
        if (err) console.error(err);
        // ลบไฟล์ทิ้งหลังจากส่งเสร็จ เพื่อลดการใช้พื้นที่
        fs.unlinkSync(imagePath);
      }, 
      messageID
    );
  },
};
