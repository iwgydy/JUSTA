const axios = require("axios");

module.exports = {
    config: {
        name: "ดูสภาพอากาศ",
        description: "ดูสภาพอากาศพร้อมข้อความในธีมคริสต์มาส",
    },
    run: async ({ api, event, args }) => {
        const location = args.join(" ") || "นครพนม";
        const apiUrl = `https://kaiz-apis.gleeze.com/api/weather?q=${encodeURIComponent(location)}`;

        let statusMsg = null;
        try {
            statusMsg = await api.sendMessage("🎄 กำลังดึงข้อมูลสภาพอากาศ... โปรดรอสักครู่ ⛄", event.threadID);
        } catch (err) {
            console.error("ไม่สามารถส่งข้อความสถานะได้:", err);
            return;
        }

        try {
            const response = await axios.get(apiUrl);
            const data = response.data["0"] || response.data["1"];
            
            if (!data || !data.current) {
                throw new Error("ไม่พบข้อมูลสภาพอากาศในพื้นที่ที่ระบุ");
            }

            const current = data.current;
            const forecast = data.forecast[0];
            const weatherIconUrl = current.imageUrl || "default-image-url";

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
                    if (statusMsg && statusMsg.messageID) {
                        await api.deleteMessage(statusMsg.messageID);
                    }
                }
            );
        } catch (error) {
            console.error("เกิดข้อผิดพลาด:", error);
            api.sendMessage("❗ เกิดข้อผิดพลาดในการดึงข้อมูลสภาพอากาศ โปรดลองใหม่อีกครั้ง", event.threadID, async () => {
                if (statusMsg && statusMsg.messageID) {
                    await api.deleteMessage(statusMsg.messageID);
                }
            });
        }
    },
};
