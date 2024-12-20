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

            // สำหรับการดีบัก: ตรวจสอบการตอบกลับ
            console.log("API Response:", data);

            const endTime = Date.now(); // จับเวลาหลังการประมวลผลเสร็จสิ้น
            const processingTime = ((endTime - startTime) / 1000).toFixed(2); // คำนวณเวลาเป็นวินาที
            const rightAlignedTime = `🕒 ${processingTime}`; // ไม่ต้อง padStart เนื่องจากอาจไม่จำเป็น

            if (data && data.response) {
                // ปรับปรุง regex หรือวิธีการดึง URL ของภาพให้ตรงกับรูปแบบการตอบกลับจริง
                // ตัวอย่างนี้สมมุติว่า URL ของภาพอยู่ใน data.imageUrl
                let imageUrl = null;

                // สมมุติว่า data.imageUrl มี URL ของภาพ
                if (data.imageUrl) {
                    imageUrl = data.imageUrl;
                } else {
                    // ถ้าไม่มี data.imageUrl ลองใช้ regex เพื่อดึง URL จาก data.response
                    const imageRegex = /!.*?(https?:\/\/.*?)/;
                    const match = imageRegex.exec(data.response);
                    if (match && match[1]) {
                        imageUrl = match[1];
                    }
                }

                if (imageUrl) {
                    // กำหนดเส้นทางสำหรับเก็บภาพชั่วคราว
                    const imagePath = path.join(__dirname, `../../temp/${Date.now()}.jpg`);

                    // ดาวน์โหลดรูปภาพ
                    const writer = fs.createWriteStream(imagePath);
                    const imageResponse = await axios({
                        url: imageUrl,
                        method: "GET",
                        responseType: "stream",
                    });

                    imageResponse.data.pipe(writer);

                    // รอจนดาวน์โหลดเสร็จ
                    await new Promise((resolve, reject) => {
                        writer.on("finish", resolve);
                        writer.on("error", reject);
                    });

                    // ส่งข้อความพร้อมแนบภาพ
                    api.sendMessage({
                        body: `${rightAlignedTime}\n\n✨ GPT-4O ตอบกลับ:`,
                        attachment: fs.createReadStream(imagePath),
                    }, event.threadID, () => {
                        // ลบไฟล์ภาพหลังจากส่งเสร็จ
                        fs.unlinkSync(imagePath);
                        // ลบข้อความสถานะ
                        api.deleteMessage(statusMsg.messageID);
                    });

                } else {
                    // ถ้าไม่มี URL ของภาพ ส่งข้อความตอบกลับแบบไม่มีภาพ
                    const cleanedResponse = data.response.replace(/TOOL_CALL:.*?\n/g, "").trim();
                    const messageBody = `${rightAlignedTime}\n\n✨ GPT-4O ตอบกลับ:\n${cleanedResponse}`;
                    api.sendMessage(messageBody, event.threadID, () => {
                        api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
                    });
                }
            } else {
                const messageBody = `${rightAlignedTime}\n\n❗ ไม่สามารถรับการตอบกลับจาก GPT-4O ได้ในขณะนี้`;
                api.sendMessage(messageBody, event.threadID, () => {
                    api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
                });
            }
        } catch (error) {
            const endTime = Date.now(); // จับเวลาหลังจากเกิดข้อผิดพลาด
            const processingTime = ((endTime - startTime) / 1000).toFixed(2); // คำนวณเวลาเป็นวินาที
            const rightAlignedTime = `🕒 ${processingTime}`;
            console.error("เกิดข้อผิดพลาดในการเชื่อมต่อกับ API:", error);
            const messageBody = `${rightAlignedTime}\n\n❗ ขออภัย, เกิดข้อผิดพลาดในการเชื่อมต่อกับ GPT-4O`;
            api.sendMessage(messageBody, event.threadID, () => {
                api.deleteMessage(statusMsg.messageID); // ลบข้อความสถานะ
            });
        }
    },
};
