const axios = require("axios");

module.exports.config = {
    name: "autoReply",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "ตอบกลับอัตโนมัติเมื่อมีคนพิมพ์ 'สวัสดี'",
    eventType: ["message"], // ตรวจจับเหตุการณ์ข้อความที่ส่งมา
    dependencies: {
        "axios": ""
    }
};

module.exports.run = async function({ api, event }) {
    const { threadID, senderID, body } = event;

    // ตรวจสอบว่าข้อความที่ส่งมาเป็น "สวัสดี" หรือไม่
    if (body && body.trim().toLowerCase() === "สวัสดี") {
        const gifURL = "https://img5.pic.in.th/file/secure-sv1/398502724_304556509125422_4209979906563284242_n1471681079abbfbf.gif";

        const replyMessage = `
สวัสดีครับ/ค่ะ! 😊
หวังว่าคุณจะมีวันที่ดี!
หากต้องการความช่วยเหลือ ให้พิมพ์คำว่า "help" ได้เลยครับ!
`;

        try {
            // ส่งข้อความตอบกลับพร้อม GIF
            await api.sendMessage({
                body: replyMessage,
                attachment: (await axios.get(gifURL, { responseType: "stream" })).data
            }, threadID);
            console.log(`ตอบกลับ 'สวัสดี' ให้กับผู้ใช้งานในกลุ่ม`);
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการส่งข้อความตอบกลับ:", error);
        }
    }
};
