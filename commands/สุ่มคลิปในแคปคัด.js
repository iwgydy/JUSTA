const axios = require('axios');
const request = require('request');

module.exports = {
  config: {
    name: 'สุ่มคลิปแคปคัด',
    description: 'ส่งคลิปวิดีโอจากแอปแคปคัดแบบสุ่มให้คุณ',
  },
  run: async ({ api, event }) => {
    try {
      const response = await axios.get('https://apis-david-mp-momn.onrender.com/api/edit');
      const data = response.data;

      // ตรวจสอบว่าข้อมูลที่ได้มาเป็นอาเรย์ และมีคลิปอยู่หรือไม่
      if (Array.isArray(data) && data.length > 0) {
        // เลือกคลิปแบบสุ่ม
        const randomClip = data[Math.floor(Math.random() * data.length)];

        // ส่งคลิปเป็นไฟล์แนบ (หากลิงก์ randomClip เป็น URL ไฟล์วิดีโอโดยตรง เช่น .mp4)
        api.sendMessage(
          { attachment: request(randomClip) },
          event.threadID,
          (err) => {
            if (err) {
              console.error("❌ ไม่สามารถส่งคลิปได้:", err);
              api.sendMessage("ขออภัยค่ะ ไม่สามารถส่งคลิปได้ในขณะนี้", event.threadID);
            } else {
              // ส่งข้อความแจ้งเตือนสั้น ๆ ว่าส่งคลิปสำเร็จแล้ว
              api.sendMessage("🎬 คลิปของคุณพร้อมแล้ว! รับชมให้สนุกนะคะ 🎉", event.threadID);
            }
          }
        );
      } else {
        // กรณีไม่มีคลิปในข้อมูล
        api.sendMessage("ไม่พบคลิปจากแคปคัดในขณะนี้ค่ะ ลองใหม่อีกครั้งนะคะ", event.threadID);
      }
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการดึงคลิป:', error);
      api.sendMessage("ไม่สามารถดึงคลิปได้ในขณะนี้ค่ะ กรุณาลองใหม่อีกครั้ง", event.threadID);
    }
  }
};
