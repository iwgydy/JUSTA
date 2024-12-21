const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
    config: {
        name: "เจอไนท์",
        description: "ตอบข้อความพร้อมเสียงในธีมคริสต์มาส 2025 🎄",
        usage: "เจอไนท์ [ข้อความ]",
    },
    run: async ({ api, event, args }) => {
        if (args.length === 0) {
            return api.sendMessage("🎅 กรุณาพิมพ์คำถามหรือข้อความสำหรับเจอไนท์ 🎄", event.threadID);
        }

        const userInput = args.join(" ").trim();
        const firebaseURL = "https://goak-71ac8-default-rtdb.firebaseio.com/responses.json";

        try {
            // ดึงข้อมูลคำตอบจาก Firebase
            const response = await axios.get(firebaseURL);
            const data = response.data;

            if (data) {
                const matchedResponse = data[userInput] || "ผมไม่เข้าใจคำนี้ 🎁";

                // แปลงข้อความเป็นเสียง
                const audioPayload = {
                    text: matchedResponse,
                    speaker: "28",
                    volume: 2,
                    speed: 1,
                    type_media: "m4a",
                    save_file: "true",
                    language: "th",
                };

                const audioHeaders = {
                    "Bot-Token": "VTdiZmFiYzMyYTg3M2VkY2QzNmU4N2FmMzIwOGUxNmI4NTYxODk0",
                    "Content-Type": "application/json",
                };

                const audioResponse = await axios.post(
                    "https://api.botnoi.ai/openapi/v1/generate_audio",
                    audioPayload,
                    { headers: audioHeaders }
                );

                if (audioResponse.data && audioResponse.data.data && audioResponse.data.data.url) {
                    const audioUrl = audioResponse.data.data.url;

                    // ดาวน์โหลดไฟล์เสียง
                    const filePath = path.resolve(__dirname, `${Date.now()}-response.m4a`);
                    const writer = fs.createWriteStream(filePath);
                    const downloadResponse = await axios({
                        url: audioUrl,
                        method: "GET",
                        responseType: "stream",
                    });

                    downloadResponse.data.pipe(writer);

                    writer.on("finish", () => {
                        // ส่งข้อความพร้อมไฟล์เสียง
                        api.sendMessage(
                            {
                                body: `🎄 *Merry Christmas 2025!*\n🎅 เจอไนท์: ${matchedResponse}`,
                                attachment: fs.createReadStream(filePath),
                            },
                            event.threadID,
                            () => {
                                // ลบไฟล์เสียงหลังส่งสำเร็จ
                                fs.unlinkSync(filePath);
                            }
                        );
                    });

                    writer.on("error", (err) => {
                        console.error("❌ เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์เสียง:", err);
                        api.sendMessage("❌ ไม่สามารถส่งไฟล์เสียงได้ 🎄", event.threadID);
                    });
                } else {
                    return api.sendMessage(
                        "❌ ไม่สามารถแปลงข้อความเป็นเสียงได้ กรุณาลองใหม่ 🎄",
                        event.threadID
                    );
                }
            }
        } catch (error) {
            console.error("❌ เกิดข้อผิดพลาด:", error.message);
            return api.sendMessage(
                "❌ ไม่สามารถประมวลผลข้อความหรือแปลงเสียงได้ กรุณาลองใหม่ 🎄",
                event.threadID
            );
        }
    },
};
