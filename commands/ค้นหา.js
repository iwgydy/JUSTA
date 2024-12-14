const axios = require('axios');

module.exports = {
    config: {
        name: "ค้นหา",
        description: "ค้นหาวิดีโอ TikTok และแสดงลิงก์ดาวน์โหลด",
        usage: "/tiktok <คำค้นหา>",
        access: "ทุกคน"
    },
    run: async ({ api, event, args }) => {
        const threadID = event.threadID;
        const messageID = event.messageID;

        if (!args.length) {
            return api.sendMessage("❗ โปรดระบุคำค้นหาของคุณ เช่น `/tiktok ปรารถนาสิ่งใด`", threadID, messageID);
        }

        const query = args.join(' '); // รวบรวมคำค้นหาจากผู้ใช้

        // แสดงข้อความ "⏳ กำลังค้นหา..."
        api.sendMessage("⏳ กำลังค้นหา TikTok วิดีโอ...", threadID, async (err, info) => {
            if (err) return console.error(`❌ ไม่สามารถส่งข้อความ "กำลังค้นหา..." ได้: ${err.message}`);

            try {
                // เรียก API TikTok
                const response = await axios.get(`https://nash-api.onrender.com/api/tiktok`, {
                    params: { query: query },
                    timeout: 0 // ไม่มีการจำกัดเวลา
                });

                // ลบข้อความ "⏳ กำลังค้นหา..."
                api.deleteMessage(info.messageID, (deleteErr) => {
                    if (deleteErr) console.error(`❌ ไม่สามารถลบข้อความ "กำลังค้นหา..." ได้: ${deleteErr.message}`);
                });

                // ตรวจสอบข้อมูลที่ได้รับจาก API
                if (response.data) {
                    const { title, cover, no_watermark, watermark, music } = response.data;

                    // ส่งข้อความข้อมูล TikTok
                    const message = `
🎥 **${title}**
🌟 **ดาวน์โหลดวิดีโอ:**
    - [ไม่มีลายน้ำ](${no_watermark})
    - [มีลายน้ำ](${watermark})
🎵 **เพลง:** [ฟังเพลงนี้](${music})
📸 **ภาพหน้าปก:** [ดูภาพปก](${cover})
                    `;
                    api.sendMessage(message, threadID);
                } else {
                    api.sendMessage("❗ ไม่พบวิดีโอ TikTok ที่ตรงกับคำค้นหาของคุณ", threadID);
                }
            } catch (error) {
                console.error(`❌ เกิดข้อผิดพลาดในการติดต่อ TikTok API: ${error.message}`);

                // ลบข้อความ "⏳ กำลังค้นหา..." กรณีมีข้อผิดพลาด
                api.deleteMessage(info.messageID, (deleteErr) => {
                    if (deleteErr) console.error(`❌ ไม่สามารถลบข้อความ "กำลังค้นหา..." ได้: ${deleteErr.message}`);
                });

                // ส่งข้อความแจ้งข้อผิดพลาด
                api.sendMessage("❗ เกิดข้อผิดพลาดในการติดต่อ TikTok API โปรดลองใหม่อีกครั้งภายหลัง", threadID);
            }
        });
    }
};
