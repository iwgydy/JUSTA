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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // ปรับให้เหมาะสมกับความปลอดภัยของคุณ
        methods: ["GET", "POST"]
    }
});
const PORT = 3005;

// การตั้งค่า session
app.use(session({
    secret: 'your-secret-key', // เปลี่ยนเป็นคีย์ที่ปลอดภัย
    resave: false,
    saveUninitialized: false,
}));

// Middleware สำหรับ parsing ข้อมูล
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ข้อมูลผู้ใช้และบอท
let users = {};
let bots = {};

// โหลดข้อมูลผู้ใช้จากไฟล์
const usersPath = path.join(__dirname, 'users.json');
if (fs.existsSync(usersPath)) {
    users = JSON.parse(fs.readFileSync(usersPath));
}

// โหลดข้อมูลบอทจากไฟล์
const botsPath = path.join(__dirname, 'bots.json');
if (fs.existsSync(botsPath)) {
    bots = JSON.parse(fs.readFileSync(botsPath));
}

// ฟังก์ชันบันทึกข้อมูลผู้ใช้
function saveUsers() {
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

// ฟังก์ชันบันทึกข้อมูลบอท
function saveBots() {
    fs.writeFileSync(botsPath, JSON.stringify(bots, null, 2));
}

// ฟังก์ชันช่วยเหลือในการสร้างข้อมูลบอทสำหรับการอัปเดตแบบเรียลไทม์
function generateBotData(userId) {
    const userBots = Object.values(bots).filter(bot => bot.userId === userId);
    const totalBots = userBots.length;
    const onlineBots = userBots.filter(bot => bot.status === 'online').length;
    const activeBots = userBots.filter(bot => bot.status === 'active').length;

    const botRows = userBots.map(bot => `
        <tr id="bot-${bot.token}">
            <td>
                <i class="fas fa-robot me-2" style="color: var(--primary-color);"></i>
                ${bot.name}
            </td>
            <td>
                <span class="${bot.status === 'online' ? 'status-online' : 'status-offline'}">
                    <i class="fas fa-circle"></i>
                    ${bot.status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}
                </span>
                ${bot.status === 'offline' ? `<span class="countdown" id="countdown-${bot.token}"> (ลบใน <span class="countdown-seconds">60</span> วินาที)</span>` : ''}
            </td>
            <td>
                <span class="runtime" data-start-time="${bot.startTime}">
                    กำลังคำนวณ...
                </span>
            </td>
            <td>
                <button class="btn btn-danger btn-sm stop-bot" data-token="${bot.token}"><i class="fas fa-stop"></i> หยุด</button>
                <button class="btn btn-warning btn-sm edit-bot" data-token="${bot.token}"><i class="fas fa-edit"></i> แก้ไข</button>
            </td>
        </tr>
    `).join('') || `
        <tr>
            <td colspan="4" class="text-center">ไม่มีบอทที่กำลังทำงาน</td>
        </tr>
    `;

    // รวบรวมบอทที่ออฟไลน์เพื่อให้ frontend จัดการนับถอยหลัง
    const offlineBots = userBots
        .filter(bot => bot.status === 'offline')
        .map(bot => bot.token);

    return { totalBots, onlineBots, activeBots, botRows, offlineBots };
}

// ฟังก์ชันช่วยเหลือในการสร้างข้อมูลคำสั่ง
function generateCommandData() {
    // สมมุติว่า commandUsage ถูกเก็บไว้ในไฟล์ bots.json สำหรับแต่ละบอท
    const commandUsage = {};

    Object.values(bots).forEach(bot => {
        if (bot.commandUsage) {
            for (const [cmd, count] of Object.entries(bot.commandUsage)) {
                if (!commandUsage[cmd]) {
                    commandUsage[cmd] = 0;
                }
                commandUsage[cmd] += count;
            }
        }
    });

    const commandsData = Object.entries(commandUsage).map(([name, count]) => `
        <tr>
            <td>${name}</td>
            <td>${count}</td>
        </tr>
    `).join('') || `
        <tr>
            <td colspan="2" class="text-center">ไม่มีคำสั่งที่ถูกใช้งาน</td>
        </tr>
    `;

    return commandsData;
}

// Middleware สำหรับตรวจสอบการล็อกอิน
function isAuthenticated(req, res, next) {
    if (req.session.userId && users[req.session.userId]) {
        return next();
    }
    res.redirect('/login');
}

// โหลดคำสั่งจากโฟลเดอร์ commands
const commandsPathDir = path.join(__dirname, 'commands');
const commands = {};
if (fs.existsSync(commandsPathDir)) {
    fs.readdirSync(commandsPathDir).forEach((file) => {
        if (file.endsWith(".js")) {
            const command = require(`./commands/${file}`);
            if (command.config && command.config.name) {
                commands[command.config.name.toLowerCase()] = command;
                console.log(`📦 โหลดคำสั่ง: ${command.config.name}`);
            }
        }
    });
}

// โหลดอีเวนต์จากโฟลเดอร์ events
const events = {};
const eventsPathDir = path.join(__dirname, 'events');
if (fs.existsSync(eventsPathDir)) {
    fs.readdirSync(eventsPathDir).forEach((file) => {
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

// หน้า Home (Dashboard) - ต้องล็อกอินก่อน
app.get("/", isAuthenticated, (req, res) => {
    const userId = req.session.userId;
    const botData = generateBotData(userId);

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
            <link rel="stylesheet" href="/css/styles.css">
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
                            <li class="nav-item">
                                <a class="nav-link" href="/logout"><i class="fas fa-sign-out-alt me-1"></i> ออกจากระบบ</a>
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
                            <div class="stats-number" id="totalBots">${botData.totalBots}</div>
                            <div class="stats-label">บอททั้งหมด</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-signal fa-2x mb-3" style="color: var(--info-color);"></i>
                            <div class="stats-number" id="onlineBots">${botData.onlineBots}</div>
                            <div class="stats-label">บอทออนไลน์</div>
                        </div>
                    </div>
                    <div class="col-md-4 col-sm-6 mb-3">
                        <div class="stats-card">
                            <i class="fas fa-clock fa-2x mb-3" style="color: var(--secondary-color);"></i>
                            <div class="stats-number" id="activeBots">${botData.activeBots}</div>
                            <div class="stats-label">บอททำงานแล้ว</div>
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
                                            <th>การจัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody id="botTableBody">
                                        ${botData.botRows}
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
            <script src="/js/scripts.js"></script>
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

                        el.textContent = \`\${days} วัน \${hours} ชั่วโมง \${minutes} นาที \${seconds} วินาที\`;
                    });
                }

                // ฟังก์ชันเริ่มนับถอยหลังการลบบอท
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

                // จัดการการหยุดบอท
                document.addEventListener('click', function(e) {
                    if (e.target.classList.contains('stop-bot')) {
                        const token = e.target.getAttribute('data-token');
                        fetch('/stop-bot', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ token })
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                alert('หยุดบอทสำเร็จ');
                                // อัปเดตข้อมูลบอท
                                socket.emit('requestUpdate');
                            } else {
                                alert('เกิดข้อผิดพลาด: ' + data.message);
                            }
                        });
                    }

                    if (e.target.classList.contains('edit-bot')) {
                        const token = e.target.getAttribute('data-token');
                        const newName = prompt('กรุณาใส่ชื่อบอทใหม่:');
                        if (newName) {
                            fetch('/edit-bot', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, newName })
                            })
                            .then(res => res.json())
                            .then(data => {
                                if (data.success) {
                                    alert('แก้ไขบอทสำเร็จ');
                                    // อัปเดตข้อมูลบอท
                                    socket.emit('requestUpdate');
                                } else {
                                    alert('เกิดข้อผิดพลาด: ' + data.message);
                                }
                            });
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// หน้าเพิ่มบอท - ต้องล็อกอินก่อน
app.get("/start", isAuthenticated, (req, res) => {
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
            <link rel="stylesheet" href="/css/styles.css">
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
                            <li class="nav-item">
                                <a class="nav-link" href="/logout"><i class="fas fa-sign-out-alt me-1"></i> ออกจากระบบ</a>
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

// POST /start เพื่อเริ่มต้นบอท - ต้องล็อกอินก่อน
app.post('/start', isAuthenticated, async (req, res) => {
    const tokenInput = req.body.token.trim();
    const userId = req.session.userId;

    // ตรวจสอบว่าผู้ใช้มีบอทนี้อยู่แล้วหรือไม่
    if (bots[tokenInput]) {
        return res.redirect('/start?error=already-running');
    }

    const botCount = Object.keys(bots).length + 1;
    const botName = `Bot ${botCount}`;
    const startTime = Date.now();

    try {
        const appState = JSON.parse(tokenInput);
        await startBot(appState, tokenInput, botName, startTime, userId);
        res.redirect('/bots');
        io.emit('updateBots', generateBotData(userId));
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        res.redirect('/start?error=invalid-token');
    }
});

// ฟังก์ชันเริ่มต้นบอท
async function startBot(appState, token, name, startTime, userId) {
    return new Promise((resolve, reject) => {
        login({ appState }, (err, api) => {
            if (err) {
                console.error(chalk.red(`❌ การเข้าสู่ระบบล้มเหลวสำหรับโทเค็น: ${token}`));
                return reject(err);
            }

            if (bots[token]) {
                console.log(chalk.yellow(`⚠️ บอทกำลังทำงานอยู่กับโทเค็น: ${token}`));
                return reject(new Error('บอทกำลังทำงานอยู่'));
            }

            bots[token] = { 
                api, 
                name, 
                startTime, 
                status: 'online',
                userId,
                commandUsage: {}
            };
            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));

            api.setOptions({ listenEvents: true });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    bots[token].status = 'offline';
                    io.emit('updateBots', generateBotData(userId));
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
                            bots[token].commandUsage[commandName] = (bots[token].commandUsage[commandName] || 0) + 1;

                            io.emit('updateBots', generateBotData(userId));
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
                if (bots[token].status === 'online' && removalTimers[token]) {
                    clearCountdown(token);
                }
            });

            io.emit('updateBots', generateBotData(userId));
            resolve();
        });
    });
}

// ฟังก์ชันเริ่มต้นการนับถอยหลังและลบบอทจากเซิร์ฟเวอร์หลังจาก 60 วินาที
function scheduleBotRemoval(token) {
    if (removalTimers[token]) return; // ถ้ามีการนับถอยหลังอยู่แล้ว

    removalTimers[token] = setTimeout(() => {
        delete bots[token];
        delete removalTimers[token];
        console.log(chalk.yellow(`⚠️ ลบบอทที่ออฟไลน์: ${token}`));
        io.emit('updateBots', generateBotData(bots[token].userId));
    }, 60000); // 60 วินาที
}

// ฟังก์ชันยกเลิกการลบบอท
function clearCountdown(token) {
    // ยกเลิกการนับถอยหลัง
    if (removalTimers[token]) {
        clearTimeout(removalTimers[token]);
        delete removalTimers[token];
        // ส่งการอัปเดตไปยัง frontend
        io.emit('updateBots', generateBotData(bots[token].userId));
        console.log(chalk.yellow(`⚠️ ยกเลิกการลบบอท ${bots[token].name}`));
    }
}

// หน้าแสดงบอทรัน - ต้องล็อกอินก่อน
app.get("/bots", isAuthenticated, (req, res) => {
    const userId = req.session.userId;
    const botData = generateBotData(userId);

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
            <link rel="stylesheet" href="/css/styles.css">
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
                                <a class="nav-link active" href="/bots"><i class="fas fa-list me-1"></i> ดูบอทรัน</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/commands"><i class="fas fa-terminal me-1"></i> คำสั่งที่ใช้</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" href="/logout"><i class="fas fa-sign-out-alt me-1"></i> ออกจากระบบ</a>
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
                                    <th>การจัดการ</th>
                                </tr>
                            </thead>
                            <tbody id="botTableBody">
                                ${botData.botRows}
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
            <script src="/js/scripts.js"></script>
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

                        el.textContent = \`\${days} วัน \${hours} ชั่วโมง \${minutes} นาที \${seconds} วินาที\`;
                    });
                }

                // ฟังก์ชันเริ่มนับถอยหลังการลบบอท
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

                // จัดการการหยุดบอท
                document.addEventListener('click', function(e) {
                    if (e.target.classList.contains('stop-bot')) {
                        const token = e.target.getAttribute('data-token');
                        fetch('/stop-bot', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ token })
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                alert('หยุดบอทสำเร็จ');
                                // อัปเดตข้อมูลบอท
                                socket.emit('requestUpdate');
                            } else {
                                alert('เกิดข้อผิดพลาด: ' + data.message);
                            }
                        });
                    }

                    if (e.target.classList.contains('edit-bot')) {
                        const token = e.target.getAttribute('data-token');
                        const newName = prompt('กรุณาใส่ชื่อบอทใหม่:');
                        if (newName) {
                            fetch('/edit-bot', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ token, newName })
                            })
                            .then(res => res.json())
                            .then(data => {
                                if (data.success) {
                                    alert('แก้ไขบอทสำเร็จ');
                                    // อัปเดตข้อมูลบอท
                                    socket.emit('requestUpdate');
                                } else {
                                    alert('เกิดข้อผิดพลาด: ' + data.message);
                                }
                            });
                        }
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// หน้าแสดงคำสั่งที่ใช้ - ต้องล็อกอินก่อน
app.get("/commands", isAuthenticated, (req, res) => {
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
            <link rel="stylesheet" href="/css/styles.css">
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
                            <li class="nav-item">
                                <a class="nav-link" href="/logout"><i class="fas fa-sign-out-alt me-1"></i> ออกจากระบบ</a>
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

// หน้า Signup
app.get("/signup", (req, res) => {
    const error = req.query.error ? "ชื่อผู้ใช้ถูกใช้แล้วหรือข้อมูลไม่ถูกต้อง" : "";
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>สมัครสมาชิก | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <link rel="stylesheet" href="/css/styles.css">
        </head>
        <body>
            <div class="container d-flex align-items-center justify-content-center" style="min-height: 100vh;">
                <div class="glass-card w-100" style="max-width: 400px;">
                    <h5 class="mb-4 text-center">
                        <i class="fas fa-user-plus me-2" style="color: var(--primary-color);"></i>
                        สมัครสมาชิก
                    </h5>
                    ${error ? `<div class="alert alert-danger">${error}</div>` : ''}
                    <form method="POST" action="/signup">
                        <div class="mb-3">
                            <label for="username" class="form-label">ชื่อผู้ใช้</label>
                            <input type="text" id="username" name="username" class="form-control" required placeholder="กรอกชื่อผู้ใช้">
                        </div>
                        <div class="mb-3">
                            <label for="password" class="form-label">รหัสผ่าน</label>
                            <input type="password" id="password" name="password" class="form-control" required placeholder="กรอกรหัสผ่าน">
                        </div>
                        <button type="submit" class="btn btn-primary w-100">
                            <i class="fas fa-user-check me-2"></i>
                            สมัครสมาชิก
                        </button>
                    </form>
                    <p class="mt-3 text-center">
                        มีบัญชีแล้ว? <a href="/login">เข้าสู่ระบบ</a>
                    </p>
                </div>
            </div>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `);
});

// POST /signup เพื่อสมัครสมาชิก
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    // ตรวจสอบว่าชื่อผู้ใช้มีอยู่แล้วหรือไม่
    const existingUser = Object.values(users).find(user => user.username === username);
    if (existingUser) {
        return res.redirect('/signup?error=1');
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // สร้างผู้ใช้ใหม่
    const userId = Date.now().toString();
    users[userId] = { username, password: hashedPassword };
    saveUsers();

    // สร้างไฟล์บอทสำหรับผู้ใช้ใหม่
    bots[userId] = {};
    saveBots();

    // ตั้งค่า session
    req.session.userId = userId;

    res.redirect('/');
});

// หน้า Login
app.get("/login", (req, res) => {
    const error = req.query.error ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" : "";
    res.send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>เข้าสู่ระบบ | ระบบจัดการบอท</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <link rel="stylesheet" href="/css/styles.css">
        </head>
        <body>
            <div class="container d-flex align-items-center justify-content-center" style="min-height: 100vh;">
                <div class="glass-card w-100" style="max-width: 400px;">
                    <h5 class="mb-4 text-center">
                        <i class="fas fa-sign-in-alt me-2" style="color: var(--primary-color);"></i>
                        เข้าสู่ระบบ
                    </h5>
                    ${error ? `<div class="alert alert-danger">${error}</div>` : ''}
                    <form method="POST" action="/login">
                        <div class="mb-3">
                            <label for="username" class="form-label">ชื่อผู้ใช้</label>
                            <input type="text" id="username" name="username" class="form-control" required placeholder="กรอกชื่อผู้ใช้">
                        </div>
                        <div class="mb-3">
                            <label for="password" class="form-label">รหัสผ่าน</label>
                            <input type="password" id="password" name="password" class="form-control" required placeholder="กรอกรหัสผ่าน">
                        </div>
                        <button type="submit" class="btn btn-primary w-100">
                            <i class="fas fa-sign-in-alt me-2"></i>
                            เข้าสู่ระบบ
                        </button>
                    </form>
                    <p class="mt-3 text-center">
                        ยังไม่มีบัญชี? <a href="/signup">สมัครสมาชิก</a>
                    </p>
                </div>
            </div>

            <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
    `);
});

// POST /login เพื่อเข้าสู่ระบบ
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // ค้นหาผู้ใช้
    const userEntry = Object.entries(users).find(([id, user]) => user.username === username);
    if (!userEntry) {
        return res.redirect('/login?error=1');
    }

    const [userId, user] = userEntry;

    // ตรวจสอบรหัสผ่าน
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return res.redirect('/login?error=1');
    }

    // ตั้งค่า session
    req.session.userId = userId;

    res.redirect('/');
});

// GET /logout เพื่อออกจากระบบ
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// POST /stop-bot เพื่อหยุดบอท - ต้องล็อกอินก่อน
app.post('/stop-bot', isAuthenticated, (req, res) => {
    const { token } = req.body;
    const userId = req.session.userId;

    if (!bots[token] || bots[token].userId !== userId) {
        return res.json({ success: false, message: 'ไม่พบบอทหรือคุณไม่มีสิทธิ์จัดการบอทนี้' });
    }

    // หยุดบอท
    bots[token].api.disconnect();
    bots[token].status = 'offline';
    saveBots();

    io.emit('updateBots', generateBotData(userId));

    res.json({ success: true });
});

// POST /edit-bot เพื่อแก้ไขชื่อบอท - ต้องล็อกอินก่อน
app.post('/edit-bot', isAuthenticated, (req, res) => {
    const { token, newName } = req.body;
    const userId = req.session.userId;

    if (!bots[token] || bots[token].userId !== userId) {
        return res.json({ success: false, message: 'ไม่พบบอทหรือคุณไม่มีสิทธิ์จัดการบอทนี้' });
    }

    bots[token].name = newName;
    saveBots();

    io.emit('updateBots', generateBotData(userId));

    res.json({ success: true });
});

// Socket.io สำหรับหน้าแดชบอร์ดหลักและดูบอทรัน
io.on('connection', (socket) => {
    console.log(chalk.blue('🔌 Socket.io client connected'));

    // รับคำขออัปเดต
    socket.on('requestUpdate', () => {
        // ควรส่ง userId มาด้วย
        // แต่เนื่องจาก Socket.io ไม่มี session โดยตรง เราต้องเชื่อมโยงด้วยวิธีอื่น
        // สำหรับความง่ายในที่นี้ เราจะส่งข้อมูลทั้งหมด
        socket.emit('updateBots', generateBotData(socket.handshake.query.userId));
        socket.emit('updateCommands', generateCommandData());
    });

    socket.on('disconnect', () => {
        console.log(chalk.red('🔌 Socket.io client disconnected'));
    });
});

// เริ่มต้นเซิร์ฟเวอร์
server.listen(PORT, () => {
    console.log(chalk.blue(`🌐 เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${PORT}`));
    console.log(chalk.green(figlet.textSync("Bot Management", { horizontalLayout: "full" })));
});
