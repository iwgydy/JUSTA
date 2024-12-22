/* ===== index.js (ธีมคริสต์มาส 2025 + โหมดซิม) ===== */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const login = require('ryuu-fca-api'); 
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = 3005;

// ========= ตัวแปรและโครงสร้างพื้นฐาน =========
let botCount = 0;
global.botSessions = {}; 
const commands = {};
const commandDescriptions = [];
let commandUsage = {};

// โฟลเดอร์ที่ใช้เก็บบอทและข้อมูล
const botsDir = path.join(__dirname, 'bots');
const dataDir = path.join(__dirname, 'data');

// สร้างโฟลเดอร์ bots และ data ถ้ายังไม่มี
if (!fs.existsSync(botsDir)) fs.mkdirSync(botsDir);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// ไฟล์เก็บการใช้งานคำสั่ง
const commandUsageFile = path.join(dataDir, 'commandUsage.json');

// ฟังก์ชันโหลด commandUsage จากไฟล์
function loadCommandUsage() {
    if (fs.existsSync(commandUsageFile)) {
        try {
            const data = fs.readFileSync(commandUsageFile, 'utf-8');
            commandUsage = JSON.parse(data);
            console.log(chalk.green('✅ โหลด commandUsage สำเร็จ'));
        } catch (err) {
            console.error(chalk.red(`❌ ไม่สามารถโหลด commandUsage จากไฟล์: ${err.message}`));
            commandUsage = {};
        }
    } else {
        commandUsage = {};
    }
}

// ฟังก์ชันบันทึก commandUsage ลงไฟล์
function saveCommandUsage() {
    try {
        fs.writeFileSync(commandUsageFile, JSON.stringify(commandUsage, null, 4), 'utf-8');
        console.log(chalk.green('✅ บันทึก commandUsage สำเร็จ'));
    } catch (err) {
        console.error(chalk.red(`❌ ไม่สามารถบันทึก commandUsage ลงไฟล์: ${err.message}`));
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
                    description: command.config.description || "ไม่มีคำอธิบาย"
                });
                commandUsage[command.config.name.toLowerCase()] =
                    commandUsage[command.config.name.toLowerCase()] || 0;
                console.log(`📦 โหลดคำสั่ง: ${command.config.name}`);
            }
        }
    });
}

// โหลด commandUsage เมื่อเปิดเซิร์ฟเวอร์
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

// ตั้งค่า Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// สุ่มรหัส 6 หลัก
function generate6DigitCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ========== ฟังก์ชันสร้างส่วน HTML เพื่ออัปเดต Bot ==========

// ตัวแปรเก็บค่าปิงเว็บไซต์
let websitePing = 0;

// สร้างข้อมูลบอทสำหรับอัปเดตแบบเรียลไทม์
function generateBotData() {
    const totalBots = Object.keys(botSessions).length;
    const onlineBots = Object.values(botSessions).filter(
        bot => bot.status === 'online' || bot.status === 'active'
    ).length;
    const activeBots = Object.values(botSessions).filter(
        bot => bot.status === 'active'
    ).length;

    const botRows = Object.entries(botSessions).map(([token, bot]) => {
        return `
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
                <button class="btn btn-warning btn-sm edit-btn" data-token="${encodeURIComponent(token)}">
                    <i class="fas fa-edit"></i> แก้ไข
                </button>
                <button class="btn btn-danger btn-sm delete-btn" data-token="${encodeURIComponent(token)}">
                    <i class="fas fa-trash-alt"></i> ลบ
                </button>
                <button class="btn btn-secondary btn-sm restart-btn" data-token="${encodeURIComponent(token)}">
                    <i class="fas fa-sync-alt"></i> รีสตาร์ท
                </button>
            </td>
        </tr>
        `;
    }).join('') || `
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

// แปลสถานะเป็นข้อความ
function translateStatus(status) {
    switch(status) {
        case 'connecting': return 'กำลังเชื่อมต่อ';
        case 'online': return 'ออนไลน์';
        case 'active': return 'ทำงาน';
        case 'connection_failed': return 'เชื่อมต่อไม่สำเร็จ';
        case 'offline': return 'ออฟไลน์';
        default: return status;
    }
}

// กำหนดคลาส CSS ของสถานะ
function getStatusClass(status) {
    switch(status) {
        case 'connecting': return 'status-connecting';
        case 'online': return 'status-online';
        case 'active': return 'status-active';
        case 'connection_failed': return 'status-connection-failed';
        case 'offline': return 'status-offline';
        default: return 'status-unknown';
    }
}

// สร้างข้อมูลตารางคำสั่ง
function generateCommandData() {
    const commandsData = Object.entries(commandUsage)
        .map(([name, count]) => {
            const desc = commandDescriptions.find(cmd => cmd.name.toLowerCase() === name)?.description || "ไม่มีคำอธิบาย";
            return `
                <tr>
                    <td>${name}</td>
                    <td>${count}</td>
                    <td>${desc}</td>
                </tr>
            `;
        })
        .join('') || `
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
                const { appState, token, name, startTime, password, adminID, prefix, autoReply } = botData;

                // เริ่มบอท
                startBot(appState, token, name, prefix, startTime, password, adminID, false, autoReply)
                    .catch(err => {
                        console.error(`ไม่สามารถเริ่มบอทจากไฟล์: ${filePath}, error=${err.message}`);
                    });
            } catch (err) {
                console.error(`ไม่สามารถอ่านไฟล์บอท: ${filePath}, error=${err.message}`);
            }
        }
    });
}

// ========== หน้าเว็บหลัก / (ธีมคริสต์มาส 2025) ==========
app.get("/", (req, res) => {
    const data = generateBotData();

    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>แดชบอร์ดหลัก | Xmas Bot Manager 2025</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <style>
            /* ====== ธีมคริสต์มาส 2025 ====== */
            body {
                background: url('https://i.postimg.cc/3J0g5FBk/christmas2025-bg.jpg') no-repeat center center fixed;
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

            /* Navbar */
            .navbar {
                background: rgba(220, 20, 60, 0.9) !important; 
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
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
                color: #ffd700 !important; 
            }

            /* Cards */
            .stats-card {
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .stats-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.6);
            }
            .stats-number {
                font-size: 2.5rem;
                font-weight: 700;
                margin: 10px 0;
                color: #ffd700;
            }
            .stats-label {
                font-size: 1rem;
                color: #ffffff;
            }

            .glass-card {
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .glass-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 12px 24px rgba(0, 0, 0, 0.6);
            }

            .bot-table th, .bot-table td {
                padding: 12px 15px;
            }
            .bot-table th {
                background-color: rgba(220, 20, 60, 0.9);
                color: #fff;
                font-weight: 600;
            }
            .bot-table tr:nth-child(even) {
                background-color: rgba(255, 255, 255, 0.1);
            }

            /* สถานะ */
            .status-online {
                background: #198754;
                color: #fff;
                padding: 5px 10px;
                border-radius: 20px;
                font-size: 0.9rem;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            .status-active {
                background: #20c997;
                color: #fff;
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
                color: #fff;
                padding: 5px 10px;
                border-radius: 20px;
                font-size: 0.9rem;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            .status-offline {
                background: #6c757d;
                color: #fff;
                padding: 5px 10px;
                border-radius: 20px;
                font-size: 0.9rem;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            /* Footer */
            .footer {
                background: rgba(220, 20, 60, 0.9);
                border-top: 2px solid rgba(255, 255, 255, 0.3);
                padding: 20px 0;
                font-size: 0.9rem;
                color: #fff;
            }

            /* ปุ่ม */
            .btn-primary {
                background: #ffd700;
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
                transform: translateY(-2px);
            }
            .btn-warning,
            .btn-danger,
            .btn-secondary {
                transition: transform 0.2s ease;
            }
            .btn-warning:hover,
            .btn-danger:hover,
            .btn-secondary:hover {
                transform: scale(1.05);
            }

            /* Toast */
            .toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1055;
            }

            /* Text */
            .bot-name {
                font-family: 'Press Start 2P', cursive;
                color: #00ffcc;
                font-size: 1rem;
            }
            .runtime {
                font-weight: 500;
                color: #ffd700;
            }
            .ping {
                font-weight: 500;
                color: #198754;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .stats-card {
                    margin-bottom: 20px;
                }
                .glass-card {
                    margin-bottom: 20px;
                }
            }

            /* Animation */
            .animate-float {
                animation: float 3s ease-in-out infinite;
            }
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
        </style>
    </head>
    <body>
        <div class="overlay"></div>
        <nav class="navbar navbar-expand-lg navbar-dark mb-4">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="/">
                    <i class="fas fa-tree fa-lg me-2 animate-float" style="color: #fff;"></i>
                    Xmas 2025 Bot Manager
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
                    data-bs-target="#navbarNav" aria-controls="navbarNav"
                    aria-expanded="false" aria-label="Toggle navigation">
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
                            <a class="nav-link" href="/how-to-make-bot"><i class="fas fa-video me-1"></i> วิธีทำบอท</a>
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
                            <i class="fas fa-robot fa-2x mb-3" style="color: #ffd700;"></i>
                            <div class="stats-number" id="totalBots">${data.totalBots}</div>
                            <div class="stats-label">บอททั้งหมด</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-signal fa-2x mb-3" style="color: #00ffcc;"></i>
                            <div class="stats-number" id="onlineBots">${data.onlineBots}</div>
                            <div class="stats-label">บอทออนไลน์</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-clock fa-2x mb-3" style="color: #ffd700;"></i>
                            <div class="stats-number" id="activeBots">${data.activeBots}</div>
                            <div class="stats-label">บอททำงาน</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-tachometer-alt fa-2x mb-3" style="color: #00ffcc;"></i>
                            <div class="stats-number" id="websitePing">${data.websitePing} ms</div>
                            <div class="stats-label">Ping เว็บไซต์</div>
                        </div>
                    </div>
                </div>

                <!-- ตารางบอท -->
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-robot me-2" style="color: #ffd700;"></i>
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
                <p class="mb-0">© ${new Date().getFullYear()} Xmas Bot Manager 2025 | พัฒนาด้วย ❤️</p>
            </div>
        </footer>

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
                showToast(\`บอท "\${botName}" จะถูกลบใน 60 วินาที เนื่องจากออฟไลน์\`, 'warning');
            });

            socket.on('botRestarted', (botName) => {
                showToast(\`บอท "\${botName}" รีสตาร์ทเรียบร้อย\`, 'success');
            });

            setInterval(updateRuntime, 1000);
            document.addEventListener('DOMContentLoaded', updateRuntime);

            document.addEventListener('click', function(event) {
                if (event.target.closest('.delete-btn')) {
                    const token = decodeURIComponent(event.target.closest('.delete-btn').getAttribute('data-token'));
                    const deleteCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยัน:');
                    if (deleteCode) {
                        fetch('/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, code: deleteCode })
                        })
                        .then(r => r.json())
                        .then(d => {
                            if (d.success) showToast('ลบบอทสำเร็จ', 'success');
                            else showToast(d.message || 'เกิดข้อผิดพลาด', 'danger');
                        })
                        .catch(err => {
                            console.error(err);
                            showToast('เกิดข้อผิดพลาด', 'danger');
                        });
                    }
                }

                if (event.target.closest('.edit-btn')) {
                    const token = decodeURIComponent(event.target.closest('.edit-btn').getAttribute('data-token'));
                    const editCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยัน:');
                    if (editCode) {
                        const newToken = prompt('กรุณากรอกโทเค่นใหม่:');
                        if (newToken) {
                            fetch('/edit', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ token, code: editCode, newToken })
                            })
                            .then(r => r.json())
                            .then(d => {
                                if (d.success) showToast('แก้ไขโทเค่นสำเร็จ', 'success');
                                else showToast(d.message || 'เกิดข้อผิดพลาด', 'danger');
                            })
                            .catch(err => {
                                console.error(err);
                                showToast('เกิดข้อผิดพลาด', 'danger');
                            });
                        }
                    }
                }

                if (event.target.closest('.restart-btn')) {
                    const token = decodeURIComponent(event.target.closest('.restart-btn').getAttribute('data-token'));
                    const restartCode = prompt('กรุณากรอกรหัสผ่าน 6 หลักเพื่อยืนยัน:');
                    if (restartCode) {
                        fetch('/restart', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token, code: restartCode })
                        })
                        .then(r => r.json())
                        .then(d => {
                            if (d.success) {
                                showToast('รีสตาร์ทบอทสำเร็จ', 'success');
                                socket.emit('botRestarted', d.botName);
                            } else {
                                showToast(d.message || 'เกิดข้อผิดพลาด', 'danger');
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            showToast('เกิดข้อผิดพลาด', 'danger');
                        });
                    }
                }
            });
        </script>
    </body>
    </html>
    `);
});

// ========== หน้าเพิ่มบอท /start ==========
app.get("/start", (req, res) => {
    const error = req.query.error;
    let errorMessage = "";
    if (error === 'already-running') {
        errorMessage = `<div class="alert alert-warning" role="alert">บอทนี้กำลังทำงานอยู่แล้ว</div>`;
    } else if (error === 'invalid-token') {
        errorMessage = `<div class="alert alert-danger" role="alert">โทเค็นไม่ถูกต้อง ลองใหม่!</div>`;
    } else if (error === 'missing-fields') {
        errorMessage = `<div class="alert alert-danger" role="alert">กรุณากรอกโทเค็น, รหัสผ่าน, ID แอดมิน, ชื่อบอท ให้ครบ</div>`;
    } else if (error === 'invalid-password') {
        errorMessage = `<div class="alert alert-danger" role="alert">รหัสผ่านไม่ถูกต้อง ต้องเป็นตัวเลข 6 หลัก</div>`;
    } else if (error === 'invalid-name') {
        errorMessage = `<div class="alert alert-danger" role="alert">ชื่อบอทไม่ถูกต้อง (3-20 ตัว a-z0-9-_)</div>`;
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>เพิ่มบอท | Xmas 2025</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
        <style>
            body {
                background: url('https://i.postimg.cc/3J0g5FBk/christmas2025-bg.jpg') no-repeat center center fixed;
                background-size: cover;
                color: #fff;
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
            .overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.6);
                z-index: -1;
            }
            .navbar {
                background: rgba(220, 20, 60, 0.9) !important;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
            }
            .navbar-brand {
                font-family: 'Kanit', sans-serif;
                font-weight: 600;
                color: #fff !important;
            }
            main.flex-grow-1 {
                flex: 1;
            }
            .glass-card {
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .glass-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 12px 24px rgba(0, 0, 0, 0.6);
            }
            .form-control {
                background: rgba(255, 255, 255, 0.25);
                border: 1px solid rgba(255, 255, 255, 0.4);
                border-radius: 8px;
                color: #fff;
            }
            .footer {
                background: rgba(220, 20, 60, 0.9);
                border-top: 2px solid rgba(255, 255, 255, 0.3);
                padding: 20px 0;
                font-size: 0.9rem;
                color: #fff;
            }
        </style>
    </head>
    <body>
        <div class="overlay"></div>
        <nav class="navbar navbar-expand-lg navbar-dark mb-4">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="/">
                    <i class="fas fa-tree fa-lg me-2" style="color: #fff;"></i>
                    Xmas 2025 Bot Manager
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
                    data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false"
                    aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav ms-auto">
                        <li class="nav-item">
                            <a class="nav-link active" href="/start">
                                <i class="fas fa-plus-circle me-1"></i> เพิ่มบอท
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/bots">
                                <i class="fas fa-list me-1"></i> ดูบอทรัน
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/commands">
                                <i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/how-to-make-bot">
                                <i class="fas fa-video me-1"></i> วิธีทำบอท
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>

        <main class="flex-grow-1">
            <div class="container">
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-plus-circle me-2" style="color: #ffd700;"></i>
                        เพิ่มบอทใหม่
                    </h5>
                    ${errorMessage}
                    <form class="add-bot-form" method="POST" action="/start">
                        <div class="mb-3">
                            <label for="token" class="form-label">โทเค็น (AppState JSON)</label>
                            <textarea 
                                id="token" 
                                name="token" 
                                class="form-control" 
                                rows="4" 
                                placeholder='{"appState":[ ... ]}'
                                required
                            ></textarea>
                        </div>
                        <div class="mb-3">
                            <label for="prefix" class="form-label">คำนำหน้าบอท (ไม่ใส่ก็ได้)</label>
                            <input 
                                type="text" 
                                id="prefix" 
                                name="prefix" 
                                class="form-control" 
                                placeholder="ตัวอย่าง: /"
                                pattern="^.{0,10}$"
                                title="หากใส่ต้องไม่เกิน 10 ตัวอักษร"
                            />
                        </div>
                        <div class="mb-3">
                            <label for="name" class="form-label">ชื่อบอท</label>
                            <input 
                                type="text" 
                                id="name" 
                                name="name" 
                                class="form-control" 
                                placeholder="MyXmasBot" 
                                required
                                pattern="^[a-zA-Z0-9_-]{3,20}$"
                                title="3-20 ตัว ประกอบด้วย a-z, A-Z, 0-9, -, _"
                            />
                        </div>
                        <div class="mb-3">
                            <label for="password" class="form-label">รหัสผ่าน 6 หลักสำหรับจัดการบอท</label>
                            <input 
                                type="password" 
                                id="password" 
                                name="password" 
                                class="form-control" 
                                pattern="\\d{6}" 
                                placeholder="123456" 
                                required
                                title="ต้องเป็นตัวเลข 6 หลัก"
                            />
                        </div>
                        <div class="mb-3">
                            <label for="adminID" class="form-label">ID แอดมินของบอท</label>
                            <input 
                                type="text" 
                                id="adminID" 
                                name="adminID" 
                                class="form-control" 
                                placeholder="1234567890" 
                                required
                            />
                        </div>
                        <!-- เพิ่มตัวเลือก: autoReply -->
                        <div class="mb-3 form-check">
                            <input type="checkbox" class="form-check-input" id="autoReply" name="autoReply" />
                            <label class="form-check-label" for="autoReply">เปิดโหมดซิม (ตอบกลับอัตโนมัติ)</label>
                        </div>

                        <button type="submit" class="btn btn-primary w-100">
                            <i class="fas fa-play me-2"></i>
                            เริ่มบอท
                        </button>
                    </form>
                </div>
            </div>
        </main>

        <footer class="footer text-center mt-4">
            <div class="container">
                <p class="mb-0">© ${new Date().getFullYear()} Xmas Bot Manager 2025 | พัฒนาด้วย ❤️</p>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>
    `);
});

// ========== หน้า /bots (ดูบอทรัน) ==========
app.get("/bots", (req, res) => {
    const data = generateBotData();
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>ดูบอทรัน | Xmas 2025</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
        <style>
            body {
                background: url('https://i.postimg.cc/3J0g5FBk/christmas2025-bg.jpg') no-repeat center center fixed;
                background-size: cover;
                color: #fff;
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
            .overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.6);
                z-index: -1;
            }
            .navbar {
                background: rgba(220, 20, 60, 0.9) !important;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
            }
            .navbar-brand {
                font-family: 'Kanit', sans-serif;
                font-weight: 600;
                color: #fff !important;
            }
            .glass-card {
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .glass-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 12px 24px rgba(0, 0, 0, 0.6);
            }
            .bot-table th, .bot-table td {
                padding: 12px 15px;
            }
            .bot-table th {
                background-color: rgba(220, 20, 60, 0.9);
                color: #fff;
                font-weight: 600;
            }
            .bot-table tr:nth-child(even) {
                background-color: rgba(255, 255, 255, 0.1);
            }
            .footer {
                background: rgba(220, 20, 60, 0.9);
                border-top: 2px solid rgba(255, 255, 255, 0.3);
                padding: 20px 0;
                font-size: 0.9rem;
                color: #fff;
            }
        </style>
    </head>
    <body>
        <div class="overlay"></div>
        <nav class="navbar navbar-expand-lg navbar-dark mb-4">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="/">
                    <i class="fas fa-tree fa-lg me-2" style="color: #fff;"></i>
                    Xmas 2025 Bot Manager
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
                    data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false"
                    aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav ms-auto">
                        <li class="nav-item">
                            <a class="nav-link" href="/start">
                                <i class="fas fa-plus-circle me-1"></i> เพิ่มบอท
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link active" href="/bots">
                                <i class="fas fa-list me-1"></i> ดูบอทรัน
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/commands">
                                <i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/how-to-make-bot">
                                <i class="fas fa-video me-1"></i> วิธีทำบอท
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>

        <main class="flex-grow-1">
            <div class="container">
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-list me-2" style="color: #ffd700;"></i>
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
                <p class="mb-0">© ${new Date().getFullYear()} Xmas Bot Manager 2025 | พัฒนาด้วย ❤️</p>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        <script src="/socket.io/socket.io.js"></script>
        <!-- สามารถคัดลอกโค้ด JS จากหน้า / (index) มาวางได้ หรือจะปล่อยให้หน้า / เป็นตัว handle ก็ได้ -->
    </body>
    </html>
    `);
});

// ========== หน้า /commands (คำสั่งทั้งหมด) ==========
app.get("/commands", (req, res) => {
    const commandsData = generateCommandData();
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>คำสั่งที่ใช้ | Xmas 2025</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
        <style>
            body {
                background: url('https://i.postimg.cc/3J0g5FBk/christmas2025-bg.jpg') no-repeat center center fixed;
                background-size: cover; 
                color: #fff; 
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
            .overlay {
                position: fixed;
                top: 0; 
                left: 0;
                width: 100%; 
                height: 100%;
                background: rgba(0,0,0,0.6);
                z-index: -1;
            }
            .navbar {
                background: rgba(220, 20, 60, 0.9) !important;
                box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            }
            .navbar-brand {
                font-family: 'Kanit', sans-serif;
                font-weight: 600;
                color: #fff !important;
            }
            .glass-card {
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 8px 16px rgba(0,0,0,0.4);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .glass-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 12px 24px rgba(0,0,0,0.6);
            }
            .command-table th, .command-table td {
                padding: 12px 15px;
            }
            .command-table th {
                background-color: rgba(220, 20, 60, 0.9);
                color: #fff;
                font-weight: 600;
            }
            .command-table tr:nth-child(even) {
                background-color: rgba(255,255,255,0.1);
            }
            .footer {
                background: rgba(220,20,60,0.9);
                border-top: 2px solid rgba(255,255,255,0.3);
                padding: 20px 0;
                font-size: 0.9rem;
                color: #fff;
            }
        </style>
    </head>
    <body>
        <div class="overlay"></div>
        <nav class="navbar navbar-expand-lg navbar-dark mb-4">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="/">
                    <i class="fas fa-tree fa-lg me-2" style="color: #fff;"></i>
                    Xmas 2025 Bot Manager
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
                    data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false"
                    aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav ms-auto">
                        <li class="nav-item">
                            <a class="nav-link" href="/start">
                                <i class="fas fa-plus-circle me-1"></i> เพิ่มบอท
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/bots">
                                <i class="fas fa-list me-1"></i> ดูบอทรัน
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link active" href="/commands">
                                <i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/how-to-make-bot">
                                <i class="fas fa-video me-1"></i> วิธีทำบอท
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>

        <main class="flex-grow-1">
            <div class="container">
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-terminal me-2" style="color: #ffd700;"></i>
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
                <p class="mb-0">© ${new Date().getFullYear()} Xmas Bot Manager 2025 | พัฒนาด้วย ❤️</p>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>
    `);
});

// ========== หน้า /how-to-make-bot ==========
app.get("/how-to-make-bot", (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>วิธีทำบอทของคุณเอง | Xmas 2025</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet"/>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
        <style>
            body {
                background: url('https://i.postimg.cc/3J0g5FBk/christmas2025-bg.jpg') no-repeat center center fixed;
                background-size: cover; 
                color: #fff; 
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
            .overlay {
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100%; 
                height: 100%; 
                background: rgba(0,0,0,0.6);
                z-index: -1;
            }
            .navbar {
                background: rgba(220, 20, 60, 0.9) !important;
                box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            }
            .navbar-brand {
                font-family: 'Kanit', sans-serif;
                font-weight: 600;
                color: #fff !important;
            }
            main.flex-grow-1 {
                flex: 1;
            }
            .glass-card {
                background: rgba(255,255,255,0.15);
                border: 1px solid rgba(255,255,255,0.3);
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 8px 16px rgba(0,0,0,0.4);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .glass-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 12px 24px rgba(0,0,0,0.6);
            }
            .footer {
                background: rgba(220,20,60,0.9);
                border-top: 2px solid rgba(255,255,255,0.3);
                padding: 20px 0;
                font-size: 0.9rem;
                color: #fff;
            }
        </style>
    </head>
    <body>
        <div class="overlay"></div>
        <nav class="navbar navbar-expand-lg navbar-dark mb-4">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="/">
                    <i class="fas fa-tree fa-lg me-2" style="color: #fff;"></i>
                    Xmas 2025 Bot Manager
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
                    data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false"
                    aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav ms-auto">
                        <li class="nav-item">
                            <a class="nav-link" href="/start">
                                <i class="fas fa-plus-circle me-1"></i> เพิ่มบอท
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/bots">
                                <i class="fas fa-list me-1"></i> ดูบอทรัน
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/commands">
                                <i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link active" href="/how-to-make-bot">
                                <i class="fas fa-video me-1"></i> วิธีทำบอท
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>

        <main class="flex-grow-1">
            <div class="container">
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-video me-2" style="color: #ffd700;"></i>
                        วิธีทำบอทของคุณเอง
                    </h5>
                    <p>1) ดาวน์โหลดซอฟต์แวร์ที่จำเป็นจาก GitHub หรือแหล่งที่คุณต้องการ</p>
                    <p>2) ตั้งค่าไฟล์ <code>index.js</code> และไฟล์อื่น ๆ ตามตัวอย่าง</p>
                    <p>3) เริ่มเซิร์ฟเวอร์ด้วยคำสั่ง <code>node index.js</code></p>
                    <p>4) เข้าหน้าเว็บ <code>http://localhost:3005</code> เพื่อจัดการบอทผ่านแดชบอร์ด</p>
                    <p>5) สามารถดูตัวอย่างเพิ่มเติมได้จากคลิปวิดีโอด้านล่าง</p>
                    <div class="ratio ratio-16x9 mb-3">
                        <iframe 
                            src="https://www.youtube.com/embed/dQw4w9WgXcQ" 
                            allowfullscreen
                        ></iframe>
                    </div>
                    <p>สุขสันต์วันคริสต์มาสและสนุกกับการทำบอทนะครับ!</p>
                </div>
            </div>
        </main>

        <footer class="footer text-center mt-4">
            <div class="container">
                <p class="mb-0">© ${new Date().getFullYear()} Xmas Bot Manager 2025 | พัฒนาด้วย ❤️</p>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    </body>
    </html>
    `);
});

// ========== Route Debug ==========
app.get("/debug/bots", (req, res) => {
    const bots = Object.entries(botSessions).map(([token, bot]) => ({
        token,
        name: bot.name,
        status: bot.status,
        password: bot.password,
        adminID: bot.adminID,
        ping: bot.ping || 'N/A',
        prefix: bot.prefix,
        autoReply: bot.autoReply
    }));
    res.json(bots);
});

// ========== POST /start ==========
app.post('/start', async (req, res) => {
    const { token, prefix, name, password, adminID, autoReply } = req.body;

    if (!token || !name || !password || !adminID) {
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
        const appState = JSON.parse(token.trim());
        const tokenKey = token.trim();
        if (botSessions[tokenKey]) {
            return res.redirect('/start?error=already-running');
        }

        const botPrefix = prefix ? prefix.trim() : '';
        const startTime = Date.now();
        const isAutoReply = autoReply === 'on'; 

        await startBotWithRetry(
            appState, 
            tokenKey, 
            name.trim(), 
            botPrefix, 
            startTime, 
            password, 
            adminID, 
            5,
            isAutoReply
        );
        res.redirect('/bots');
        io.emit('updateBots', generateBotData());
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        return res.redirect('/start?error=invalid-token');
    }
});

// ========== ฟังก์ชันลองล็อกอินซ้ำ =============
async function startBotWithRetry(appState, token, name, prefix, startTime, password, adminID, retries, autoReply) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            await startBot(appState, token, name, prefix, startTime, password, adminID, true, autoReply);
            console.log(chalk.green(`✅ เริ่มบอทสำเร็จ: ${name}`));
            return;
        } catch (err) {
            attempt++;
            console.error(chalk.red(`❌ ลองเริ่มบอทครั้งที่ ${attempt} ล้มเหลว: ${err.message}`));
            if (attempt >= retries) {
                console.error(chalk.red(`❌ บอท ${name} ล้มเหลวหลังลอง ${retries} ครั้ง`));
                await deleteBot(token, false);
                throw new Error(`บอท ${name} ล้มเหลวในการล็อกอิน`);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// ========== ฟังก์ชันสตาร์ทบอทหลัก =============
async function startBot(
    appState, token, name, prefix, startTime, password, adminID, saveToFile = true, autoReply = false
) {
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
            autoReply
        };

        login({ appState }, (err, api) => {
            if (err) {
                console.error(chalk.red(`❌ ล็อกอินล้มเหลว: ${token}`));
                botSessions[token].status = 'connection_failed';
                io.emit('updateBots', generateBotData());
                return reject(err);
            }

            botSessions[token].api = api;
            botSessions[token].status = 'online';
            botCount = Math.max(
                botCount,
                parseInt(name.replace(/✨/g, '').replace('Bot ', '') || '0')
            );

            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} ทำงานด้วยโทเค็น: ${token}`));
            console.log(chalk.green(`🔑 รหัสผ่านลบ/แก้ไข: ${password}`));
            console.log(chalk.green(`🔑 ID แอดมิน: ${adminID}`));
            console.log(chalk.yellow(`🔄 autoReply: ${botSessions[token].autoReply ? 'เปิด' : 'ปิด'}`));

            api.setOptions({ listenEvents: true });

            // ========= โซนรับอีเวนต์ข้อความ =========
            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ Error: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots', generateBotData());

                    io.emit('botOffline', botSessions[token].name);
                    if (!botSessions[token].deletionTimeout) {
                        botSessions[token].deletionTimeout = setTimeout(() => {
                            deleteBot(token, true);
                        }, 60000);
                        console.log(chalk.yellow(`⌛ บอท ${name} จะถูกลบใน 60 วินาที`));
                    }
                    return;
                }

                // จัดการข้อความ
                if (event.type === 'message') {
                    const message = event.body ? event.body.trim() : "";

                    // (1) เช็กโหมด autoReply
                    if (botSessions[token].autoReply) {
                        // ถ้า user พิมพ์ "สวัสดี" => ตอบกลับทันที
                        if (message === "สวัสดี") {
                            api.sendMessage("สวัสดี! มีอะไรให้ช่วยไหม?", event.threadID);
                        }
                    }

                    // (2) เช็ก prefix
                    if (!botSessions[token].prefix || botSessions[token].prefix.length === 0) {
                        // ไม่มี prefix => ไม่ประมวลผลคำสั่ง
                        return;
                    } else {
                        // ถ้ามี prefix แต่ข้อความไม่ขึ้นต้น => ไม่ใช่คำสั่ง
                        if (!message.startsWith(botSessions[token].prefix)) return;
                    }

                    // (3) ตัด prefix แล้ว parse คำสั่ง
                    const args = message.slice(botSessions[token].prefix.length).trim().split(/ +/);
                    const commandName = args.shift().toLowerCase();

                    // ** คำสั่ง /sim เพื่อ toggle autoReply **
                    if (commandName === "sim") {
                        botSessions[token].autoReply = !botSessions[token].autoReply;
                        const statusText = botSessions[token].autoReply ? "เปิด" : "ปิด";
                        api.sendMessage(`โหมดซิมถูก${statusText}แล้วจ้า!`, event.threadID);
                        return;
                    }

                    const command = commands[commandName];
                    if (command && typeof command.run === "function") {
                        try {
                            await command.run({ api, event, args });
                            console.log(chalk.green(`✅ รันคำสั่ง: ${commandName}`));
                            commandUsage[commandName] = (commandUsage[commandName] || 0) + 1;
                            saveCommandUsage();
                            io.emit('updateBots', generateBotData());
                            io.emit('updateCommands', generateCommandData());
                        } catch (error) {
                            console.error(chalk.red(`❌ Error cmd ${commandName}:`), error);
                            api.sendMessage("❗ การรันคำสั่งล้มเหลว", event.threadID);
                        }
                    } else {
                        api.sendMessage("❗ ไม่พบคำสั่งที่ระบุ", event.threadID);
                    }
                }

                // หากบอทกลับมาออนไลน์ ให้ยกเลิก Timeout ลบอัตโนมัติ
                if (botSessions[token].status === 'online') {
                    if (botSessions[token].deletionTimeout) {
                        clearTimeout(botSessions[token].deletionTimeout);
                        botSessions[token].deletionTimeout = null;
                        console.log(chalk.green(`🔄 ยกเลิกการลบบอท ${name}`));
                    }
                }
            });

            if (saveToFile) {
                const botFilePath = path.join(botsDir, `${name.replace(/ /g, '_')}.json`);
                const botData = { appState, token, name, prefix, startTime, password, adminID, autoReply };
                fs.writeFileSync(botFilePath, JSON.stringify(botData, null, 4));
            }

            io.emit('updateBots', generateBotData());
            resolve();
        });
    });
}

// ========== ฟังก์ชันลบบอท ==========
function deleteBot(token, emitDeleted = true) {
    const bot = botSessions[token];
    if (!bot) {
        console.log(chalk.red(`❌ ไม่พบบอท: ${token}`));
        return;
    }
    const { name } = bot;
    const botFilePath = path.join(botsDir, `${name.replace(/ /g, '_')}.json`);
    if (fs.existsSync(botFilePath)) {
        fs.unlinkSync(botFilePath);
        console.log(chalk.green(`✅ ลบไฟล์บอท: ${botFilePath}`));
    }
    delete botSessions[token];
    console.log(chalk.green(`✅ ลบบอท: ${token}`));
    if (emitDeleted) {
        io.emit('updateBots', generateBotData());
        io.emit('botDeleted', name);
    }
}

// ========== Route ลบบอท ==========
app.post('/delete', (req, res) => {
    const { token, code } = req.body;
    if (!token || !code) return res.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });

    const trimmedToken = token.trim();
    const bot = botSessions[trimmedToken];
    if (!bot) return res.json({ success: false, message: 'ไม่พบบอทที่ต้องการลบ' });

    if (bot.password.toString() !== code.toString()) {
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

// ========== Route แก้ไขโทเค่น ==========
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
        const newAppState = JSON.parse(trimmedNewToken);
        const newPassword = generate6DigitCode();
        const startTime = Date.now();
        await startBotWithRetry(
            newAppState,
            trimmedNewToken,
            bot.name,
            bot.prefix,
            startTime,
            newPassword,
            bot.adminID,
            5,
            bot.autoReply
        );
        console.log(chalk.green(`✅ แก้ไขโทเค่น ${bot.name} -> ${trimmedNewToken}`));
        io.emit('updateBots', generateBotData());
        res.json({ success: true, message: 'แก้ไขโทเค่นสำเร็จ' });
    } catch (err) {
        console.error(chalk.red(`❌ แก้ไขโทเค่นผิดพลาด: ${err.message}`));
        res.json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขโทเค่น' });
    }
});

// ========== Route รีสตาร์ทบอท ==========
app.post('/restart', async (req, res) => {
    const { token, code } = req.body;
    if (!token || !code) return res.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });

    const trimmedToken = token.trim();
    const bot = botSessions[trimmedToken];
    if (!bot) {
        return res.json({ success: false, message: 'ไม่พบบอทที่ต้องการรีสตาร์ท' });
    }
    if (bot.password.toString() !== code.toString()) {
        return res.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    try {
        const { appState, name, prefix, password, adminID, autoReply } = bot;
        deleteBot(trimmedToken, false);
        await startBotWithRetry(appState, trimmedToken, name, prefix, Date.now(), password, adminID, 5, autoReply);
        console.log(chalk.green(`✅ รีสตาร์ทบอทสำเร็จ: ${name}`));
        io.emit('updateBots', generateBotData());
        res.json({ success: true, message: 'รีสตาร์ทบอทสำเร็จ', botName: name });
    } catch (err) {
        console.error(chalk.red(`❌ รีสตาร์ทบอทผิดพลาด: ${err.message}`));
        res.json({ success: false, message: 'เกิดข้อผิดพลาดในการรีสตาร์ทบอท' });
    }
});

// ========== Socket.io สำหรับหน้าแดชบอร์ด ==========
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

// สร้างชื่อบอทแบบสุ่ม (ตัวอย่าง)
function generateBotName() {
    const adjectives = ["Super", "Mega", "Ultra", "Hyper", "Xmas", "Santa", "Snowy", "Jingle"];
    const nouns = ["Tree", "Bell", "Reindeer", "Snowman", "Elf", "Candy", "Cookie", "Gift"];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}${noun}`;
}

// เริ่มเซิร์ฟเวอร์ + โหลดบอทจากไฟล์
server.listen(PORT, () => {
    console.log(chalk.blue(`🌐 เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${PORT}`));
    console.log(chalk.green(figlet.textSync("Xmas Bot 2025", { horizontalLayout: "full" })));
    loadBotsFromFiles();
});

// อัปเดตปิงของบอททุก 5 วิ (จำลอง)
setInterval(() => {
    Object.values(botSessions).forEach(bot => {
        bot.ping = Math.floor(Math.random() * 200) + 1;
    });
    io.emit('updateBots', generateBotData());
}, 5000);

// ลบบอทที่การเชื่อมต่อล้มเหลว/ออฟไลน์ทุก 5 นาที
setInterval(() => {
    console.log(chalk.yellow('🔍 ตรวจสอบบอทสำหรับลบอัตโนมัติ...'));
    let botsToDelete = 0;
    Object.keys(botSessions).forEach(token => {
        const bot = botSessions[token];
        if (bot.status === 'connection_failed' || bot.status === 'offline') {
            console.log(chalk.yellow(`⌛ ลบบอท "${bot.name}" (สถานะ: ${bot.status})`));
            deleteBot(token, true);
            botsToDelete++;
        }
    });
    if (botsToDelete === 0) {
        console.log(chalk.green('✅ ไม่มีบอทที่ต้องลบตอนนี้'));
    }
}, 300000); // 5 นาที
