const fs = require("fs");
const axios = require("axios");

module.exports.config = {
  name: "สร้างภาพวาด",
  version: "1.1",
  hasPermssion: 0,
  credits: "YourName",
  description: "สร้างภาพวาดตามข้อความที่กำหนด พร้อมแสดงเวลาที่ใช้",
  commandCategory: "สร้างภาพ",
  usages: "สร้างภาพวาด [ข้อความ]",
  cooldowns: 10,
};

module.exports.run = async function ({ api, event, args }) {
  try {
    if (args.length === 0) {
      return api.sendMessage(
        "❌ กรุณาใส่ข้อความที่ต้องการให้สร้างภาพ เช่น: สร้างภาพวาด แมวเล่นกับผีเสื้อ",
        event.threadID,
        event.messageID
      );
    }

    const prompt = args.join(" ");
    api.sendMessage(`🎨 กำลังสร้างภาพ: "${prompt}" โปรดรอสักครู่...`, event.threadID);

    const startTime = Date.now(); // บันทึกเวลาที่เริ่มต้นการสร้างภาพ

    const apiUrl = "https://api-inference.huggingface.co/models/Datou1111/shou_xin";
    const apiKey = "Bearer hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; // แทนที่ด้วย API Key จริง

    const response = await axios({
      url: apiUrl,
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      data: { inputs: prompt },
      responseType: "stream",
    });

    const filePath = `${__dirname}/cache/image_${Date.now()}.png`;
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    writer.on("finish", () => {
      const endTime = Date.now(); // เวลาที่การสร้างภาพเสร็จสิ้น
      const duration = endTime - startTime; // คำนวณเวลาที่ใช้
      const timeFormat = formatDuration(duration);

      api.sendMessage(
        {
          body: `🎨 ภาพวาดเสร็จแล้วสำหรับคำว่า: "${prompt}"\n⏱ ใช้เวลา: ${timeFormat} วินาที`,
          attachment: fs.createReadStream(filePath),
        },
        event.threadID,
        () => fs.unlinkSync(filePath),
        event.messageID
      );
    });

    writer.on("error", () => {
      api.sendMessage("❌ เกิดข้อผิดพลาดในการบันทึกภาพ โปรดลองใหม่อีกครั้ง!", event.threadID);
    });
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    api.sendMessage("❌ ไม่สามารถสร้างภาพได้ โปรดลองใหม่อีกครั้ง!", event.threadID, event.messageID);
  }
};

// ฟังก์ชันช่วยแปลงมิลลิวินาทีเป็นรูปแบบ 0.0.0.0
function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours}.${minutes}.${seconds}.${milliseconds}`;
}
