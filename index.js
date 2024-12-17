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
    const onlineBots = Object.values(botSessions).filter(bot => bot.status === 'online').length;
    const activeBots = Object.values(botSessions).filter(bot => bot.status === 'active').length;

    // สร้างแถวตารางบอทพร้อมข้อมูลปิง
    const botRows = Object.entries(botSessions).map(([token, bot]) => `
        <tr id="bot-${encodeURIComponent(token)}">
            <td>
                <i class="fas fa-robot me-2" style="color: var(--primary-color);"></i>
                <span class="bot-name">${bot.name}</span>
            </td>
            <td>
                <span class="${bot.status === 'online' ? 'status-online' : 'status-offline'}">
                    <i class="fas fa-circle"></i>
                    ${bot.status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}
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
                startBot(appState, token, name, startTime, password, adminID, prefix, false).catch(err => {
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
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #f8f9fa;
                    --card-bg: #ffffff;
                    --card-border: #dee2e6;
                    --text-color: #212529;
                    --success-color: #198754;
                    --error-color: #dc3545;
                    --info-color: #0d6efd;
                    --bot-name-color: #ff5722;
                }

                body {
                    background: var(--background-color);
                    color: var(--text-color);
                    font-family: 'Roboto', sans-serif;
                    min-height: 100vh;
                    position: relative;
                    overflow-x: hidden;
                }

                .navbar {
                    background: var(--primary-color);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #ffffff !important;
                }

                .stats-card {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .stats-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                }

                .stats-number {
                    font-size: 2.5rem;
                    font-weight: 700;
                    margin: 10px 0;
                    color: var(--primary-color);
                }

                .stats-label {
                    font-size: 1rem;
                    color: var(--text-color);
                }

                .glass-card {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
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
                    background-color: var(--primary-color);
                    color: #fff;
                    font-weight: 600;
                }

                .bot-table tr:nth-child(even),
                .command-table tr:nth-child(even) {
                    background-color: #f1f1f1;
                }

                .status-online {
                    background: var(--success-color);
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .status-offline {
                    background: var(--error-color);
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .footer {
                    background: var(--primary-color);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
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

                .runtime {
                    font-weight: 500;
                    color: var(--info-color);
                }

                .ping {
                    font-weight: 500;
                    color: var(--accent-color);
                }

                .bot-name {
                    font-family: 'Press Start 2P', cursive;
                    color: var(--bot-name-color);
                    font-size: 1.1rem;
                }

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

                /* Styles for Edit and Delete Buttons */
                .btn-edit, .btn-delete {
                    margin-right: 5px;
                }

                /* Toast Styles */
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }
            </style>
        </head>
        <body>
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
                        </ul>
                    </div>
                </div>
            </nav>

            <div class="container">
                <!-- สถิติ -->
                <div class="row mb-4">
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-robot fa-2x mb-3" style="color: var(--primary-color);"></i>
                            <div class="stats-number" id="totalBots">${data.totalBots}</div>
                            <div class="stats-label">บอททั้งหมด</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-signal fa-2x mb-3" style="color: var(--info-color);"></i>
                            <div class="stats-number" id="onlineBots">${data.onlineBots}</div>
                            <div class="stats-label">บอทออนไลน์</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-clock fa-2x mb-3" style="color: var(--secondary-color);"></i>
                            <div class="stats-number" id="activeBots">${data.activeBots}</div>
                            <div class="stats-label">บอททำงานแล้ว</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-tachometer-alt fa-2x mb-3" style="color: var(--accent-color);"></i>
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
                                <i class="fas fa-robot me-2" style="color: var(--primary-color);"></i>
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

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

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

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

                // Event Delegation สำหรับปุ่มลบและแก้ไข
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
                            const newPrefix = prompt('กรุณากรอกคำนำหน้าใหม่ (ถ้าไม่ต้องการคำนำหน้า ให้เว้นว่างไว้):');
                            if (newToken !== null) { // Allow empty prefix
                                fetch('/edit', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ token, code: editCode, newToken, newPrefix })
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
                            กรุณากรอกทั้งโทเค็น, รหัสผ่าน และ ID แอดมิน
                        </div>`;
    } else if (error === 'invalid-password') {
        errorMessage = `<div class="alert alert-danger" role="alert">
                            รหัสผ่านไม่ถูกต้อง กรุณากรอกรหัสผ่าน 6 หลัก
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
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #f8f9fa;
                    --card-bg: #ffffff;
                    --card-border: #dee2e6;
                    --text-color: #212529;
                    --success-color: #198754;
                    --error-color: #dc3545;
                    --info-color: #0d6efd;
                }

                body {
                    background: var(--background-color);
                    color: var(--text-color);
                    font-family: 'Roboto', sans-serif;
                    min-height: 100vh;
                    position: relative;
                    overflow-x: hidden;
                }

                .navbar {
                    background: var(--primary-color);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #ffffff !important;
                }

                .glass-card {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
                }

                .add-bot-form .form-label {
                    font-weight: 500;
                    color: var(--text-color);
                }

                .form-control {
                    background: #f1f1f1;
                    border: 1px solid #ced4da;
                    border-radius: 8px;
                    padding: 10px 12px;
                    font-size: 1rem;
                    transition: border-color 0.3s ease, background 0.3s ease;
                    color: var(--text-color);
                }

                .form-control::placeholder {
                    color: #6c757d;
                }

                .form-control:focus {
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
                    background: #e9ecef;
                    color: var(--text-color);
                }

                .btn-primary {
                    background: var(--primary-color);
                    border: none;
                    padding: 10px 20px;
                    font-size: 1rem;
                    border-radius: 8px;
                    transition: background 0.3s ease, transform 0.2s ease;
                    color: #fff;
                    font-weight: 600;
                }

                .btn-primary:hover {
                    background: #0b5ed7;
                    transform: translateY(-2px);
                }

                .footer {
                    background: var(--primary-color);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
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

                /* Toast Styles */
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }
            </style>
        </head>
        <body>
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
                        </ul>
                    </div>
                </div>
            </nav>

            <div class="container">
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-plus-circle me-2" style="color: var(--primary-color);"></i>
                        เพิ่มบอทใหม่
                    </h5>
                    ${errorMessage}
                    <form class="add-bot-form" method="POST" action="/start">
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
                        <div class="mb-3">
                            <label for="prefix" class="form-label">คำนำหน้าสำหรับคำสั่ง (ถ้าไม่ต้องการคำนำหน้า ให้เว้นว่างไว้)</label>
                            <input 
                                type="text" 
                                id="prefix" 
                                name="prefix" 
                                class="form-control" 
                                placeholder="/"
                                maxlength="3"
                            />
                        </div>
                        <button type="submit" class="btn btn-primary w-100">
                            <i class="fas fa-play me-2"></i>
                            เริ่มบอท
                        </button>
                    </form>
                </div>
            </div>

            <!-- Toast Container -->
            <div class="toast-container"></div>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script>
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

                // Event Delegation สำหรับปุ่มลบและแก้ไข
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
                            const newPrefix = prompt('กรุณากรอกคำนำหน้าใหม่ (ถ้าไม่ต้องการคำนำหน้า ให้เว้นว่างไว้):');
                            if (newToken !== null) { // Allow empty prefix
                                fetch('/edit', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ token, code: editCode, newToken, newPrefix })
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
                });
            </script>
        </body>
        </html>
    `);
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
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #f8f9fa;
                    --card-bg: #ffffff;
                    --card-border: #dee2e6;
                    --text-color: #212529;
                    --success-color: #198754;
                    --error-color: #dc3545;
                    --info-color: #0d6efd;
                    --bot-name-color: #ff5722;
                }

                body {
                    background: var(--background-color);
                    color: var(--text-color);
                    font-family: 'Roboto', sans-serif;
                    min-height: 100vh;
                    position: relative;
                    overflow-x: hidden;
                }

                .navbar {
                    background: var(--primary-color);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #ffffff !important;
                }

                .glass-card {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
                }

                .bot-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                .bot-table th, .bot-table td {
                    padding: 12px 15px;
                    text-align: left;
                }

                .bot-table th {
                    background-color: var(--primary-color);
                    color: #fff;
                    font-weight: 600;
                }

                .bot-table tr:nth-child(even) {
                    background-color: #f1f1f1;
                }

                .status-online {
                    background: var(--success-color);
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .status-offline {
                    background: var(--error-color);
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }

                .footer {
                    background: var(--primary-color);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
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

                .runtime {
                    font-weight: 500;
                    color: var(--info-color);
                }

                .ping {
                    font-weight: 500;
                    color: var(--accent-color);
                }

                .bot-name {
                    font-family: 'Press Start 2P', cursive;
                    color: var(--bot-name-color);
                    font-size: 1.1rem;
                }

                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                    .bot-table th, .bot-table td {
                        padding: 8px 10px;
                    }
                }

                /* Styles for Edit and Delete Buttons */
                .btn-edit, .btn-delete {
                    margin-right: 5px;
                }

                /* Toast Styles */
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }
            </style>
        </head>
        <body>
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
                                <a class="nav-link active" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <div class="container">
                <!-- ตารางบอท -->
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-list me-2" style="color: var(--info-color);"></i>
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

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

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

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

                // Event Delegation สำหรับปุ่มลบและแก้ไข
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
                            const newPrefix = prompt('กรุณากรอกคำนำหน้าใหม่ (ถ้าไม่ต้องการคำนำหน้า ให้เว้นว่างไว้):');
                            if (newToken !== null) { // Allow empty prefix
                                fetch('/edit', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ token, code: editCode, newToken, newPrefix })
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
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #f8f9fa;
                    --card-bg: #ffffff;
                    --card-border: #dee2e6;
                    --text-color: #212529;
                    --success-color: #198754;
                    --error-color: #dc3545;
                    --info-color: #0d6efd;
                }

                body {
                    background: var(--background-color);
                    color: var(--text-color);
                    font-family: 'Roboto', sans-serif;
                    min-height: 100vh;
                    position: relative;
                    overflow-x: hidden;
                }

                .navbar {
                    background: var(--primary-color);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: #ffffff !important;
                }

                .glass-card {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
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
                    background-color: var(--primary-color);
                    color: #fff;
                    font-weight: 600;
                }

                .command-table tr:nth-child(even) {
                    background-color: #f1f1f1;
                }

                .footer {
                    background: var(--primary-color);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
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
                    .command-table th, .command-table td {
                        padding: 8px 10px;
                    }
                }

                /* Toast Styles */
                .toast-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1055;
                }
            </style>
        </head>
        <body>
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
                                <a class="nav-link active" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <div class="container">
                <!-- ตารางคำสั่งที่ใช้ -->
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-terminal me-2" style="color: var(--secondary-color);"></i>
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

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
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
        prefix: bot.prefix || '/'
    }));
    res.json(bots);
});

// POST /start เพื่อเริ่มต้นบอท
app.post('/start', async (req, res) => {
    const { token, password, adminID, prefix } = req.body;

    // ตรวจสอบว่ามีการกรอกโทเค็น, รหัสผ่าน และ ID แอดมิน
    if (!token || !password || !adminID) {
        return res.redirect('/start?error=missing-fields');
    }

    // ตรวจสอบรูปแบบของรหัสผ่าน (ต้องเป็นเลข 6 หลัก)
    const passwordRegex = /^\d{6}$/;
    if (!passwordRegex.test(password)) {
        return res.redirect('/start?error=invalid-password');
    }

    try {
        const appState = JSON.parse(token);
        const tokenKey = token.trim();
        if (botSessions[tokenKey]) {
            return res.redirect('/start?error=already-running');
        }

        const botName = `⚡${generateCoolBotName()}⚡`;
        const startTime = Date.now();

        await startBot(appState, tokenKey, botName, startTime, password, adminID, prefix, true);
        res.redirect('/bots');
        io.emit('updateBots', generateBotData());
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        res.redirect('/start?error=invalid-token');
    }
});

// ฟังก์ชันเริ่มต้นบอท
async function startBot(appState, token, name, startTime, password, adminID, prefix, saveToFile = true) {
    return new Promise((resolve, reject) => {
        login({ appState }, (err, api) => {
            if (err) {
                console.error(chalk.red(`❌ การเข้าสู่ระบบล้มเหลวสำหรับโทเค็น: ${token}`));
                return reject(err);
            }

            if (botSessions[token]) {
                console.log(chalk.yellow(`⚠️ บอทกำลังทำงานอยู่กับโทเค็น: ${token}`));
                return reject(new Error('บอทกำลังทำงานอยู่'));
            }

            botSessions[token] = { 
                api, 
                name, 
                startTime, 
                status: 'online',
                password: password.toString(), // แปลงเป็น string เพื่อความแน่ใจ
                adminID: adminID.trim(), // เก็บ ID แอดมิน
                ping: 'N/A', // เริ่มต้นปิงเป็น N/A
                deletionTimeout: null, // เพิ่มตัวแปรสำหรับการลบอัตโนมัติ
                prefix: prefix ? prefix.trim() : '/' // ตั้งค่าคำนำหน้า
            };
            botCount = Math.max(botCount, parseInt(name.replace(/⚡/g, '').replace('Bot ', '') || '0')); // ปรับ botCount ให้สูงสุด

            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));
            console.log(chalk.green(`🔑 รหัสผ่านสำหรับลบ/แก้ไขโทเค่น: ${password}`)); // แสดงรหัสผ่านใน console
            console.log(chalk.green(`🔑 ID แอดมิน: ${adminID}`)); // แสดง ID แอดมินใน console

            console.log(chalk.blue(`🔤 คำนำหน้าสำหรับบอทนี้: "${botSessions[token].prefix}"`)); // แสดงคำนำหน้า

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
                            deleteBot(token);
                            io.emit('botDeleted', botSessions[token].name);
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

                    const currentPrefix = botSessions[token].prefix || '/';
                    if (currentPrefix && !message.startsWith(currentPrefix)) return;

                    const args = currentPrefix ? message.slice(currentPrefix.length).trim().split(/ +/) : message.trim().split(/ +/);
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
                        // ปรับปรุงข้อความแสดงข้อผิดพลาด
                        const suggestion = `${currentPrefix}help`; // สามารถปรับเปลี่ยนได้ตามต้องการ
                        api.sendMessage(\`❗ ไม่พบคำสั่งนี้ ลองพิมพ์ "\${suggestion}" เพื่อดูคำสั่งที่ใช้งานได้\`, event.threadID);
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
                const botData = { appState, token, name, startTime, password, adminID, prefix };
                const botFilePath = path.join(botsDir, `${name.replace(/ /g, '_')}.json`);
                fs.writeFileSync(botFilePath, JSON.stringify(botData, null, 4));
            }

            io.emit('updateBots', generateBotData());
            resolve();
        });
    });
}

// ฟังก์ชันสำหรับลบบอท
function deleteBot(token) {
    const bot = botSessions[token];
    if (!bot) {
        console.log(chalk.red(`❌ ไม่พบบอทที่ต้องการลบ: ${token}`));
        return;
    }

    const { api, name } = bot;

    // หยุดการทำงานของบอท
    if (typeof api.logout === 'function') {
        api.logout((err) => {
            if (err) {
                console.error(chalk.red(`❌ ไม่สามารถหยุดบอท: ${name}, error=${err.message}`));
            } else {
                console.log(chalk.green(`✅ หยุดบอทเรียบร้อย: ${name}`));
            }

            // ลบไฟล์บอท
            const botFilePath = path.join(botsDir, `${name.replace(/ /g, '_')}.json`);
            if (fs.existsSync(botFilePath)) {
                fs.unlinkSync(botFilePath);
                console.log(chalk.green(`✅ ลบไฟล์บอท: ${botFilePath}`));
            }

            // ลบจาก botSessions
            delete botSessions[token];
            console.log(chalk.green(`✅ ลบบอทจากระบบ: ${token}`));

            io.emit('updateBots', generateBotData());
            io.emit('botDeleted', name);
        });
    } else {
        console.error(chalk.red(`❌ เมธอด logout ไม่พบใน bot.api สำหรับบอท: ${name}`));
    }
}

// Route สำหรับลบบอท
app.post('/delete', async (req, res) => {
    const { token, code } = req.body;

    console.log(`ได้รับคำขอลบบอท: token=${token}, code=${code}`);

    if (!token || !code) {
        console.log('ข้อมูลไม่ครบถ้วน');
        return res.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const trimmedToken = token.trim(); // ทำการ trim โทเค็นก่อนค้นหา
    const bot = botSessions[trimmedToken];
    if (!bot) {
        console.log('ไม่พบบอทที่ต้องการลบ');
        return res.json({ success: false, message: 'ไม่พบบอทที่ต้องการลบ' });
    }

    console.log(`ตรวจสอบรหัสผ่าน: bot.password=${bot.password}, code=${code}`);

    if (bot.password.toString() !== code.toString()) { // ตรวจสอบรหัสผ่าน
        console.log('รหัสผ่านไม่ถูกต้อง');
        return res.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    // หยุดการทำงานของบอทและลบทันที
    try {
        // ตรวจสอบว่า bot.api มีเมธอด logout หรือไม่
        if (typeof bot.api.logout === 'function') {
            await new Promise((resolve, reject) => {
                bot.api.logout((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            console.log(`บอทถูกหยุดทำงาน: ${bot.name}`);
        } else {
            throw new Error('เมธอด logout ไม่พบใน bot.api');
        }

        // ลบไฟล์บอท
        const botFilePath = path.join(botsDir, `${bot.name.replace(/ /g, '_')}.json`);
        if (fs.existsSync(botFilePath)) {
            fs.unlinkSync(botFilePath);
            console.log(`ลบไฟล์บอท: ${botFilePath}`);
        }

        // ลบจาก botSessions
        delete botSessions[trimmedToken];
        console.log(`ลบบอทจาก botSessions: ${trimmedToken}`);

        io.emit('updateBots', generateBotData());
        io.emit('botDeleted', bot.name);
        res.json({ success: true, message: 'ลบบอทสำเร็จ' });
    } catch (err) {
        console.error(`ไม่สามารถหยุดบอท: ${err.message}`);
        res.json({ success: false, message: 'ไม่สามารถหยุดบอทได้' });
    }
});

// Route สำหรับแก้ไขโทเค่น
app.post('/edit', async (req, res) => {
    const { token, code, newToken, newPrefix } = req.body;

    if (!token || !code || !newToken) {
        return res.json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
    }

    const trimmedToken = token.trim();
    const bot = botSessions[trimmedToken];
    if (!bot) {
        return res.json({ success: false, message: 'ไม่พบบอทที่ต้องการแก้ไข' });
    }

    if (bot.password.toString() !== code.toString()) { // ตรวจสอบรหัสผ่าน
        return res.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    const trimmedNewToken = newToken.trim();
    if (botSessions[trimmedNewToken]) {
        return res.json({ success: false, message: 'โทเค่นใหม่ถูกใช้งานแล้ว' });
    }

    try {
        // หยุดการทำงานของบอท
        if (typeof bot.api.logout === 'function') {
            await new Promise((resolve, reject) => {
                bot.api.logout((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
            console.log(`หยุดบอท: ${bot.name}`);
        } else {
            throw new Error('เมธอด logout ไม่พบใน bot.api');
        }

        // ลบไฟล์บอทเก่า
        const oldBotFilePath = path.join(botsDir, `${bot.name.replace(/ /g, '_')}.json`);
        if (fs.existsSync(oldBotFilePath)) {
            fs.unlinkSync(oldBotFilePath);
            console.log(`ลบไฟล์บอทเก่า: ${oldBotFilePath}`);
        }

        // ลบจาก botSessions
        delete botSessions[trimmedToken];
        console.log(`ลบบอทจาก botSessions: ${trimmedToken}`);

        // เริ่มต้นบอทใหม่ด้วยโทเค่นใหม่และรหัสผ่านใหม่
        const newPassword = generate6DigitCode();
        let newAppState;
        try {
            newAppState = JSON.parse(newToken); // ตรวจสอบว่า newToken เป็น JSON string
        } catch (parseError) {
            throw new Error('newToken ไม่เป็น JSON ที่ถูกต้อง');
        }
        const startTime = Date.now();
        await startBot(newAppState, trimmedNewToken, bot.name, startTime, newPassword, bot.adminID, newPrefix, true);

        console.log(chalk.green(`✅ แก้ไขโทเค่นของบอท: ${bot.name} เป็น ${trimmedNewToken}`));
        io.emit('updateBots', generateBotData());
        res.json({ success: true, message: 'แก้ไขโทเค่นสำเร็จ' });
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการแก้ไขโทเค่น: ${err.message}`));
        res.json({ success: false, message: 'เกิดข้อผิดพลาดในการแก้ไขโทเค่น' });
    }
});

// Socket.io สำหรับหน้าแดชบอร์ดหลักและดูบอทรัน
io.on('connection', (socket) => {
    console.log(chalk.blue('🔌 Socket.io client connected'));

    // Handle 'ping' event from client
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

// ฟังก์ชันช่วยเหลือในการสร้างชื่อบอทที่เท่ๆ และไฮเทค
function generateCoolBotName() {
    const adjectives = ["Quantum", "Neon", "Cyber", "Nova", "Aero", "Lunar", "Zenith", "Pixel", "Hyper"];
    const nouns = ["Xenon", "Specter", "Vortex", "Orion", "Blaze", "Nebula", "Titan", "Fusion", "Matrix"];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000); // เพิ่มตัวเลขเพื่อความเฉพาะเจาะจง
    return `${adjective}${noun}${number}`;
}

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
}, 5000); // อัปเดตทุก 5 วินาที ทำให้ทั้งเว็บสวยขึ้นต่างออกไปจากเดิมเหมือนเว็บรันบอทต่างประเทศ
