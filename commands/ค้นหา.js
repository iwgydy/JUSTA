const axios = require("axios");

module.exports.config = {
  name: "ค้นหาอวตาร์",
  version: "1.1",
  hasPermssion: 0,
  credits: "YourName",
  description: "ค้นหาอวตาร์จาก API ด้วยหมายเลข ID",
  commandCategory: "fun",
  usages: "ค้นหาอวตาร์ <หมายเลข ID>",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event, args }) {
  try {
    const id = args[0];
    if (!id || isNaN(id) || id < 1 || id > 846) {
      return api.sendMessage("❌ กรุณาระบุหมายเลข ID ที่ต้องการค้นหา (ระหว่าง 1-846)", event.threadID, event.messageID);
    }

    const response = await axios.get(`https://api.joshweb.click/canvas/search?id=${id}`);
    const data = response.data;

    if (!data || !data.data) {
      return api.sendMessage("❌ ไม่พบอวตาร์ที่ตรงกับหมายเลขนี้ กรุณาลองใหม่", event.threadID, event.messageID);
    }

    const { imgAnime, colorBg, dm } = data.data;

    if (!imgAnime) {
      return api.sendMessage("❌ ไม่พบข้อมูลอวตาร์ กรุณาลองใหม่", event.threadID, event.messageID);
    }

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
    console.error("❌ เกิดข้อผิดพลาด:", error.message);
    api.sendMessage("❌ ไม่สามารถค้นหาอวตาร์ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง!", event.threadID, event.messageID);
  }
};
