const { createCanvas } = require('canvas');

module.exports = {
    name: 'image',
    description: 'สร้างรูปภาพพร้อมข้อความจาก args',
    async execute(message, args) {
        if (!args.length) {
            return message.reply('กรุณากรอกข้อความด้วย เช่น !image สวัสดีครับ ทำไรอยู่');
        }

        // ข้อความที่ส่งเข้ามาจะถูกจับใส่เป็นบรรทัดๆ จาก args
        // ตัวอย่าง: "!image สวัสดีครับ ทำไรอยู่"
        // args = ["สวัสดีครับ", "ทำไรอยู่"]

        const width = 1080;
        const height = 720;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // วาดพื้นหลัง
        ctx.fillStyle = '#2d1c0e'; 
        ctx.fillRect(0, 0, width, height);

        // ตั้งค่าฟอนต์และสีข้อความ
        ctx.font = '48px sans-serif'; 
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';

        let x = width / 2;  // ตำแหน่งกึ่งกลางภาพ
        let y = 100;        // จุดเริ่มต้น Y
        const lineHeight = 60;

        args.forEach(line => {
            ctx.fillText(line, x, y);
            y += lineHeight;
        });

        // สร้างบัฟเฟอร์ภาพ
        const attachment = canvas.toBuffer();
        
        // ส่งภาพกลับไปในแชนแนล
        return message.channel.send({ files: [{ attachment, name: 'output.png' }] });
    }
};
