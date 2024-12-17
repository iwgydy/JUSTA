const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "สร้างภาพวาด",
    version: "1.0",
    hasPermission: 0,
    credits: "YourName",
    description: "สร้างภาพวาดตามคำที่กำหนด",
    commandCategory: "utility",
    usages: "[ข้อความที่ต้องการวาด]",
    cooldowns: 10
  },

  run: async function ({ api, event, args }) {
    const startTime = Date.now(); // เริ่มจับเวลา
    const inputText = args.join(" ");
    if (!inputText) {
      return api.sendMessage("❌ กรุณาระบุคำที่ต้องการสร้างภาพ!", event.threadID, event.messageID);
    }

    try {
      const query = async (data) => {
        const response = await fetch(
          "https://api-inference.huggingface.co/models/Datou1111/shou_xin",
          {
            headers: {
              Authorization: "Bearer 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", // ใส่ API Key ตรงนี้
              "Content-Type": "application/json",
            },
            method: "POST",
            body: JSON.stringify(data),
          }
        );
        return response.blob();
      };

      // ดึงข้อมูลภาพ
      const result = await query({ inputs: inputText });

      // บันทึกภาพ
      const imagePath = path.join(__dirname, `/cache/image_${Date.now()}.png`);
      const buffer = await result.arrayBuffer();
      fs.writeFileSync(imagePath, Buffer.from(buffer));

      const endTime = Date.now(); // จับเวลาสิ้นสุด
      const elapsedTime = ((endTime - startTime) / 1000).toFixed(2); // คำนวณเวลาเป็นวินาที

      // ส่งภาพกลับไปยังผู้ใช้
      api.sendMessage({
        body: `✅ ภาพวาดของคุณเสร็จสิ้น!\n🕒 ใช้เวลา: ${elapsedTime} วินาที\n🖼️ คำที่ใช้: "${inputText}"`,
        attachment: fs.createReadStream(imagePath),
      }, event.threadID, () => {
        fs.unlinkSync(imagePath); // ลบไฟล์หลังจากส่งสำเร็จ
      }, event.messageID);

    } catch (error) {
      console.error(error);
      return api.sendMessage("❌ เกิดข้อผิดพลาดในการสร้างภาพ กรุณาลองใหม่อีกครั้ง!", event.threadID, event.messageID);
    }
  }
};
