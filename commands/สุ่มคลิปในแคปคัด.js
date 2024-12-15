const axios = require('axios');
const request = require('request');

module.exports = {
  config: {
    name: 'สุ่มคลิปแคปคัด',
    description: 'ส่งคลิปวิดีโอจากแอปแคปคัดแบบสุ่ม',
  },
  run: async ({ api, event }) => {
    try {
      const response = await axios.get('https://apis-david-mp-momn.onrender.com/api/edit');
      const data = response.data;

      // ดูโครงสร้างข้อมูลในคอนโซลเซิร์ฟเวอร์
      console.log("Data from API:", data);

      // จากนั้นดูใน Terminal ว่า data มีหน้าตาเป็นอย่างไร เช่น
      // data อาจจะเป็น { url: "https://..." } หรือ { clips: ["https://...", "https://..."] } หรืออื่น ๆ

      // สมมุติว่า API ส่งมาเป็นออบเจกต์ที่มีช่อง url หรือ fields อื่น ๆ
      // เช่น ถ้า API ส่งกลับมาเป็นรูปแบบ:
      // {
      //   "status": "success",
      //   "result": [
      //     "https://example.com/clip1.mp4",
      //     "https://example.com/clip2.mp4"
      //   ]
      // }
      //
      // ในกรณีนี้ คุณต้องแก้โค้ดให้เข้าถึง result เช่น:
      // const clips = data.result; // สมมุติว่าชื่อฟิลด์คือ result
      // แล้วค่อยสุ่มจาก clips

      // ตัวอย่างการปรับตามโครงสร้าง (สมมุติ)
      // หาก data.result เป็นอาเรย์ของคลิป
      // if (Array.isArray(data.result) && data.result.length > 0) {
      //   const randomClip = data.result[Math.floor(Math.random() * data.result.length)];
      //   api.sendMessage({ attachment: request(randomClip) }, event.threadID, (err) => {
      //     if (err) {
      //       console.error("ส่งคลิปไม่สำเร็จ:", err);
      //       api.sendMessage("ไม่สามารถส่งคลิปได้ในขณะนี้", event.threadID);
      //     } else {
      //       api.sendMessage("🎬 คลิปของคุณพร้อมแล้ว! รับชมให้สนุกนะคะ 🎉", event.threadID);
      //     }
      //   });
      // } else {
      //   api.sendMessage("ไม่พบคลิปที่สามารถใช้งานได้ในขณะนี้ค่ะ ลองใหม่อีกครั้งนะคะ", event.threadID);
      // }

    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการดึงคลิป:', error);
      api.sendMessage('ไม่สามารถดึงคลิปได้ในขณะนี้ค่ะ กรุณาลองใหม่อีกครั้ง', event.threadID);
    }
  }
}
