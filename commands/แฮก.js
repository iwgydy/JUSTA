module.exports.config = {
  name: "สร้างภาพวาด",
  version: "1.0.0",
  description: "สร้างภาพวาดจากข้อความที่ป้อน",
  commandCategory: "image",
  usages: "[คำอธิบายภาพ]",
  cooldowns: 10,
};

module.exports.run = async ({ api, event, args }) => {
  const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
  const fs = require("fs-extra");
  const path = require("path");

  const startTime = Date.now();
  const textInput = args.join(" ");
  
  if (!textInput) {
    return api.sendMessage("❌ กรุณาใส่คำอธิบายภาพที่ต้องการสร้าง!", event.threadID, event.messageID);
  }

  try {
    api.sendMessage(`⏳ กำลังสร้างภาพวาดจากข้อความ: "${textInput}"\nโปรดรอสักครู่...`, event.threadID, event.messageID);

    const response = await fetch("https://api-inference.huggingface.co/models/Datou1111/shou_xin", {
      method: "POST",
      headers: {
        Authorization: "Bearer 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",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: textInput }),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const filePath = path.join(__dirname, "cache", `art_${Date.now()}.png`);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    const endTime = Date.now();
    const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

    const message = {
      body: `🎨 ภาพวาดของคุณถูกสร้างขึ้นเรียบร้อยแล้ว!\n🕒 ใช้เวลา: ${timeTaken} วินาที\n\n🌟 คำอธิบาย: "${textInput}"`,
      attachment: fs.createReadStream(filePath),
    };

    api.sendMessage(message, event.threadID, () => fs.unlinkSync(filePath), event.messageID);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    api.sendMessage("❌ ไม่สามารถสร้างภาพวาดได้ในขณะนี้ โปรดลองอีกครั้งภายหลัง!", event.threadID, event.messageID);
  }
};
