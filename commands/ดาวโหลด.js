const { loadImage, createCanvas } = require("canvas");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports.config = {
    name: "pair",
    version: "1.0.0",
    hasPermssion: 0,
    credits: "xemon",
    description: "จับคู่ผู้ใช้สองคนในห้องสนทนาและแสดงผลลัพธ์ด้วยภาพ",
    commandCategory: "love",
    usages: "",
    cooldowns: 5
};

module.exports.run = async function({ api, event, args, usersData, threadsData }) {
    try {
        const tmpDir = path.join(__dirname, "tmp");
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir);
        }

        let pathImg = path.join(tmpDir, "background.png");
        let pathAvt1 = path.join(tmpDir, "Avtmot.png");
        let pathAvt2 = path.join(tmpDir, "Avthai.png");

        const senderID = event.senderID;
        const threadID = event.threadID;

        // ดึงข้อมูลห้องสนทนา
        const threadInfo = await api.getThreadInfo(threadID);
        const allUsers = threadInfo.userInfo;

        if (allUsers.length < 2) {
            return api.sendMessage(
                "💔 ต้องมีผู้ใช้อย่างน้อย 2 คนในห้องสนทนาเพื่อทำการจับคู่!",
                threadID,
                event.messageID
            );
        }

        // ดึงข้อมูลผู้ส่งคำสั่ง
        const senderInfo = await getUserName(api, senderID);
        const senderName = senderInfo || "คุณ";

        // ดึงข้อมูลเพศของผู้ส่งคำสั่ง
        let senderGender = "UNKNOWN";
        for (let user of allUsers) {
            if (user.id == senderID) {
                senderGender = user.gender;
                break;
            }
        }

        // ดึง ID ของบอท
        const botID = await api.getCurrentUserID();

        // สร้างรายชื่อผู้สมัครจับคู่ตามเพศ
        let candidates = [];
        if (senderGender === "FEMALE") {
            candidates = allUsers.filter(
                (user) => user.gender === "MALE" && user.id !== senderID && user.id !== botID
            );
        } else if (senderGender === "MALE") {
            candidates = allUsers.filter(
                (user) => user.gender === "FEMALE" && user.id !== senderID && user.id !== botID
            );
        } else {
            candidates = allUsers.filter(
                (user) => user.id !== senderID && user.id !== botID
            );
        }

        if (candidates.length === 0) {
            return api.sendMessage(
                "❌ ไม่มีผู้ใช้ที่เหมาะสมสำหรับการจับคู่ในห้องสนทนา",
                threadID,
                event.messageID
            );
        }

        // เลือกผู้ใช้แบบสุ่มจากผู้สมัคร
        const pairedUser = candidates[Math.floor(Math.random() * candidates.length)];
        const pairedUserID = pairedUser.id;
        const pairedUserName = await getUserName(api, pairedUserID);

        // สร้างเปอร์เซ็นต์ความสัมพันธ์
        const relationshipPercentage = generateRelationshipPercentage();

        // เลือกภาพพื้นหลังแบบสุ่ม
        const backgrounds = [
            "https://i.postimg.cc/wjJ29HRB/background1.png",
            "https://i.postimg.cc/zf4Pnshv/background2.png",
            "https://i.postimg.cc/5tXRQ46D/background3.png",
        ];
        const selectedBackground = backgrounds[Math.floor(Math.random() * backgrounds.length)];

        // ดาวน์โหลดรูปภาพพื้นหลังและรูปโปรไฟล์ของผู้ใช้ทั้งสอง
        await downloadImage(selectedBackground, pathImg);
        await downloadImage(
            `https://graph.facebook.com/${senderID}/picture?width=720&height=720&access_token=YOUR_ACCESS_TOKEN`,
            pathAvt1
        );
        await downloadImage(
            `https://graph.facebook.com/${pairedUserID}/picture?width=720&height=720&access_token=EAAPr8hvPWZAwBO8YY5pAmQFyL3RUkwFomJ9SVhmJGh1eAfcJOQkTnJbcn9NbwQ8PnArAIJ2AlfzNBxMiQkuwZAZAEtzBLr8Xu5Hvmx72WQC1ZBZAtuT9YpMuhX53vX5pgsA1ZBDEeVISxg3quy8iPwyyvcFdSnRfP8TIhVNWFa1oTWcLbnWrIAtSAdOXWKktrrpcPO0U54Ql4XeUdun6HIeZBaIiXwZD`,
            pathAvt2
        );

        // สร้างภาพรวมด้วย Canvas
        const baseImage = await loadImage(pathImg);
        const baseAvt1 = await loadImage(pathAvt1);
        const baseAvt2 = await loadImage(pathAvt2);
        const canvas = createCanvas(baseImage.width, baseImage.height);
        const ctx = canvas.getContext("2d");

        // วาดภาพพื้นหลัง
        ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

        // วาดรูปโปรไฟล์ของผู้ใช้ทั้งสอง
        const avatarWidth = 300;
        const avatarHeight = 300;
        ctx.drawImage(baseAvt1, 100, 150, avatarWidth, avatarHeight);
        ctx.drawImage(baseAvt2, canvas.width - 100 - avatarWidth, 150, avatarWidth, avatarHeight);

        // เพิ่มข้อความเปอร์เซ็นต์ความสัมพันธ์
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "50px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`${relationshipPercentage}%`, canvas.width / 2, canvas.height - 100);

        // บันทึกภาพที่สร้างขึ้น
        const imageBuffer = canvas.toBuffer();
        fs.writeFileSync(pathImg, imageBuffer);

        // ส่งข้อความพร้อมภาพ
        api.sendMessage(
            {
                body: `🥰 การจับคู่สำเร็จ!\n${senderName} 💌 ขอให้คุณทั้งคู่มีความสุขกันนาน 200 ปี 💕\n${pairedUserName}.\n\n📊 โอกาสความสัมพันธ์: ${relationshipPercentage}%`,
                mentions: [
                    {
                        tag: `${pairedUserName}`,
                        id: pairedUserID,
                    },
                ],
                attachment: fs.createReadStream(pathImg),
            },
            threadID,
            () => {
                fs.unlinkSync(pathImg);
                fs.unlinkSync(pathAvt1);
                fs.unlinkSync(pathAvt2);
            },
            event.messageID
        );
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในคำสั่ง pair:", error);
        return api.sendMessage(
            "❌ เกิดข้อผิดพลาดในการจับคู่ กรุณาลองใหม่อีกครั้ง!",
            event.threadID,
            event.messageID
        );
    }
};

// ฟังก์ชันช่วยเหลือในการดาวน์โหลดรูปภาพ
async function downloadImage(url, path) {
    try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        fs.writeFileSync(path, Buffer.from(response.data, "binary"));
    } catch (error) {
        console.error(`ไม่สามารถดาวน์โหลดรูปภาพจาก ${url}:`, error);
        throw new Error(`ไม่สามารถดาวน์โหลดรูปภาพจาก ${url}`);
    }
}

// ฟังก์ชันช่วยเหลือในการดึงชื่อผู้ใช้
async function getUserName(api, userID) {
    try {
        const userInfo = await api.getUserInfo(userID);
        return userInfo[userID].name || "ผู้ใช้";
    } catch (error) {
        console.error(`ไม่สามารถดึงชื่อของผู้ใช้ ${userID}:`, error);
        return "ผู้ใช้";
    }
}

// ฟังก์ชันช่วยเหลือในการสร้างเปอร์เซ็นต์ความสัมพันธ์
function generateRelationshipPercentage() {
    const basePercentage = Math.floor(Math.random() * 100) + 1;
    const modifiers = ["0", "-1", "99.99", "-99", "-100", "101", "0.01"];
    const randomModifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    let finalPercentage = parseFloat(basePercentage);

    if (!isNaN(parseFloat(randomModifier))) {
        finalPercentage += parseFloat(randomModifier);
    }

    // จำกัดค่าเปอร์เซ็นต์ให้อยู่ในช่วง 0-100
    finalPercentage = Math.min(Math.max(finalPercentage, 0), 100);

    return Math.floor(finalPercentage);
}
