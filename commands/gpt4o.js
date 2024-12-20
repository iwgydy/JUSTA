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
        const startTime = Date.now();

        // ส่งข้อความสถานะ
        let statusMsg = null;
        try {
            statusMsg = await api.sendMessage("⚙️ กำลังดำเนินการ... โปรดรอสักครู่ ⏳", event.threadID);
            console.log("สถานะข้อความถูกส่ง:", statusMsg);
        } catch (err) {
            console.error("ไม่สามารถส่งข้อความสถานะได้:", err);
            return;
        }

        try {
            // เรียก API
            const response = await axios.get(apiUrl);
            const data = response.data;

            const endTime = Date.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            const rightAlignedTime = `🕒 ${processingTime}`;

            if (data && data.response) {
                let imageUrl = null;

                if (data.imageUrl) {
                    imageUrl = data.imageUrl;
                } else {
                    const imageRegex = /!.*?(https?:\/\/.*?)/;
                    const match = imageRegex.exec(data.response);
                    if (match && match[1]) {
                        imageUrl = match[1];
                    }
                }

                if (imageUrl) {
                    const imagePath = path.join(__dirname, `../../temp/${Date.now()}.jpg`);

                    const writer = fs.createWriteStream(imagePath);
                    const imageResponse = await axios({
                        url: imageUrl,
                        method: "GET",
                        responseType: "stream",
                    });

                    imageResponse.data.pipe(writer);
                    await new Promise((resolve, reject) => {
                        writer.on("finish", resolve);
                        writer.on("error", reject);
                    });

                    // ส่งภาพพร้อมข้อความ
                    await api.sendMessage(
                        {
                            body: `${rightAlignedTime}\n\n✨ GPT-4O ตอบกลับ:`,
                            attachment: fs.createReadStream(imagePath),
                        },
                        event.threadID
                    );

                    fs.unlinkSync(imagePath);
                } else {
                    // ส่งข้อความปกติ
                    const cleanedResponse = data.response.replace(/TOOL_CALL:.*?\n/g, "").trim();
                    await api.sendMessage(`${rightAlignedTime}\n\n✨ GPT-4O ตอบกลับ:\n${cleanedResponse}`, event.threadID);
                }
            } else {
                await api.sendMessage(`${rightAlignedTime}\n\n❗ ไม่สามารถรับการตอบกลับจาก GPT-4O ได้ในขณะนี้`, event.threadID);
            }
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการประมวลผล:", error);
            const endTime = Date.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            const rightAlignedTime = `🕒 ${processingTime}`;
            await api.sendMessage(`${rightAlignedTime}\n\n❗ เกิดข้อผิดพลาดในการประมวลผล`, event.threadID);
        } finally {
            // ลบข้อความสถานะ
            if (statusMsg && statusMsg.messageID) {
                try {
                    await api.deleteMessage(statusMsg.messageID);
                    console.log("ข้อความสถานะถูกลบสำเร็จ");
                } catch (err) {
                    console.error("ไม่สามารถลบข้อความสถานะได้:", err);
                }
            } else {
                console.warn("ไม่พบ messageID ของข้อความสถานะ");
            }
        }
    },
};
