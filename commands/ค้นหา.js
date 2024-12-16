const axios = require("axios");

module.exports.config = {
  name: "ค้นหาอวตาร์",
  version: "1.0",
  hasPermssion: 0,
  credits: "YourName",
  description: "ค้นหาอวตาร์จาก API ด้วยหมายเลข ID",
  commandCategory: "fun",
  usages: "ค้นหาอวตาร์ <หมายเลข ID>",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event, args }) {
  try {
    // ตรวจสอบว่าผู้ใช้ระบุ ID หรือไม่
    const id = args[0];
    if (!id || isNaN(id) || id < 1 || id > 846) {
      return api.sendMessage("❌ กรุณาระบุหมายเลข ID ที่ต้องการค้นหา (ระหว่าง 1-846)", event.threadID, event.messageID);
    }

    // เรียก API เพื่อค้นหาอวตาร์
    const response = await axios.get(`https://api.joshweb.click/canvas/search?id=${id}`);
    const data = response.data;

    if (!data || !data.data || data.data.length === 0) {
      return api.sendMessage("❌ ไม่พบอวตาร์ที่ตรงกับหมายเลขนี้ กรุณาลองใหม่", event.threadID, event.messageID);
    }

    // ดึงข้อมูลอวตาร์ที่ค้นพบ
    const avatar = data.data[0];
    const { imgAnime, colorBg, dm } = avatar;

    // ดาวน์โหลดและส่งภาพอวตาร์กลับไปยังผู้ใช้
    const imageStream = await axios({
      url: imgAnime,
      method: "GET",
      responseType: "stream",
    });

    api.sendMessage(
      {
        body: `🎨 อวตาร์หมายเลข: ${id}\n🌈 สีพื้นหลัง: ${colorBg}\n🧍 ประเภท: ${dm}`,
        attachment: imageStream.data,
      },
      event.threadID,
      event.messageID
    );
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    api.sendMessage("❌ ไม่สามารถค้นหาอวตาร์ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง!", event.threadID, event.messageID);
  }
};
