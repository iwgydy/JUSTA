const request = require('request');
const fs = require('fs');
const path = require('path');

module.exports.config = {
    name: "เสียง", // ชื่อคำสั่งภาษาไทย
    description: "แปลงข้อความเป็นเสียงพูด",
    usage: "เสียง <ข้อความ>", // วิธีใช้งาน
};

module.exports.run = async ({ api, event, args }) => {
    const ข้อความ = args.join(" "); // รวมข้อความทั้งหมดที่พิมพ์หลังคำสั่ง
    if (!ข้อความ) {
        return api.sendMessage("❗ กรุณาใส่ข้อความที่ต้องการแปลงเป็นเสียง", event.threadID);
    }

    api.sendMessage("⏳ กำลังแปลงข้อความเป็นเสียง...", event.threadID);

    // เรียกใช้งาน API
    const ตัวเลือก = {
        method: 'POST',
        url: 'https://api-voice.botnoi.ai/openapi/v1/generate_audio',
        body: JSON.stringify({
            text: ข้อความ,
            speaker: "2", // เลือกเสียงที่ต้องการ
            volume: 1,
            speed: 1,
            type_media: "mp3",
            save_file: "true",
            language: "th"
        }),
        headers: {
            'Botnoi-Token': 'UUxZVGZMV21YWVVTS0ZIN1hnVDFCRVdCYmYyMzU2MTg5NA==',
            'Content-Type': 'application/json'
        }
    };

    request(ตัวเลือก, (ข้อผิดพลาด, การตอบกลับ) => {
        if (ข้อผิดพลาด) {
            return api.sendMessage(`❌ เกิดข้อผิดพลาด: ${ข้อผิดพลาด.message}`, event.threadID);
        }

        try {
            const ผลลัพธ์ = JSON.parse(การตอบกลับ.body.toString('utf-8')); // แปลง Byte String เป็น JSON
            const ไฟล์เสียง = ผลลัพธ์.audio_url; // URL ไฟล์เสียง

            if (!ไฟล์เสียง) {
                return api.sendMessage("❗ ไม่พบไฟล์เสียงที่สร้างขึ้น", event.threadID);
            }

            // ดาวน์โหลดไฟล์เสียงชั่วคราว
            const ที่เก็บไฟล์ = path.join(__dirname, "เสียง.mp3"); // เปลี่ยนเป็น .mp3 ตาม API
            const ไฟล์ = fs.createWriteStream(ที่เก็บไฟล์);

            request(ไฟล์เสียง).pipe(ไฟล์).on('finish', () => {
                api.sendMessage({
                    body: "🎙️ นี่คือเสียงที่แปลงจากข้อความ:",
                    attachment: fs.createReadStream(ที่เก็บไฟล์)
                }, event.threadID, () => {
                    fs.unlinkSync(ที่เก็บไฟล์); // ลบไฟล์หลังส่งเสร็จ
                });
            });
        } catch (ข้อผิดพลาด) {
            api.sendMessage("❌ เกิดข้อผิดพลาดในการแปลงไฟล์เสียง", event.threadID);
        }
    });
};
