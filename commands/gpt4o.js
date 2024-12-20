const axios = require("axios");

module.exports = {
    config: {
        name: "gpt4o",
        description: "คุยกับ GPT-4O และสร้างภาพจากข้อความพร้อมตอบกลับ",
    },
    run: async ({ api, event, args }) => {
        const query = args.join(" ");
        if (!query) {
            return api.sendMessage("⛔ กรุณากรอกข้อความที่ต้องการถาม GPT-4O", event.threadID);
        }

        const apiUrl = `https://kaiz-apis.gleeze.com/api/gpt-4o-pro?q=${encodeURIComponent(query)}&uid=1&imageUrl=`;
        const startTime = Date.now(); // เริ่มจับเวลาการประมวลผล

        // แจ้งสถานะเริ่มต้น
        const statusMsg = await api.sendMessage("⚙️ กำลังดำเนินการ... โปรดรอสักครู่ ⏳", event.threadID);

        try {
            const response = await axios.get(apiUrl);
            const data = response.data;

            const endTime = Date.now(); // จับเวลาหลังการประมวลผลเสร็จสิ้น
            const processingTime = ((endTime - startTime) / 1000).toFixed(2); // คำนวณเวลาเป็นวินาที
            const rightAlignedTime = `🕒 ${processingTime}`;

            if (data && data.response) {
                const imageRegex = /\!.*?(.*?)/;
                const match = imageRegex.exec(data.response);

                if (match && match[1]) {
                    const imageUrl = match[1];
                    const cleanedResponse = data.response.replace(imageRegex, "").trim();

                    const messageBody = `${rightAlignedTime}\n\n✨ GPT-4O ตอบกลับ:\n![Generated Image](${imageUrl})`;

                    api.sendMessage(messageBody, event.threadID, () => {
                        api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
                    });
                } else {
                    const cleanedResponse = data.response.replace(/TOOL_CALL:.*?\n/g, "").trim();
                    const messageBody = `${rightAlignedTime}\n\n✨ GPT-4O ตอบกลับ:\n${cleanedResponse}`;
                    api.sendMessage(messageBody, event.threadID);
                    api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
                }
            } else {
                const messageBody = `${rightAlignedTime}\n\n❗ ไม่สามารถรับการตอบกลับจาก GPT-4O ได้ในขณะนี้`;
                api.sendMessage(messageBody, event.threadID);
                api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
            }
        } catch (error) {
            const endTime = Date.now(); // จับเวลาหลังจากเกิดข้อผิดพลาด
            const processingTime = ((endTime - startTime) / 1000).toFixed(2); // คำนวณเวลาเป็นวินาที
            const rightAlignedTime = `🕒 ${processingTime}`;
            console.error("เกิดข้อผิดพลาดในการเชื่อมต่อกับ API:", error);
            const messageBody = `${rightAlignedTime}\n\n❗ ขออภัย, เกิดข้อผิดพลาดในการเชื่อมต่อกับ GPT-4O`;
            api.sendMessage(messageBody, event.threadID);
            api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
        }
    },
};
