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

let botCount = 0;
const botSessions = {};
const removalTimers = {}; // เก็บตัวจับเวลาการลบบอท
const prefix = "/";
const commands = {};
const commandDescriptions = [];
const commandUsage = {}; // ติดตามการใช้งานคำสั่ง

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

// ฟังก์ชันช่วยเหลือในการสร้างข้อมูลบอทสำหรับการอัปเดตแบบเรียลไทม์
function generateBotData() {
    const totalBots = Object.keys(botSessions).length;
    const onlineBots = Object.values(botSessions).filter(bot => bot.status === 'online').length;
    const activeBots = Object.values(botSessions).filter(bot => bot.status === 'active').length;

    const botRows = Object.entries(botSessions).map(([token, bot]) => `
        <tr id="bot-${token}">
            <td>
                <i class="fas fa-robot me-2" style="color: var(--primary-color);"></i>
                ${bot.name}
            </td>
            <td>
                <span class="${bot.status === 'online' ? 'status-online' : 'status-offline'}">
                    <i class="fas fa-circle"></i>
                    ${bot.status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}
                </span>
                ${bot.status === 'offline' ? `<span class="countdown" id="countdown-${token}"> (ลบใน <span class="countdown-seconds">60</span> วินาที)</span>` : ''}
            </td>
            <td>
                <span class="runtime" data-start-time="${bot.startTime}">
                    กำลังคำนวณ...
                </span>
            </td>
        </tr>
    `).join('') || `
        <tr>
            <td colspan="3" class="text-center">ไม่มีบอทที่กำลังทำงาน</td>
        </tr>
    `;

    // รวบรวมบอทที่ออฟไลน์เพื่อให้ frontend จัดการนับถอยหลัง
    const offlineBots = Object.entries(botSessions)
        .filter(([token, bot]) => bot.status === 'offline')
        .map(([token, bot]) => token);

    return { totalBots, onlineBots, activeBots, botRows, commandDescriptions, offlineBots };
}

// ฟังก์ชันช่วยเหลือในการสร้างข้อมูลคำสั่ง
function generateCommandData() {
    const commandsData = Object.entries(commandUsage).map(([name, count]) => `
        <tr>
            <td>${prefix}${name}</td>
            <td>${count}</td>
        </tr>
    `).join('') || `
        <tr>
            <td colspan="2" class="text-center">ไม่มีคำสั่งที่ถูกใช้งาน</td>
        </tr>
    `;

    return commandsData;
}

// หน้าแดชบอร์ดหลัก
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>แดชบอร์ดหลัก | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #121212;
                    --card-bg: rgba(255, 255, 255, 0.1);
                    --card-border: rgba(255, 255, 255, 0.2);
                    --text-color: #ffffff;
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

                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        radial-gradient(circle at 20% 20%, rgba(13, 110, 253, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 80% 80%, rgba(25, 135, 84, 0.15) 0%, transparent 40%);
                    pointer-events: none;
                    z-index: -1;
                }

                .navbar {
                    background: rgba(0, 0, 0, 0.8);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    border-bottom: 2px solid var(--primary-color);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: var(--text-color) !important;
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
                    background-color: rgba(13, 110, 253, 0.05);
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
                    background: rgba(0, 0, 0, 0.8);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: var(--text-color);
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

                /* เพิ่มแอนิเมชันสำหรับการนับถอยหลัง */
                .countdown {
                    font-weight: 500;
                    color: var(--error-color);
                    animation: blink 1s step-start infinite;
                }

                @keyframes blink {
                    50% { opacity: 0; }
                }

                @media (max-width: 768px) {
                    .stats-card {
                        margin-bottom: 20px;
                    }
                    .glass-card {
                        margin-bottom: 20px;
                    }
                    .bot-table th, .bot-table td {
                        padding: 8px 10px;
                    }
                }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
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
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-robot fa-2x mb-3" style="color: var(--primary-color);"></i>
                            <div class="stats-number" id="totalBots">${Object.keys(botSessions).length}</div>
                            <div class="stats-label">บอททั้งหมด</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-signal fa-2x mb-3" style="color: var(--info-color);"></i>
                            <div class="stats-number" id="onlineBots">${Object.values(botSessions).filter(bot => bot.status === 'online').length}</div>
                            <div class="stats-label">บอทออนไลน์</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-clock fa-2x mb-3" style="color: var(--secondary-color);"></i>
                            <div class="stats-number" id="activeBots">${Object.values(botSessions).filter(bot => bot.status === 'active').length}</div>
                            <div class="stats-label">บอททำงานแล้ว</div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <!-- ตารางบอท -->
                    <div class="col-12">
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
                                        </tr>
                                    </thead>
                                    <tbody id="botTableBody">
                                        ${Object.entries(botSessions).map(([token, bot]) => `
                                            <tr id="bot-${token}">
                                                <td>
                                                    <i class="fas fa-robot me-2" style="color: var(--primary-color);"></i>
                                                    ${bot.name}
                                                </td>
                                                <td>
                                                    <span class="${bot.status === 'online' ? 'status-online' : 'status-offline'}">
                                                        <i class="fas fa-circle"></i>
                                                        ${bot.status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}
                                                    </span>
                                                    ${bot.status === 'offline' ? `<span class="countdown" id="countdown-${token}"> (ลบใน <span class="countdown-seconds">60</span> วินาที)</span>` : ''}
                                                </td>
                                                <td>
                                                    <span class="runtime" data-start-time="${bot.startTime}">
                                                        กำลังคำนวณ...
                                                    </span>
                                                </td>
                                            </tr>
                                        `).join('') || `
                                            <tr>
                                                <td colspan="3" class="text-center">ไม่มีบอทที่กำลังทำงาน</td>
                                            </tr>
                                        `}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();

                const removalTimers = {};

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

                        el.textContent = `${days} วัน ${hours} ชั่วโมง ${minutes} นาที ${seconds} วินาที`;
                    });
                }

                // ฟังก์ชันเริ่มนับถอยหลังการลบบอท
                function startCountdown(token) {
                    const countdownElement = document.getElementById(`countdown-${token}`);
                    if (!countdownElement) return;

                    let secondsLeft = 60;
                    const secondsSpan = countdownElement.querySelector('.countdown-seconds');

                    const interval = setInterval(() => {
                        secondsLeft--;
                        secondsSpan.textContent = secondsLeft;
                        if (secondsLeft <= 0) {
                            clearInterval(interval);
                            // ลบแถวของบอทออกจากตาราง
                            const row = countdownElement.closest('tr');
                            if (row) row.remove();
                            delete removalTimers[token];
                        }
                    }, 1000);

                    removalTimers[token] = interval;
                }

                // รับข้อมูลอัปเดตจากเซิร์ฟเวอร์
                socket.on('updateBots', (data) => {
                    document.getElementById('totalBots').textContent = data.totalBots;
                    document.getElementById('onlineBots').textContent = data.onlineBots;
                    document.getElementById('activeBots').textContent = data.activeBots;
                    
                    const botTableBody = document.getElementById('botTableBody');
                    if (botTableBody) {
                        botTableBody.innerHTML = data.botRows;
                    }

                    updateRuntime();

                    // จัดการนับถอยหลังสำหรับบอทที่ออฟไลน์
                    data.offlineBots.forEach(token => {
                        if (!removalTimers[token]) {
                            startCountdown(token);
                        }
                    });
                });

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);
            </script>
        </body>
        </html>
    `);
});

// หน้าเพิ่มบอท
app.get("/start", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>เพิ่มบอท | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #121212;
                    --card-bg: rgba(255, 255, 255, 0.1);
                    --card-border: rgba(255, 255, 255, 0.2);
                    --text-color: #ffffff;
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

                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        radial-gradient(circle at 20% 20%, rgba(13, 110, 253, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 80% 80%, rgba(25, 135, 84, 0.15) 0%, transparent 40%);
                    pointer-events: none;
                    z-index: -1;
                }

                .navbar {
                    background: rgba(0, 0, 0, 0.8);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    border-bottom: 2px solid var(--primary-color);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: var(--text-color) !important;
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
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 8px;
                    padding: 10px 12px;
                    font-size: 1rem;
                    transition: border-color 0.3s ease, background 0.3s ease;
                    color: var(--text-color);
                }

                .form-control::placeholder {
                    color: rgba(255, 255, 255, 0.6);
                }

                .form-control:focus {
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
                    background: rgba(255, 255, 255, 0.3);
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
                    background: var(--info-color);
                    transform: translateY(-2px);
                }

                .footer {
                    background: rgba(0, 0, 0, 0.8);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: var(--text-color);
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
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
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
                        <button type="submit" class="btn btn-primary w-100">
                            <i class="fas fa-play me-2"></i>
                            เริ่มบอท
                        </button>
                    </form>
                </div>
            </div>

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

// หน้าแสดงบอทรัน
app.get("/bots", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ดูบอทรัน | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #121212;
                    --card-bg: rgba(255, 255, 255, 0.1);
                    --card-border: rgba(255, 255, 255, 0.2);
                    --text-color: #ffffff;
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

                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        radial-gradient(circle at 20% 20%, rgba(13, 110, 253, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 80% 80%, rgba(25, 135, 84, 0.15) 0%, transparent 40%);
                    pointer-events: none;
                    z-index: -1;
                }

                .navbar {
                    background: rgba(0, 0, 0, 0.8);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    border-bottom: 2px solid var(--primary-color);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: var(--text-color) !important;
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
                    background-color: rgba(13, 110, 253, 0.05);
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
                    background: rgba(0, 0, 0, 0.8);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: var(--text-color);
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

                /* เพิ่มแอนิเมชันสำหรับการนับถอยหลัง */
                .countdown {
                    font-weight: 500;
                    color: var(--error-color);
                    animation: blink 1s step-start infinite;
                }

                @keyframes blink {
                    50% { opacity: 0; }
                }

                @media (max-width: 768px) {
                    .glass-card {
                        margin-bottom: 20px;
                    }
                    .bot-table th, .bot-table td {
                        padding: 8px 10px;
                    }
                }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
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
                                </tr>
                            </thead>
                            <tbody id="botTableBody">
                                ${Object.entries(botSessions).map(([token, bot]) => `
                                    <tr id="bot-${token}">
                                        <td>
                                            <i class="fas fa-robot me-2" style="color: var(--primary-color);"></i>
                                            ${bot.name}
                                        </td>
                                        <td>
                                            <span class="${bot.status === 'online' ? 'status-online' : 'status-offline'}">
                                                <i class="fas fa-circle"></i>
                                                ${bot.status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}
                                            </span>
                                            ${bot.status === 'offline' ? `<span class="countdown" id="countdown-${token}"> (ลบใน <span class="countdown-seconds">60</span> วินาที)</span>` : ''}
                                        </td>
                                        <td>
                                            <span class="runtime" data-start-time="${bot.startTime}">
                                                กำลังคำนวณ...
                                            </span>
                                        </td>
                                    </tr>
                                `).join('') || `
                                    <tr>
                                        <td colspan="3" class="text-center">ไม่มีบอทที่กำลังทำงาน</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <footer class="footer text-center">
                <div class="container">
                    <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io({
                    reconnectionAttempts: 5, // จำนวนครั้งที่ลองเชื่อมต่อใหม่
                    reconnectionDelay: 1000, // เวลาระหว่างการลองเชื่อมต่อใหม่ (มิลลิวินาที)
                });

                const removalTimers = {};

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

                        el.textContent = `${days} วัน ${hours} ชั่วโมง ${minutes} นาที ${seconds} วินาที`;
                    });
                }

                // ฟังก์ชันเริ่มนับถอยหลังการลบบอท
                function startCountdown(token) {
                    const countdownElement = document.getElementById(`countdown-${token}`);
                    if (!countdownElement) return;

                    let secondsLeft = 60;
                    const secondsSpan = countdownElement.querySelector('.countdown-seconds');

                    const interval = setInterval(() => {
                        secondsLeft--;
                        secondsSpan.textContent = secondsLeft;
                        if (secondsLeft <= 0) {
                            clearInterval(interval);
                            // ลบแถวของบอทออกจากตาราง
                            const row = countdownElement.closest('tr');
                            if (row) row.remove();
                            delete removalTimers[token];
                        }
                    }, 1000);

                    removalTimers[token] = interval;
                }

                // รับข้อมูลอัปเดตจากเซิร์ฟเวอร์
                socket.on('updateBots', (data) => {
                    document.getElementById('totalBots').textContent = data.totalBots;
                    document.getElementById('onlineBots').textContent = data.onlineBots;
                    document.getElementById('activeBots').textContent = data.activeBots;
                    
                    const botTableBody = document.getElementById('botTableBody');
                    if (botTableBody) {
                        botTableBody.innerHTML = data.botRows;
                    }

                    updateRuntime();

                    // จัดการนับถอยหลังสำหรับบอทที่ออฟไลน์
                    data.offlineBots.forEach(token => {
                        if (!removalTimers[token]) {
                            startCountdown(token);
                        }
                    });
                });

                // อัปเดตเวลารันทุกวินาที
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);

                // จัดการการเชื่อมต่อใหม่
                socket.on('reconnect_attempt', () => {
                    console.log(chalk.yellow('🔄 กำลังลองเชื่อมต่อใหม่...'));
                });

                socket.on('reconnect_failed', () => {
                    console.log(chalk.red('🔌 การเชื่อมต่อใหม่ล้มเหลว'));
                });

                socket.on('connect_error', (err) => {
                    console.log(chalk.red(`🔌 การเชื่อมต่อล้มเหลว: ${err.message}`));
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
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #121212;
                    --card-bg: rgba(255, 255, 255, 0.1);
                    --card-border: rgba(255, 255, 255, 0.2);
                    --text-color: #ffffff;
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

                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        radial-gradient(circle at 20% 20%, rgba(13, 110, 253, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 80% 80%, rgba(25, 135, 84, 0.15) 0%, transparent 40%);
                    pointer-events: none;
                    z-index: -1;
                }

                .navbar {
                    background: rgba(0, 0, 0, 0.8);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    border-bottom: 2px solid var(--primary-color);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: var(--text-color) !important;
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
                    background-color: rgba(13, 110, 253, 0.05);
                }

                .footer {
                    background: rgba(0, 0, 0, 0.8);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: var(--text-color);
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
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
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
                                </tr>
                            </thead>
                            <tbody id="commandTableBody">
                                ${commandsData}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

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

// POST /start เพื่อเริ่มต้นบอท
app.post('/start', async (req, res) => {
    const tokenInput = req.body.token.trim();

    if (botSessions[tokenInput]) {
        return res.redirect('/start?error=already-running');
    }

    botCount++;
    const botName = `Bot ${botCount}`;
    const startTime = Date.now();

    try {
        const appState = JSON.parse(tokenInput);
        await startBot(appState, tokenInput, botName, startTime);
        res.redirect('/bots');
        io.emit('updateBots', generateBotData());
        io.emit('updateCommands', generateCommandData());
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        botCount--;
        res.redirect('/start?error=invalid-token');
    }
});

// ฟังก์ชันเริ่มต้นบอท
async function startBot(appState, token, name, startTime) {
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
                status: 'online'
            };
            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));

            api.setOptions({ listenEvents: true });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots', generateBotData());
                    scheduleBotRemoval(token); // เริ่มการลบบอทหลังจากออฟไลน์
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
                    
                    if (!message.startsWith(prefix)) return;

                    const args = message.slice(prefix.length).trim().split(/ +/);
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
                if (botSessions[token].status === 'online' && removalTimers[token]) {
                    clearCountdown(token);
                }
            });

            io.emit('updateBots', generateBotData());
            resolve();
        });
    });
}

// ฟังก์ชันเริ่มต้นการนับถอยหลังและลบบอทจากเซิร์ฟเวอร์หลังจาก 60 วินาที
function scheduleBotRemoval(token) {
    if (removalTimers[token]) return; // ถ้ามีการนับถอยหลังอยู่แล้ว

    removalTimers[token] = setTimeout(() => {
        delete botSessions[token];
        delete removalTimers[token];
        console.log(chalk.yellow(`⚠️ ลบบอทที่ออฟไลน์: ${token}`));
        io.emit('updateBots', generateBotData());
    }, 60000); // 60 วินาที
}

// ฟังก์ชันยกเลิกการลบบอท
function clearCountdown(token) {
    // ยกเลิกการนับถอยหลัง
    if (removalTimers[token]) {
        clearTimeout(removalTimers[token]);
        delete removalTimers[token];
        // ส่งการอัปเดตไปยัง frontend
        io.emit('updateBots', generateBotData());
        console.log(chalk.yellow(`⚠️ ยกเลิกการลบบอท ${botSessions[token].name}`));
    }
}

// Socket.io สำหรับหน้าแดชบอร์ดหลักและดูบอทรัน
io.on('connection', (socket) => {
    console.log(chalk.blue('🔌 Socket.io client connected'));
    socket.emit('updateBots', generateBotData());
    socket.emit('updateCommands', generateCommandData());

    socket.on('disconnect', () => {
        console.log(chalk.red('🔌 Socket.io client disconnected'));
    });
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
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #121212;
                    --card-bg: rgba(255, 255, 255, 0.1);
                    --card-border: rgba(255, 255, 255, 0.2);
                    --text-color: #ffffff;
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

                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        radial-gradient(circle at 20% 20%, rgba(13, 110, 253, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 80% 80%, rgba(25, 135, 84, 0.15) 0%, transparent 40%);
                    pointer-events: none;
                    z-index: -1;
                }

                .navbar {
                    background: rgba(0, 0, 0, 0.8);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    border-bottom: 2px solid var(--primary-color);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: var(--text-color) !important;
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
                    background-color: rgba(13, 110, 253, 0.05);
                }

                .footer {
                    background: rgba(0, 0, 0, 0.8);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: var(--text-color);
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
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
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
                                </tr>
                            </thead>
                            <tbody id="commandTableBody">
                                ${commandsData}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

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

// POST /start เพื่อเริ่มต้นบอท
app.post('/start', async (req, res) => {
    const tokenInput = req.body.token.trim();

    if (botSessions[tokenInput]) {
        return res.redirect('/start?error=already-running');
    }

    botCount++;
    const botName = `Bot ${botCount}`;
    const startTime = Date.now();

    try {
        const appState = JSON.parse(tokenInput);
        await startBot(appState, tokenInput, botName, startTime);
        res.redirect('/bots');
        io.emit('updateBots', generateBotData());
        io.emit('updateCommands', generateCommandData());
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        botCount--;
        res.redirect('/start?error=invalid-token');
    }
});

// ฟังก์ชันเริ่มต้นบอท
async function startBot(appState, token, name, startTime) {
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
                status: 'online'
            };
            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));

            api.setOptions({ listenEvents: true });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots', generateBotData());
                    scheduleBotRemoval(token); // เริ่มการลบบอทหลังจากออฟไลน์
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
                    
                    if (!message.startsWith(prefix)) return;

                    const args = message.slice(prefix.length).trim().split(/ +/);
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
                if (botSessions[token].status === 'online' && removalTimers[token]) {
                    clearCountdown(token);
                }
            });

            io.emit('updateBots', generateBotData());
            resolve();
        });
    });
}

// ฟังก์ชันเริ่มต้นการนับถอยหลังและลบบอทจากเซิร์ฟเวอร์หลังจาก 60 วินาที
function scheduleBotRemoval(token) {
    if (removalTimers[token]) return; // ถ้ามีการนับถอยหลังอยู่แล้ว

    removalTimers[token] = setTimeout(() => {
        delete botSessions[token];
        delete removalTimers[token];
        console.log(chalk.yellow(`⚠️ ลบบอทที่ออฟไลน์: ${token}`));
        io.emit('updateBots', generateBotData());
    }, 60000); // 60 วินาที
}

// ฟังก์ชันยกเลิกการลบบอท
function clearCountdown(token) {
    // ยกเลิกการนับถอยหลัง
    if (removalTimers[token]) {
        clearTimeout(removalTimers[token]);
        delete removalTimers[token];
        // ส่งการอัปเดตไปยัง frontend
        io.emit('updateBots', generateBotData());
        console.log(chalk.yellow(`⚠️ ยกเลิกการลบบอท ${botSessions[token].name}`));
    }
}

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
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #121212;
                    --card-bg: rgba(255, 255, 255, 0.1);
                    --card-border: rgba(255, 255, 255, 0.2);
                    --text-color: #ffffff;
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

                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        radial-gradient(circle at 20% 20%, rgba(13, 110, 253, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 80% 80%, rgba(25, 135, 84, 0.15) 0%, transparent 40%);
                    pointer-events: none;
                    z-index: -1;
                }

                .navbar {
                    background: rgba(0, 0, 0, 0.8);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    border-bottom: 2px solid var(--primary-color);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: var(--text-color) !important;
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
                    background-color: rgba(13, 110, 253, 0.05);
                }

                .footer {
                    background: rgba(0, 0, 0, 0.8);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: var(--text-color);
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
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
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
                                </tr>
                            </thead>
                            <tbody id="commandTableBody">
                                ${commandsData}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

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

// POST /start เพื่อเริ่มต้นบอท
app.post('/start', async (req, res) => {
    const tokenInput = req.body.token.trim();

    if (botSessions[tokenInput]) {
        return res.redirect('/start?error=already-running');
    }

    botCount++;
    const botName = `Bot ${botCount}`;
    const startTime = Date.now();

    try {
        const appState = JSON.parse(tokenInput);
        await startBot(appState, tokenInput, botName, startTime);
        res.redirect('/bots');
        io.emit('updateBots', generateBotData());
        io.emit('updateCommands', generateCommandData());
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        botCount--;
        res.redirect('/start?error=invalid-token');
    }
});

// ฟังก์ชันเริ่มต้นบอท
async function startBot(appState, token, name, startTime) {
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
                status: 'online'
            };
            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));

            api.setOptions({ listenEvents: true });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots', generateBotData());
                    scheduleBotRemoval(token); // เริ่มการลบบอทหลังจากออฟไลน์
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
                    
                    if (!message.startsWith(prefix)) return;

                    const args = message.slice(prefix.length).trim().split(/ +/);
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
                if (botSessions[token].status === 'online' && removalTimers[token]) {
                    clearCountdown(token);
                }
            });

            io.emit('updateBots', generateBotData());
            resolve();
        });
    });
}

// ฟังก์ชันเริ่มต้นการนับถอยหลังและลบบอทจากเซิร์ฟเวอร์หลังจาก 60 วินาที
function scheduleBotRemoval(token) {
    if (removalTimers[token]) return; // ถ้ามีการนับถอยหลังอยู่แล้ว

    removalTimers[token] = setTimeout(() => {
        delete botSessions[token];
        delete removalTimers[token];
        console.log(chalk.yellow(`⚠️ ลบบอทที่ออฟไลน์: ${token}`));
        io.emit('updateBots', generateBotData());
    }, 60000); // 60 วินาที
}

// ฟังก์ชันยกเลิกการลบบอท
function clearCountdown(token) {
    // ยกเลิกการนับถอยหลัง
    if (removalTimers[token]) {
        clearTimeout(removalTimers[token]);
        delete removalTimers[token];
        // ส่งการอัปเดตไปยัง frontend
        io.emit('updateBots', generateBotData());
        console.log(chalk.yellow(`⚠️ ยกเลิกการลบบอท ${botSessions[token].name}`));
    }
}

// Socket.io สำหรับหน้าแดชบอร์ดหลักและดูบอทรัน
io.on('connection', (socket) => {
    console.log(chalk.blue('🔌 Socket.io client connected'));
    socket.emit('updateBots', generateBotData());
    socket.emit('updateCommands', generateCommandData());

    socket.on('disconnect', () => {
        console.log(chalk.red('🔌 Socket.io client disconnected'));
    });
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
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                /* CSS ปรับปรุงสำหรับ UI ที่สวยงามและตอบสนองได้ดี */
                :root {
                    --primary-color: #0d6efd;
                    --secondary-color: #6c757d;
                    --accent-color: #198754;
                    --background-color: #121212;
                    --card-bg: rgba(255, 255, 255, 0.1);
                    --card-border: rgba(255, 255, 255, 0.2);
                    --text-color: #ffffff;
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

                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        radial-gradient(circle at 20% 20%, rgba(13, 110, 253, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 80% 80%, rgba(25, 135, 84, 0.15) 0%, transparent 40%);
                    pointer-events: none;
                    z-index: -1;
                }

                .navbar {
                    background: rgba(0, 0, 0, 0.8);
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    border-bottom: 2px solid var(--primary-color);
                }

                .navbar-brand {
                    font-family: 'Kanit', sans-serif;
                    font-weight: 600;
                    color: var(--text-color) !important;
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
                    background-color: rgba(13, 110, 253, 0.05);
                }

                .footer {
                    background: rgba(0, 0, 0, 0.8);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: var(--text-color);
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
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
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
                                </tr>
                            </thead>
                            <tbody id="commandTableBody">
                                ${commandsData}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

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

// POST /start เพื่อเริ่มต้นบอท
app.post('/start', async (req, res) => {
    const tokenInput = req.body.token.trim();

    if (botSessions[tokenInput]) {
        return res.redirect('/start?error=already-running');
    }

    botCount++;
    const botName = `Bot ${botCount}`;
    const startTime = Date.now();

    try {
        const appState = JSON.parse(tokenInput);
        await startBot(appState, tokenInput, botName, startTime);
        res.redirect('/bots');
        io.emit('updateBots', generateBotData());
        io.emit('updateCommands', generateCommandData());
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        botCount--;
        res.redirect('/start?error=invalid-token');
    }
});

// ฟังก์ชันเริ่มต้นบอท
async function startBot(appState, token, name, startTime) {
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
                status: 'online'
            };
            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));

            api.setOptions({ listenEvents: true });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots', generateBotData());
                    scheduleBotRemoval(token); // เริ่มการลบบอทหลังจากออฟไลน์
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
                    
                    if (!message.startsWith(prefix)) return;

                    const args = message.slice(prefix.length).trim().split(/ +/);
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
                if (botSessions[token].status === 'online' && removalTimers[token]) {
                    clearCountdown(token);
                }
            });

            io.emit('updateBots', generateBotData());
            resolve();
        });
    });
}

// ฟังก์ชันเริ่มต้นการนับถอยหลังและลบบอทจากเซิร์ฟเวอร์หลังจาก 60 วินาที
function scheduleBotRemoval(token) {
    if (removalTimers[token]) return; // ถ้ามีการนับถอยหลังอยู่แล้ว

    removalTimers[token] = setTimeout(() => {
        delete botSessions[token];
        delete removalTimers[token];
        console.log(chalk.yellow(`⚠️ ลบบอทที่ออฟไลน์: ${token}`));
        io.emit('updateBots', generateBotData());
    }, 60000); // 60 วินาที
}

// ฟังก์ชันยกเลิกการลบบอท
function clearCountdown(token) {
    // ยกเลิกการนับถอยหลัง
    if (removalTimers[token]) {
        clearTimeout(removalTimers[token]);
        delete removalTimers[token];
        // ส่งการอัปเดตไปยัง frontend
        io.emit('updateBots', generateBotData());
        console.log(chalk.yellow(`⚠️ ยกเลิกการลบบอท ${botSessions[token].name}`));
    }
}

// Socket.io สำหรับหน้าแดชบอร์ดหลักและดูบอทรัน
io.on('connection', (socket) => {
    console.log(chalk.blue('🔌 Socket.io client connected'));
    socket.emit('updateBots', generateBotData());
    socket.emit('updateCommands', generateCommandData());

    socket.on('disconnect', () => {
        console.log(chalk.red('🔌 Socket.io client disconnected'));
    });
});

// เริ่มต้นเซิร์ฟเวอร์
server.listen(PORT, () => {
    console.log(chalk.blue(`🌐 เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${PORT}`));
    console.log(chalk.green(figlet.textSync("Bot Management", { horizontalLayout: "full" })));
});
