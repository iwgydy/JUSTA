// commands/ตั้งเวลา.js
const moment = require('moment-timezone'); // ใช้สำหรับจัดการเวลา
moment.tz.setDefault('Asia/Bangkok'); // ตั้งค่าโซนเวลาเป็นไทย

module.exports = {
    config: {
        name: "ตั้งเวลา",
        description: "ตั้งเตือนเวลาในอนาคต (ระบุเวลาเป็น HH:mm หรือ X นาที)",
        usage: "/ตั้งเวลา [เวลา/นาที] [ข้อความ]",
        example: "/ตั้งเวลา 10:30 นัดประชุมทีม\n/ตั้งเวลา 30 นัดประชุมทีม"
    },
    run: async ({ api, event, args }) => {
        const [timeInput, ...messageParts] = args;
        const message = messageParts.join(' ');

        if (!timeInput || !message) {
            return api.sendMessage(
                "⚠️ กรุณากรอกข้อมูลให้ครบถ้วน\nตัวอย่าง: /ตั้งเวลา 10:30 นัดประชุมทีม\nหรือ /ตั้งเวลา 30 นัดประชุมทีม",
                event.threadID
            );
        }

        let targetTime;

        // ตรวจสอบว่าผู้ใช้ระบุเวลาเป็นนาทีหรือไม่
        if (/^\d+$/.test(timeInput)) {
            const minutes = parseInt(timeInput);
            if (minutes <= 0) {
                return api.sendMessage(
                    "⚠️ กรุณาระบุจำนวนนาทีที่มากกว่า 0",
                    event.threadID
                );
            }
            targetTime = moment().add(minutes, 'minutes');
        } else {
            // ถ้าไม่ใช่ตัวเลข ให้ถือว่าเป็นเวลาในรูปแบบ HH:mm
            targetTime = moment(timeInput, "HH:mm");
            if (!targetTime.isValid()) {
                return api.sendMessage(
                    "⚠️ เวลาไม่ถูกต้อง กรุณากรอกในรูปแบบ HH:mm (เช่น 10:30) หรือระบุจำนวนนาที (เช่น 30)",
                    event.threadID
                );
            }
        }

        // คำนวณเวลาที่เหลือ
        const now = moment();
        const duration = moment.duration(targetTime.diff(now));

        if (duration.asMilliseconds() <= 0) {
            return api.sendMessage(
                "⚠️ เวลาที่ระบุผ่านไปแล้ว กรุณากรอกเวลาในอนาคต",
                event.threadID
            );
        }

        // แจ้งเตือนเมื่อถึงเวลา
        setTimeout(async () => {
            await api.sendMessage(
                `⏰ เตือนเวลา: ${message}`,
                event.threadID
            );
        }, duration.asMilliseconds());

        await api.sendMessage(
            `✅ ตั้งเวลาเรียบร้อย!\nจะแจ้งเตือนเมื่อถึงเวลา ${targetTime.format("HH:mm")} (อีกประมาณ ${Math.floor(duration.asMinutes())} นาที)`,
            event.threadID
        );
    }
};
