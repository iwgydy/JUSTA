module.exports = {
    config: {
        name: "ดูข้อมูลกลุ่ม",
        description: "แสดงข้อมูลเกี่ยวกับกลุ่ม",
        usage: "/ดูข้อมูลกลุ่ม",
    },
    run: async ({ api, event }) => {
        try {
            // ดึงข้อมูลกลุ่ม
            const threadInfo = await api.getThreadInfo(event.threadID);
            const { threadName, participantIDs, adminIDs, emoji, color } = threadInfo;

            // นับจำนวนสมาชิกและแอดมิน
            const totalMembers = participantIDs.length;
            const totalAdmins = adminIDs.length;

            // สร้างข้อความ
            const groupInfo = `
📌 **ชื่อกลุ่ม**: ${threadName || "ไม่มีชื่อ"}
🎨 **ไอคอนกลุ่ม**: ${emoji || "ไม่มี"}
🌈 **สีกลุ่ม**: ${color || "ไม่มี"}
👥 **จำนวนสมาชิก**: ${totalMembers} คน
👑 **จำนวนแอดมิน**: ${totalAdmins} คน
            `;

            // ส่งข้อความ
            api.sendMessage(groupInfo, event.threadID);
        } catch (error) {
            console.error(error);
            api.sendMessage("⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่ม", event.threadID);
        }
    }
};
