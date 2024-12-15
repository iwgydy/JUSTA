const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const login = require('ryuu-fca-api');
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

// ตั้งค่าเส้นทางสำหรับไฟล์ฐานข้อมูลผู้ใช้และบอท
const USERS_FILE = path.join(__dirname, 'users.json');
const BOTDATA_FILE = path.join(__dirname, 'botData.json');

// โหลดข้อมูลผู้ใช้
function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(USERS_FILE));
}

// บันทึกข้อมูลผู้ใช้
function saveUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// โหลดข้อมูลบอท
function loadBotData() {
    if (!fs.existsSync(BOTDATA_FILE)) {
        fs.writeFileSync(BOTDATA_FILE, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(BOTDATA_FILE));
}

// บันทึกข้อมูลบอท
function saveBotData(data) {
    fs.writeFileSync(BOTDATA_FILE, JSON.stringify(data, null, 2));
}

const usersData = loadUsers();
let botData = loadBotData();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = 3005;

const prefix = "/";
const commands = {};
const commandDescriptions = [];
const commandUsage = {};

// โหลดคำสั่งจากโฟลเดอร์ commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    fs.readdirSync(commandsPath).forEach((file) => {
        if (file.endsWith(".js")) {
            const command = require(path.join(commandsPath, file));
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
            const event = require(path.join(eventsPath, file));
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

app.use(session({
    secret: 'yoursecretkey', // ควรเปลี่ยนเป็น key ของคุณเอง
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // ถ้าจะใช้ HTTPS ให้ตั้ง secure: true
}));

// Middleware ตรวจสอบการล็อกอิน
function checkAuth(req, res, next) {
    if (!req.session || !req.session.username) {
        return res.redirect('/login');
    }
    next();
}

// ฟังก์ชันช่วยเหลือในการสร้างข้อมูลบอทสำหรับผู้ใช้
function generateBotDataForUser(username) {
    const userBots = botData[username] || {};
    const botSessions = userBots.bots || {};

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
                ${bot.status === 'offline' ? `<span class="countdown" id="countdown-${token}"> (หยุดทำงานแล้ว)</span>` : ''}
            </td>
            <td>
                <span class="runtime" data-start-time="${bot.startTime || ''}">
                    ${bot.startTime ? 'กำลังคำนวณ...' : 'ยังไม่เริ่ม'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="location.href='/edit-bot?token=${encodeURIComponent(token)}'">แก้ไขโทเค่น</button>
                <button class="btn btn-sm btn-danger" onclick="location.href='/delete-bot?token=${encodeURIComponent(token)}'">ลบโทเค่น</button>
                ${bot.status === 'online' 
                    ? `<button class="btn btn-sm btn-secondary" onclick="location.href='/stop-bot?token=${encodeURIComponent(token)}'">หยุดทำงาน</button>`
                    : `<button class="btn btn-sm btn-success" onclick="location.href='/restart-bot?token=${encodeURIComponent(token)}'">เริ่มใหม่</button>`
                }
            </td>
        </tr>
    `).join('') || `
        <tr>
            <td colspan="4" class="text-center">ไม่มีบอทที่กำลังทำงาน</td>
        </tr>
    `;

    return { totalBots, onlineBots, activeBots, botRows };
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

// หน้า Sign Up
app.get('/signup', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>สมัครสมาชิก | ระบบจัดการบอท</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body {
                background: #0f0f0f;
                color: #fff;
                font-family: sans-serif;
                background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .card {
                background: rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
                border: none;
                border-radius: 16px;
                padding: 20px;
            }
            .form-control {
                background: rgba(255,255,255,0.2);
                border: none;
                color: #fff;
            }
            .form-control:focus {
                box-shadow: 0 0 0 0.2rem rgba(13,110,253,0.25);
                border: none;
            }
            .btn-primary {
                background: #0d6efd;
                border: none;
            }
        </style>
    </head>
    <body>
        <div class="card text-white" style="max-width: 400px; width:100%;">
            <div class="card-body">
                <h3 class="mb-4 text-center">สมัครสมาชิก</h3>
                <form method="POST" action="/signup">
                    <div class="mb-3">
                        <label class="form-label">ชื่อผู้ใช้</label>
                        <input type="text" name="username" class="form-control" required/>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">รหัสผ่าน</label>
                        <input type="password" name="password" class="form-control" required/>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">สมัครสมาชิก</button>
                </form>
                <hr>
                <p class="text-center">มีบัญชีแล้ว? <a href="/login" style="color:#0d6efd;">เข้าสู่ระบบ</a></p>
            </div>
        </div>
    </body>
    </html>
    `);
});

app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const userExists = usersData.users.find(u => u.username === username);
    if (userExists) {
        return res.redirect('/signup?error=userexists');
    }

    const hash = await bcrypt.hash(password, 10);
    usersData.users.push({ username, passwordHash: hash });
    saveUsers(usersData);

    // สร้างข้อมูลบอทให้ผู้ใช้งานใหม่
    botData[username] = { bots: {} };
    saveBotData(botData);

    res.redirect('/login?success=signedup');
});

// หน้า Login
app.get('/login', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>เข้าสู่ระบบ | ระบบจัดการบอท</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body {
                background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
                color: #fff;
                font-family: sans-serif;
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .card {
                background: rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
                border: none;
                border-radius: 16px;
                padding: 20px;
            }
            .form-control {
                background: rgba(255,255,255,0.2);
                border: none;
                color: #fff;
            }
            .form-control:focus {
                box-shadow: 0 0 0 0.2rem rgba(13,110,253,0.25);
                border: none;
            }
            .btn-primary {
                background: #0d6efd;
                border: none;
            }
        </style>
    </head>
    <body>
        <div class="card text-white" style="max-width: 400px; width:100%;">
            <div class="card-body">
                <h3 class="mb-4 text-center">เข้าสู่ระบบ</h3>
                <form method="POST" action="/login">
                    <div class="mb-3">
                        <label class="form-label">ชื่อผู้ใช้</label>
                        <input type="text" name="username" class="form-control" required/>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">รหัสผ่าน</label>
                        <input type="password" name="password" class="form-control" required/>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">เข้าสู่ระบบ</button>
                </form>
                <hr>
                <p class="text-center">ยังไม่มีบัญชี? <a href="/signup" style="color:#0d6efd;">สมัครสมาชิก</a></p>
            </div>
        </div>
    </body>
    </html>
    `);
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = usersData.users.find(u => u.username === username);
    if (!user) {
        return res.redirect('/login?error=nouser');
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
        return res.redirect('/login?error=wrongpass');
    }

    req.session.username = username;
    res.redirect('/');
});

// ออกจากระบบ
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// หน้าแดชบอร์ดหลัก
app.get("/", checkAuth, (req, res) => {
    const username = req.session.username;
    const { totalBots, onlineBots, activeBots, botRows } = generateBotDataForUser(username);

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
                /* สไตล์เหมือนเดิม ปรับเพิ่มเพื่อความสวยงาม */
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
                    background: linear-gradient(to bottom right, #000000, #0f0f0f, #171717);
                }

                .navbar {
                    background: rgba(0, 0, 0, 0.8);
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

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                th, td {
                    padding: 12px 15px;
                    text-align: left;
                }

                th {
                    background-color: var(--primary-color);
                    color: #fff;
                    font-weight: 600;
                }

                tr:nth-child(even) {
                    background-color: rgba(13, 110, 253, 0.05);
                }

                .status-online {
                    background: var(--success-color);
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                }

                .status-offline {
                    background: var(--error-color);
                    color: #ffffff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                }

                .footer {
                    background: rgba(0, 0, 0, 0.8);
                    border-top: 2px solid var(--primary-color);
                    padding: 20px 0;
                    margin-top: 40px;
                    font-size: 0.9rem;
                    color: var(--text-color);
                    position: relative;
                }

                .runtime {
                    color: var(--info-color);
                }

                .btn {
                    border-radius: 8px;
                    margin-right: 5px;
                    margin-bottom: 5px;
                }

                @media (max-width: 768px) {
                    .stats-card {
                        margin-bottom: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2" style="color: var(--primary-color);"></i>
                        ระบบจัดการบอท
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item"><a class="nav-link" href="/start"><i class="fas fa-plus-circle me-1"></i> เพิ่มบอท</a></li>
                            <li class="nav-item"><a class="nav-link" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a></li>
                            <li class="nav-item"><a class="nav-link" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a></li>
                            <li class="nav-item"><a class="nav-link" href="/logout"><i class="fas fa-sign-out-alt me-1"></i> ออกจากระบบ</a></li>
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
                            <div class="stats-label">บอททั้งหมดของคุณ</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-signal fa-2x mb-3" style="color: var(--info-color);"></i>
                            <div class="stats-number" id="onlineBots">${onlineBots}</div>
                            <div class="stats-label">บอทออนไลน์</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-clock fa-2x mb-3" style="color: var(--secondary-color);"></i>
                            <div class="stats-number" id="activeBots">${activeBots}</div>
                            <div class="stats-label">บอททำงานแล้ว</div>
                        </div>
                    </div>
                </div>
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-robot me-2" style="color: var(--primary-color);"></i>
                        บอทของคุณ
                    </h5>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>ชื่อบอท</th>
                                    <th>สถานะ</th>
                                    <th>เวลารัน</th>
                                    <th>การจัดการ</th>
                                </tr>
                            </thead>
                            <tbody id="botTableBody">
                                ${botRows}
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
                const socket = io();
                function updateRuntime() {
                    const runtimeElements = document.querySelectorAll('.runtime');
                    const now = Date.now();
                    runtimeElements.forEach(el => {
                        const startTime = parseInt(el.getAttribute('data-start-time'));
                        if (!startTime) {
                            el.textContent = "ยังไม่เริ่ม";
                            return;
                        }
                        const elapsed = now - startTime;
                        const seconds = Math.floor((elapsed / 1000) % 60);
                        const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
                        const hours = Math.floor((elapsed / (1000 * 60 * 60)) % 24);
                        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
                        el.textContent = \`\${days} วัน \${hours} ชั่วโมง \${minutes} นาที \${seconds} วินาที\`;
                    });
                }
                setInterval(updateRuntime, 1000);
                document.addEventListener('DOMContentLoaded', updateRuntime);
            </script>
        </body>
        </html>
    `);
});

// หน้าเพิ่มบอท
app.get("/start", checkAuth, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>เพิ่มบอท | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body {
                    background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
                    min-height: 100vh;
                    color: #fff;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .card {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    border-radius: 16px;
                    padding: 20px;
                    width: 400px;
                    max-width: 90%;
                    backdrop-filter: blur(10px);
                }
                .form-control {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: #fff;
                }
                .btn-primary {
                    background: #0d6efd;
                    border: none;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <h5 class="mb-4 text-center">
                    <i class="fas fa-plus-circle me-2" style="color:#0d6efd;"></i>
                    เพิ่มบอทใหม่
                </h5>
                <form method="POST" action="/start">
                    <div class="mb-3">
                        <label class="form-label">โทเค็นของคุณ</label>
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
                        <i class="fas fa-play me-2"></i> เริ่มบอท
                    </button>
                </form>
                <hr>
                <div class="text-center">
                    <a href="/" class="text-decoration-none" style="color:#0d6efd;">กลับสู่หน้าหลัก</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.post('/start', checkAuth, async (req, res) => {
    const username = req.session.username;
    const tokenInput = req.body.token.trim();

    if (!botData[username]) {
        botData[username] = { bots: {} };
    }

    if (botData[username].bots[tokenInput]) {
        // ถ้ามีบอทนี้อยู่แล้ว (token นี้) แสดงว่าเคยรันมาก่อน
        return res.redirect('/start?error=already-running');
    }

    const botCount = Object.keys(botData[username].bots).length + 1;
    const botName = `Bot ${botCount}`;
    const startTime = Date.now();

    try {
        const appState = JSON.parse(tokenInput);
        await startBot(username, appState, tokenInput, botName, startTime);
        res.redirect('/bots');
        io.emit('updateBots', {}); // อัปเดตข้อมูลถ้าต้องการ
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        res.redirect('/start?error=invalid-token');
    }
});

// หน้าแสดงบอทรัน
app.get("/bots", checkAuth, (req, res) => {
    const username = req.session.username;
    const { totalBots, onlineBots, activeBots, botRows } = generateBotDataForUser(username);

    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ดูบอทรัน | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                body {
                    background: linear-gradient(to bottom right, #000000, #0f0f0f, #171717);
                    color: #fff;
                    font-family: sans-serif;
                    min-height: 100vh;
                }
                .navbar {
                    background: rgba(0,0,0,0.8);
                    border-bottom: 2px solid #0d6efd;
                }
                .navbar-brand {
                    font-weight: 600;
                }
                .glass-card {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.1);
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    padding: 12px 15px;
                    text-align: left;
                }
                th {
                    background-color: #0d6efd;
                    color: #fff;
                    font-weight: 600;
                }
                tr:nth-child(even) {
                    background-color: rgba(13,110,253,0.05);
                }
                .status-online {
                    background: #198754;
                    color: #fff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                }
                .status-offline {
                    background: #dc3545;
                    color: #fff;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                }
                .btn {
                    border-radius: 8px;
                    margin-right: 5px;
                    margin-bottom: 5px;
                }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand d-flex align-items-center" href="/">
                        <i class="fas fa-robot fa-lg me-2" style="color:#0d6efd;"></i>
                        ระบบจัดการบอท
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item"><a class="nav-link" href="/start"><i class="fas fa-plus-circle me-1"></i> เพิ่มบอท</a></li>
                            <li class="nav-item"><a class="nav-link active" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a></li>
                            <li class="nav-item"><a class="nav-link" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a></li>
                            <li class="nav-item"><a class="nav-link" href="/logout"><i class="fas fa-sign-out-alt me-1"></i> ออกจากระบบ</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            <div class="container">
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-list me-2" style="color:#0d6efd;"></i>
                        บอทของคุณ
                    </h5>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>ชื่อบอท</th>
                                    <th>สถานะ</th>
                                    <th>เวลารัน</th>
                                    <th>การจัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${botRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `);
});

// แสดงคำสั่งที่ใช้
app.get("/commands", checkAuth, (req, res) => {
    const commandsData = generateCommandData();
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>คำสั่งที่ใช้ | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body {
                    background: linear-gradient(to bottom right, #000000, #0f0f0f, #171717);
                    color: #fff;
                    font-family: sans-serif;
                    min-height: 100vh;
                }
                .navbar {
                    background: rgba(0,0,0,0.8);
                    border-bottom: 2px solid #0d6efd;
                }
                .glass-card {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 16px;
                    padding: 24px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    padding: 12px 15px;
                    text-align: left;
                }
                th {
                    background-color: #0d6efd;
                    color: #fff;
                    font-weight: 600;
                }
                tr:nth-child(even) {
                    background-color: rgba(13,110,253,0.05);
                }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg navbar-dark mb-4">
                <div class="container">
                    <a class="navbar-brand" href="/">
                        <i class="fas fa-robot fa-lg me-2" style="color:#0d6efd;"></i>
                        ระบบจัดการบอท
                    </a>
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item"><a class="nav-link" href="/start"><i class="fas fa-plus-circle me-1"></i> เพิ่มบอท</a></li>
                            <li class="nav-item"><a class="nav-link" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a></li>
                            <li class="nav-item"><a class="nav-link active" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a></li>
                            <li class="nav-item"><a class="nav-link" href="/logout"><i class="fas fa-sign-out-alt me-1"></i> ออกจากระบบ</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            <div class="container">
                <div class="glass-card">
                    <h5 class="mb-4">
                        <i class="fas fa-terminal me-2"></i> คำสั่งที่ใช้
                    </h5>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>ชื่อคำสั่ง</th>
                                    <th>จำนวนที่ใช้</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${commandsData}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `);
});

// หน้าแก้ไขโทเค่น
app.get('/edit-bot', checkAuth, (req, res) => {
    const username = req.session.username;
    const { token } = req.query;
    const userBots = botData[username]?.bots || {};
    if (!userBots[token]) {
        return res.redirect('/bots');
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>แก้ไขโทเค่น | ระบบจัดการบอท</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
            body {
                background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
                min-height: 100vh;
                color: #fff;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .card {
                background: rgba(255,255,255,0.1);
                border: none;
                border-radius: 16px;
                padding: 20px;
                width: 400px;
                max-width: 90%;
                backdrop-filter: blur(10px);
            }
            .form-control {
                background: rgba(255,255,255,0.2);
                border: none;
                color: #fff;
            }
            .btn-primary {
                background: #0d6efd;
                border: none;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <h5 class="mb-4 text-center">แก้ไขโทเค่น</h5>
            <form method="POST" action="/edit-bot">
                <div class="mb-3">
                    <label class="form-label">โทเค่นใหม่</label>
                    <textarea name="newToken" class="form-control" rows="4" required>${token}</textarea>
                </div>
                <input type="hidden" name="oldToken" value="${token}" />
                <button type="submit" class="btn btn-primary w-100">บันทึก</button>
            </form>
            <hr>
            <div class="text-center">
                <a href="/bots" class="text-decoration-none" style="color:#0d6efd;">ยกเลิก</a>
            </div>
        </div>
    </body>
    </html>
    `);
});

app.post('/edit-bot', checkAuth, async (req, res) => {
    const username = req.session.username;
    const { oldToken, newToken } = req.body;
    const userBots = botData[username]?.bots || {};

    if (!userBots[oldToken]) {
        return res.redirect('/bots');
    }

    // ย้ายข้อมูลเดิมมาใช้ token ใหม่
    const botInfo = userBots[oldToken];
    delete userBots[oldToken];
    userBots[newToken] = botInfo;

    // ถ้าบอทออนไลน์อยู่ ต้องหยุดแล้วรันใหม่ด้วย token ใหม่
    if (botInfo.status === 'online') {
        // หยุดบอทเก่า
        if (botInfo.api && botInfo.api.logout) {
            botInfo.api.logout();
        }
        // เริ่มใหม่
        try {
            const appState = JSON.parse(newToken);
            await startBot(username, appState, newToken, botInfo.name, botInfo.startTime || Date.now());
        } catch (err) {
            console.error("Error restarting bot with new token", err);
            // ถ้ารันไม่สำเร็จ ให้บอทหยุดไว้ก่อน
            userBots[newToken].status = 'offline';
        }
    }

    botData[username].bots = userBots;
    saveBotData(botData);
    res.redirect('/bots');
});

// ลบโทเค่นบอท
app.get('/delete-bot', checkAuth, (req, res) => {
    const username = req.session.username;
    const { token } = req.query;
    const userBots = botData[username]?.bots || {};
    if (!userBots[token]) {
        return res.redirect('/bots');
    }
    // หยุดบอทก่อน
    if (userBots[token].api && userBots[token].status === 'online') {
        userBots[token].api.logout();
    }
    delete userBots[token];
    botData[username].bots = userBots;
    saveBotData(botData);
    res.redirect('/bots');
});

// หยุดการทำงานบอท
app.get('/stop-bot', checkAuth, (req, res) => {
    const username = req.session.username;
    const { token } = req.query;
    const userBots = botData[username]?.bots || {};
    if (!userBots[token]) {
        return res.redirect('/bots');
    }
    if (userBots[token].api && userBots[token].status === 'online') {
        userBots[token].api.logout();
        userBots[token].status = 'offline';
        saveBotData(botData);
    }
    res.redirect('/bots');
});

// เริ่มบอทใหม่
app.get('/restart-bot', checkAuth, async (req, res) => {
    const username = req.session.username;
    const { token } = req.query;
    const userBots = botData[username]?.bots || {};
    if (!userBots[token]) {
        return res.redirect('/bots');
    }

    const botInfo = userBots[token];
    try {
        const appState = JSON.parse(token);
        await startBot(username, appState, token, botInfo.name, botInfo.startTime || Date.now());
    } catch (err) {
        console.error("Error restarting bot", err);
    }

    res.redirect('/bots');
});

// ฟังก์ชันเริ่มต้นบอท
async function startBot(username, appState, token, name, startTime) {
    return new Promise((resolve, reject) => {
        login({ appState }, (err, api) => {
            if (err) {
                console.error(chalk.red(`❌ การเข้าสู่ระบบล้มเหลวสำหรับโทเค็น: ${token}`));
                return reject(err);
            }

            if (!botData[username]) botData[username] = { bots: {} };
            const userBots = botData[username].bots || {};

            userBots[token] = {
                api,
                name,
                startTime,
                status: 'online'
            };
            botData[username].bots = userBots;
            saveBotData(botData);

            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));

            api.setOptions({ listenEvents: true });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    userBots[token].status = 'offline';
                    botData[username].bots = userBots;
                    saveBotData(botData);
                    return;
                }

                // Log Event
                // console.log(chalk.blue(`📩 รับอีเวนต์: ${event.type}`));

                // จัดการอีเวนต์
                if (event.logMessageType && events[event.logMessageType]) {
                    for (const eventHandler of events[event.logMessageType]) {
                        try {
                            await eventHandler.run({ api, event });
                            // console.log(chalk.blue(`🔄 ประมวลผลอีเวนต์: ${eventHandler.config.name}`));
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
                            // console.log(chalk.green(`✅ รันคำสั่ง: ${commandName}`));
                            commandUsage[commandName] = (commandUsage[commandName] || 0) + 1;
                        } catch (error) {
                            console.error(chalk.red(`❌ เกิดข้อผิดพลาดในคำสั่ง ${commandName}:`, error));
                            api.sendMessage("❗ การรันคำสั่งล้มเหลว", event.threadID);
                        }
                    } else {
                        api.sendMessage("❗ ไม่พบคำสั่งที่ระบุ", event.threadID);
                    }
                }
            });

            resolve();
        });
    });
}

// Socket.io (สามารถขยายเพื่อตอบสนองแบบเรียลไทม์ได้)
io.on('connection', (socket) => {
    console.log(chalk.blue('🔌 Socket.io client connected'));
    socket.on('disconnect', () => {
        console.log(chalk.red('🔌 Socket.io client disconnected'));
    });
});

server.listen(PORT, () => {
    console.log(chalk.blue(`🌐 เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${PORT}`));
    console.log(chalk.green(figlet.textSync("Bot Management", { horizontalLayout: "full" })));
});
