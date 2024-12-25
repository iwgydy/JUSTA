module.exports = {
    config: {
        name: 'Greet',
        eventType: ['message'], // ระบุประเภทของเหตุการณ์ที่ต้องการฟัง
    },
    run: async ({ api, event }) => {
        const message = event.body ? event.body.trim() : '';

        // ตรวจสอบว่าข้อความเป็น "สวัสดี" หรือไม่
        if (message === 'สวัสดี') {
            const replyMessage = 'สวัสดีครับ! 🎄 Merry Christmas 2025! ขอให้มีความสุขในช่วงเทศกาลนี้นะครับ 🎁';
            api.sendMessage(replyMessage, event.threadID);
        }
    }
};
