const axios = require("axios");
const fs = require("fs");
const path = require("path");

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

            const rightAlignedTime = `🕒 ${processingTime}`.padStart(25, " "); // จัดข้อความเวลาให้อยู่ด้านขวา

            if (data && data.response) {
                const imageRegex = /\!.*?(.*?)/;
                const match = imageRegex.exec(data.response);

                if (match && match[1]) {
                    const imageUrl = match[1];
                    const imagePath = path.join(__dirname, `../../temp/${Date.now()}.jpg`);

                    // ดาวน์โหลดรูปภาพ
                    const writer = fs.createWriteStream(imagePath);
                    const imageResponse = await axios({
                        url: imageUrl,
                        method: "GET",
                        responseType: "stream",
                    });

                    imageResponse.data.pipe(writer);

                    writer.on("finish", () => {
                        api.sendMessage({
                            body: `${rightAlignedTime}\n\n✨ GPT-4O ตอบกลับ:\nภาพที่สร้างขึ้นจากข้อความของคุณ`,
                            attachment: fs.createReadStream(imagePath),
                        }, event.threadID, () => {
                            fs.unlinkSync(imagePath); // ลบไฟล์หลังส่ง
                        });

                        api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
                    });

                    writer.on("error", (error) => {
                        console.error("เกิดข้อผิดพลาดในการดาวน์โหลดรูปภาพ:", error);
                        api.sendMessage(`${rightAlignedTime}\n\n❗ ไม่สามารถดาวน์โหลดรูปภาพได้`, event.threadID);
                        api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
                    });
                } else {
                    api.sendMessage(`${rightAlignedTime}\n\n✨ GPT-4O ตอบกลับ:\n${data.response}`, event.threadID);
                    api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
                }
            } else {
                api.sendMessage(`${rightAlignedTime}\n\n❗ ไม่สามารถรับการตอบกลับจาก GPT-4O ได้ในขณะนี้`, event.threadID);
                api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
            }
        } catch (error) {
            const endTime = Date.now(); // จับเวลาหลังจากเกิดข้อผิดพลาด
            const processingTime = ((endTime - startTime) / 1000).toFixed(2); // คำนวณเวลาเป็นวินาที
            const rightAlignedTime = `🕒 ${processingTime}`.padStart(25, " "); // จัดข้อความเวลาให้อยู่ด้านขวา
            console.error("เกิดข้อผิดพลาดในการเชื่อมต่อกับ API:", error);
            api.sendMessage(`${rightAlignedTime}\n\n❗ ขออภัย, เกิดข้อผิดพลาดในการเชื่อมต่อกับ GPT-4O`, event.threadID);
            api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
        }
    },
};
