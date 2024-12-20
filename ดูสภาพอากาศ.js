const axios = require("axios");

module.exports = {
    config: {
        name: "ดูสภาพอากาศ",
        description: "ดูสภาพอากาศพร้อมข้อความในธีมคริสต์มาส",
    },
    run: async ({ api, event, args }) => {
        const location = args.join(" ") || "นครพนม"; // ใช้ "นครพนม" เป็นค่าเริ่มต้นถ้าไม่มีการระบุ
        const apiUrl = `https://kaiz-apis.gleeze.com/api/weather?q=${encodeURIComponent(location)}`;

        // แจ้งสถานะเริ่มต้น
        let statusMsg = null;
        try {
            statusMsg = await api.sendMessage("🎄 กำลังดึงข้อมูลสภาพอากาศ... โปรดรอสักครู่ ⛄", event.threadID);
        } catch (err) {
            console.error("ไม่สามารถส่งข้อความสถานะได้:", err);
            return;
        }

        try {
            // เรียก API
            const response = await axios.get(apiUrl);
            const data = response.data["0"]; // ใช้ข้อมูลที่ index 0

            if (!data || !data.current) {
                throw new Error("ไม่พบข้อมูลสภาพอากาศในพื้นที่ที่ระบุ");
            }

            // ข้อมูลปัจจุบัน
            const current = data.current;
            const forecast = data.forecast[0]; // ข้อมูลพยากรณ์สำหรับวันนี้
            const weatherIconUrl = current.imageUrl;

            // รูปแบบข้อความตอบกลับ
            const weatherMessage = `
🎅 **สภาพอากาศวันนี้ที่ ${data.location.name}** 🎁
📅 วันที่: ${current.date} (${current.day})
⏰ เวลาสังเกตการณ์: ${current.observationtime}

🌡️ อุณหภูมิ: ${current.temperature}°C
🌞 สภาพอากาศ: ${current.skytext}
💧 ความชื้น: ${current.humidity}%
🍃 ลม: ${current.winddisplay}
🌡️ รู้สึกเหมือน: ${current.feelslike}°C

🎄 **พยากรณ์วันนี้** 🎄
📉 ต่ำสุด: ${forecast.low}°C
📈 สูงสุด: ${forecast.high}°C
🌞 ท้องฟ้า: ${forecast.skytextday}
💦 โอกาสฝนตก: ${forecast.precip}%

❄️ ขอให้คุณมีวันที่สดใสและเต็มไปด้วยความอบอุ่นในธีมคริสต์มาส! 🎁
            `;

            // ส่งข้อความพร้อมรูป
            api.sendMessage(
                {
                    body: weatherMessage,
                    attachment: await axios({
                        url: weatherIconUrl,
                        method: "GET",
                        responseType: "stream",
                    }).then((res) => res.data),
                },
                event.threadID,
                async () => {
                    // ลบข้อความสถานะ
                    if (statusMsg && statusMsg.messageID) {
                        await api.deleteMessage(statusMsg.messageID);
                    }
                }
            );
        } catch (error) {
            console.error("เกิดข้อผิดพลาด:", error);

            // แจ้งข้อผิดพลาด
            api.sendMessage("❗ เกิดข้อผิดพลาดในการดึงข้อมูลสภาพอากาศ โปรดลองใหม่อีกครั้ง", event.threadID, async () => {
                // ลบข้อความสถานะ
                if (statusMsg && statusMsg.messageID) {
                    await api.deleteMessage(statusMsg.messageID);
                }
            });
        }
    },
};
