const axios = require("axios");

module.exports = {
  config: {
    name: "ค้นหา",
    version: "1.0.0",
    description: "ค้นหาวิดีโอ TikTok จากคำที่ต้องการ",
    usage: "/ค้นหา <คำค้น>",
    aliases: ["searchtiktok", "tiksearch"],
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;

    // ตรวจสอบว่ามีคำค้นมาหรือไม่
    if (args.length === 0) {
      return api.sendMessage(
        "❗ กรุณาระบุคำที่ต้องการค้นหา\n\nตัวอย่าง: /ค้นหา ปรารถนาสิ่งใด",
        threadID,
        messageID
      );
    }

    const query = args.join(" ");
    const apiUrl = `https://kaiz-apis.gleeze.com/api/tiksearch?search=${encodeURIComponent(query)}`;

    try {
      // เรียก API
      const response = await axios.get(apiUrl);
      const data = response.data;

      // ตรวจสอบว่ามีข้อมูลวิดีโอหรือไม่
      if (!data.data || !data.data.videos || data.data.videos.length === 0) {
        return api.sendMessage(
          `❗ ไม่พบวิดีโอที่เกี่ยวข้องกับ "${query}"`,
          threadID,
          messageID
        );
      }

      // เลือกวิดีโอแรก
      const video = data.data.videos[0];
      const videoInfo = `
🎥 **ชื่อวิดีโอ**: ${video.title}
👤 **ผู้สร้าง**: ${video.author.nickname} (@${video.author.unique_id})
🌟 **ยอดถูกใจ**: ${video.digg_count}
💬 **ความคิดเห็น**: ${video.comment_count}
🔗 **ลิงก์วิดีโอ**: https://www.tiktok.com/@${video.author.unique_id}/video/${video.video_id}
      `;

      // ส่งข้อมูลและวิดีโอ
      return api.sendMessage(
        {
          body: videoInfo,
          attachment: await axios({
            url: video.play,
            responseType: "stream",
          }).then((res) => res.data),
        },
        threadID,
        messageID
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการเรียก API:", error.message);

      // แจ้งข้อผิดพลาดให้ผู้ใช้ทราบ
      return api.sendMessage(
        "❗ ไม่สามารถค้นหาวิดีโอได้ในขณะนี้ กรุณาลองใหม่ภายหลัง",
        threadID,
        messageID
      );
    }
  },
};
