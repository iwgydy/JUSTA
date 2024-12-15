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
const removalTimers = {};
const prefix = "/";
const commands = {};
const commandDescriptions = [];
const commandUsage = {};

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
                commandUsage[command.config.name.toLowerCase()] = 0;
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

    const offlineBots = Object.entries(botSessions)
        .filter(([token, bot]) => bot.status === 'offline')
        .map(([token, bot]) => token);

    return { totalBots, onlineBots, activeBots, botRows, commandDescriptions, offlineBots };
}

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

app.get("/", (req, res) => {
    const totalBots = Object.keys(botSessions).length;
    const onlineBots = Object.values(botSessions).filter(bot => bot.status === 'online').length;
    const activeBots = Object.values(botSessions).filter(bot => bot.status === 'active').length;

    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>แดชบอร์ดหลัก | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Audiowide&display=swap" rel="stylesheet">
            <style>
                :root {
                    --primary-color: #00ffe7;
                    --secondary-color: #6c757d;
                    --accent-color: #00ff8c;
                    --background-color: #0a0a0a;
                    --card-bg: rgba(255, 255, 255, 0.05);
                    --card-border: rgba(255, 255, 255, 0.1);
                    --text-color: #ffffff;
                    --success-color: #00ff5e;
                    --error-color: #ff0040;
                    --info-color: #00b7ff;
                }

                body {
                    background: var(--background-color);
                    color: var(--text-color);
                    font-family: 'Audiowide', sans-serif;
                    min-height: 100vh;
                    position: relative;
                    overflow-x: hidden;
                }

                /* พื้นหลังตารางนีออนเคลื่อนไหว */
                body::before {
                    content: "";
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: radial-gradient(circle, #00181e, #000000);
                    z-index: -3;
                }

                body::after {
                    content: "";
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: 
                        repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(0,255,230,0.05) 51px, rgba(0,255,230,0.05) 100px),
                        repeating-linear-gradient(-90deg, transparent, transparent 50px, rgba(0,255,230,0.05) 51px, rgba(0,255,230,0.05) 100px);
                    z-index: -2;
                    animation: moveGrid 10s linear infinite;
                }

                @keyframes moveGrid {
                    0% { background-position: 0 0, 0 0; }
                    100% { background-position: 100px 100px, 100px 100px; }
                }

                /* เพิ่ม glow ให้ navbar */
                .navbar {
                    background: rgba(0, 0, 0, 0.3);
                    box-shadow: 0 0 20px rgba(0,255,230,0.3);
                    border-bottom: 2px solid var(--primary-color);
                    backdrop-filter: blur(20px);
                }

                .navbar-brand {
                    font-weight: 700;
                    color: var(--text-color) !important;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    text-shadow: 0 0 10px var(--primary-color);
                }

                .navbar-nav .nav-link {
                    color: #fff !important;
                    font-weight: 500;
                    transition: color 0.3s;
                    text-shadow: 0 0 5px var(--primary-color);
                }

                .navbar-nav .nav-link:hover {
                    color: var(--accent-color) !important;
                    text-shadow: 0 0 10px var(--accent-color);
                }

                .stats-card {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: 12px;
                    padding: 20px;
                    text-align: center;
                    box-shadow: 0 0 20px rgba(0,255,230,0.2);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    backdrop-filter: blur(20px);
                    position: relative;
                }

                .stats-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 0 40px rgba(0,255,230,0.5);
                }

                .stats-card i {
                    text-shadow: 0 0 10px var(--primary-color);
                }

                .stats-number {
                    font-size: 2.5rem;
                    font-weight: 700;
                    margin: 10px 0;
                    color: var(--primary-color);
                    text-shadow: 0 0 15px var(--primary-color);
                }

                .stats-label {
                    font-size: 1rem;
                    color: var(--text-color);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .glass-card {
                    background: var(--card-bg);
                    border: 1px solid var(--card-border);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 0 20px rgba(0,255,230,0.2);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    backdrop-filter: blur(20px);
                    position: relative;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 0 40px rgba(0,255,230,0.5);
                }

                .glass-card h5 {
                    font-weight: 700;
                    text-shadow: 0 0 10px var(--primary-color);
                    margin-bottom: 1.5rem;
                    letter-spacing: 1px;
                    text-transform: uppercase;
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
                    vertical-align: middle;
                    color: var(--text-color);
                }

                .bot-table th, .command-table th {
                    background-color: var(--primary-color);
                    color: #000;
                    font-weight: 700;
                    text-transform: uppercase;
                    border: none;
                    text-shadow: 0 0 5px #000;
                }

                .bot-table tr:nth-child(even),
                .command-table tr:nth-child(even) {
                    background-color: rgba(255,255,255,0.05);
                }

                .status-online {
                    background: var(--success-color);
                    color: #000;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    text-shadow: 0 0 5px var(--success-color);
                }

                .status-offline {
                    background: var(--error-color);
                    color: #000;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    text-shadow: 0 0 5px var(--error-color);
                }

                .footer {
                    background: rgba(0,0,0,0.3);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: var(--text-color);
                    text-align: center;
                    backdrop-filter: blur(20px);
                    text-shadow: 0 0 5px var(--primary-color);
                }

                .footer p {
                    margin-bottom: 0;
                    letter-spacing: 1px;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%,100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                .runtime {
                    font-weight: 500;
                    color: var(--accent-color);
                    text-shadow: 0 0 5px var(--accent-color);
                }

                .countdown {
                    font-weight: 500;
                    color: var(--error-color);
                    animation: blink 1s step-start infinite;
                    text-shadow: 0 0 5px var(--error-color);
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
                    .bot-table th, .bot-table td,
                    .command-table th, .command-table td {
                        padding: 8px 10px;
                    }
                    .stats-number {
                        font-size: 2rem;
                    }
                }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
                        Bot Management
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
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
                <div class="row mb-4">
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-robot fa-2x mb-3" style="color: var(--primary-color);"></i>
                            <div class="stats-number" id="totalBots">${totalBots}</div>
                            <div class="stats-label">บอททั้งหมด</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-signal fa-2x mb-3" style="color: var(--accent-color);"></i>
                            <div class="stats-number" id="onlineBots">${onlineBots}</div>
                            <div class="stats-label">บอทออนไลน์</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-clock fa-2x mb-3" style="color: var(--info-color);"></i>
                            <div class="stats-number" id="activeBots">${activeBots}</div>
                            <div class="stats-label">บอททำงานแล้ว</div>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-12">
                        <div class="glass-card">
                            <h5>
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
                    <p>© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const removalTimers = {};

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

                function startCountdown(token) {
                    const countdownElement = document.getElementById(\`countdown-\${token}\`);
                    if (!countdownElement) return;

                    let secondsLeft = 60;
                    const secondsSpan = countdownElement.querySelector('.countdown-seconds');
                    const interval = setInterval(() => {
                        secondsLeft--;
                        secondsSpan.textContent = secondsLeft;
                        if (secondsLeft <= 0) {
                            clearInterval(interval);
                            const row = countdownElement.closest('tr');
                            if (row) row.remove();
                            delete removalTimers[token];
                        }
                    }, 1000);

                    removalTimers[token] = interval;
                }

                socket.on('updateBots', (data) => {
                    const totalBots = document.getElementById('totalBots');
                    const onlineBots = document.getElementById('onlineBots');
                    const activeBots = document.getElementById('activeBots');
                    if(totalBots) totalBots.textContent = data.totalBots;
                    if(onlineBots) onlineBots.textContent = data.onlineBots;
                    if(activeBots) activeBots.textContent = data.activeBots;

                    const botTableBody = document.getElementById('botTableBody');
                    if (botTableBody) {
                        botTableBody.innerHTML = data.botRows;
                    }
                    updateRuntime();
                    data.offlineBots.forEach(token => {
                        if (!removalTimers[token]) {
                            startCountdown(token);
                        }
                    });
                });

                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);
            </script>
        </body>
        </html>
    `);
});

app.get("/start", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>เพิ่มบอท | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Audiowide&display=swap" rel="stylesheet">
            <style>
                /* ใช้สไตล์เดียวกับหน้าแรก */
                body {
                    background: #000;
                    color: #fff;
                    font-family: 'Audiowide', sans-serif;
                    overflow-x: hidden;
                    min-height: 100vh;
                    position: relative;
                }

                /* เพิ่มพื้นหลังนีออน */
                body::before {
                    content: "";
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: radial-gradient(circle, #00181e, #000000);
                    z-index: -3;
                }

                body::after {
                    content: "";
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: 
                        repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(0,255,230,0.05) 51px, rgba(0,255,230,0.05) 100px),
                        repeating-linear-gradient(-90deg, transparent, transparent 50px, rgba(0,255,230,0.05) 51px, rgba(0,255,230,0.05) 100px);
                    z-index: -2;
                    animation: moveGrid 10s linear infinite;
                }

                @keyframes moveGrid {
                    0% { background-position: 0 0, 0 0; }
                    100% { background-position: 100px 100px, 100px 100px; }
                }

                :root {
                    --primary-color: #00ffe7;
                    --accent-color: #00ff8c;
                }

                .navbar {
                    background: rgba(0, 0, 0, 0.3);
                    border-bottom: 2px solid var(--primary-color);
                    backdrop-filter: blur(20px);
                    box-shadow: 0 0 20px rgba(0,255,230,0.3);
                }

                .navbar-brand {
                    font-weight: 700;
                    color: #fff !important;
                    letter-spacing: 1px;
                    text-shadow: 0 0 10px var(--primary-color);
                    text-transform: uppercase;
                }

                .navbar-nav .nav-link {
                    color: #fff !important;
                    text-shadow: 0 0 5px var(--primary-color);
                }

                .navbar-nav .nav-link:hover {
                    color: var(--accent-color) !important;
                    text-shadow: 0 0 10px var(--accent-color);
                }

                .glass-card {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 0 20px rgba(0,255,230,0.2);
                    backdrop-filter: blur(20px);
                    transition: transform 0.3s, box-shadow 0.3s;
                    margin-top: 50px;
                }

                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 0 40px rgba(0,255,230,0.5);
                }

                .glass-card h5 {
                    font-weight: 700;
                    text-shadow: 0 0 10px var(--primary-color);
                    margin-bottom: 1.5rem;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }

                .form-control {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 8px;
                    padding: 10px 12px;
                    font-size: 1rem;
                    transition: border-color 0.3s ease, background 0.3s ease;
                    color: #fff;
                }

                .form-control:focus {
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 0.2rem rgba(0,255,230,0.25);
                    background: rgba(255,255,255,0.2);
                    color: #fff;
                }

                .btn-primary {
                    background: var(--primary-color);
                    border: none;
                    padding: 10px 20px;
                    font-size: 1rem;
                    border-radius: 8px;
                    transition: background 0.3s ease, transform 0.2s ease;
                    color: #000;
                    font-weight: 700;
                    text-shadow: 0 0 5px #000;
                }

                .btn-primary:hover {
                    background: var(--accent-color);
                    transform: translateY(-2px);
                    text-shadow: 0 0 10px var(--accent-color);
                }

                .footer {
                    background: rgba(0,0,0,0.3);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: #fff;
                    text-align: center;
                    backdrop-filter: blur(20px);
                    text-shadow: 0 0 5px var(--primary-color);
                }

                .footer p {
                    margin-bottom: 0;
                    letter-spacing: 1px;
                }

                .animate-float {
                    animation: float 3s ease-in-out infinite;
                }
                @keyframes float {
                    0%,100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
                        Bot Management
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
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
                    <h5>
                        <i class="fas fa-plus-circle me-2" style="color: var(--primary-color);"></i>
                        เพิ่มบอทใหม่
                    </h5>
                    <form class="add-bot-form" method="POST" action="/start">
                        <div class="mb-3">
                            <label for="token" class="form-label">โทเค็นของคุณ (AppState)</label>
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
                    <p>© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `);
});

app.get("/bots", (req, res) => {
    const { totalBots, onlineBots, activeBots, botRows, offlineBots } = generateBotData();
    // ใช้โค้ด HTML เดิมจากหน้าแรก แต่เปลี่ยนเนื้อหาตารางบอท
    // เนื่องจากเรามีสไตล์ทั้งหมดในหน้าแรกแล้ว สามารถใช้สไตล์เดิมได้ เพื่อความสอดคล้อง
    res.redirect("/"); // เปลี่ยนเป็นกลับไปหน้าแรกเพื่อดูบอทรันด้วยกัน (หรือจะคงหน้าเดิมก็ได้ แต่เพื่อความง่ายให้รีไดเรค)
});

app.get("/commands", (req, res) => {
    const commandsData = generateCommandData();
    // ใช้สไตล์เดียวกัน แล้วแสดงตาราง commands
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>คำสั่งที่ใช้ | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Audiowide&display=swap" rel="stylesheet">
            <style>
                /* ใช้สไตล์เดียวกันกับหน้าแรก เพื่อความสวยงาม */
                /* (คัดลอกสไตล์เดียวกับหน้าแรก) */
                ${/* เนื่องจากยาวมาก ขอไม่คัดลอกทั้งหมดซ้ำ */''}
                /* สามารถคัดลอกสไตล์จากหน้าแรกทั้งหมดมาวางซ้ำที่นี่เพื่อให้ UI เหมือนกัน */
                /* สำหรับสั้นลง จะขอใช้หน้าเดียวกันหมด หรืออาจ redirect ไปหน้าแรกพร้อมโหมดแสดง commands */
                body {
                    background: #000;
                    color: #fff;
                    font-family: 'Audiowide', sans-serif;
                    overflow-x: hidden;
                    min-height: 100vh;
                    position: relative;
                }
                body::before, body::after {
                    /* ใส่เอฟเฟกต์เดียวกับหน้าแรก */
                    content: "";
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: radial-gradient(circle, #00181e, #000000);
                    z-index: -3;
                }
                body::after {
                    background: 
                        repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(0,255,230,0.05) 51px, rgba(0,255,230,0.05) 100px),
                        repeating-linear-gradient(-90deg, transparent, transparent 50px, rgba(0,255,230,0.05) 51px, rgba(0,255,230,0.05) 100px);
                    z-index: -2;
                    animation: moveGrid 10s linear infinite;
                }
                @keyframes moveGrid {
                    0% { background-position: 0 0, 0 0; }
                    100% { background-position: 100px 100px, 100px 100px; }
                }
                :root {
                    --primary-color: #00ffe7;
                    --accent-color: #00ff8c;
                }
                .navbar {
                    background: rgba(0, 0, 0, 0.3);
                    border-bottom: 2px solid var(--primary-color);
                    backdrop-filter: blur(20px);
                    box-shadow: 0 0 20px rgba(0,255,230,0.3);
                }
                .navbar-brand {
                    font-weight: 700;
                    color: #fff !important;
                    letter-spacing: 1px;
                    text-shadow: 0 0 10px var(--primary-color);
                    text-transform: uppercase;
                }
                .navbar-nav .nav-link {
                    color: #fff !important;
                    text-shadow: 0 0 5px var(--primary-color);
                }
                .navbar-nav .nav-link:hover {
                    color: var(--accent-color) !important;
                    text-shadow: 0 0 10px var(--accent-color);
                }
                .glass-card {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 0 20px rgba(0,255,230,0.2);
                    backdrop-filter: blur(20px);
                    transition: transform 0.3s, box-shadow 0.3s;
                    margin-top: 50px;
                }
                .glass-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 0 40px rgba(0,255,230,0.5);
                }
                .glass-card h5 {
                    font-weight: 700;
                    text-shadow: 0 0 10px var(--primary-color);
                    margin-bottom: 1.5rem;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }
                .command-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                .command-table th, .command-table td {
                    padding: 12px 15px;
                    text-align: left;
                    vertical-align: middle;
                    color: #fff;
                }
                .command-table th {
                    background-color: var(--primary-color);
                    color: #000;
                    font-weight: 700;
                    text-transform: uppercase;
                    border: none;
                }
                .command-table tr:nth-child(even) {
                    background-color: rgba(255,255,255,0.05);
                }
                .footer {
                    background: rgba(0,0,0,0.3);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: #fff;
                    text-align: center;
                    backdrop-filter: blur(20px);
                    text-shadow: 0 0 5px var(--primary-color);
                }
                .footer p {
                    margin-bottom: 0;
                    letter-spacing: 1px;
                }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2" style="color: var(--primary-color);"></i>
                        Bot Management
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
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
                <div class="glass-card">
                    <h5>
                        <i class="fas fa-terminal me-2" style="color: var(--accent-color);"></i>
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
                    <p>© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
                </div>
            </footer>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `);
});

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
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        botCount--;
        res.redirect('/start?error=invalid-token');
    }
});

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

            api.setOptions({ listenEvents: true, selfListen: false });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots', generateBotData());
                    scheduleBotRemoval(token);
                    return;
                }

                if (event.type === "message") {
                    const message = event.body ? event.body.trim() : "";
                    if (message.startsWith(prefix)) {
                        const args = message.slice(prefix.length).trim().split(/ +/);
                        const commandName = args.shift().toLowerCase();
                        const command = commands[commandName];

                        if (command && typeof command.run === "function") {
                            try {
                                await command.run({ api, event, args });
                                console.log(chalk.green(`✅ รันคำสั่ง: ${commandName}`));
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
                } else if (event.logMessageType && events[event.logMessageType]) {
                    for (const eventHandler of events[event.logMessageType]) {
                        try {
                            await eventHandler.run({ api, event });
                            console.log(chalk.blue(`🔄 ประมวลผลอีเวนต์: ${eventHandler.config.name}`));
                        } catch (error) {
                            console.error(chalk.red(`❌ เกิดข้อผิดพลาดในอีเวนต์ ${eventHandler.config.name}:`, error));
                        }
                    }
                }

                if (botSessions[token].status === 'online' && removalTimers[token]) {
                    clearCountdown(token);
                }
            });

            io.emit('updateBots', generateBotData());
            resolve();
        });
    });
}

function scheduleBotRemoval(token) {
    if (removalTimers[token]) return;
    removalTimers[token] = setTimeout(() => {
        delete botSessions[token];
        delete removalTimers[token];
        console.log(chalk.yellow(`⚠️ ลบบอทที่ออฟไลน์: ${token}`));
        io.emit('updateBots', generateBotData());
    }, 60000);
}

function clearCountdown(token) {
    if (removalTimers[token]) {
        clearTimeout(removalTimers[token]);
        delete removalTimers[token];
        io.emit('updateBots', generateBotData());
        console.log(chalk.yellow(`⚠️ ยกเลิกการลบบอท ${botSessions[token].name}`));
    }
}

io.on('connection', (socket) => {
    console.log(chalk.blue('🔌 Socket.io client connected'));
    socket.emit('updateBots', generateBotData());
    socket.emit('updateCommands', generateCommandData());

    socket.on('disconnect', () => {
        console.log(chalk.red('🔌 Socket.io client disconnected'));
    });
});

server.listen(PORT, () => {
    console.log(chalk.blue(`🌐 เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${PORT}`));
    console.log(chalk.green(figlet.textSync("Bot Management", { horizontalLayout: "full" })));
});
