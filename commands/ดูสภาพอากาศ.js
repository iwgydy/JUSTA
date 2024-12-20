const axios = require("axios");

module.exports.config = {
    name: "ดูสภาพอากาศ",
    version: "1.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "ดูสภาพอากาศปัจจุบันพร้อมพยากรณ์อากาศ",
    commandCategory: "utility",
    usages: "ดูสภาพอากาศ <จังหวัด>",
    cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
    try {
        const location = args.join(" ");
        if (!location) {
            return api.sendMessage("❗ กรุณาระบุชื่อจังหวัดที่ต้องการดูสภาพอากาศ", event.threadID, event.messageID);
        }

        const url = `https://kaiz-apis.gleeze.com/api/weather?q=${encodeURIComponent(location)}`;
        const response = await axios.get(url);
        const weatherData = response.data["0"];

        if (!weatherData) {
            return api.sendMessage("❌ ไม่พบข้อมูลสภาพอากาศสำหรับจังหวัดนี้", event.threadID, event.messageID);
        }

        const { location: loc, current, forecast } = weatherData;

        // ข้อความสภาพอากาศ
        let message = `🎄✨ สภาพอากาศในธีมคริสต์มาส ✨🎄\n\n`;
        message += `📍 สถานที่: ${loc.name}\n`;
        message += `🌡 อุณหภูมิ: ${current.temperature}°C\n`;
        message += `☀️ สภาพอากาศ: ${current.skytext}\n`;
        message += `💧 ความชื้น: ${current.humidity}%\n`;
        message += `💨 ลม: ${current.winddisplay}\n`;
        message += `📅 วันที่: ${current.date} เวลา: ${current.observationtime}\n\n`;
        message += `🔮 พยากรณ์อากาศ:\n`;

        forecast.forEach(day => {
            message += `📅 ${day.shortday} (${day.date}): ${day.low}°C - ${day.high}°C (${day.skytextday})\n`;
        });

        // ส่งข้อความกลับไปในแชท
        api.sendMessage(message, event.threadID, event.messageID);

    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการดึงข้อมูลสภาพอากาศ:", error);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการดึงข้อมูล กรุณาลองใหม่อีกครั้ง", event.threadID, event.messageID);
    }
};
