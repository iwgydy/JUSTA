const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
    name: "จับคู่วี2",
    version: "1.4.0",
    hasPermssion: 0,
    credits: "YourName",
    description: "จับคู่สมาชิกในกลุ่ม พร้อมแสดงเปอร์เซ็นต์ และทำภาพพิเศษหากเข้ากัน 100%",
    commandCategory: "fun",
    usages: "[ไม่มีพารามิเตอร์]",
    cooldowns: 5
};

module.exports.run = async function ({ api, event }) {
    try {
        const { threadID, senderID, messageID } = event;
        const threadInfo = await api.getThreadInfo(threadID);
        const members = threadInfo.participantIDs;

        if (members.length < 2) {
            return api.sendMessage("❌ สมาชิกในกลุ่มน้อยเกินไป ไม่สามารถจับคู่ได้!", threadID, messageID);
        }

        // ฟังก์ชันสุ่มสมาชิก
        const getRandomMember = (excludeID) => {
            const filtered = members.filter(id => id !== excludeID);
            return filtered[Math.floor(Math.random() * filtered.length)];
        };

        // ฟังก์ชันคำคมตามเปอร์เซ็นต์
        const getQuoteByPercentage = (percentage) => {
            if (percentage <= 10) return "ความรักแค่นี้ไม่พอหรอก ต้องเพิ่มความพยายามอีกหน่อยนะ! 🌱";
            if (percentage <= 30) return "รักนี้เหมือนต้นกล้า ต้องรดน้ำพรวนดินอีกสักพัก 🌿💚";
            if (percentage <= 50) return "เริ่มมีความหวังแล้วนะ ลองหมั่นดูแลกันบ่อยๆ น้า ✨🌻";
            if (percentage <= 70) return "ความรักเริ่มเบ่งบานแล้ว ทำให้ดีที่สุดนะ! 💕🌹";
            if (percentage <= 90) return "ความรักของคู่นี้ช่างหวานเหมือนน้ำผึ้งเลยล่ะ! 🍯💖";
            return "รักนี้สมบูรณ์แบบแล้ว เหมือนเกิดมาคู่กันเลย! 💍❤️";
        };

        const firstUser = senderID;
        const secondUser = getRandomMember(firstUser);

        const firstUserInfo = await api.getUserInfo(firstUser);
        const secondUserInfo = await api.getUserInfo(secondUser);

        const firstUserName = firstUserInfo[firstUser].name || "ไม่ทราบชื่อ";
        const secondUserName = secondUserInfo[secondUser].name || "ไม่ทราบชื่อ";

        const firstUserProfile = `https://graph.facebook.com/${firstUser}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        const secondUserProfile = `https://graph.facebook.com/${secondUser}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

        const matchPercentage = Math.floor(Math.random() * 100) + 1;
        const loveQuote = getQuoteByPercentage(matchPercentage);

        // สร้างภาพพิเศษถ้าเปอร์เซ็นต์เท่ากับ 100%
        if (matchPercentage === 100) {
            const backgroundImageUrl = "https://i.imgur.com/JGTkjSo.jpeg";
            const tmpPath = path.join(__dirname, "tmp");
            const outputImagePath = path.join(tmpPath, `special_love_${Date.now()}.png`);

            if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);

            // ดาวน์โหลดพื้นหลังและภาพคนที่สอง
            const [backgroundImage, secondUserImage] = await Promise.all([
                axios({ url: backgroundImageUrl, responseType: "arraybuffer" }),
                axios({ url: secondUserProfile, responseType: "arraybuffer" })
            ]);

            // ใช้ sharp เพื่อรวมภาพ
            await sharp(Buffer.from(backgroundImage.data))
                .composite([{ input: Buffer.from(secondUserImage.data), gravity: "center" }])
                .resize(1280, 720)
                .toFile(outputImagePath);

            // ส่งภาพพิเศษ
            return api.sendMessage({
                body: `💖 คู่แท้ของกลุ่มนี้คือ!\n\n✨ ${firstUserName} ❤️ ${secondUserName}\n💯 ความเข้ากันได้: ${matchPercentage}%\n💌 รักนี้เกิดมาเพื่อกันและกัน 💍❤️\n\nขอให้รักกันนานๆ นะ! 💕`,
                attachment: fs.createReadStream(outputImagePath)
            }, threadID, () => fs.unlinkSync(outputImagePath), messageID);
        }

        // ส่งข้อความธรรมดาพร้อมคำคม
        api.sendMessage({
            body: `💖 จับคู่สำเร็จ!\n\n✨ ${firstUserName} ❤️ ${secondUserName}\n💯 ความเข้ากันได้: ${matchPercentage}%\n💌 ${loveQuote}\n\nขอให้คู่นี้รักกันนานๆ น้า 💖`,
            attachment: [
                await axios.get(firstUserProfile, { responseType: "stream" }).then(res => res.data),
                await axios.get(secondUserProfile, { responseType: "stream" }).then(res => res.data)
            ]
        }, threadID, messageID);
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในคำสั่งจับคู่:", error);
        return api.sendMessage("❌ เกิดข้อผิดพลาดในการจับคู่ กรุณาลองใหม่!", event.threadID, event.messageID);
    }
};
