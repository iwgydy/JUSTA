const axios = require("axios");

module.exports = {
  config: {
    name: "tiktok",
    description: "ดาวน์โหลดวิดีโอจาก TikTok โดยใช้ลิงก์",
    usage: "/tiktok <ลิงก์วิดีโอ TikTok>",
  },
  run: async ({ api, event, args }) => {
    const threadID = event.threadID;
    const messageID = event.messageID;

    if (!args[0]) {
      return api.sendMessage(
        "❗ โปรดระบุลิงก์วิดีโอ TikTok ที่ต้องการดาวน์โหลด",
        threadID,
        messageID
      );
    }

    let tiktokLink = args[0].trim();

    if (!tiktokLink.startsWith("http") || !tiktokLink.includes("tiktok.com")) {
      return api.sendMessage(
        "❗ ลิงก์ไม่ถูกต้อง โปรดตรวจสอบลิงก์ TikTok อีกครั้ง",
        threadID,
        messageID
      );
    }

    try {
      // Debug: ตรวจสอบลิงก์ก่อนขยาย
      console.log("Input Link:", tiktokLink);

      // ขยายลิงก์ (สำหรับลิงก์ย่อ)
      const resolvedLink = await axios.head(tiktokLink).then((res) => res.request.res.responseUrl);

      // Debug: ลิงก์หลังขยาย
      console.log("Resolved Link:", resolvedLink);

      // เรียก API ดาวน์โหลด
      const response = await axios.get(
        `https://nethwieginedev.vercel.app/api/tiktokdl?link=${encodeURIComponent(resolvedLink)}`
      );

      // Debug: การตอบกลับของ API
      console.log("API Response:", response.data);

      if (response.data.error) {
        return api.sendMessage(
          `❗ เกิดข้อผิดพลาด: ${response.data.error}`,
          threadID,
          messageID
        );
      }

      const videoUrl = response.data.video;
      const caption = response.data.caption || "วิดีโอจาก TikTok";

      // Debug: ลิงก์วิดีโอที่ได้
      console.log("Video URL:", videoUrl);

      api.sendMessage(
        {
          body: caption,
          attachment: await axios({
            url: videoUrl,
            method: "GET",
            responseType: "stream",
          }).then((res) => res.data),
        },
        threadID,
        messageID
      );
    } catch (error) {
      console.error("Error processing TikTok link:", error);
      return api.sendMessage(
        "❗ เกิดข้อผิดพลาดในการดาวน์โหลดวิดีโอ",
        threadID,
        messageID
      );
    }
  },
};
