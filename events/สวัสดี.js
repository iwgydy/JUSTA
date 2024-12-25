const axios = require("axios");

module.exports.config = {
    name: "autoReply",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "ตอบกลับอัตโนมัติเมื่อมีคนพิมพ์ 'สวัสดี'",
    eventType: ["message"], // ตรวจจับข้อความ
    dependencies: {
        "axios": ""
    }
};

module.exports.run = async function({ api, event }) {
    const { threadID, senderID, body } = event;

    // ตรวจสอบว่าข้อความมีคำว่า "สวัสดี"
    if (body && body.toLowerCase().includes("สวัสดี")) {
        const gifURL = "https://img5.pic.in.th/file/secure-sv1/398502724_304556509125422_4209979906563284242_n1471681079abbfbf.gif";

        const replyMessage = `
สวัสดีครับ/ค่ะ! 😊
หวังว่าคุณจะมีวันที่ดี!
หากต้องการความช่วยเหลือ พิมพ์ "help" ได้เลยครับ!
`;

        try {
            // ส่งข้อความตอบกลับ
            const gifStream = (await axios.get(gifURL, { responseType: "stream" })).data;
            await api.sendMessage({
                body: replyMessage,
                attachment: gifStream
            }, threadID);
            console.log(`ตอบกลับข้อความ 'สวัสดี' ในกลุ่ม`);
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการส่งข้อความ:", error);
        }
    }
};
