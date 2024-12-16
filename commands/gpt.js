const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

module.exports = {
  config: {
    name: "จับคู่วี2",
    aliases: [],
    version: "1.1",
    author: "Vex_kshitiz",
    shortDescription: "จับคู่รูปโปรไฟล์",
    longDescription: "ค้นหารูปโปรไฟล์ที่จับคู่กัน",
    category: "image",
    guide: {
      en: "{p}pairdp2 {คำค้น1} and {คำค้น2} -{ลำดับรูปภาพ}\nตัวอย่าง: {p}pairdp2 zoro and sanji -2"
    }
  },
  onStart: async function ({ message, event, args, api }) {
    try {
      const input = args.join(" ");
      const [queries, imageIndex] = input.split(' -');
      if (!queries || !imageIndex) {
        return message.reply("❌ || กรุณาระบุคำค้นหา 2 คำคั่นด้วยคำว่า 'and' และหมายเลขรูปภาพโดยใช้เครื่องหมาย '-',\nตัวอย่าง: pairdp2 zoro and sanji -2");
      }

      const [query1, query2] = queries.split(' and ');
      if (!query1 || !query2) {
        return message.reply("❌ || กรุณาระบุคำค้นหา 2 คำคั่นด้วย 'and'\nตัวอย่าง: pairdp2 zoro and sanji -2");
      }

      const searchQuery = `${query1} and ${query2}`;
      const apiUrl = `https://pin-two.vercel.app/pin?search=${encodeURIComponent(searchQuery)}`;

      const response = await axios.get(apiUrl);
      const imageData = response.data.result;

      const index = parseInt(imageIndex) - 1;
      if (index < 0 || index >= imageData.length) {
        return message.reply(`❌ || กรุณาระบุหมายเลขรูปภาพที่ถูกต้อง ระหว่าง 1 ถึง ${imageData.length}`);
      }

      const imageUrl = imageData[index];

      const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });

      const image = await loadImage(imgResponse.data);
      const width = image.width;
      const height = image.height;
      const halfWidth = width / 2;

      const canvasLeft = createCanvas(halfWidth, height);
      const ctxLeft = canvasLeft.getContext('2d');
      ctxLeft.drawImage(image, 0, 0, halfWidth, height, 0, 0, halfWidth, height);

      const canvasRight = createCanvas(halfWidth, height);
      const ctxRight = canvasRight.getContext('2d');
      ctxRight.drawImage(image, halfWidth, 0, halfWidth, height, 0, 0, halfWidth, height);

      const cacheFolderPath = path.join(__dirname, 'cache');
      if (!fs.existsSync(cacheFolderPath)) {
        fs.mkdirSync(cacheFolderPath);
      }

      const timestamp = Date.now();
      const leftImagePath = path.join(cacheFolderPath, `${timestamp}left.png`);
      const rightImagePath = path.join(cacheFolderPath, `${timestamp}right.png`);

      await Promise.all([
        fs.promises.writeFile(leftImagePath, canvasLeft.toBuffer('image/png')),
        fs.promises.writeFile(rightImagePath, canvasRight.toBuffer('image/png'))
      ]);

      const imgData = [
        fs.createReadStream(leftImagePath),
        fs.createReadStream(rightImagePath)
      ];

      await api.sendMessage({
        attachment: imgData,
        body: "ภาพคู่ DP!"
      }, event.threadID, event.messageID);

      fs.unlinkSync(leftImagePath);
      fs.unlinkSync(rightImagePath);

      console.log("ส่งรูปภาพสำเร็จ และทำความสะอาดแคชเรียบร้อย");
    } catch (error) {
      console.error("Error:", error);
      message.reply("❌ | เกิดข้อผิดพลาดบางอย่าง");
    }
  }
};
