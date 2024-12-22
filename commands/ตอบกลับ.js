// ตัวอย่างไฟล์ commands/autoreply.js
module.exports.config = {
    name: "autoreply",
    description: "เปิดหรือปิดโหมดตอบกลับอัตโนมัติ"
};

module.exports.run = async ({ api, event, args }) => {
    // ถ้าใช้ /autoreply on
    if (args[0] === "on") {
        global.autoReplyThreads[event.threadID] = true;
        return api.sendMessage("เปิดโหมดตอบกลับอัตโนมัติในห้องนี้แล้ว", event.threadID, event.messageID);
    }
    // ถ้าใช้ /autoreply off
    else if (args[0] === "off") {
        global.autoReplyThreads[event.threadID] = false;
        return api.sendMessage("ปิดโหมดตอบกลับอัตโนมัติในห้องนี้แล้ว", event.threadID, event.messageID);
    }
    // ถ้าไม่ได้พิมพ์ on/off
    else {
        return api.sendMessage(
            "โปรดพิมพ์: autoreply on หรือ autoreply off",
            event.threadID,
            event.messageID
        );
    }
};
