/*****************************************************
 * index.js (ธีมคริสต์มาส 2025)
 * ปรับปรุงจากโค้ดต้นฉบับ โดยเพิ่มความสามารถในการอัปโหลดคำสั่งของผู้ใช้
 *****************************************************/
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const login = require('ryuu-fca-api'); // ตรวจสอบว่าติดตั้งแพ็กเกจนี้แล้ว
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // สำหรับการอัปโหลดไฟล์

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
global.botSessions = {}; 
const commands = {};
const commandDescriptions = [];
let commandUsage = {};

const botsDir = path.join(__dirname, 'bots');
const dataDir = path.join(__dirname, 'data'); // โฟลเดอร์สำหรับเก็บข้อมูล

// สร้างโฟลเดอร์ bots และ data ถ้ายังไม่มี
if (!fs.existsSync(botsDir)) {
    fs.mkdirSync(botsDir);
}
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// เส้นทางของไฟล์ commandUsage.json
const commandUsageFile = path.join(dataDir, 'commandUsage.json');

// ฟังก์ชันช่วยเหลือในการโหลด commandUsage จากไฟล์
function loadCommandUsage() {
    if (fs.existsSync(commandUsageFile)) {
        try {
            const data = fs.readFileSync(commandUsageFile, 'utf-8');
            commandUsage = JSON.parse(data);
            console.log(chalk.green('✅ โหลด commandUsage สำเร็จ'));
        } catch (err) {
            console.error(chalk.red(`❌ ไม่สามารถโหลด commandUsage จากไฟล์ได้: ${err.message}`));
            commandUsage = {};
        }
    } else {
        commandUsage = {};
    }
}

// ฟังก์ชันช่วยเหลือในการบันทึก commandUsage ลงไฟล์
function saveCommandUsage() {
    try {
        fs.writeFileSync(commandUsageFile, JSON.stringify(commandUsage, null, 4), 'utf-8');
        console.log(chalk.green('✅ บันทึก commandUsage สำเร็จ'));
    } catch (err) {
        console.error(chalk.red(`❌ ไม่สามารถบันทึก commandUsage ลงไฟล์ได้: ${err.message}`));
    }
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
                commandUsage[command.config.name.toLowerCase()] = commandUsage[command.config.name.toLowerCase()] || 0; // เริ่มต้นตัวนับคำสั่ง
                console.log(`📦 โหลดคำสั่ง: ${command.config.name}`);
            }
        }
    });
}

// โหลด commandUsage จากไฟล์เมื่อเริ่มต้นเซิร์ฟเวอร์
loadCommandUsage();

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

// ตัวแปรสำหรับเก็บค่าปิงของเว็บไซต์
let websitePing = 0;

// ฟังก์ชันสร้างข้อมูลบอทสำหรับอัปเดต
function generateBotData() {
    const totalBots = Object.keys(botSessions).length;
    const onlineBots = Object.values(botSessions).filter(bot => bot.status === 'online' || bot.status === 'active').length;
    const activeBots = Object.values(botSessions).filter(bot => bot.status === 'active').length;

    // สร้างแถวตารางบอท
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
                <button class="btn btn-secondary btn-sm restart-btn" data-token="${encodeURIComponent(token)}"><i class="fas fa-sync-alt"></i> รีสตาร์ท</button>
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

// ฟังก์ชันช่วยเหลือในการแปลสถานะ
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

// ฟังก์ชันกำหนดคลาสสีสถานะ
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

// ฟังก์ชันสร้างข้อมูลคำสั่ง
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

// โหลดบอทจากไฟล์
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

// ------------------------- หน้าเว็บต่าง ๆ -------------------------

// หน้าแดชบอร์ดหลัก
app.get("/", (req, res) => {
    const data = generateBotData(); 

    // เปลี่ยนเฉพาะธีมให้เป็นคริสต์มาส 2025 + เพิ่มเอฟเฟกต์หิมะตกให้สมจริง
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>แดชบอร์ดหลัก | Merry Christmas 2025</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

            <style>
                /* ========= ธีมคริสต์มาส 2025 ========= */

                :root {
                    --primary-color: #c62828;   /* โทนแดงคริสต์มาส */
                    --secondary-color: #2e7d32; /* โทนเขียวคริสต์มาส */
                }

                /* พื้นหลัง */
                body {
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                    margin: 0;
                    padding: 0;
                }

                /* Flex Layout */
                html, body {
                    height: 100%;
                }
                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }
                main.flex-grow-1 {
                    flex: 1;
                }

                /* Overlay */
                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: -1;
                }

                /* ปรับแต่ง Navbar */
                .navbar {
                    background: rgba(198, 40, 40, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                }
                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #fff !important;
                }
                .navbar-nav .nav-link {
                    color: #fff !important;
                    transition: color 0.3s ease;
                }
                .navbar-nav .nav-link:hover {
                    color: #ffd54f !important;
                }

                /* ปุ่ม Hover */
                .btn:hover {
                    transform: translateY(-2px);
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
                    color: #ffd54f; /* เหลืองทองเข้ากับคริสต์มาส */
                }
                .stats-label {
                    font-size: 1rem;
                    color: #ffffff;
                }

                .glass-card {
                    background: rgba(255, 255, 255, 0.15);
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
                    background-color: rgba(198, 40, 40, 0.9);
                    color: #fff;
                    font-weight: 600;
                }
                .bot-table tr:nth-child(even),
                .command-table tr:nth-child(even) {
                    background-color: rgba(255, 255, 255, 0.1);
                }

                /* ปรับแต่งสถานะ */
                .status-online {
                    background: #2e7d32;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-active {
                    background: #43a047;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-connecting {
                    background: #ffd54f;
                    color: #212529;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-connection-failed {
                    background: #ef5350;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-offline {
                    background: #616161;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                /* ปรับแต่ง Footer */
                .footer {
                    background: rgba(198, 40, 40, 0.9);
                    border-top: 2px solid rgba(255, 213, 79, 0.5);
                    padding: 20px 0;
                    font-size: 0.9rem;
                    color: #ffffff;
                }

                /* ปุ่ม */
                .btn-primary {
                    background: #ffd54f;
                    border: none;
                    padding: 10px 20px;
                    font-size: 1rem;
                    border-radius: 8px;
                    transition: background 0.3s ease, transform 0.2s ease;
                    color: #212529;
                    font-weight: 600;
                }
                .btn-primary:hover {
                    background: #ffca28;
                }
                .btn-warning, .btn-danger, .btn-secondary {
                    transition: transform 0.2s ease;
                }
                .btn-warning:hover, .btn-danger:hover, .btn-secondary:hover {
                    transform: scale(1.05);
                }

                /* Toast */
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }

                /* ข้อความ / Text */
                .bot-name {
                    font-family: 'Press Start 2P', cursive;
                    color: #ffd54f;
                    font-size: 1.1rem;
                }
                .runtime {
                    font-weight: 500;
                    color: #ffd54f;
                }
                .ping {
                    font-weight: 500;
                    color: #2e7d32;
                }

                /* Animation ลอยเบาๆ */
                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                /* =========== หิมะตกแบบสมจริง =========== */
                .snowflake {
                    position: fixed;
                    top: -10%;
                    /* ใช้ top เป็น -10% เพื่อกันไม่ให้หิมะโผล่มาเห็นก่อนจะเริ่มแอนิเมชัน */
                    z-index: 9999;
                    pointer-events: none;
                    color: #fff;
                    opacity: 0.8;
                    /* animation จะถูกกำหนดแบบสุ่มผ่าน JS */
                }

                /* ตั้งค่า keyframes เพื่อให้หิมะร่วงลงมาพร้อมการหมุนและการส่าย (drift) */
                @keyframes snowfall {
                    0% { transform: translateX(0) translateY(0) rotate(0deg); }
                    50% { transform: translateX(30px) translateY(50vh) rotate(180deg); }
                    100% { transform: translateX(-30px) translateY(100vh) rotate(360deg); }
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
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <!-- ไอคอนต้นคริสต์มาสสไตล์ Snowflake แทน Robot ก็ได้ -->
                        <i class="fas fa-snowflake fa-lg me-2 animate-float" style="color: #fff;"></i>
                        Merry Christmas 2025
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
                            <li class="nav-item">
                                <a class="nav-link" href="/upload-commands"><i class="fas fa-upload me-1"></i> อัปโหลดคำสั่ง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <main class="flex-grow-1">
                <div class="container">
                    <!-- สถิติ -->
                    <div class="row mb-4">
                        <div class="col-md-3 col-sm-6 mb-3">
                            <div class="stats-card">
                                <i class="fas fa-robot fa-2x mb-3" style="color: #ffd54f;"></i>
                                <div class="stats-number" id="totalBots">${data.totalBots}</div>
                                <div class="stats-label">บอททั้งหมด</div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-6 mb-3">
                            <div class="stats-card">
                                <i class="fas fa-signal fa-2x mb-3" style="color: #2e7d32;"></i>
                                <div class="stats-number" id="onlineBots">${data.onlineBots}</div>
                                <div class="stats-label">บอทออนไลน์</div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-6 mb-3">
                            <div class="stats-card">
                                <i class="fas fa-clock fa-2x mb-3" style="color: #ffd54f;"></i>
                                <div class="stats-number" id="activeBots">${data.activeBots}</div>
                                <div class="stats-label">บอททำงานแล้ว</div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-6 mb-3">
                            <div class="stats-card">
                                <i class="fas fa-tachometer-alt fa-2x mb-3" style="color: #2e7d32;"></i>
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
                                    <i class="fas fa-robot me-2" style="color: #ffd54f;"></i>
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
            </main>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} Merry Christmas 2025 | Powered with ❤️</p>
                </div>
            </footer>

            <!-- สคริปต์หลัก -->
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();

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

                // แสดง Toast
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

                socket.on('botDeleted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกลบเรียบร้อยแล้ว\`, 'success');
                });
                socket.on('botOffline', (botName) => {
                    showToast(\`บอท "\${botName}" กำลังจะถูกลบภายใน 60 วินาที เนื่องจากออฟไลน์\`, 'warning');
                });
                socket.on('botRestarted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกรีสตาร์ทเรียบร้อยแล้ว\`, 'success');
                });

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

                // จัดการลบ, แก้ไข, และรีสตาร์ทบอทผ่าน Fetch
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
                                    socket.emit('botRestarted', data.botName);
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

                // ========== สคริปต์สร้างหิมะตกสมจริง ==========
                document.addEventListener('DOMContentLoaded', function() {
                    // จำนวนหิมะที่ต้องการ
                    const snowflakesCount = 60;

                    // ตัวเลือกสัญลักษณ์หิมะ เพื่อให้ดูหลากหลาย
                    const snowSymbols = ['❄', '❅', '❆', '✻', '✼'];

                    // ฟังก์ชันสุ่มตัวเลขระหว่าง min กับ max
                    function randomIntBetween(min, max) {
                        return Math.floor(Math.random() * (max - min + 1) + min);
                    }

                    // ฟังก์ชันสุ่มเลือกสัญลักษณ์หิมะ
                    function randomSnowSymbol() {
                        return snowSymbols[Math.floor(Math.random() * snowSymbols.length)];
                    }

                    for (let i = 0; i < snowflakesCount; i++) {
                        const snowflake = document.createElement('div');
                        snowflake.classList.add('snowflake');

                        // กำหนดค่าแบบสุ่ม
                        const size = randomIntBetween(15, 30); // ขนาดตัวอักษร (px)
                        const leftPos = Math.random() * 100;   // ตำแหน่ง left เป็นเปอร์เซ็นต์
                        const delay = Math.random() * 5;       // หน่วงเวลาเริ่มต้น (s)
                        const duration = randomIntBetween(10, 20); // ระยะเวลาที่หิมะร่วง (s)
                        const rotateStart = randomIntBetween(0, 360);

                        snowflake.style.left = leftPos + '%';
                        snowflake.style.fontSize = size + 'px';
                        snowflake.style.animation = \`snowfall \${duration}s linear \${delay}s infinite\`;
                        snowflake.style.transform = \`rotate(\${rotateStart}deg)\`; 
                        snowflake.style.opacity = Math.random() * 0.6 + 0.4; // ให้ความโปร่งใสหลากหลาย
                        snowflake.textContent = randomSnowSymbol();

                        document.body.appendChild(snowflake);
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

    // เปลี่ยนเฉพาะธีมให้เป็นคริสต์มาส 2025 + เพิ่มหิมะตก
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>เพิ่มบอท | Merry Christmas 2025</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* ========= ธีมคริสต์มาส 2025 ========= */
                :root {
                    --primary-color: #c62828;
                    --secondary-color: #2e7d32;
                }

                body {
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                    margin: 0;
                    padding: 0;
                }

                html, body {
                    height: 100%;
                }

                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }

                main.flex-grow-1 {
                    flex: 1;
                }

                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: -1;
                }

                .navbar {
                    background: rgba(198, 40, 40, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #fff !important;
                }

                .navbar-nav .nav-link {
                    color: #fff !important;
                    transition: color 0.3s ease;
                }
                .navbar-nav .nav-link:hover {
                    color: #ffd54f !important;
                }

                .glass-card {
                    background: rgba(255, 255, 255, 0.15);
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
                    border-color: #ffd54f;
                    box-shadow: 0 0 0 0.2rem rgba(255, 213, 79, 0.25);
                    background: rgba(255, 255, 255, 0.3);
                    color: #ffffff;
                }

                .btn-primary {
                    background: #ffd54f;
                    border: none;
                    padding: 10px 20px;
                    font-size: 1rem;
                    border-radius: 8px;
                    transition: background 0.3s ease, transform 0.2s ease;
                    color: #212529;
                    font-weight: 600;
                }

                .btn-primary:hover {
                    background: #ffca28;
                }

                .footer {
                    background: rgba(198, 40, 40, 0.9);
                    border-top: 2px solid rgba(255, 213, 79, 0.5);
                    padding: 20px 0;
                    font-size: 0.9rem;
                    color: #ffffff;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }

                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                }

                /* ===== ใส่เอฟเฟกต์หิมะ ===== */
                #snow-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none; /* ไม่ให้เมาส์คลิกโดน */
                    overflow: hidden;
                    z-index: 9999; /* บนสุด */
                }
                .snowflake {
                    position: absolute;
                    top: -2em; /* เริ่มเหนือจอ */
                    color: #fff; /* สีขาว */
                    font-size: 1.2em;
                    pointer-events: none;
                    user-select: none;
                    animation-name: fall;
                    animation-timing-function: linear;
                    animation-iteration-count: 1;
                }
                @keyframes fall {
                    0% {
                        transform: translateY(-100%);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(120vh);
                        opacity: 0;
                    }
                }

                /* ====== โมดัลคำอธิบาย ====== */
                .modal-header {
                    border-bottom: none;
                }
                .modal-footer {
                    border-top: none;
                }

                /* ====== ตัวอย่างชื่อบอท ====== */
                #botNamePreview {
                    margin-top: 10px;
                    font-weight: 600;
                    color: #ffd54f;
                }

                /* ====== อินดิเคเตอร์การส่งข้อมูล ====== */
                #loadingOverlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-snowflake fa-lg me-2 animate-float" style="color: #fff;"></i>
                        Merry Christmas 2025
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
                            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
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
                            <li class="nav-item">
                                <a class="nav-link" href="/upload-commands"><i class="fas fa-upload me-1"></i> อัปโหลดคำสั่ง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <main class="flex-grow-1">
                <div class="container">
                    <!-- สถิติ -->
                    <div class="row mb-4">
                        <div class="col-md-3 col-sm-6 mb-3">
                            <div class="stats-card">
                                <i class="fas fa-robot fa-2x mb-3" style="color: #ffd54f;"></i>
                                <div class="stats-number" id="totalBots">${data.totalBots}</div>
                                <div class="stats-label">บอททั้งหมด</div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-6 mb-3">
                            <div class="stats-card">
                                <i class="fas fa-signal fa-2x mb-3" style="color: #2e7d32;"></i>
                                <div class="stats-number" id="onlineBots">${data.onlineBots}</div>
                                <div class="stats-label">บอทออนไลน์</div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-6 mb-3">
                            <div class="stats-card">
                                <i class="fas fa-clock fa-2x mb-3" style="color: #ffd54f;"></i>
                                <div class="stats-number" id="activeBots">${data.activeBots}</div>
                                <div class="stats-label">บอททำงานแล้ว</div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-6 mb-3">
                            <div class="stats-card">
                                <i class="fas fa-tachometer-alt fa-2x mb-3" style="color: #2e7d32;"></i>
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
                                    <i class="fas fa-robot me-2" style="color: #ffd54f;"></i>
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
            </main>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} Merry Christmas 2025 | Powered with ❤️</p>
                </div>
            </footer>

            <!-- Container สำหรับหิมะ -->
            <div id="snow-container"></div>

            <!-- สคริปต์หลัก -->
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();

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

                // แสดง Toast
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

                socket.on('botDeleted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกลบเรียบร้อยแล้ว\`, 'success');
                });
                socket.on('botOffline', (botName) => {
                    showToast(\`บอท "\${botName}" กำลังจะถูกลบภายใน 60 วินาที เนื่องจากออฟไลน์\`, 'warning');
                });
                socket.on('botRestarted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกรีสตาร์ทเรียบร้อยแล้ว\`, 'success');
                });

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

                // จัดการลบ, แก้ไข, และรีสตาร์ทบอทผ่าน Fetch
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
                                    socket.emit('botRestarted', data.botName);
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

                // ========== สคริปต์สร้างหิมะตกสมจริง ==========
                document.addEventListener('DOMContentLoaded', function() {
                    // จำนวนหิมะที่ต้องการ
                    const snowflakesCount = 60;

                    // ตัวเลือกสัญลักษณ์หิมะ เพื่อให้ดูหลากหลาย
                    const snowSymbols = ['❄', '❅', '❆', '✻', '✼'];

                    // ฟังก์ชันสุ่มตัวเลขระหว่าง min กับ max
                    function randomIntBetween(min, max) {
                        return Math.floor(Math.random() * (max - min + 1) + min);
                    }

                    // ฟังก์ชันสุ่มเลือกสัญลักษณ์หิมะ
                    function randomSnowSymbol() {
                        return snowSymbols[Math.floor(Math.random() * snowSymbols.length)];
                    }

                    for (let i = 0; i < snowflakesCount; i++) {
                        const snowflake = document.createElement('div');
                        snowflake.classList.add('snowflake');

                        // กำหนดค่าแบบสุ่ม
                        const size = randomIntBetween(15, 30); // ขนาดตัวอักษร (px)
                        const leftPos = Math.random() * 100;   // ตำแหน่ง left เป็นเปอร์เซ็นต์
                        const delay = Math.random() * 5;       // หน่วงเวลาเริ่มต้น (s)
                        const duration = randomIntBetween(10, 20); // ระยะเวลาที่หิมะร่วง (s)
                        const rotateStart = randomIntBetween(0, 360);

                        snowflake.style.left = leftPos + '%';
                        snowflake.style.fontSize = size + 'px';
                        snowflake.style.animation = \`snowfall \${duration}s linear \${delay}s infinite\`;
                        snowflake.style.transform = \`rotate(\${rotateStart}deg)\`; 
                        snowflake.style.opacity = Math.random() * 0.6 + 0.4; // ให้ความโปร่งใสหลากหลาย
                        snowflake.textContent = randomSnowSymbol();

                        document.body.appendChild(snowflake);
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// หน้าอัปโหลดคำสั่ง
app.get("/upload-commands", (req, res) => {
    // ตรวจสอบว่าผู้ใช้ได้ล็อกอินและมีสิทธิ์ในการอัปโหลดคำสั่งสำหรับบอทใดบ้าง
    // ตัวอย่างนี้สมมุติว่าผู้ใช้สามารถอัปโหลดได้ทุกบอทที่เขาเป็นแอดมิน
    // คุณควรเพิ่มการตรวจสอบสิทธิ์จริงตามระบบของคุณ

    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>อัปโหลดคำสั่ง | Merry Christmas 2025</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* ========= ธีมคริสต์มาส 2025 ========= */
                :root {
                    --primary-color: #c62828;
                    --secondary-color: #2e7d32;
                }

                body {
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                    margin: 0;
                    padding: 0;
                }

                html, body {
                    height: 100%;
                }

                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }

                main.flex-grow-1 {
                    flex: 1;
                }

                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: -1;
                }

                .navbar {
                    background: rgba(198, 40, 40, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #fff !important;
                }

                .navbar-nav .nav-link {
                    color: #fff !important;
                    transition: color 0.3s ease;
                }
                .navbar-nav .nav-link:hover {
                    color: #ffd54f !important;
                }

                .glass-card {
                    background: rgba(255, 255, 255, 0.15);
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
                    border-color: #ffd54f;
                    box-shadow: 0 0 0 0.2rem rgba(255, 213, 79, 0.25);
                    background: rgba(255, 255, 255, 0.3);
                    color: #ffffff;
                }

                .btn-primary {
                    background: #ffd54f;
                    border: none;
                    padding: 10px 20px;
                    font-size: 1rem;
                    border-radius: 8px;
                    transition: background 0.3s ease, transform 0.2s ease;
                    color: #212529;
                    font-weight: 600;
                }

                .btn-primary:hover {
                    background: #ffca28;
                }

                .footer {
                    background: rgba(198, 40, 40, 0.9);
                    border-top: 2px solid rgba(255, 213, 79, 0.5);
                    padding: 20px 0;
                    font-size: 0.9rem;
                    color: #ffffff;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }

                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                }

                /* ===== ใส่เอฟเฟกต์หิมะ ===== */
                #snow-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none; /* ไม่ให้เมาส์คลิกโดน */
                    overflow: hidden;
                    z-index: 9999; /* บนสุด */
                }
                .snowflake {
                    position: absolute;
                    top: -2em; /* เริ่มเหนือจอ */
                    color: #fff; /* สีขาว */
                    font-size: 1.2em;
                    pointer-events: none;
                    user-select: none;
                    animation-name: fall;
                    animation-timing-function: linear;
                    animation-iteration-count: 1;
                }
                @keyframes fall {
                    0% {
                        transform: translateY(-100%);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(120vh);
                        opacity: 0;
                    }
                }

                /* ====== โมดัลคำอธิบาย ====== */
                .modal-header {
                    border-bottom: none;
                }
                .modal-footer {
                    border-top: none;
                }

                /* ====== ตัวอย่างชื่อบอท ====== */
                #botNamePreview {
                    margin-top: 10px;
                    font-weight: 600;
                    color: #ffd54f;
                }

                /* ====== อินดิเคเตอร์การส่งข้อมูล ====== */
                #loadingOverlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-snowflake fa-lg me-2 animate-float" style="color: #fff;"></i>
                        Merry Christmas 2025
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
                            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
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
                            <li class="nav-item">
                                <a class="nav-link" href="/upload-commands"><i class="fas fa-upload me-1"></i> อัปโหลดคำสั่ง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <main class="flex-grow-1">
                <div class="container">
                    <div class="glass-card">
                        <h5 class="mb-4">
                            <i class="fas fa-plus-circle me-2" style="color: #ffd54f;"></i>
                            เพิ่มบอทใหม่
                        </h5>
                        ${errorMessage}
                        <form class="add-bot-form" method="POST" action="/start" id="addBotForm">
                            <div class="mb-3">
                                <label for="token" class="form-label">โทเค็นของคุณ</label>
                                <textarea 
                                    id="token" 
                                    name="token" 
                                    class="form-control" 
                                    rows="4" 
                                    placeholder='{"appState": "YOUR_APP_STATE"}'
                                    required
                                ></textarea>
                            </div>
                            <div class="mb-3">
                                <label for="prefix" class="form-label">คำนำหน้าบอท</label>
                                <input 
                                    type="text" 
                                    id="prefix" 
                                    name="prefix" 
                                    class="form-control" 
                                    placeholder="/" 
                                    required
                                    pattern="^.{1,10}$" 
                                    title="กรุณากรอกคำนำหน้าที่มีความยาว 1-10 ตัวอักษร"
                                />
                            </div>
                            <div class="mb-3">
                                <label for="name" class="form-label">ชื่อบอท</label>
                                <input 
                                    type="text" 
                                    id="name" 
                                    name="name" 
                                    class="form-control" 
                                    placeholder="MyBot" 
                                    required
                                    pattern="^[a-zA-Z0-9_-]{3,20}$" 
                                    title="กรุณากรอกชื่อบอทที่มีความยาว 3-20 ตัวอักษร และประกอบด้วย a-z, A-Z, 0-9, -, _"
                                />
                                <div id="botNamePreview">ตัวอย่าง: <span id="previewText">MyBot</span></div>
                            </div>
                            <div class="mb-3">
                                <label for="password" class="form-label">ตั้งรหัสผ่าน 6 หลักสำหรับการจัดการบอท</label>
                                <input 
                                    type="password" 
                                    id="password" 
                                    name="password" 
                                    class="form-control" 
                                    pattern="\\d{6}" 
                                    placeholder="123456" 
                                    required
                                    title="กรุณากรอกรหัสผ่าน 6 หลัก"
                                />
                            </div>
                            <div class="mb-3">
                                <label for="adminID" class="form-label">ID แอดมินของบอท</label>
                                <input 
                                    type="text" 
                                    id="adminID" 
                                    name="adminID" 
                                    class="form-control" 
                                    placeholder="61555184860915" 
                                    required
                                    title="กรุณากรอก ID แอดมินของบอท"
                                />
                            </div>
                            <button type="submit" class="btn btn-primary w-100" id="submitButton">
                                <i class="fas fa-play me-2"></i>
                                เริ่มบอท
                            </button>
                        </form>
                    </div>
                </div>
            </main>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} Merry Christmas 2025 | Powered with ❤️</p>
                </div>
            </footer>

            <!-- Container สำหรับหิมะ -->
            <div id="snow-container"></div>

            <!-- โมดัลคำอธิบาย -->
            <div class="modal fade" id="descriptionModal" tabindex="-1" aria-labelledby="descriptionModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content bg-dark text-white">
                        <div class="modal-header">
                            <h5 class="modal-title" id="descriptionModalLabel">คำอธิบายการเพิ่มบอท</h5>
                        </div>
                        <div class="modal-body">
                            กรุณากรอกข้อมูลโทเค็น, คำนำหน้าบอท, ชื่อบอท, รหัสผ่าน 6 หลัก และ ID แอดมิน เพื่อเริ่มต้นบอทของคุณ
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">ตกลง</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- อินดิเคเตอร์การส่งข้อมูล -->
            <div id="loadingOverlay">
                <div class="spinner-border text-light" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>

            <div class="toast-container"></div>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // ========= สคริปต์หิมะตก =========
                function createSnowflake() {
                    const snowflakeText = "❄";
                    const snowflake = document.createElement("span");
                    snowflake.classList.add("snowflake");
                    snowflake.textContent = snowflakeText;

                    // สุ่มตำแหน่ง X
                    snowflake.style.left = Math.random() * 100 + "%";

                    // สุ่มขนาด + ระยะเวลาตก
                    const size = (Math.random() * 1.2 + 0.5) + "em";
                    const duration = (Math.random() * 5 + 5) + "s"; // 5-10 วินาที
                    snowflake.style.fontSize = size;
                    snowflake.style.animationDuration = duration;

                    // เพิ่มเข้าใน #snow-container
                    const snowContainer = document.getElementById("snow-container");
                    snowContainer.appendChild(snowflake);

                    // ลบเมื่อแอนิเมชันจบ
                    snowflake.addEventListener("animationend", () => {
                        snowflake.remove();
                    });
                }

                // สร้างหิมะทุก 300ms
                setInterval(createSnowflake, 300);
            </script>
        </body>
        </html>
    `);
});

// หน้าแสดงบอทรัน
app.get("/bots", (req, res) => {
    const data = generateBotData(); 

    // เปลี่ยนเฉพาะธีมเป็นคริสต์มาส 2025 + หิมะตก
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ดูบอทรัน | Merry Christmas 2025</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* ========= ธีมคริสต์มาส 2025 ========= */
                :root {
                    --primary-color: #c62828;
                    --secondary-color: #2e7d32;
                }

                body {
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                    margin: 0;
                    padding: 0;
                }

                html, body {
                    height: 100%;
                }

                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }

                main.flex-grow-1 {
                    flex: 1;
                }

                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: -1;
                }

                .navbar {
                    background: rgba(198, 40, 40, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #fff !important;
                }
                .navbar-nav .nav-link {
                    color: #fff !important;
                    transition: color 0.3s ease;
                }
                .navbar-nav .nav-link:hover {
                    color: #ffd54f !important;
                }

                .glass-card {
                    background: rgba(255, 255, 255, 0.15);
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
                    background-color: rgba(198, 40, 40, 0.9);
                    color: #fff;
                    font-weight: 600;
                }
                .bot-table tr:nth-child(even),
                .command-table tr:nth-child(even) {
                    background-color: rgba(255, 255, 255, 0.1);
                }

                .status-online {
                    background: #2e7d32;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-active {
                    background: #43a047;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-connecting {
                    background: #ffd54f;
                    color: #212529;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-connection-failed {
                    background: #ef5350;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-offline {
                    background: #616161;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .footer {
                    background: rgba(198, 40, 40, 0.9);
                    border-top: 2px solid rgba(255, 213, 79, 0.5);
                    padding: 20px 0;
                    font-size: 0.9rem;
                    color: #ffffff;
                }

                .btn-warning, .btn-danger, .btn-secondary {
                    transition: transform 0.2s ease;
                }
                .btn-warning:hover, .btn-danger:hover, .btn-secondary:hover {
                    transform: scale(1.05);
                }

                .bot-name {
                    font-family: 'Press Start 2P', cursive;
                    color: #ffd54f;
                    font-size: 1.1rem;
                }
                .runtime {
                    font-weight: 500;
                    color: #ffd54f;
                }
                .ping {
                    font-weight: 500;
                    color: #2e7d32;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                    .bot-table th, .bot-table td,
                    .command-table th, .command-table td {
                        padding: 8px 10px;
                    }
                }

                /* ===== เพิ่มเอฟเฟกต์หิมะ ===== */
                #snow-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none; /* ไม่ให้เมาส์คลิกโดน */
                    overflow: hidden;
                    z-index: 9999; /* บนสุด */
                }
                .snowflake {
                    position: absolute;
                    top: -2em; /* เริ่มเหนือจอ */
                    color: #fff; /* สีขาว */
                    font-size: 1.2em;
                    pointer-events: none;
                    user-select: none;
                    animation-name: fall;
                    animation-timing-function: linear;
                    animation-iteration-count: 1;
                }
                @keyframes fall {
                    0% {
                        transform: translateY(-100%);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(120vh);
                        opacity: 0;
                    }
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-snowflake fa-lg me-2 animate-float" style="color: #fff;"></i>
                        Merry Christmas 2025
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
                            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item">
                                <a class="nav-link" href="/start"><i class="fas fa-plus-circle me-1"></i> เพิ่มบอท</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link active" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/how-to-make-bot"><i class="fas fa-video me-1"></i> วิธีทำบอทของคุณเอง</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/upload-commands"><i class="fas fa-upload me-1"></i> อัปโหลดคำสั่ง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <main class="flex-grow-1">
                <div class="container">
                    <div class="glass-card">
                        <h5 class="mb-4">
                            <i class="fas fa-list me-2" style="color: #2e7d32;"></i>
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
            </main>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} Merry Christmas 2025 | Powered with ❤️</p>
                </div>
            </footer>

            <!-- Container สำหรับหิมะ -->
            <div id="snow-container"></div>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();

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

                function sendPing() {
                    const timestamp = Date.now();
                    socket.emit('ping', timestamp);
                }
                setInterval(sendPing, 5000);
                sendPing();

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

                    toastEl.addEventListener('hidden.bs.toast', () => {
                        toastEl.remove();
                    });
                }

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

                socket.on('botDeleted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกลบเรียบร้อยแล้ว\`, 'success');
                });
                socket.on('botOffline', (botName) => {
                    showToast(\`บอท "\${botName}" กำลังจะถูกลบภายใน 60 วินาที เนื่องจากออฟไลน์\`, 'warning');
                });
                socket.on('botRestarted', (botName) => {
                    showToast(\`บอท "\${botName}" ถูกรีสตาร์ทเรียบร้อยแล้ว\`, 'success');
                });

                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

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
                                    socket.emit('botRestarted', data.botName);
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

                // ========= สคริปต์หิมะตก =========
                function createSnowflake() {
                    const snowflakeText = "❄"; // หรือจะ random หลาย ๆ ตัวก็ได้
                    const snowflake = document.createElement("span");
                    snowflake.classList.add("snowflake");
                    snowflake.textContent = snowflakeText;

                    // สุ่มตำแหน่ง X
                    snowflake.style.left = Math.random() * 100 + "%";

                    // สุ่มขนาด + ระยะเวลาตก
                    const size = (Math.random() * 1.2 + 0.5) + "em";
                    const duration = (Math.random() * 5 + 5) + "s"; // 5-10 วินาที
                    snowflake.style.fontSize = size;
                    snowflake.style.animationDuration = duration;

                    // เพิ่มเข้าใน #snow-container
                    const snowContainer = document.getElementById("snow-container");
                    snowContainer.appendChild(snowflake);

                    // ลบเมื่อแอนิเมชันจบ
                    snowflake.addEventListener("animationend", () => {
                        snowflake.remove();
                    });
                }

                // สร้างหิมะทุก 300ms
                setInterval(createSnowflake, 300);
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
            <title>คำสั่งที่ใช้ | Merry Christmas 2025</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* ========= ธีมคริสต์มาส 2025 ========= */
                :root {
                    --primary-color: #c62828;
                    --secondary-color: #2e7d32;
                    --glow-color: rgba(255, 213, 79, 0.3);
                }

                body {
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png')
                        no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                    margin: 0;
                    padding: 0;
                }

                html, body {
                    height: 100%;
                }

                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }

                main.flex-grow-1 {
                    flex: 1;
                }

                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: -1;
                }

                .navbar {
                    background: rgba(198, 40, 40, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                }
                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #fff !important;
                }
                .navbar-nav .nav-link {
                    color: #fff !important;
                    transition: color 0.3s ease;
                }
                .navbar-nav .nav-link:hover {
                    color: #ffd54f !important;
                }

                .glass-card {
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3), 0 0 20px var(--glow-color);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }
                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5), 0 0 30px var(--glow-color);
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
                    background-color: rgba(198, 40, 40, 0.9);
                    color: #fff;
                    font-weight: 600;
                }
                .command-table tr:nth-child(even) {
                    background-color: rgba(255, 255, 255, 0.1);
                }

                .footer {
                    background: rgba(198, 40, 40, 0.9);
                    border-top: 2px solid rgba(255, 213, 79, 0.5);
                    padding: 20px 0;
                    font-size: 0.9rem;
                    color: #ffffff;
                }

                .btn-warning, .btn-danger, .btn-secondary {
                    transition: transform 0.2s ease;
                }
                .btn-warning:hover, .btn-danger:hover, .btn-secondary:hover {
                    transform: scale(1.05);
                }

                .bot-name {
                    font-family: 'Press Start 2P', cursive;
                    color: #ffd54f;
                    font-size: 1.1rem;
                }
                .runtime {
                    font-weight: 500;
                    color: #ffd54f;
                }
                .ping {
                    font-weight: 500;
                    color: #2e7d32;
                }
                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                    .command-table th, .command-table td {
                        padding: 8px 10px;
                    }
                }

                /* ===== ใส่เอฟเฟกต์หิมะ ===== */
                #snow-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none; 
                    overflow: hidden;
                    z-index: 9999; /* บนสุด */
                }
                .snowflake {
                    position: absolute;
                    top: -2em; 
                    color: #fff;
                    font-size: 1.2em;
                    pointer-events: none;
                    user-select: none;
                    animation-name: fall;
                    animation-timing-function: linear;
                    animation-iteration-count: 1;
                    filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
                }
                @keyframes fall {
                    0% {
                        transform: translateY(-100%) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(120vh) rotate(360deg);
                        opacity: 0;
                    }
                }

                /* ===== เอฟเฟกต์แสงสว่าง ===== */
                .glow {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 200px;
                    height: 200px;
                    background: radial-gradient(circle, rgba(255, 213, 79, 0.3), transparent 70%);
                    transform: translate(-50%, -50%);
                    z-index: -1;
                    opacity: 0.5;
                    animation: glow-pulse 3s infinite alternate;
                }
                @keyframes glow-pulse {
                    0% { transform: translate(-50%, -50%) scale(1); }
                    100% { transform: translate(-50%, -50%) scale(1.2); }
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <div class="glow"></div>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-snowflake fa-lg me-2 animate-float" style="color: #fff;"></i>
                        Merry Christmas 2025
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
                            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
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
                            <li class="nav-item">
                                <a class="nav-link" href="/upload-commands"><i class="fas fa-upload me-1"></i> อัปโหลดคำสั่ง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <main class="flex-grow-1">
                <div class="container">
                    <div class="glass-card">
                        <h5 class="mb-4">
                            <i class="fas fa-terminal me-2" style="color: #2e7d32;"></i>
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
            </main>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} Merry Christmas 2025 | Powered with ❤️</p>
                </div>
            </footer>

            <!-- Container สำหรับหิมะ -->
            <div id="snow-container"></div>

            <div class="toast-container"></div>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // ========= สคริปต์หิมะตก =========
                function createSnowflake() {
                    const snowflakeText = "❄";
                    const snowflake = document.createElement("span");
                    snowflake.classList.add("snowflake");
                    snowflake.textContent = snowflakeText;

                    // สุ่มตำแหน่ง X
                    snowflake.style.left = Math.random() * 100 + "%";

                    // สุ่มขนาด + ระยะเวลาตก
                    const size = (Math.random() * 1.2 + 0.5) + "em";
                    const duration = (Math.random() * 5 + 5) + "s"; // 5-10 วินาที
                    snowflake.style.fontSize = size;
                    snowflake.style.animationDuration = duration;

                    // เพิ่มเข้าใน #snow-container
                    const snowContainer = document.getElementById("snow-container");
                    snowContainer.appendChild(snowflake);

                    // ลบเมื่อแอนิเมชันจบ
                    snowflake.addEventListener("animationend", () => {
                        snowflake.remove();
                    });
                }

                // สร้างหิมะทุก 300ms
                setInterval(createSnowflake, 300);
            </script>
        </body>
        </html>
    `);
});

// หน้า "วิธีทำบอทของคุณเอง"
app.get("/how-to-make-bot", (req, res) => {
    // เปลี่ยนเฉพาะธีมเป็นคริสต์มาส 2025
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>วิธีทำบอทของคุณเอง | Merry Christmas 2025</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                :root {
                    --primary-color: #c62828;
                    --secondary-color: #2e7d32;
                }

                body {
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                }

                html, body {
                    height: 100%;
                    margin: 0;
                    padding: 0;
                }

                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }

                main.flex-grow-1 {
                    flex: 1;
                }

                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: -1;
                }

                .navbar {
                    background: rgba(198, 40, 40, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #fff !important;
                }

                .navbar-nav .nav-link {
                    color: #fff !important;
                    transition: color 0.3s ease;
                }
                .navbar-nav .nav-link:hover {
                    color: #ffd54f !important;
                }

                .glass-card {
                    background: rgba(255, 255, 255, 0.15);
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
                    background: rgba(198, 40, 40, 0.9);
                    border-top: 2px solid rgba(255, 213, 79, 0.5);
                    padding: 20px 0;
                    font-size: 0.9rem;
                    color: #ffffff;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-snowflake fa-lg me-2 animate-float" style="color: #fff;"></i>
                        Merry Christmas 2025
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
                            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
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
                                <a class="nav-link active" href="/how-to-make-bot"><i class="fas fa-video me-1"></i> วิธีทำบอทของคุณเอง</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/upload-commands"><i class="fas fa-upload me-1"></i> อัปโหลดคำสั่ง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <main class="flex-grow-1">
                <div class="container">
                    <div class="glass-card">
                        <h5 class="mb-4">
                            <i class="fas fa-video me-2" style="color: #ffd54f;"></i>
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
            </main>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} Merry Christmas 2025 | Powered with ❤️</p>
                </div>
            </footer>

            <!-- Container สำหรับหิมะ -->
            <div id="snow-container"></div>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `);
});

// หน้าอัปโหลดคำสั่ง
app.get("/upload-commands", (req, res) => {
    // ตรวจสอบว่าผู้ใช้ได้ล็อกอินและมีสิทธิ์ในการอัปโหลดคำสั่งสำหรับบอทใดบ้าง
    // ตัวอย่างนี้สมมุติว่าผู้ใช้สามารถอัปโหลดได้ทุกบอทที่เขาเป็นแอดมิน
    // คุณควรเพิ่มการตรวจสอบสิทธิ์จริงตามระบบของคุณ

    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>อัปโหลดคำสั่ง | Merry Christmas 2025</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* ========= ธีมคริสต์มาส 2025 ========= */
                :root {
                    --primary-color: #c62828;
                    --secondary-color: #2e7d32;
                }

                body {
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                    margin: 0;
                    padding: 0;
                }

                html, body {
                    height: 100%;
                }

                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }

                main.flex-grow-1 {
                    flex: 1;
                }

                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: -1;
                }

                .navbar {
                    background: rgba(198, 40, 40, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #fff !important;
                }

                .navbar-nav .nav-link {
                    color: #fff !important;
                    transition: color 0.3s ease;
                }
                .navbar-nav .nav-link:hover {
                    color: #ffd54f !important;
                }

                .glass-card {
                    background: rgba(255, 255, 255, 0.15);
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
                    border-color: #ffd54f;
                    box-shadow: 0 0 0 0.2rem rgba(255, 213, 79, 0.25);
                    background: rgba(255, 255, 255, 0.3);
                    color: #ffffff;
                }

                .btn-primary {
                    background: #ffd54f;
                    border: none;
                    padding: 10px 20px;
                    font-size: 1rem;
                    border-radius: 8px;
                    transition: background 0.3s ease, transform 0.2s ease;
                    color: #212529;
                    font-weight: 600;
                }

                .btn-primary:hover {
                    background: #ffca28;
                }

                .footer {
                    background: rgba(198, 40, 40, 0.9);
                    border-top: 2px solid rgba(255, 213, 79, 0.5);
                    padding: 20px 0;
                    font-size: 0.9rem;
                    color: #ffffff;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }

                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                }

                /* ===== ใส่เอฟเฟกต์หิมะ ===== */
                #snow-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none; /* ไม่ให้เมาส์คลิกโดน */
                    overflow: hidden;
                    z-index: 9999; /* บนสุด */
                }
                .snowflake {
                    position: absolute;
                    top: -2em; /* เริ่มเหนือจอ */
                    color: #fff; /* สีขาว */
                    font-size: 1.2em;
                    pointer-events: none;
                    user-select: none;
                    animation-name: fall;
                    animation-timing-function: linear;
                    animation-iteration-count: 1;
                }
                @keyframes fall {
                    0% {
                        transform: translateY(-100%);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(120vh);
                        opacity: 0;
                    }
                }

                /* ====== โมดัลคำอธิบาย ====== */
                .modal-header {
                    border-bottom: none;
                }
                .modal-footer {
                    border-top: none;
                }

                /* ====== ตัวอย่างชื่อบอท ====== */
                #botNamePreview {
                    margin-top: 10px;
                    font-weight: 600;
                    color: #ffd54f;
                }

                /* ====== อินดิเคเตอร์การส่งข้อมูล ====== */
                #loadingOverlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-snowflake fa-lg me-2 animate-float" style="color: #fff;"></i>
                        Merry Christmas 2025
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
                            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
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
                            <li class="nav-item">
                                <a class="nav-link active" href="/upload-commands"><i class="fas fa-upload me-1"></i> อัปโหลดคำสั่ง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <main class="flex-grow-1">
                <div class="container">
                    <div class="glass-card">
                        <h5 class="mb-4">
                            <i class="fas fa-upload me-2" style="color: #ffd54f;"></i>
                            อัปโหลดไฟล์คำสั่ง
                        </h5>
                        <form action="/upload-commands" method="POST" enctype="multipart/form-data">
                            <div class="mb-3">
                                <label for="botToken" class="form-label">เลือกบอท</label>
                                <select class="form-select" id="botToken" name="botToken" required>
                                    ${Object.entries(botSessions).map(([token, bot]) => `
                                        <option value="${token}">${bot.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="commandFile" class="form-label">ไฟล์คำสั่ง (.js)</label>
                                <input class="form-control" type="file" id="commandFile" name="commandFile" accept=".js" required>
                            </div>
                            <button type="submit" class="btn btn-primary">อัปโหลดคำสั่ง</button>
                        </form>
                    </div>
                </div>
            </main>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} Merry Christmas 2025 | Powered with ❤️</p>
                </div>
            </footer>

            <!-- Container สำหรับหิมะ -->
            <div id="snow-container"></div>

            <div class="toast-container"></div>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // ========= สคริปต์หิมะตก =========
                function createSnowflake() {
                    const snowflakeText = "❄";
                    const snowflake = document.createElement("span");
                    snowflake.classList.add("snowflake");
                    snowflake.textContent = snowflakeText;

                    // สุ่มตำแหน่ง X
                    snowflake.style.left = Math.random() * 100 + "%";

                    // สุ่มขนาด + ระยะเวลาตก
                    const size = (Math.random() * 1.2 + 0.5) + "em";
                    const duration = (Math.random() * 5 + 5) + "s"; // 5-10 วินาที
                    snowflake.style.fontSize = size;
                    snowflake.style.animationDuration = duration;

                    // เพิ่มเข้าใน #snow-container
                    const snowContainer = document.getElementById("snow-container");
                    snowContainer.appendChild(snowflake);

                    // ลบเมื่อแอนิเมชันจบ
                    snowflake.addEventListener("animationend", () => {
                        snowflake.remove();
                    });
                }

                // สร้างหิมะทุก 300ms
                setInterval(createSnowflake, 300);
            </script>
        </body>
        </html>
    `);
});

// Route สำหรับการอัปโหลดคำสั่ง
// ตั้งค่า multer สำหรับการอัปโหลดไฟล์
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const botToken = req.body.botToken;
        const userCommandsDir = path.join(botsDir, 'user', botToken);
        if (!fs.existsSync(userCommandsDir)) {
            fs.mkdirSync(userCommandsDir, { recursive: true });
        }
        cb(null, userCommandsDir);
    },
    filename: function (req, file, cb) {
        // ตั้งชื่อไฟล์ให้เป็นชื่อเดิม
        cb(null, file.originalname);
    }
});

// กำหนดการตรวจสอบไฟล์
const fileFilter = (req, file, cb) => {
    if (path.extname(file.originalname) !== '.js') {
        return cb(new Error('เฉพาะไฟล์ .js เท่านั้นที่อนุญาตให้ใช้'), false);
    }
    cb(null, true);
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// Route สำหรับการอัปโหลดคำสั่ง
app.post('/upload-commands', upload.single('commandFile'), (req, res) => {
    const { botToken } = req.body;
    if (!botToken || !botSessions[botToken]) {
        return res.status(400).send('ไม่พบบอทที่ต้องการอัปโหลดคำสั่ง');
    }

    if (!req.file) {
        return res.status(400).send('ไม่พบไฟล์ที่อัปโหลด');
    }

    // โหลดคำสั่งที่อัปโหลดใหม่
    try {
        const userCommandPath = path.join(botsDir, 'user', botToken, req.file.filename);
        delete require.cache[require.resolve(userCommandPath)]; // ล้าง cache เพื่อโหลดไฟล์ใหม่
        const userCommand = require(userCommandPath);

        if (userCommand.config && userCommand.config.name) {
            const commandName = userCommand.config.name.toLowerCase();
            // เก็บคำสั่งในระบบคำสั่งเฉพาะของบอทนี้
            botSessions[botToken].userCommands = botSessions[botToken].userCommands || {};
            botSessions[botToken].userCommands[commandName] = userCommand;

            // เพิ่มคำสั่งเข้าไปในคำอธิบายและการใช้งาน
            commandDescriptions.push({
                name: userCommand.config.name,
                description: userCommand.config.description || "ไม่มีคำอธิบาย",
            });
            commandUsage[commandName] = commandUsage[commandName] || 0;

            console.log(`📥 อัปโหลดคำสั่งสำเร็จ: ${userCommand.config.name} สำหรับบอท: ${botSessions[botToken].name}`);
            saveCommandUsage();
            io.emit('updateBots', generateBotData());
            io.emit('updateCommands', generateCommandData());

            res.redirect('/commands'); // เปลี่ยนเส้นทางไปยังหน้าคำสั่ง
        } else {
            throw new Error('ไฟล์คำสั่งไม่มีการกำหนด config.name');
        }
    } catch (err) {
        console.error(`❌ เกิดข้อผิดพลาดในการโหลดคำสั่ง: ${err.message}`);
        res.status(500).send('เกิดข้อผิดพลาดในการโหลดคำสั่ง');
    }
});

// หน้าแสดงบอทรัน
app.get("/bots", (req, res) => {
    const data = generateBotData(); 

    // เปลี่ยนเฉพาะธีมเป็นคริสต์มาส 2025 + หิมะตก
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ดูบอทรัน | Merry Christmas 2025</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* ========= ธีมคริสต์มาส 2025 ========= */
                :root {
                    --primary-color: #c62828;
                    --secondary-color: #2e7d32;
                }

                body {
                    background: url('https://i.postimg.cc/WbGnSFc9/snapedit-1734599436384.png') no-repeat center center fixed;
                    background-size: cover;
                    color: #ffffff;
                    font-family: 'Roboto', sans-serif;
                    position: relative;
                    overflow-x: hidden;
                    margin: 0;
                    padding: 0;
                }

                html, body {
                    height: 100%;
                }

                body {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }

                main.flex-grow-1 {
                    flex: 1;
                }

                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.6);
                    z-index: -1;
                }

                .navbar {
                    background: rgba(198, 40, 40, 0.9) !important;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #fff !important;
                }
                .navbar-nav .nav-link {
                    color: #fff !important;
                    transition: color 0.3s ease;
                }
                .navbar-nav .nav-link:hover {
                    color: #ffd54f !important;
                }

                .glass-card {
                    background: rgba(255, 255, 255, 0.15);
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
                    background-color: rgba(198, 40, 40, 0.9);
                    color: #fff;
                    font-weight: 600;
                }
                .bot-table tr:nth-child(even),
                .command-table tr:nth-child(even) {
                    background-color: rgba(255, 255, 255, 0.1);
                }

                .status-online {
                    background: #2e7d32;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-active {
                    background: #43a047;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-connecting {
                    background: #ffd54f;
                    color: #212529;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-connection-failed {
                    background: #ef5350;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .status-offline {
                    background: #616161;
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .footer {
                    background: rgba(198, 40, 40, 0.9);
                    border-top: 2px solid rgba(255, 213, 79, 0.5);
                    padding: 20px 0;
                    font-size: 0.9rem;
                    color: #ffffff;
                }

                .btn-warning, .btn-danger, .btn-secondary {
                    transition: transform 0.2s ease;
                }
                .btn-warning:hover, .btn-danger:hover, .btn-secondary:hover {
                    transform: scale(1.05);
                }

                .bot-name {
                    font-family: 'Press Start 2P', cursive;
                    color: #ffd54f;
                    font-size: 1.1rem;
                }
                .runtime {
                    font-weight: 500;
                    color: #ffd54f;
                }
                .ping {
                    font-weight: 500;
                    color: #2e7d32;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                    .bot-table th, .bot-table td,
                    .command-table th, .command-table td {
                        padding: 8px 10px;
                    }
                }

                /* ===== เพิ่มเอฟเฟกต์หิมะ ===== */
                #snow-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none; /* ไม่ให้เมาส์คลิกโดน */
                    overflow: hidden;
                    z-index: 9999; /* บนสุด */
                }
                .snowflake {
                    position: absolute;
                    top: -2em; /* เริ่มเหนือจอ */
                    color: #fff; /* สีขาว */
                    font-size: 1.2em;
                    pointer-events: none;
                    user-select: none;
                    animation-name: fall;
                    animation-timing-function: linear;
                    animation-iteration-count: 1;
                }
                @keyframes fall {
                    0% {
                        transform: translateY(-100%);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(120vh);
                        opacity: 0;
                    }
                }
            </style>
        </head>
        <body>
            <div class="overlay"></div>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-snowflake fa-lg me-2 animate-float" style="color: #fff;"></i>
                        Merry Christmas 2025
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
                            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
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
                            <li class="nav-item">
                                <a class="nav-link active" href="/upload-commands"><i class="fas fa-upload me-1"></i> อัปโหลดคำสั่ง</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <main class="flex-grow-1">
                <div class="container">
                    <div class="glass-card">
                        <h5 class="mb-4">
                            <i class="fas fa-upload me-2" style="color: #ffd54f;"></i>
                            อัปโหลดไฟล์คำสั่ง
                        </h5>
                        <form action="/upload-commands" method="POST" enctype="multipart/form-data">
                            <div class="mb-3">
                                <label for="botToken" class="form-label">เลือกบอท</label>
                                <select class="form-select" id="botToken" name="botToken" required>
                                    ${Object.entries(botSessions).map(([token, bot]) => `
                                        <option value="${token}">${bot.name}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="commandFile" class="form-label">ไฟล์คำสั่ง (.js)</label>
                                <input class="form-control" type="file" id="commandFile" name="commandFile" accept=".js" required>
                            </div>
                            <button type="submit" class="btn btn-primary">อัปโหลดคำสั่ง</button>
                        </form>
                    </div>
                </div>
            </main>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} Merry Christmas 2025 | Powered with ❤️</p>
                </div>
            </footer>

            <!-- Container สำหรับหิมะ -->
            <div id="snow-container"></div>

            <div class="toast-container"></div>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
                // ========= สคริปต์หิมะตก =========
                function createSnowflake() {
                    const snowflakeText = "❄";
                    const snowflake = document.createElement("span");
                    snowflake.classList.add("snowflake");
                    snowflake.textContent = snowflakeText;

                    // สุ่มตำแหน่ง X
                    snowflake.style.left = Math.random() * 100 + "%";

                    // สุ่มขนาด + ระยะเวลาตก
                    const size = (Math.random() * 1.2 + 0.5) + "em";
                    const duration = (Math.random() * 5 + 5) + "s"; // 5-10 วินาที
                    snowflake.style.fontSize = size;
                    snowflake.style.animationDuration = duration;

                    // เพิ่มเข้าใน #snow-container
                    const snowContainer = document.getElementById("snow-container");
                    snowContainer.appendChild(snowflake);

                    // ลบเมื่อแอนิเมชันจบ
                    snowflake.addEventListener("animationend", () => {
                        snowflake.remove();
                    });
                }

                // สร้างหิมะทุก 300ms
                setInterval(createSnowflake, 300);
            </script>
        </body>
        </html>
    `);
});

// debug/bots
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

// POST /start
app.post('/start', async (req, res) => {
    const { token, prefix, name, password, adminID } = req.body;
    if (!token || !prefix || !name || !password || !adminID) {
        return res.redirect('/start?error=missing-fields');
    }
    const passwordRegex = /^\d{6}$/;
    if (!passwordRegex.test(password)) {
        return res.redirect('/start?error=invalid-password');
    }
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

        await startBotWithRetry(appState, tokenKey, botName, botPrefix, startTime, password, adminID, 5);
        res.redirect('/bots');
        io.emit('updateBots', generateBotData());
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err ? err.message : err}`));
        res.redirect('/start?error=invalid-token');
    }
});

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
                await deleteBot(token, false);
                throw new Error(`บอท ${name} ล้มเหลวในการล็อกอิน`);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

async function startBot(appState, token, name, prefix, startTime, password, adminID, saveToFile = true) {
    return new Promise((resolve, reject) => {
        botSessions[token] = { 
            api: null, 
            name, 
            prefix,
            startTime, 
            status: 'connecting',
            password: password.toString(),
            adminID: adminID.trim(),
            ping: 'N/A',
            deletionTimeout: null,
            retryCount: 0,
            userCommands: {} // เก็บคำสั่งของผู้ใช้
        };

        login({ appState }, (err, api) => {
            if (err) {
                console.error(chalk.red(`❌ การเข้าสู่ระบบล้มเหลวสำหรับโทเค็น: ${token}`));
                botSessions[token].status = 'connection_failed';
                io.emit('updateBots', generateBotData());
                return reject(err);
            }

            botSessions[token].api = api;
            botSessions[token].status = 'online';
            botCount = Math.max(botCount, parseInt(name.replace(/✨/g, '').replace('Bot ', '') || '0'));

            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));
            console.log(chalk.green(`🔑 รหัสผ่านสำหรับลบ/แก้ไขโทเค่น: ${password}`));
            console.log(chalk.green(`🔑 ID แอดมิน: ${adminID}`));

            api.setOptions({ listenEvents: true });

            // โหลดคำสั่งจากโฟลเดอร์ผู้ใช้
            const userCommandsDir = path.join(botsDir, 'user', token);
            if (fs.existsSync(userCommandsDir)) {
                fs.readdirSync(userCommandsDir).forEach((file) => {
                    if (file.endsWith('.js')) {
                        try {
                            const commandPath = path.join(userCommandsDir, file);
                            delete require.cache[require.resolve(commandPath)]; // ล้าง cache เพื่อโหลดไฟล์ใหม่
                            const command = require(commandPath);
                            if (command.config && command.config.name) {
                                const commandName = command.config.name.toLowerCase();
                                botSessions[token].userCommands[commandName] = command;
                                commandDescriptions.push({
                                    name: command.config.name,
                                    description: command.config.description || "ไม่มีคำอธิบาย",
                                });
                                commandUsage[commandName] = commandUsage[commandName] || 0;
                                console.log(`📦 โหลดคำสั่งผู้ใช้: ${command.config.name} สำหรับบอท: ${name}`);
                            }
                        } catch (err) {
                            console.error(`❌ ไม่สามารถโหลดคำสั่งผู้ใช้จากไฟล์: ${file}, error=${err.message}`);
                        }
                    }
                });
            }

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots', generateBotData());
                    io.emit('botOffline', botSessions[token].name);

                    if (!botSessions[token].deletionTimeout) {
                        botSessions[token].deletionTimeout = setTimeout(() => {
                            deleteBot(token, true);
                        }, 60000);
                        console.log(chalk.yellow(`⌛ บอท ${name} จะถูกลบในอีก 60 วินาที`));
                    }
                    return;
                }

                console.log(chalk.blue(`📩 รับอีเวนต์: ${event.type}`));

                // ตรวจสอบอีเวนต์ตามประเภท
                if (event.logMessageType && events[event.logMessageType]) {
                    for (const eventHandler of events[event.logMessageType]) {
                        try {
                            console.log(chalk.blue(`🔄 กำลังประมวลผลอีเวนต์: ${eventHandler.config.name}`));
                            await eventHandler.run({ api, event });
                            console.log(chalk.green(`✅ ประมวลผลอีเวนต์สำเร็จ: ${eventHandler.config.name}`));
                        } catch (error) {
                            console.error(chalk.red(`❌ เกิดข้อผิดพลาดในอีเวนต์ ${eventHandler.config.name}:`, error));
                        }
                    }
                }

                // ตัวอย่างการจัดการอีเวนต์ข้อความ (message)
                if (event.type === "message") {
                    const message = event.body ? event.body.trim() : "";
                    console.log(chalk.cyan(`📨 ข้อความที่ได้รับ: "${message}" จากผู้ใช้ ${event.senderID}`));

                    if (!message.startsWith(botSessions[token].prefix)) return;

                    const args = message.slice(botSessions[token].prefix.length).trim().split(/ +/);
                    const commandName = args.shift().toLowerCase();

                    // ตรวจสอบคำสั่งจากคำสั่งของผู้ใช้ก่อน
                    let command = botSessions[token].userCommands[commandName] || commands[commandName];

                    if (command && typeof command.run === "function") {
                        try {
                            console.log(chalk.yellow(`🚀 กำลังรันคำสั่ง: ${commandName}`));
                            await command.run({ api, event, args });
                            console.log(chalk.green(`✅ รันคำสั่งสำเร็จ: ${commandName}`));
                            commandUsage[commandName] = (commandUsage[commandName] || 0) + 1;
                            saveCommandUsage();
                            io.emit('updateBots', generateBotData());
                            io.emit('updateCommands', generateCommandData());
                        } catch (error) {
                            console.error(chalk.red(`❌ เกิดข้อผิดพลาดในคำสั่ง ${commandName}:`, error));
                            api.sendMessage("❗ การรันคำสั่งล้มเหลว", event.threadID);
                        }
                    } else {
                        api.sendMessage(`
    ===========================
    🎄 [ ERROR 404 ] ❗ ไม่พบคำสั่งที่ระบุ 🎄  
    🎅 กรุณาตรวจสอบคำสั่งอีกครั้ง 🎁  
    ✨ คำแนะนำ: พิมพ์ ${botSessions[token].prefix}ดูคำสั่ง เพื่อดูรายการคำสั่ง  
    ===========================
`, event.threadID);
                    }
                }

                if (botSessions[token].status === 'online') {
                    if (botSessions[token].deletionTimeout) {
                        clearTimeout(botSessions[token].deletionTimeout);
                        botSessions[token].deletionTimeout = null;
                        console.log(chalk.green(`🔄 ยกเลิกการลบบอท ${name}`));
                    }
                }
            });

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

function deleteBot(token, emitDeleted = true) {
    const bot = botSessions[token];
    if (!bot) {
        console.log(chalk.red(`❌ ไม่พบบอทที่ต้องการลบ: ${token}`));
        return;
    }

    const { name } = bot;
    const botFilePath = path.join(botsDir, `${name.replace(/ /g, '_')}.json`);
    if (fs.existsSync(botFilePath)) {
        fs.unlinkSync(botFilePath);
        console.log(chalk.green(`✅ ลบไฟล์บอท: ${botFilePath}`));
    }

    delete botSessions[token];
    console.log(chalk.green(`✅ ลบบอทจากระบบ: ${token}`));

    if (emitDeleted) {
        io.emit('updateBots', generateBotData());
        io.emit('botDeleted', name);
    }
}

// POST /delete
app.post('/delete', async (req, res) => {
    const { token, code } = req.body;
    console.log(`ได้รับคำขอลบบอท: token=${token}, code=${code}`);

    if (!token || !code) {
        console.log('ข้อมูลไม่ครบถ้วน');
        return res.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const trimmedToken = token.trim();
    const bot = botSessions[trimmedToken];
    if (!bot) {
        console.log('ไม่พบบอทที่ต้องการลบ');
        return res.json({ success: false, message: 'ไม่พบบอทที่ต้องการลบ' });
    }

    console.log(`ตรวจสอบรหัสผ่าน: bot.password=${bot.password}, code=${code}`);

    if (bot.password.toString() !== code.toString()) {
        console.log('รหัสผ่านไม่ถูกต้อง');
        return res.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    try {
        deleteBot(trimmedToken, true);
        res.json({ success: true, message: 'ลบบอทสำเร็จ' });
    } catch (err) {
        console.error(`ไม่สามารถหยุดบอท: ${err.message}`);
        res.json({ success: false, message: 'ไม่สามารถหยุดบอทได้' });
    }
});

// POST /edit
app.post('/edit', async (req, res) => {
    const { token, code, newToken } = req.body;
    if (!token || !code || !newToken) {
        return res.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const trimmedToken = token.trim();
    const bot = botSessions[trimmedToken];
    if (!bot) {
        return res.json({ success: false, message: 'ไม่พบบอทที่ต้องการแก้ไข' });
    }

    if (bot.password.toString() !== code.toString()) {
        return res.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    const trimmedNewToken = newToken.trim();
    if (botSessions[trimmedNewToken]) {
        return res.json({ success: false, message: 'โทเค่นใหม่ถูกใช้งานแล้ว' });
    }

    try {
        deleteBot(trimmedToken, false);
        const newAppState = JSON.parse(newToken); 
        const newPassword = generate6DigitCode();
        const startTime = Date.now();
        await startBotWithRetry(newAppState, trimmedNewToken, bot.name, bot.prefix, startTime, newPassword, bot.adminID, 5);

        console.log(chalk.green(`✅ แก้ไขโทเค่นของบอท: ${bot.name} เป็น ${trimmedNewToken}`));
        io.emit('updateBots', generateBotData());
        res.json({ success: true, message: 'แก้ไขโทเค่นสำเร็จ' });
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการแก้ไขโทเค่น: ${err.message}`));
        res.json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขโทเค่น' });
    }
});

// POST /restart
app.post('/restart', async (req, res) => {
    const { token, code } = req.body;
    console.log(`ได้รับคำขอรีสตาร์ทบอท: token=${token}, code=${code}`);

    if (!token || !code) {
        console.log('ข้อมูลไม่ครบถ้วน');
        return res.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const trimmedToken = token.trim();
    const bot = botSessions[trimmedToken];
    if (!bot) {
        console.log('ไม่พบบอทที่ต้องการรีสตาร์ท');
        return res.json({ success: false, message: 'ไม่พบบอทที่ต้องการรีสตาร์ท' });
    }

    console.log(`ตรวจสอบรหัสผ่านสำหรับรีสตาร์ท: bot.password=${bot.password}, code=${code}`);

    if (bot.password.toString() !== code.toString()) {
        console.log('รหัสผ่านไม่ถูกต้องสำหรับการรีสตาร์ท');
        return res.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    try {
        const { appState, name, prefix, startTime, password, adminID } = bot;
        deleteBot(trimmedToken, false);
        await startBotWithRetry(appState, trimmedToken, name, prefix, Date.now(), password, adminID, 5);

        console.log(chalk.green(`✅ รีสตาร์ทบอทสำเร็จ: ${name}`));
        io.emit('updateBots', generateBotData());
        res.json({ success: true, message: 'รีสตาร์ทบอทสำเร็จ', botName: name });
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการรีสตาร์ทบอท: ${err.message}`));
        res.json({ success: false, message: 'เกิดข้อผิดพลาดในการรีสตาร์ทบอท' });
    }
});

// Socket.io 
io.on('connection', (socket) => {
    console.log(chalk.blue('🔌 Socket.io client connected'));

    socket.on('ping', (timestamp) => {
        const latency = Date.now() - timestamp;
        const ping = Math.min(latency, 200);
        websitePing = ping;
        io.emit('updateBots', generateBotData());
    });

    socket.emit('updateBots', generateBotData());

    socket.on('disconnect', () => {
        console.log(chalk.red('🔌 Socket.io client disconnected'));
    });
});

function generateBotName() {
  const adjectives = [
    "Super",
    "Mega",
    "Ultra",
    "Hyper",
    "Turbo",
    "Alpha",
    "Beta",
    "Gamma",
    "Delta",
  ];
  const nouns = [
    "Dragon",
    "Phoenix",
    "Falcon",
    "Tiger",
    "Lion",
    "Eagle",
    "Shark",
    "Wolf",
    "Leopard",
  ];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  // ใช้ Template Literal ธรรมดา
  return `${adjective}${noun}`;
}

// เริ่มต้นเซิร์ฟเวอร์
server.listen(PORT, () => {
    console.log(chalk.blue(`Server is running at http://localhost:${PORT}`));
    console.log(chalk.green(figlet.textSync("Merry XMas 2025", { horizontalLayout: "full" })));
    loadBotsFromFiles();
});

// อัปเดตปิงของบอททุกๆ 5 วินาที
setInterval(() => {
    Object.values(botSessions).forEach(bot => {
        bot.ping = Math.floor(Math.random() * 200) + 1;
    });
    io.emit('updateBots', generateBotData());
}, 5000);

// ลบบอทที่ล้มเหลวอัตโนมัติทุก 5 นาที
setInterval(() => {
    console.log(chalk.yellow('🔍 กำลังตรวจสอบบอททั้งหมดสำหรับการลบอัตโนมัติ...'));
    let botsToDelete = 0;
    Object.keys(botSessions).forEach(token => {
        const bot = botSessions[token];
        if (bot.status === 'connection_failed' || bot.status === 'offline') {
            console.log(chalk.yellow(`Bot "${bot.name}" จะถูกลบออกเนื่องจากสถานะ "${bot.status}"`));
            deleteBot(token, true);
            botsToDelete++;
        }
    });
    if (botsToDelete === 0) {
        console.log(chalk.green('✅ ไม่มีบอทที่ต้องการลบในครั้งนี้'));
    }
}, 300000);

// โหลดคำสั่งจากโฟลเดอร์ commands และ userCommands
const loadAllCommands = () => {
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
                    commandUsage[command.config.name.toLowerCase()] = commandUsage[command.config.name.toLowerCase()] || 0;
                    console.log(`📦 โหลดคำสั่ง: ${command.config.name}`);
                }
            }
        });
    }

    // โหลดคำสั่งจากโฟลเดอร์ผู้ใช้
    const userCommandsBaseDir = path.join(botsDir, 'user');
    if (fs.existsSync(userCommandsBaseDir)) {
        fs.readdirSync(userCommandsBaseDir).forEach((botToken) => {
            const userCommandsDir = path.join(userCommandsBaseDir, botToken);
            if (fs.existsSync(userCommandsDir)) {
                fs.readdirSync(userCommandsDir).forEach((file) => {
                    if (file.endsWith('.js')) {
                        try {
                            const commandPath = path.join(userCommandsDir, file);
                            delete require.cache[require.resolve(commandPath)]; // ล้าง cache เพื่อโหลดไฟล์ใหม่
                            const command = require(commandPath);
                            if (command.config && command.config.name) {
                                if (botSessions[botToken]) {
                                    const commandName = command.config.name.toLowerCase();
                                    botSessions[botToken].userCommands = botSessions[botToken].userCommands || {};
                                    botSessions[botToken].userCommands[commandName] = command;

                                    commandDescriptions.push({
                                        name: command.config.name,
                                        description: command.config.description || "ไม่มีคำอธิบาย",
                                    });
                                    commandUsage[commandName] = commandUsage[commandName] || 0;
                                    console.log(`📦 โหลดคำสั่งผู้ใช้: ${command.config.name} สำหรับบอท: ${botSessions[botToken].name}`);
                                }
                            }
                        } catch (err) {
                            console.error(`❌ ไม่สามารถโหลดคำสั่งผู้ใช้จากไฟล์: ${file}, error=${err.message}`);
                        }
                    }
                });
            }
        });
    }
};

// เรียกใช้เมื่อเริ่มต้นเซิร์ฟเวอร์
loadAllCommands();
