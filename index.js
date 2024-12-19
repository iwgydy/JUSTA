const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const login = require('ryuu-fca-api'); // ตรวจสอบว่าติดตั้งแพ็กเกจนี้แล้ว
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // ปรับให้เหมาะสมกับความปลอดภัยของคุณ
        methods: ["GET", "POST"]
    }
});
const PORT = 3005;

let botCount = 0;
global.botSessions = {}; // เปลี่ยนจาก let เป็น global เพื่อให้สามารถเข้าถึงได้ในคำสั่ง
const commands = {};
const commandDescriptions = [];
const commandUsage = {}; // ติดตามการใช้งานคำสั่ง

const botsDir = path.join(__dirname, 'bots');

// สร้างโฟลเดอร์ bots ถ้ายังไม่มี
if (!fs.existsSync(botsDir)) {
    fs.mkdirSync(botsDir);
}

// โหลดคำสั่งจากโฟลเดอร์ commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    fs.readdirSync(commandsPath).forEach((file) => {
        if (file.endsWith(".js")) {
            const command = require(`./commands/${file}`);
            if (command.config && command.config.name) {
                commands[command.config.name.toLowerCase()] = command;
                commandDescriptions.push({
                    name: command.config.name,
                    description: command.config.description || "ไม่มีคำอธิบาย",
                });
                commandUsage[command.config.name.toLowerCase()] = 0; // เริ่มต้นตัวนับคำสั่ง
                console.log(`📦 โหลดคำสั่ง: ${command.config.name}`);
            }
        }
    });
}

// โหลดอีเวนต์จากโฟลเดอร์ events
const events = {};
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    fs.readdirSync(eventsPath).forEach((file) => {
        if (file.endsWith(".js")) {
            const event = require(`./events/${file}`);
            if (event.config && event.config.eventType) {
                event.config.eventType.forEach((type) => {
                    if (!events[type]) events[type] = [];
                    events[type].push(event);
                });
                console.log(`🔔 โหลดอีเวนต์: ${file}`);
            }
        }
    });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ฟังก์ชันช่วยเหลือในการสร้างรหัส 6 หลัก
function generate6DigitCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ฟังก์ชันช่วยเหลือในการสร้างข้อมูลบอทสำหรับการอัปเดตแบบเรียลไทม์
function generateBotData() {
    const totalBots = Object.keys(botSessions).length;
    const onlineBots = Object.values(botSessions).filter(bot => bot.status === 'online' || bot.status === 'active').length;
    const activeBots = Object.values(botSessions).filter(bot => bot.status === 'active').length;

    // สร้างแถวตารางบอทพร้อมข้อมูลปิงและสถานะใหม่
    const botRows = Object.entries(botSessions).map(([token, bot]) => `
        <tr id="bot-${encodeURIComponent(token)}">
            <td>
                <i class="fas fa-robot me-2" style="color: var(--primary-color);"></i>
                <span class="bot-name">${bot.name}</span>
            </td>
            <td>
                <span class="${getStatusClass(bot.status)}">
                    <i class="fas fa-circle"></i>
                    ${translateStatus(bot.status)}
                </span>
            </td>
            <td>
                <span class="runtime" data-start-time="${bot.startTime}">
                    กำลังคำนวณ...
                </span>
            </td>
            <td>
                <span class="ping">${bot.ping || 'N/A'} ms</span>
            </td>
            <td>
                <button class="btn btn-warning btn-sm edit-btn" data-token="${encodeURIComponent(token)}"><i class="fas fa-edit"></i> แก้ไข</button>
                <button class="btn btn-danger btn-sm delete-btn" data-token="${encodeURIComponent(token)}"><i class="fas fa-trash-alt"></i> ลบ</button>
                <button class="btn btn-secondary btn-sm restart-btn" data-token="${encodeURIComponent(token)}"><i class="fas fa-sync-alt"></i> รีสตาร์ท</button> <!-- ปุ่มรีสตาร์ท -->
            </td>
        </tr>
    `).join('') || `
        <tr>
            <td colspan="5" class="text-center">ไม่มีบอทที่กำลังทำงาน</td>
        </tr>
    `;

    return { 
        totalBots, 
        onlineBots, 
        activeBots, 
        botRows, 
        commandDescriptions, 
        websitePing 
    };
}

// ฟังก์ชันช่วยเหลือในการแปลสถานะเป็นข้อความ
function translateStatus(status) {
    switch(status) {
        case 'connecting':
            return 'กำลังเชื่อมต่อ';
        case 'online':
            return 'ออนไลน์';
        case 'active':
            return 'ทำงาน';
        case 'connection_failed':
            return 'เชื่อมต่อไม่สำเร็จ';
        case 'offline':
            return 'ออฟไลน์';
        default:
            return status;
    }
}

// ฟังก์ชันช่วยเหลือในการกำหนดคลาสสำหรับสถานะ
function getStatusClass(status) {
    switch(status) {
        case 'connecting':
            return 'status-connecting';
        case 'online':
            return 'status-online';
        case 'active':
            return 'status-active';
        case 'connection_failed':
            return 'status-connection-failed';
        case 'offline':
            return 'status-offline';
        default:
            return 'status-unknown';
    }
}

// ฟังก์ชันช่วยเหลือในการสร้างข้อมูลคำสั่ง
function generateCommandData() {
    const commandsData = Object.entries(commandUsage).map(([name, count]) => {
        const description = commandDescriptions.find(cmd => cmd.name.toLowerCase() === name)?.description || "ไม่มีคำอธิบาย";
        return `
            <tr>
                <td>${name}</td>
                <td>${count}</td>
                <td>${description}</td>
            </tr>
        `;
    }).join('') || `
        <tr>
            <td colspan="3" class="text-center">ไม่มีคำสั่งที่ถูกใช้งาน</td>
        </tr>
    `;

    return commandsData;
}

// โหลดบอทจากไฟล์ที่เก็บไว้เมื่อตอนเริ่มต้นเซิร์ฟเวอร์
function loadBotsFromFiles() {
    fs.readdirSync(botsDir).forEach(file => {
        if (file.endsWith('.json')) {
            const filePath = path.join(botsDir, file);
            try {
                const botData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                const { appState, token, name, startTime, password, adminID, prefix } = botData;
                startBot(appState, token, name, prefix, startTime, password, adminID, false).catch(err => {
                    console.error(`ไม่สามารถเริ่มต้นบอทจากไฟล์: ${filePath}, error=${err.message}`);
                });
            } catch (err) {
                console.error(`ไม่สามารถอ่านไฟล์บอท: ${filePath}, error=${err.message}`);
            }
        }
    });
}

// ตัวแปรสำหรับเก็บค่าปิงของเว็บไซต์
let websitePing = 0;

// ฟังก์ชันช่วยเหลือในการสร้างชื่อบอทที่สวยงาม
function generateBotName() {
    const adjectives = ["Super", "Mega", "Ultra", "Hyper", "Turbo", "Alpha", "Beta", "Gamma", "Delta"];
    const nouns = ["Dragon", "Phoenix", "Falcon", "Tiger", "Lion", "Eagle", "Shark", "Wolf", "Leopard"];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adjective}${noun}`;
}

// ฟังก์ชันสำหรับลบบอท
function deleteBot(token, emitDeleted = true) {
    const bot = botSessions[token];
    if (!bot) {
        console.log(chalk.red(`❌ ไม่พบบอทที่ต้องการลบ: ${token}`));
        return;
    }

    const { name } = bot;

    // ลบไฟล์บอท
    const botFilePath = path.join(botsDir, `${name.replace(/ /g, '_')}.json`);
    if (fs.existsSync(botFilePath)) {
        fs.unlinkSync(botFilePath);
        console.log(chalk.green(`✅ ลบไฟล์บอท: ${botFilePath}`));
    }

    // ลบจาก botSessions
    delete botSessions[token];
    console.log(chalk.green(`✅ ลบบอทจากระบบ: ${token}`));

    if (emitDeleted) {
        io.emit('updateBots', generateBotData());
        io.emit('botDeleted', name);
    }
}

// ฟังก์ชันเริ่มต้นบอท
async function startBot(appState, token, name, prefix, startTime, password, adminID, saveToFile = true) {
    return new Promise((resolve, reject) => {
        // ตั้งสถานะเป็น 'connecting' ก่อนเริ่มเชื่อมต่อ
        botSessions[token] = { 
            api: null, 
            name, 
            prefix,
            startTime, 
            status: 'connecting', // ตั้งสถานะเริ่มต้นเป็น 'connecting'
            password: password.toString(), // แปลงเป็น string เพื่อความแน่ใจ
            adminID: adminID.trim(), // เก็บ ID แอดมิน
            ping: 'N/A', // เริ่มต้นปิงเป็น N/A
            deletionTimeout: null, // เพิ่มตัวแปรสำหรับการลบอัตโนมัติ
            retryCount: 0 // เพิ่มตัวนับการลองล็อกอิน
        };

        login({ appState }, (err, api) => {
            if (err) {
                console.error(chalk.red(`❌ การเข้าสู่ระบบล้มเหลวสำหรับโทเค็น: ${token}`));
                botSessions[token].status = 'connection_failed'; // เปลี่ยนสถานะเป็น 'connection_failed'
                io.emit('updateBots', generateBotData());
                return reject(err);
            }

            botSessions[token].api = api;
            botSessions[token].status = 'online'; // เปลี่ยนสถานะเป็น 'online'
            botCount = Math.max(botCount, parseInt(name.replace(/✨/g, '').replace('Bot ', '') || '0')); // ปรับ botCount ให้สูงสุด

            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));
            console.log(chalk.green(`🔑 รหัสผ่านสำหรับลบ/แก้ไขโทเค่น: ${password}`)); // แสดงรหัสผ่านใน console
            console.log(chalk.green(`🔑 ID แอดมิน: ${adminID}`)); // แสดง ID แอดมินใน console

            api.setOptions({ listenEvents: true });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots', generateBotData());

                    // แจ้งเตือนว่า บอทจะถูกลบภายใน 60 วินาที
                    io.emit('botOffline', botSessions[token].name);

                    // ตั้งเวลา 60 วินาทีสำหรับการลบบอทเมื่อออฟไลน์
                    if (!botSessions[token].deletionTimeout) {
                        botSessions[token].deletionTimeout = setTimeout(() => {
                            deleteBot(token, true);
                        }, 60000); // 60,000 มิลลิวินาที = 60 วินาที
                        console.log(chalk.yellow(`⌛ บอท ${name} จะถูกลบในอีก 60 วินาที`));
                    }
                    return;
                }

                // เพิ่มล็อกเมื่อได้รับอีเวนต์
                console.log(chalk.blue(`📩 รับอีเวนต์: ${event.type}`));

                // จัดการอีเวนต์
                if (event.logMessageType && events[event.logMessageType]) {
                    for (const eventHandler of events[event.logMessageType]) {
                        try {
                            await eventHandler.run({ api, event });
                            console.log(chalk.blue(`🔄 ประมวลผลอีเวนต์: ${eventHandler.config.name}`));
                        } catch (error) {
                            console.error(chalk.red(`❌ เกิดข้อผิดพลาดในอีเวนต์ ${eventHandler.config.name}:`, error));
                        }
                    }
                }

                // จัดการข้อความ
                if (event.type === "message") {
                    const message = event.body ? event.body.trim() : "";

                    if (!message.startsWith(botSessions[token].prefix)) return;

                    const args = message.slice(botSessions[token].prefix.length).trim().split(/ +/);
                    const commandName = args.shift().toLowerCase();
                    const command = commands[commandName];

                    if (command && typeof command.run === "function") {
                        try {
                            await command.run({ api, event, args });
                            console.log(chalk.green(`✅ รันคำสั่ง: ${commandName}`));
                            // เพิ่มตัวนับการใช้คำสั่ง
                            commandUsage[commandName] = (commandUsage[commandName] || 0) + 1;

                            io.emit('updateBots', generateBotData());
                            io.emit('updateCommands', generateCommandData());
                        } catch (error) {
                            console.error(chalk.red(`❌ เกิดข้อผิดพลาดในคำสั่ง ${commandName}:`, error));
                            api.sendMessage("❗ การรันคำสั่งล้มเหลว", event.threadID);
                        }
                    } else {
                        api.sendMessage("❗ ไม่พบคำสั่งที่ระบุ", event.threadID);
                    }
                }

                // หากบอทกลับมาทำงานใหม่ขณะนับถอยหลังให้ยกเลิกการลบ
                if (botSessions[token].status === 'online') {
                    if (botSessions[token].deletionTimeout) {
                        clearTimeout(botSessions[token].deletionTimeout);
                        botSessions[token].deletionTimeout = null;
                        console.log(chalk.green(`🔄 ยกเลิกการลบบอท ${name}`));
                    }
                }
            });

            // บันทึกข้อมูลบอทลงไฟล์
            if (saveToFile) {
                const botData = { appState, token, name, prefix, startTime, password, adminID };
                const botFilePath = path.join(botsDir, `${name.replace(/ /g, '_')}.json`);
                fs.writeFileSync(botFilePath, JSON.stringify(botData, null, 4));
            }

            io.emit('updateBots', generateBotData());
            resolve();
        });
    });
}

// ฟังก์ชันเริ่มต้นบอทด้วยการลองล็อกอินซ้ำ
async function startBotWithRetry(appState, token, name, prefix, startTime, password, adminID, retries) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            await startBot(appState, token, name, prefix, startTime, password, adminID, true);
            console.log(chalk.green(`✅ เริ่มบอทสำเร็จ: ${name}`));
            return;
        } catch (err) {
            attempt++;
            console.error(chalk.red(`❌ ลองเริ่มบอทครั้งที่ ${attempt} ล้มเหลว: ${err.message}`));
            if (attempt >= retries) {
                console.error(chalk.red(`❌ บอท ${name} ล้มเหลวในการล็อกอินหลังจากลอง ${retries} ครั้ง`));
                await deleteBot(token, false); // ลบบอทโดยไม่ต้อง emit 'botDeleted' อีกครั้ง
                throw new Error(`บอท ${name} ล้มเหลวในการล็อกอิน`);
            }
            // รอ 2 วินาทีก่อนลองใหม่
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// หน้าแดชบอร์ดหลัก
app.get("/", (req, res) => {
    const data = generateBotData(); // เรียกใช้ generateBotData()

    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>แดชบอร์ดหลัก | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <!-- Snowfall.js Library -->
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-snowfall/1.7.4/snowfall.min.js"></script>
            <style>
                /* ทำให้ body ใช้ Flexbox */
                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                }

                /* เพิ่ม overlay เพื่อให้เนื้อหาดูชัดเจน */
                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: -1;
                }

                /* ปรับแต่ง Navbar */
                .navbar {
                    background: rgba(13, 110, 253, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #ffffff !important;
                }

                .navbar-nav .nav-link {
                    color: #ffffff !important;
                    transition: color 0.3s ease;
                }

                .navbar-nav .nav-link:hover {
                    color: #ffc107 !important;
                }

                /* ปรับแต่ง Cards */
                .stats-card {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .stats-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
                }

                .stats-number {
                    font-size: 2.5rem;
                    font-weight: 700;
                    margin: 10px 0;
                    color: #ffc107;
                }

                .stats-label {
                    font-size: 1rem;
                    color: #ffffff;
                }

                .glass-card {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
                }

                .bot-table, .command-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                .bot-table th, .bot-table td,
                .command-table th, .command-table td {
                    padding: 12px 15px;
                    text-align: left;
                }

                .bot-table th, .command-table th {
                    background-color: rgba(13, 110, 253, 0.9);
                    color: #fff;
                    font-weight: 600;
                }

                .bot-table tr:nth-child(even),
                .command-table tr:nth-child(even) {
                    background-color: rgba(255, 255, 255, 0.1);
                }

                /* ปรับแต่งสถานะ */
                .status-online {
                    background: #198754;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .status-active {
                    background: #20c997;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .status-connecting {
                    background: #ffc107;
                    color: #212529;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .status-connection-failed {
                    background: #dc3545;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .status-offline {
                    background: #6c757d;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                /* ปรับแต่ง Footer ให้ติดอยู่ด้านล่าง */
                .footer {
                    background: rgba(13, 110, 253, 0.9);
                    border-top: 2px solid rgba(255, 193, 7, 0.5);
                    padding: 20px 0;
                    margin-top: auto; /* Push footer to the bottom */
                    font-size: 0.9rem;
                    color: #ffffff;
                    text-align: center;
                }

                /* ปรับแต่งปุ่ม */
                .btn-primary {
                    background: #ffc107;
                    border: none;
                    padding: 10px 20px;
                    font-size: 1rem;
                    border-radius: 8px;
                    transition: background 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
                    color: #212529;
                    font-weight: 600;
                }

                .btn-primary:hover {
                    background: #e0a800;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                }

                .btn-warning, .btn-danger, .btn-secondary {
                    transition: transform 0.2s ease, box-shadow 0.3s ease;
                }

                .btn-warning:hover, .btn-danger:hover, .btn-secondary:hover {
                    transform: scale(1.05);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                }

                /* ปรับแต่ง Toast */
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .stats-card {
                        margin-bottom: 20px;
                    }
                    .glass-card {
                        margin-bottom: 20px;
                    }
                    .bot-table th, .bot-table td,
                    .command-table th, .command-table td {
                        padding: 8px 10px;
                    }
                }

                /* เพิ่มแอนิเมชัน */
                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                /* เพิ่มสไตล์สำหรับปุ่มที่สวยงาม */
                .btn {
                    border-radius: 12px;
                    padding: 10px 20px;
                    font-weight: 600;
                }

                /* สไตล์เพิ่มเติมสำหรับเอฟเฟกต์หิมะ */
                #snowfallCanvas {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 999;
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <!-- Snowfall Effect -->
            <canvas id="snowfallCanvas"></canvas>
            <!-- Background Music -->
            <audio id="backgroundMusic" src="https://firebasestorage.googleapis.com/v0/b/goak-71ac8.appspot.com/o/SnapSave.io%20-%20Perfect%20_%20Style%20-%20One%20Direction%20%26%20Taylor%20Swift%20(Cover%20-%20Mashup)%20(128%20kbps).mp3?alt=media&token=9c6ac6ac-5e87-48b6-8021-3ecdf36c9a99" autoplay loop></audio>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: #ffffff;"></i>
                        ระบบจัดการบอท
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link" href="/start"><i class="fas fa-plus-circle me-1"></i> เพิ่มบอท</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/how-to-make-bot"><i class="fas fa-video me-1"></i> วิธีทำบอทของคุณเอง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <div class="container flex-grow-1">
                <!-- สถิติ -->
                <div class="row mb-4">
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-robot fa-2x mb-3" style="color: #ffc107;"></i>
                            <div class="stats-number" id="totalBots">${data.totalBots}</div>
                            <div class="stats-label">บอททั้งหมด</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-signal fa-2x mb-3" style="color: #198754;"></i>
                            <div class="stats-number" id="onlineBots">${data.onlineBots}</div>
                            <div class="stats-label">บอทออนไลน์</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-clock fa-2x mb-3" style="color: #ffc107;"></i>
                            <div class="stats-number" id="activeBots">${data.activeBots}</div>
                            <div class="stats-label">บอททำงานแล้ว</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-tachometer-alt fa-2x mb-3" style="color: #198754;"></i>
                            <div class="stats-number" id="websitePing">${data.websitePing} ms</div>
                            <div class="stats-label">Ping เว็บไซต์</div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <!-- ตารางบอท -->
                    <div class="col-12">
                        <div class="glass-card">
                            <h5 class="mb-4">
                                <i class="fas fa-robot me-2" style="color: #ffc107;"></i>
                                บอทที่กำลังทำงาน
                            </h5>
                            <div class="table-responsive">
                                <table class="table bot-table">
                                    <thead>
                                        <tr>
                                            <th>ชื่อบอท</th>
                                            <th>สถานะ</th>
                                            <th>เวลารัน</th>
                                            <th>ปิง</th>
                                            <th>การจัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody id="botTableBody">
                                        ${data.botRows}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Toast Container -->
            <div class="toast-container"></div>

            <footer class="footer">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();

                // Initialize Snowfall Effect
                $(document).ready(function(){
                    $(document).snowfall({ 
                        flakeCount : 100,
                        maxSpeed : 5,
                        minSpeed : 1,
                        maxSize : 5,
                        minSize : 2,
                        round : true,
                        shadow : true
                    });
                });

                // ฟังก์ชันอัปเดตเวลารัน
                function updateRuntime() {
                    const runtimeElements = document.querySelectorAll('.runtime');
                    const now = Date.now();

                    runtimeElements.forEach(el => {
                        const startTime = parseInt(el.getAttribute('data-start-time'));
                        if (!startTime) return;

                        const elapsed = now - startTime;
                        const seconds = Math.floor((elapsed / 1000) % 60);
                        const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
                        const hours = Math.floor((elapsed / (1000 * 60 * 60)) % 24);
                        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));

                        el.textContent = \`\${days} วัน \${hours} ชั่วโมง \${minutes} นาที \${seconds} วินาที\`;
                    });
                }

                // ฟังก์ชันส่งปิงไปยังเซิร์ฟเวอร์
                function sendPing() {
                    const timestamp = Date.now();
                    socket.emit('ping', timestamp);
                }

                // ส่งปิงทุกๆ 5 วินาที
                setInterval(sendPing, 5000);
                // ส่งปิงทันทีเมื่อโหลดหน้า
                sendPing();

                // ฟังก์ชันแสดง Toast
                function showToast(message, type = 'info') {
                    const toastContainer = document.querySelector('.toast-container');
                    const toastEl = document.createElement('div');
                    toastEl.className = \`toast align-items-center text-bg-\${type} border-0\`;
                    toastEl.setAttribute('role', 'alert');
                    toastEl.setAttribute('aria-live', 'assertive');
                    toastEl.setAttribute('aria-atomic', 'true');
                    toastEl.innerHTML = \`
                        <div class="d-flex">
                            <div class="toast-body">
                                \${message}
                            </div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>
                    \`;
                    toastContainer.appendChild(toastEl);
                    const toast = new bootstrap.Toast(toastEl);
                    toast.show();

                    // ลบ Toast หลังจากปิด
                    toastEl.addEventListener('hidden.bs.toast', () => {
                        toastEl.remove();
                    });
                }

                // รับข้อมูลอัปเดตจากเซิร์ฟเวอร์
                socket.on('updateBots', (data) => {
                    document.getElementById('totalBots').textContent = data.totalBots;
                    document.getElementById('onlineBots').textContent = data.onlineBots;
                    document.getElementById('activeBots').textContent = data.activeBots;
                    document.getElementById('websitePing').textContent = data.websitePing + ' ms';

                    const botTableBody = document.getElementById('botTableBody');
                    if (botTableBody) {
                        botTableBody.innerHTML = data.botRows;
                    }

                    updateRuntime();
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทถูกลบ
                socket.on('botDeleted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกลบเรียบร้อยแล้ว\`, 'success');
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทไปออฟไลน์
                socket.on('botOffline', (botName) => {
                    showToast(\`บอท "\${botName}" กำลังจะถูกลบภายใน 60 วินาที เนื่องจากออฟไลน์\`, 'warning');
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทถูกรีสตาร์ท
                socket.on('botRestarted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกรีสตาร์ทเรียบร้อยแล้ว\`, 'success');
                });

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

                // Event Delegation สำหรับปุ่มลบ, แก้ไข, และรีสตาร์ท
                document.addEventListener('click', function(event) {
                    if (event.target.closest('.delete-btn')) {
                        const token = decodeURIComponent(event.target.closest('.delete-btn').getAttribute('data-token'));
                        const deleteCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการลบบอท:');
                        if (deleteCode) {
                            fetch('/delete', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, code: deleteCode })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showToast('ลบบอทสำเร็จ', 'success');
                                } else {
                                    showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาดในการลบบอท', 'danger');
                            });
                        }
                    }

                    if (event.target.closest('.edit-btn')) {
                        const token = decodeURIComponent(event.target.closest('.edit-btn').getAttribute('data-token'));
                        const editCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการแก้ไขโทเค่น:');
                        if (editCode) {
                            const newToken = prompt('กรุณากรอกโทเค่นใหม่:');
                            if (newToken) {
                                fetch('/edit', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ token, code: editCode, newToken })
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        showToast('แก้ไขโทเค่นสำเร็จ', 'success');
                                    } else {
                                        showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                    }
                                })
                                .catch(err => {
                                    console.error(err);
                                    showToast('เกิดข้อผิดพลาดในการแก้ไขโทเค่น', 'danger');
                                });
                            }
                        }
                    }

                    // การจัดการปุ่มรีสตาร์ท
                    if (event.target.closest('.restart-btn')) {
                        const token = decodeURIComponent(event.target.closest('.restart-btn').getAttribute('data-token'));
                        const restartCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการรีสตาร์ทบอท:');
                        if (restartCode) {
                            fetch('/restart', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, code: restartCode })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showToast('รีสตาร์ทบอทสำเร็จ', 'success');
                                    io.emit('botRestarted', data.botName); // ส่งเหตุการณ์รีสตาร์ทบอท
                                } else {
                                    showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาดในการรีสตาร์ทบอท', 'danger');
                            });
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// หน้าเพิ่มบอท
app.get("/start", (req, res) => {
    const error = req.query.error;

    let errorMessage = "";
    if (error === 'already-running') {
        errorMessage = `<div class="alert alert-warning" role="alert">
                            บอทนี้กำลังทำงานอยู่แล้ว
                        </div>`;
    } else if (error === 'invalid-token') {
        errorMessage = `<div class="alert alert-danger" role="alert">
                            โทเค็นไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง
                        </div>`;
    } else if (error === 'missing-fields') {
        errorMessage = `<div class="alert alert-danger" role="alert">
                            กรุณากรอกทั้งโทเค็น, รหัสผ่าน, ID แอดมิน, ชื่อบอท และคำนำหน้าบอท
                        </div>`;
    } else if (error === 'invalid-password') {
        errorMessage = `<div class="alert alert-danger" role="alert">
                            รหัสผ่านไม่ถูกต้อง กรุณากรอกรหัสผ่าน 6 หลัก
                        </div>`;
    } else if (error === 'invalid-name') {
        errorMessage = `<div class="alert alert-danger" role="alert">
                            ชื่อบอทไม่ถูกต้อง กรุณากรอกชื่อบอทที่มีความยาว 3-20 ตัวอักษร และประกอบด้วย a-z, A-Z, 0-9, -, _
                        </div>`;
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>เพิ่มบอท | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <!-- Snowfall.js Library -->
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-snowfall/1.7.4/snowfall.min.js"></script>
            <style>
                /* ทำให้ body ใช้ Flexbox */
                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                }

                /* เพิ่ม overlay เพื่อให้เนื้อหาดูชัดเจน */
                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: -1;
                }

                /* ปรับแต่ง Navbar */
                .navbar {
                    background: rgba(13, 110, 253, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #ffffff !important;
                }

                .navbar-nav .nav-link {
                    color: #ffffff !important;
                    transition: color 0.3s ease;
                }

                .navbar-nav .nav-link:hover {
                    color: #ffc107 !important;
                }

                /* ปรับแต่ง Cards */
                .glass-card {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
                }

                .add-bot-form .form-label {
                    font-weight: 500;
                    color: #ffffff;
                }

                .form-control {
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 8px;
                    padding: 10px 12px;
                    font-size: 1rem;
                    transition: border-color 0.3s ease, background 0.3s ease;
                    color: #ffffff;
                }

                .form-control::placeholder {
                    color: #e0e0e0;
                }

                .form-control:focus {
                    border-color: #ffc107;
                    box-shadow: 0 0 0 0.2rem rgba(255, 193, 7, 0.25);
                    background: rgba(255, 255, 255, 0.3);
                    color: #ffffff;
                }

                .btn-primary {
                    background: #ffc107;
                    border: none;
                    padding: 10px 20px;
                    font-size: 1rem;
                    border-radius: 8px;
                    transition: background 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease;
                    color: #212529;
                    font-weight: 600;
                }

                .btn-primary:hover {
                    background: #e0a800;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                }

                .footer {
                    background: rgba(13, 110, 253, 0.9);
                    border-top: 2px solid rgba(255, 193, 7, 0.5);
                    padding: 20px 0;
                    margin-top: auto; /* Push footer to the bottom */
                    font-size: 0.9rem;
                    color: #ffffff;
                    text-align: center;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                /* ปรับแต่ง Toast */
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                }

                /* สไตล์เพิ่มเติมสำหรับปุ่มที่สวยงาม */
                .btn {
                    border-radius: 12px;
                    padding: 10px 20px;
                    font-weight: 600;
                }

                /* เพิ่มสไตล์สำหรับเอฟเฟกต์หิมะ */
                #snowfallCanvas {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 999;
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <!-- Snowfall Effect -->
            <canvas id="snowfallCanvas"></canvas>
            <!-- Background Music -->
            <audio id="backgroundMusic" src="https://firebasestorage.googleapis.com/v0/b/goak-71ac8.appspot.com/o/SnapSave.io%20-%20Perfect%20_%20Style%20-%20One%20Direction%20%26%20Taylor%20Swift%20(Cover%20-%20Mashup)%20(128%20kbps).mp3?alt=media&token=9c6ac6ac-5e87-48b6-8021-3ecdf36c9a99" autoplay loop></audio>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: #ffffff;"></i>
                        ระบบจัดการบอท
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link active" href="/start"><i class="fas fa-plus-circle me-1"></i> เพิ่มบอท</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/how-to-make-bot"><i class="fas fa-video me-1"></i> วิธีทำบอทของคุณเอง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <div class="container flex-grow-1">
                <!-- สถิติ -->
                <div class="row mb-4">
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-robot fa-2x mb-3" style="color: #ffc107;"></i>
                            <div class="stats-number" id="totalBots">${data.totalBots}</div>
                            <div class="stats-label">บอททั้งหมด</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-signal fa-2x mb-3" style="color: #198754;"></i>
                            <div class="stats-number" id="onlineBots">${data.onlineBots}</div>
                            <div class="stats-label">บอทออนไลน์</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-clock fa-2x mb-3" style="color: #ffc107;"></i>
                            <div class="stats-number" id="activeBots">${data.activeBots}</div>
                            <div class="stats-label">บอททำงานแล้ว</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-tachometer-alt fa-2x mb-3" style="color: #198754;"></i>
                            <div class="stats-number" id="websitePing">${data.websitePing} ms</div>
                            <div class="stats-label">Ping เว็บไซต์</div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <!-- ตารางบอท -->
                    <div class="col-12">
                        <div class="glass-card">
                            <h5 class="mb-4">
                                <i class="fas fa-robot me-2" style="color: #ffc107;"></i>
                                บอทที่กำลังทำงาน
                            </h5>
                            <div class="table-responsive">
                                <table class="table bot-table">
                                    <thead>
                                        <tr>
                                            <th>ชื่อบอท</th>
                                            <th>สถานะ</th>
                                            <th>เวลารัน</th>
                                            <th>ปิง</th>
                                            <th>การจัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody id="botTableBody">
                                        ${data.botRows}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Toast Container -->
            <div class="toast-container"></div>

            <footer class="footer">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();

                // Initialize Snowfall Effect
                $(document).ready(function(){
                    $(document).snowfall({ 
                        flakeCount : 100,
                        maxSpeed : 5,
                        minSpeed : 1,
                        maxSize : 5,
                        minSize : 2,
                        round : true,
                        shadow : true
                    });
                });

                // ฟังก์ชันอัปเดตเวลารัน
                function updateRuntime() {
                    const runtimeElements = document.querySelectorAll('.runtime');
                    const now = Date.now();

                    runtimeElements.forEach(el => {
                        const startTime = parseInt(el.getAttribute('data-start-time'));
                        if (!startTime) return;

                        const elapsed = now - startTime;
                        const seconds = Math.floor((elapsed / 1000) % 60);
                        const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
                        const hours = Math.floor((elapsed / (1000 * 60 * 60)) % 24);
                        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));

                        el.textContent = \`\${days} วัน \${hours} ชั่วโมง \${minutes} นาที \${seconds} วินาที\`;
                    });
                }

                // ฟังก์ชันส่งปิงไปยังเซิร์ฟเวอร์
                function sendPing() {
                    const timestamp = Date.now();
                    socket.emit('ping', timestamp);
                }

                // ส่งปิงทุกๆ 5 วินาที
                setInterval(sendPing, 5000);
                // ส่งปิงทันทีเมื่อโหลดหน้า
                sendPing();

                // ฟังก์ชันแสดง Toast
                function showToast(message, type = 'info') {
                    const toastContainer = document.querySelector('.toast-container');
                    const toastEl = document.createElement('div');
                    toastEl.className = \`toast align-items-center text-bg-\${type} border-0\`;
                    toastEl.setAttribute('role', 'alert');
                    toastEl.setAttribute('aria-live', 'assertive');
                    toastEl.setAttribute('aria-atomic', 'true');
                    toastEl.innerHTML = \`
                        <div class="d-flex">
                            <div class="toast-body">
                                \${message}
                            </div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>
                    \`;
                    toastContainer.appendChild(toastEl);
                    const toast = new bootstrap.Toast(toastEl);
                    toast.show();

                    // ลบ Toast หลังจากปิด
                    toastEl.addEventListener('hidden.bs.toast', () => {
                        toastEl.remove();
                    });
                }

                // รับข้อมูลอัปเดตจากเซิร์ฟเวอร์
                socket.on('updateBots', (data) => {
                    document.getElementById('totalBots').textContent = data.totalBots;
                    document.getElementById('onlineBots').textContent = data.onlineBots;
                    document.getElementById('activeBots').textContent = data.activeBots;
                    document.getElementById('websitePing').textContent = data.websitePing + ' ms';

                    const botTableBody = document.getElementById('botTableBody');
                    if (botTableBody) {
                        botTableBody.innerHTML = data.botRows;
                    }

                    updateRuntime();
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทถูกลบ
                socket.on('botDeleted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกลบเรียบร้อยแล้ว\`, 'success');
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทไปออฟไลน์
                socket.on('botOffline', (botName) => {
                    showToast(\`บอท "\${botName}" กำลังจะถูกลบภายใน 60 วินาที เนื่องจากออฟไลน์\`, 'warning');
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทถูกรีสตาร์ท
                socket.on('botRestarted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกรีสตาร์ทเรียบร้อยแล้ว\`, 'success');
                });

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

                // Event Delegation สำหรับปุ่มลบ, แก้ไข, และรีสตาร์ท
                document.addEventListener('click', function(event) {
                    if (event.target.closest('.delete-btn')) {
                        const token = decodeURIComponent(event.target.closest('.delete-btn').getAttribute('data-token'));
                        const deleteCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการลบบอท:');
                        if (deleteCode) {
                            fetch('/delete', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, code: deleteCode })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showToast('ลบบอทสำเร็จ', 'success');
                                } else {
                                    showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาดในการลบบอท', 'danger');
                            });
                        }
                    }

                    if (event.target.closest('.edit-btn')) {
                        const token = decodeURIComponent(event.target.closest('.edit-btn').getAttribute('data-token'));
                        const editCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการแก้ไขโทเค่น:');
                        if (editCode) {
                            const newToken = prompt('กรุณากรอกโทเค่นใหม่:');
                            if (newToken) {
                                fetch('/edit', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ token, code: editCode, newToken })
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        showToast('แก้ไขโทเค่นสำเร็จ', 'success');
                                    } else {
                                        showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                    }
                                })
                                .catch(err => {
                                    console.error(err);
                                    showToast('เกิดข้อผิดพลาดในการแก้ไขโทเค่น', 'danger');
                                });
                            }
                        }
                    }

                    // การจัดการปุ่มรีสตาร์ท
                    if (event.target.closest('.restart-btn')) {
                        const token = decodeURIComponent(event.target.closest('.restart-btn').getAttribute('data-token'));
                        const restartCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการรีสตาร์ทบอท:');
                        if (restartCode) {
                            fetch('/restart', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, code: restartCode })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showToast('รีสตาร์ทบอทสำเร็จ', 'success');
                                    io.emit('botRestarted', data.botName); // ส่งเหตุการณ์รีสตาร์ทบอท
                                } else {
                                    showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาดในการรีสตาร์ทบอท', 'danger');
                            });
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// หน้าเพิ่มบอท (POST /start)
app.post('/start', async (req, res) => {
    const { token, prefix, name, password, adminID } = req.body;

    // ตรวจสอบว่ามีการกรอกโทเค็น, รหัสผ่าน, ID แอดมิน, ชื่อบอท และคำนำหน้าบอท
    if (!token || !prefix || !name || !password || !adminID) {
        return res.redirect('/start?error=missing-fields');
    }

    // ตรวจสอบรูปแบบของรหัสผ่าน (ต้องเป็นเลข 6 หลัก)
    const passwordRegex = /^\d{6}$/;
    if (!passwordRegex.test(password)) {
        return res.redirect('/start?error=invalid-password');
    }

    // ตรวจสอบรูปแบบของชื่อบอท
    const nameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!nameRegex.test(name)) {
        return res.redirect('/start?error=invalid-name');
    }

    try {
        const appState = JSON.parse(token);
        const tokenKey = token.trim();
        if (botSessions[tokenKey]) {
            return res.redirect('/start?error=already-running');
        }

        const botName = name.trim();
        const botPrefix = prefix.trim();
        const startTime = Date.now();

        // ปรับจำนวนครั้งในการลองเชื่อมต่อเป็น 5 ครั้ง
        await startBotWithRetry(appState, tokenKey, botName, botPrefix, startTime, password, adminID, 5);
        res.redirect('/bots');
        io.emit('updateBots', generateBotData());
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err ? err.message : err}`));
        res.redirect('/start?error=invalid-token');
    }
});

// หน้าแสดงบอทรัน
app.get("/bots", (req, res) => {
    const data = generateBotData(); // เรียกใช้ generateBotData()

    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ดูบอทรัน | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <!-- Snowfall.js Library -->
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-snowfall/1.7.4/snowfall.min.js"></script>
            <style>
                /* ทำให้ body ใช้ Flexbox */
                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                }

                /* เพิ่ม overlay เพื่อให้เนื้อหาดูชัดเจน */
                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: -1;
                }

                /* ปรับแต่ง Navbar */
                .navbar {
                    background: rgba(13, 110, 253, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #ffffff !important;
                }

                .navbar-nav .nav-link {
                    color: #ffffff !important;
                    transition: color 0.3s ease;
                }

                .navbar-nav .nav-link:hover {
                    color: #ffc107 !important;
                }

                /* ปรับแต่ง Cards */
                .glass-card {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
                }

                .bot-table, .command-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                .bot-table th, .bot-table td,
                .command-table th, .command-table td {
                    padding: 12px 15px;
                    text-align: left;
                }

                .bot-table th, .command-table th {
                    background-color: rgba(13, 110, 253, 0.9);
                    color: #fff;
                    font-weight: 600;
                }

                .bot-table tr:nth-child(even),
                .command-table tr:nth-child(even) {
                    background-color: rgba(255, 255, 255, 0.1);
                }

                /* ปรับแต่งสถานะ */
                .status-online {
                    background: #198754;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .status-active {
                    background: #20c997;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .status-connecting {
                    background: #ffc107;
                    color: #212529;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .status-connection-failed {
                    background: #dc3545;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .status-offline {
                    background: #6c757d;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                /* ปรับแต่ง Footer ให้ติดอยู่ด้านล่าง */
                .footer {
                    background: rgba(13, 110, 253, 0.9);
                    border-top: 2px solid rgba(255, 193, 7, 0.5);
                    padding: 20px 0;
                    margin-top: auto; /* Push footer to the bottom */
                    font-size: 0.9rem;
                    color: #ffffff;
                    text-align: center;
                }

                /* ปรับแต่งปุ่ม */
                .btn-warning, .btn-danger, .btn-secondary {
                    transition: transform 0.2s ease, box-shadow 0.3s ease;
                }

                .btn-warning:hover, .btn-danger:hover, .btn-secondary:hover {
                    transform: scale(1.05);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                }

                /* ปรับแต่ง Toast */
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                    .bot-table th, .bot-table td,
                    .command-table th, .command-table td {
                        padding: 8px 10px;
                    }
                }

                /* เพิ่มแอนิเมชัน */
                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                /* สไตล์เพิ่มเติมสำหรับปุ่มที่สวยงาม */
                .btn {
                    border-radius: 12px;
                    padding: 10px 20px;
                    font-weight: 600;
                }

                /* เพิ่มสไตล์สำหรับเอฟเฟกต์หิมะ */
                #snowfallCanvas {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 999;
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <!-- Snowfall Effect -->
            <canvas id="snowfallCanvas"></canvas>
            <!-- Background Music -->
            <audio id="backgroundMusic" src="https://firebasestorage.googleapis.com/v0/b/goak-71ac8.appspot.com/o/SnapSave.io%20-%20Perfect%20_%20Style%20-%20One%20Direction%20%26%20Taylor%20Swift%20(Cover%20-%20Mashup)%20(128%20kbps).mp3?alt=media&token=9c6ac6ac-5e87-48b6-8021-3ecdf36c9a99" autoplay loop></audio>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: #ffffff;"></i>
                        ระบบจัดการบอท
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link" href="/start"><i class="fas fa-plus-circle me-1"></i> เพิ่มบอท</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/how-to-make-bot"><i class="fas fa-video me-1"></i> วิธีทำบอทของคุณเอง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <div class="container flex-grow-1">
                <!-- ตารางบอท -->
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-list me-2" style="color: #198754;"></i>
                        บอทที่กำลังทำงาน
                    </h5>
                    <div class="table-responsive">
                        <table class="table bot-table">
                            <thead>
                                <tr>
                                    <th>ชื่อบอท</th>
                                    <th>สถานะ</th>
                                    <th>เวลารัน</th>
                                    <th>ปิง</th>
                                    <th>การจัดการ</th>
                                </tr>
                            </thead>
                            <tbody id="botTableBody">
                                ${data.botRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Toast Container -->
            <div class="toast-container"></div>

            <footer class="footer">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();

                // Initialize Snowfall Effect
                $(document).ready(function(){
                    $(document).snowfall({ 
                        flakeCount : 100,
                        maxSpeed : 5,
                        minSpeed : 1,
                        maxSize : 5,
                        minSize : 2,
                        round : true,
                        shadow : true
                    });
                });

                // ฟังก์ชันอัปเดตเวลารัน
                function updateRuntime() {
                    const runtimeElements = document.querySelectorAll('.runtime');
                    const now = Date.now();

                    runtimeElements.forEach(el => {
                        const startTime = parseInt(el.getAttribute('data-start-time'));
                        if (!startTime) return;

                        const elapsed = now - startTime;
                        const seconds = Math.floor((elapsed / 1000) % 60);
                        const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
                        const hours = Math.floor((elapsed / (1000 * 60 * 60)) % 24);
                        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));

                        el.textContent = \`\${days} วัน \${hours} ชั่วโมง \${minutes} นาที \${seconds} วินาที\`;
                    });
                }

                // ฟังก์ชันส่งปิงไปยังเซิร์ฟเวอร์
                function sendPing() {
                    const timestamp = Date.now();
                    socket.emit('ping', timestamp);
                }

                // ส่งปิงทุกๆ 5 วินาที
                setInterval(sendPing, 5000);
                // ส่งปิงทันทีเมื่อโหลดหน้า
                sendPing();

                // ฟังก์ชันแสดง Toast
                function showToast(message, type = 'info') {
                    const toastContainer = document.querySelector('.toast-container');
                    const toastEl = document.createElement('div');
                    toastEl.className = \`toast align-items-center text-bg-\${type} border-0\`;
                    toastEl.setAttribute('role', 'alert');
                    toastEl.setAttribute('aria-live', 'assertive');
                    toastEl.setAttribute('aria-atomic', 'true');
                    toastEl.innerHTML = \`
                        <div class="d-flex">
                            <div class="toast-body">
                                \${message}
                            </div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>
                    \`;
                    toastContainer.appendChild(toastEl);
                    const toast = new bootstrap.Toast(toastEl);
                    toast.show();

                    // ลบ Toast หลังจากปิด
                    toastEl.addEventListener('hidden.bs.toast', () => {
                        toastEl.remove();
                    });
                }

                // รับข้อมูลอัปเดตจากเซิร์ฟเวอร์
                socket.on('updateBots', (data) => {
                    document.getElementById('totalBots').textContent = data.totalBots;
                    document.getElementById('onlineBots').textContent = data.onlineBots;
                    document.getElementById('activeBots').textContent = data.activeBots;
                    document.getElementById('websitePing').textContent = data.websitePing + ' ms';

                    const botTableBody = document.getElementById('botTableBody');
                    if (botTableBody) {
                        botTableBody.innerHTML = data.botRows;
                    }

                    updateRuntime();
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทถูกลบ
                socket.on('botDeleted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกลบเรียบร้อยแล้ว\`, 'success');
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทไปออฟไลน์
                socket.on('botOffline', (botName) => {
                    showToast(\`บอท "\${botName}" กำลังจะถูกลบภายใน 60 วินาที เนื่องจากออฟไลน์\`, 'warning');
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทถูกรีสตาร์ท
                socket.on('botRestarted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกรีสตาร์ทเรียบร้อยแล้ว\`, 'success');
                });

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

                // Event Delegation สำหรับปุ่มลบ, แก้ไข, และรีสตาร์ท
                document.addEventListener('click', function(event) {
                    if (event.target.closest('.delete-btn')) {
                        const token = decodeURIComponent(event.target.closest('.delete-btn').getAttribute('data-token'));
                        const deleteCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการลบบอท:');
                        if (deleteCode) {
                            fetch('/delete', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, code: deleteCode })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showToast('ลบบอทสำเร็จ', 'success');
                                } else {
                                    showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาดในการลบบอท', 'danger');
                            });
                        }
                    }

                    if (event.target.closest('.edit-btn')) {
                        const token = decodeURIComponent(event.target.closest('.edit-btn').getAttribute('data-token'));
                        const editCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการแก้ไขโทเค่น:');
                        if (editCode) {
                            const newToken = prompt('กรุณากรอกโทเค่นใหม่:');
                            if (newToken) {
                                fetch('/edit', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ token, code: editCode, newToken })
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        showToast('แก้ไขโทเค่นสำเร็จ', 'success');
                                    } else {
                                        showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                    }
                                })
                                .catch(err => {
                                    console.error(err);
                                    showToast('เกิดข้อผิดพลาดในการแก้ไขโทเค่น', 'danger');
                                });
                            }
                        }
                    }

                    // การจัดการปุ่มรีสตาร์ท
                    if (event.target.closest('.restart-btn')) {
                        const token = decodeURIComponent(event.target.closest('.restart-btn').getAttribute('data-token'));
                        const restartCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการรีสตาร์ทบอท:');
                        if (restartCode) {
                            fetch('/restart', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, code: restartCode })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showToast('รีสตาร์ทบอทสำเร็จ', 'success');
                                    io.emit('botRestarted', data.botName); // ส่งเหตุการณ์รีสตาร์ทบอท
                                } else {
                                    showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาดในการรีสตาร์ทบอท', 'danger');
                            });
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// หน้าแสดงคำสั่งที่ใช้
app.get("/commands", (req, res) => {
    const commandsData = generateCommandData();

    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>คำสั่งที่ใช้ | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <!-- Snowfall.js Library -->
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-snowfall/1.7.4/snowfall.min.js"></script>
            <style>
                /* ทำให้ body ใช้ Flexbox */
                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                }

                /* เพิ่ม overlay เพื่อให้เนื้อหาดูชัดเจน */
                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: -1;
                }

                /* ปรับแต่ง Navbar */
                .navbar {
                    background: rgba(13, 110, 253, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #ffffff !important;
                }

                .navbar-nav .nav-link {
                    color: #ffffff !important;
                    transition: color 0.3s ease;
                }

                .navbar-nav .nav-link:hover {
                    color: #ffc107 !important;
                }

                /* ปรับแต่ง Cards */
                .glass-card {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
                }

                .command-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                .command-table th, .command-table td {
                    padding: 12px 15px;
                    text-align: left;
                }

                .command-table th {
                    background-color: rgba(13, 110, 253, 0.9);
                    color: #fff;
                    font-weight: 600;
                }

                .command-table tr:nth-child(even) {
                    background-color: rgba(255, 255, 255, 0.1);
                }

                /* ปรับแต่ง Footer ให้ติดอยู่ด้านล่าง */
                .footer {
                    background: rgba(13, 110, 253, 0.9);
                    border-top: 2px solid rgba(255, 193, 7, 0.5);
                    padding: 20px 0;
                    margin-top: auto; /* Push footer to the bottom */
                    font-size: 0.9rem;
                    color: #ffffff;
                    text-align: center;
                }

                /* ปรับแต่ง Toast */
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                    .command-table th, .command-table td {
                        padding: 8px 10px;
                    }
                }

                /* เพิ่มแอนิเมชัน */
                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                /* สไตล์เพิ่มเติมสำหรับปุ่มที่สวยงาม */
                .btn {
                    border-radius: 12px;
                    padding: 10px 20px;
                    font-weight: 600;
                }

                /* เพิ่มสไตล์สำหรับเอฟเฟกต์หิมะ */
                #snowfallCanvas {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 999;
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <!-- Snowfall Effect -->
            <canvas id="snowfallCanvas"></canvas>
            <!-- Background Music -->
            <audio id="backgroundMusic" src="https://firebasestorage.googleapis.com/v0/b/goak-71ac8.appspot.com/o/SnapSave.io%20-%20Perfect%20_%20Style%20-%20One%20Direction%20%26%20Taylor%20Swift%20(Cover%20-%20Mashup)%20(128%20kbps).mp3?alt=media&token=9c6ac6ac-5e87-48b6-8021-3ecdf36c9a99" autoplay loop></audio>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: #ffffff;"></i>
                        ระบบจัดการบอท
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link" href="/start"><i class="fas fa-plus-circle me-1"></i> เพิ่มบอท</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/how-to-make-bot"><i class="fas fa-video me-1"></i> วิธีทำบอทของคุณเอง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <div class="container flex-grow-1">
                <!-- ตารางคำสั่งที่ใช้ -->
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-terminal me-2" style="color: #198754;"></i>
                        คำสั่งที่ใช้
                    </h5>
                    <div class="table-responsive">
                        <table class="table command-table">
                            <thead>
                                <tr>
                                    <th>ชื่อคำสั่ง</th>
                                    <th>จำนวนที่ใช้</th>
                                    <th>คำอธิบาย</th>
                                </tr>
                            </thead>
                            <tbody id="commandTableBody">
                                ${commandsData}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Toast Container -->
            <div class="toast-container"></div>

            <footer class="footer">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();

                // Initialize Snowfall Effect
                $(document).ready(function(){
                    $(document).snowfall({ 
                        flakeCount : 100,
                        maxSpeed : 5,
                        minSpeed : 1,
                        maxSize : 5,
                        minSize : 2,
                        round : true,
                        shadow : true
                    });
                });

                // ฟังก์ชันอัปเดตเวลารัน
                function updateRuntime() {
                    const runtimeElements = document.querySelectorAll('.runtime');
                    const now = Date.now();

                    runtimeElements.forEach(el => {
                        const startTime = parseInt(el.getAttribute('data-start-time'));
                        if (!startTime) return;

                        const elapsed = now - startTime;
                        const seconds = Math.floor((elapsed / 1000) % 60);
                        const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
                        const hours = Math.floor((elapsed / (1000 * 60 * 60)) % 24);
                        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));

                        el.textContent = \`\${days} วัน \${hours} ชั่วโมง \${minutes} นาที \${seconds} วินาที\`;
                    });
                }

                // ฟังก์ชันส่งปิงไปยังเซิร์ฟเวอร์
                function sendPing() {
                    const timestamp = Date.now();
                    socket.emit('ping', timestamp);
                }

                // ส่งปิงทุกๆ 5 วินาที
                setInterval(sendPing, 5000);
                // ส่งปิงทันทีเมื่อโหลดหน้า
                sendPing();

                // ฟังก์ชันแสดง Toast
                function showToast(message, type = 'info') {
                    const toastContainer = document.querySelector('.toast-container');
                    const toastEl = document.createElement('div');
                    toastEl.className = \`toast align-items-center text-bg-\${type} border-0\`;
                    toastEl.setAttribute('role', 'alert');
                    toastEl.setAttribute('aria-live', 'assertive');
                    toastEl.setAttribute('aria-atomic', 'true');
                    toastEl.innerHTML = \`
                        <div class="d-flex">
                            <div class="toast-body">
                                \${message}
                            </div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>
                    \`;
                    toastContainer.appendChild(toastEl);
                    const toast = new bootstrap.Toast(toastEl);
                    toast.show();

                    // ลบ Toast หลังจากปิด
                    toastEl.addEventListener('hidden.bs.toast', () => {
                        toastEl.remove();
                    });
                }

                // รับข้อมูลอัปเดตจากเซิร์ฟเวอร์
                socket.on('updateBots', (data) => {
                    document.getElementById('totalBots').textContent = data.totalBots;
                    document.getElementById('onlineBots').textContent = data.onlineBots;
                    document.getElementById('activeBots').textContent = data.activeBots;
                    document.getElementById('websitePing').textContent = data.websitePing + ' ms';

                    const botTableBody = document.getElementById('botTableBody');
                    if (botTableBody) {
                        botTableBody.innerHTML = data.botRows;
                    }

                    updateRuntime();
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทถูกลบ
                socket.on('botDeleted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกลบเรียบร้อยแล้ว\`, 'success');
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทไปออฟไลน์
                socket.on('botOffline', (botName) => {
                    showToast(\`บอท "\${botName}" กำลังจะถูกลบภายใน 60 วินาที เนื่องจากออฟไลน์\`, 'warning');
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทถูกรีสตาร์ท
                socket.on('botRestarted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกรีสตาร์ทเรียบร้อยแล้ว\`, 'success');
                });

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

                // Event Delegation สำหรับปุ่มลบ, แก้ไข, และรีสตาร์ท
                document.addEventListener('click', function(event) {
                    if (event.target.closest('.delete-btn')) {
                        const token = decodeURIComponent(event.target.closest('.delete-btn').getAttribute('data-token'));
                        const deleteCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการลบบอท:');
                        if (deleteCode) {
                            fetch('/delete', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, code: deleteCode })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showToast('ลบบอทสำเร็จ', 'success');
                                } else {
                                    showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาดในการลบบอท', 'danger');
                            });
                        }
                    }

                    if (event.target.closest('.edit-btn')) {
                        const token = decodeURIComponent(event.target.closest('.edit-btn').getAttribute('data-token'));
                        const editCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการแก้ไขโทเค่น:');
                        if (editCode) {
                            const newToken = prompt('กรุณากรอกโทเค่นใหม่:');
                            if (newToken) {
                                fetch('/edit', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ token, code: editCode, newToken })
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        showToast('แก้ไขโทเค่นสำเร็จ', 'success');
                                    } else {
                                        showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                    }
                                })
                                .catch(err => {
                                    console.error(err);
                                    showToast('เกิดข้อผิดพลาดในการแก้ไขโทเค่น', 'danger');
                                });
                            }
                        }
                    }

                    // การจัดการปุ่มรีสตาร์ท
                    if (event.target.closest('.restart-btn')) {
                        const token = decodeURIComponent(event.target.closest('.restart-btn').getAttribute('data-token'));
                        const restartCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการรีสตาร์ทบอท:');
                        if (restartCode) {
                            fetch('/restart', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, code: restartCode })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showToast('รีสตาร์ทบอทสำเร็จ', 'success');
                                    io.emit('botRestarted', data.botName); // ส่งเหตุการณ์รีสตาร์ทบอท
                                } else {
                                    showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาดในการรีสตาร์ทบอท', 'danger');
                            });
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// หน้า "วิธีทำบอทของคุณเอง"
app.get("/how-to-make-bot", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>วิธีทำบอทของคุณเอง | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <!-- Snowfall.js Library -->
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-snowfall/1.7.4/snowfall.min.js"></script>
            <style>
                /* ทำให้ body ใช้ Flexbox */
                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                }

                /* เพิ่ม overlay เพื่อให้เนื้อหาดูชัดเจน */
                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: -1;
                }

                /* ปรับแต่ง Navbar */
                .navbar {
                    background: rgba(13, 110, 253, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #ffffff !important;
                }

                .navbar-nav .nav-link {
                    color: #ffffff !important;
                    transition: color 0.3s ease;
                }

                .navbar-nav .nav-link:hover {
                    color: #ffc107 !important;
                }

                /* ปรับแต่ง Cards */
                .glass-card {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
                }

                .footer {
                    background: rgba(13, 110, 253, 0.9);
                    border-top: 2px solid rgba(255, 193, 7, 0.5);
                    padding: 20px 0;
                    margin-top: auto; /* Push footer to the bottom */
                    font-size: 0.9rem;
                    color: #ffffff;
                    text-align: center;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                /* ปรับแต่ง Toast */
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                }

                /* สไตล์เพิ่มเติมสำหรับปุ่มที่สวยงาม */
                .btn {
                    border-radius: 12px;
                    padding: 10px 20px;
                    font-weight: 600;
                }

                /* เพิ่มสไตล์สำหรับเอฟเฟกต์หิมะ */
                #snowfallCanvas {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 999;
                }

                /* ปรับแต่งวิดีโอให้ตอบสนองได้ */
                .ratio-16x9 iframe {
                    border-radius: 12px;
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <!-- Snowfall Effect -->
            <canvas id="snowfallCanvas"></canvas>
            <!-- Background Music -->
            <audio id="backgroundMusic" src="https://firebasestorage.googleapis.com/v0/b/goak-71ac8.appspot.com/o/SnapSave.io%20-%20Perfect%20_%20Style%20-%20One%20Direction%20%26%20Taylor%20Swift%20(Cover%20-%20Mashup)%20(128%20kbps).mp3?alt=media&token=9c6ac6ac-5e87-48b6-8021-3ecdf36c9a99" autoplay loop></audio>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: #ffffff;"></i>
                        ระบบจัดการบอท
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link" href="/start"><i class="fas fa-plus-circle me-1"></i> เพิ่มบอท</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/how-to-make-bot"><i class="fas fa-video me-1"></i> วิธีทำบอทของคุณเอง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <div class="container flex-grow-1">
                <!-- เนื้อหาของหน้า "วิธีทำบอทของคุณเอง" -->
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-video me-2" style="color: #ffc107;"></i>
                        วิธีทำบอทของคุณเอง
                    </h5>
                    <p>ขอแนะนำวิธีการทำบอทของคุณเองโดยดูจากคลิปวิดีโอต่อไปนี้:</p>
                    <div class="ratio ratio-16x9">
                        <iframe src="https://firebasestorage.googleapis.com/v0/b/goak-71ac8.appspot.com/o/XRecorder_18122024_114720.mp4?alt=media&token=1f243d3d-91ed-448f-83c7-3ee01d0407e4" allowfullscreen></iframe>
                    </div>
                    <hr>
                    <h6>ขั้นตอนเบื้องต้น:</h6>
                    <ol>
                        <li>ดาวน์โหลดซอฟต์แวร์ที่จำเป็นจาก <a href="https://github.com/c3cbot/c3c-ufc-utility/archive/refs/tags/1.5.zip" target="_blank" class="text-decoration-none text-warning">GitHub</a>.</li>
                        <li>แตกไฟล์ ZIP ที่ดาวน์โหลดมาและเปิดโปรเจกต์ในโปรแกรมแก้ไขโค้ดของคุณ.</li>
                        <li>ตั้งค่าการเชื่อมต่อกับ API และปรับแต่งการตั้งค่าตามความต้องการของคุณ.</li>
                        <li>รันเซิร์ฟเวอร์และตรวจสอบบอทของคุณผ่านหน้าแดชบอร์ด.</li>
                        <li>ปรับแต่งคำสั่งและอีเวนต์เพิ่มเติมเพื่อเพิ่มความสามารถให้กับบอทของคุณ.</li>
                    </ol>
                    <p>สำหรับรายละเอียดเพิ่มเติม โปรดดูวิดีโอที่แนบมาด้านบน.</p>
                </div>
            </div>

            <!-- Toast Container -->
            <div class="toast-container"></div>

            <footer class="footer">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();

                // Initialize Snowfall Effect
                $(document).ready(function(){
                    $(document).snowfall({ 
                        flakeCount : 100,
                        maxSpeed : 5,
                        minSpeed : 1,
                        maxSize : 5,
                        minSize : 2,
                        round : true,
                        shadow : true
                    });
                });

                // ฟังก์ชันอัปเดตเวลารัน
                function updateRuntime() {
                    const runtimeElements = document.querySelectorAll('.runtime');
                    const now = Date.now();

                    runtimeElements.forEach(el => {
                        const startTime = parseInt(el.getAttribute('data-start-time'));
                        if (!startTime) return;

                        const elapsed = now - startTime;
                        const seconds = Math.floor((elapsed / 1000) % 60);
                        const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
                        const hours = Math.floor((elapsed / (1000 * 60 * 60)) % 24);
                        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));

                        el.textContent = \`\${days} วัน \${hours} ชั่วโมง \${minutes} นาที \${seconds} วินาที\`;
                    });
                }

                // ฟังก์ชันส่งปิงไปยังเซิร์ฟเวอร์
                function sendPing() {
                    const timestamp = Date.now();
                    socket.emit('ping', timestamp);
                }

                // ส่งปิงทุกๆ 5 วินาที
                setInterval(sendPing, 5000);
                // ส่งปิงทันทีเมื่อโหลดหน้า
                sendPing();

                // ฟังก์ชันแสดง Toast
                function showToast(message, type = 'info') {
                    const toastContainer = document.querySelector('.toast-container');
                    const toastEl = document.createElement('div');
                    toastEl.className = \`toast align-items-center text-bg-\${type} border-0\`;
                    toastEl.setAttribute('role', 'alert');
                    toastEl.setAttribute('aria-live', 'assertive');
                    toastEl.setAttribute('aria-atomic', 'true');
                    toastEl.innerHTML = \`
                        <div class="d-flex">
                            <div class="toast-body">
                                \${message}
                            </div>
                            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>
                    \`;
                    toastContainer.appendChild(toastEl);
                    const toast = new bootstrap.Toast(toastEl);
                    toast.show();

                    // ลบ Toast หลังจากปิด
                    toastEl.addEventListener('hidden.bs.toast', () => {
                        toastEl.remove();
                    });
                }

                // รับข้อมูลอัปเดตจากเซิร์ฟเวอร์
                socket.on('updateBots', (data) => {
                    document.getElementById('totalBots').textContent = data.totalBots;
                    document.getElementById('onlineBots').textContent = data.onlineBots;
                    document.getElementById('activeBots').textContent = data.activeBots;
                    document.getElementById('websitePing').textContent = data.websitePing + ' ms';

                    const botTableBody = document.getElementById('botTableBody');
                    if (botTableBody) {
                        botTableBody.innerHTML = data.botRows;
                    }

                    updateRuntime();
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทถูกลบ
                socket.on('botDeleted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกลบเรียบร้อยแล้ว\`, 'success');
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทไปออฟไลน์
                socket.on('botOffline', (botName) => {
                    showToast(\`บอท "\${botName}" กำลังจะถูกลบภายใน 60 วินาที เนื่องจากออฟไลน์\`, 'warning');
                });

                // รับเหตุการณ์เฉพาะเมื่อบอทถูกรีสตาร์ท
                socket.on('botRestarted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกรีสตาร์ทเรียบร้อยแล้ว\`, 'success');
                });

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

                // Event Delegation สำหรับปุ่มลบ, แก้ไข, และรีสตาร์ท
                document.addEventListener('click', function(event) {
                    if (event.target.closest('.delete-btn')) {
                        const token = decodeURIComponent(event.target.closest('.delete-btn').getAttribute('data-token'));
                        const deleteCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการลบบอท:');
                        if (deleteCode) {
                            fetch('/delete', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, code: deleteCode })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showToast('ลบบอทสำเร็จ', 'success');
                                } else {
                                    showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาดในการลบบอท', 'danger');
                            });
                        }
                    }

                    if (event.target.closest('.edit-btn')) {
                        const token = decodeURIComponent(event.target.closest('.edit-btn').getAttribute('data-token'));
                        const editCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการแก้ไขโทเค่น:');
                        if (editCode) {
                            const newToken = prompt('กรุณากรอกโทเค่นใหม่:');
                            if (newToken) {
                                fetch('/edit', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ token, code: editCode, newToken })
                                })
                                .then(response => response.json())
                                .then(data => {
                                    if (data.success) {
                                        showToast('แก้ไขโทเค่นสำเร็จ', 'success');
                                    } else {
                                        showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                    }
                                })
                                .catch(err => {
                                    console.error(err);
                                    showToast('เกิดข้อผิดพลาดในการแก้ไขโทเค่น', 'danger');
                                });
                            }
                        }
                    }

                    // การจัดการปุ่มรีสตาร์ท
                    if (event.target.closest('.restart-btn')) {
                        const token = decodeURIComponent(event.target.closest('.restart-btn').getAttribute('data-token'));
                        const restartCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยันการรีสตาร์ทบอท:');
                        if (restartCode) {
                            fetch('/restart', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, code: restartCode })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    showToast('รีสตาร์ทบอทสำเร็จ', 'success');
                                    io.emit('botRestarted', data.botName); // ส่งเหตุการณ์รีสตาร์ทบอท
                                } else {
                                    showToast(data.message || 'รหัสไม่ถูกต้องหรือเกิดข้อผิดพลาด', 'danger');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาดในการรีสตาร์ทบอท', 'danger');
                            });
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// Route ชั่วคราวสำหรับตรวจสอบบอททั้งหมดและโทเค็น (เพื่อช่วยในการ Debug)
app.get("/debug/bots", (req, res) => {
    const bots = Object.entries(botSessions).map(([token, bot]) => ({
        token,
        name: bot.name,
        status: bot.status,
        password: bot.password,
        adminID: bot.adminID,
        ping: bot.ping || 'N/A',
        prefix: bot.prefix
    }));
    res.json(bots);
});

// POST /start เพื่อเริ่มต้นบอท
// ... รหัสที่เหลือยังคงเดิม ...

// เริ่มต้นเซิร์ฟเวอร์และโหลดบอทจากไฟล์ที่เก็บไว้
server.listen(PORT, () => {
    console.log(chalk.blue(`🌐 เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${PORT}`));
    console.log(chalk.green(figlet.textSync("Bot Management", { horizontalLayout: "full" })));
    loadBotsFromFiles();
});

// ฟังก์ชันช่วยเหลือในการอัปเดตปิงของบอททุกๆ 5 วินาที
setInterval(() => {
    Object.values(botSessions).forEach(bot => {
        // จำลองการปิงด้วยการสุ่มค่าระหว่าง 1-200 ms
        bot.ping = Math.floor(Math.random() * 200) + 1;
    });
    io.emit('updateBots', generateBotData());
}, 5000); // อัปเดตทุก 5 วินาที

// ฟังก์ชันระบบอัตโนมัติทุก ๆ 5 นาที เพื่อลบบอทที่ยังล้มเหลว
setInterval(() => {
    console.log(chalk.yellow('🔍 กำลังตรวจสอบบอททั้งหมดสำหรับการลบอัตโนมัติ...'));
    let botsToDelete = 0;
    Object.keys(botSessions).forEach(token => {
        const bot = botSessions[token];
        if (bot.status === 'connection_failed' || bot.status === 'offline') { // ตรวจสอบทั้งสองสถานะ
            console.log(chalk.yellow(`⌛ บอท "${bot.name}" จะถูกลบออกเนื่องจากสถานะ "${bot.status}"`));
            deleteBot(token, true);
            botsToDelete++;
        }
    });
    if (botsToDelete === 0) {
        console.log(chalk.green('✅ ไม่มีบอทที่ต้องการลบในครั้งนี้'));
    }
}, 300000); // 300,000 มิลลิวินาที = 5 นาที
