const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const login = require('ryuu-fca-api');
const chalk = require('chalk');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

// โหลดข้อมูลผู้ใช้จากไฟล์ JSON
function loadUsers() {
    if (!fs.existsSync('users.json')) {
        fs.writeFileSync('users.json', JSON.stringify({ users: [] }, null, 2));
    }
    const data = fs.readFileSync('users.json', 'utf8');
    return JSON.parse(data);
}

function saveUsers(usersData) {
    fs.writeFileSync('users.json', JSON.stringify(usersData, null, 2));
}

const usersData = loadUsers();

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
const botSessions = {}; // { token: { api, name, startTime, status, owner: username } }
const removalTimers = {}; 
const prefix = "/";
const commands = {};
const commandDescriptions = [];
const commandUsage = {}; 

// โหลดคำสั่ง
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

// โหลดอีเวนต์
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

// ตั้งค่า Session
app.use(session({
    secret: 'your_secret_key', 
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Middleware ตรวจสอบการล็อกอิน
function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

// ฟังก์ชันช่วยเหลือ
function findUserByUsername(username) {
    return usersData.users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

function generateBotDataForUser(username) {
    const userBots = Object.entries(botSessions)
        .filter(([token, bot]) => bot.owner === username);

    const totalBots = userBots.length;
    const onlineBots = userBots.filter(([token, bot]) => bot.status === 'online').length;
    const activeBots = userBots.filter(([token, bot]) => bot.status === 'active').length;

    const botRows = userBots.map(([token, bot]) => `
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
            <td>
                <div class="d-flex gap-2">
                    <form action="/stop-bot" method="POST">
                        <input type="hidden" name="token" value="${token}">
                        <button type="submit" class="btn btn-sm btn-warning"><i class="fas fa-pause"></i> หยุด</button>
                    </form>
                    <form action="/edit-bot" method="GET">
                        <input type="hidden" name="token" value="${token}">
                        <button type="submit" class="btn btn-sm btn-info"><i class="fas fa-edit"></i> แก้ไข</button>
                    </form>
                    <form action="/delete-bot" method="POST" onsubmit="return confirm('คุณต้องการลบโทเค่นนี้หรือไม่?')">
                        <input type="hidden" name="token" value="${token}">
                        <button type="submit" class="btn btn-sm btn-danger"><i class="fas fa-trash"></i> ลบ</button>
                    </form>
                </div>
            </td>
        </tr>
    `).join('') || `
        <tr>
            <td colspan="4" class="text-center">ไม่มีบอทที่กำลังทำงาน</td>
        </tr>
    `;

    const offlineBots = userBots
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

// Routing

// หน้า Login
app.get("/login", (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.send(renderLoginPage());
});

// หน้า Register
app.get("/register", (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.send(renderRegisterPage());
});

app.post("/register", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.redirect('/register?error=missing');
    }
    if (findUserByUsername(username)) {
        return res.redirect('/register?error=exists');
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    usersData.users.push({
        username: username,
        passwordHash: passwordHash,
        bots: []
    });
    saveUsers(usersData);
    res.redirect('/login?success=registered');
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = findUserByUsername(username);

    if (!user) {
        return res.redirect('/login?error=notfound');
    }

    if (!bcrypt.compareSync(password, user.passwordHash)) {
        return res.redirect('/login?error=invalid');
    }

    req.session.user = { username: user.username };
    res.redirect('/');
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// หน้าแดชบอร์ดหลัก
app.get("/", requireLogin, (req, res) => {
    const { totalBots, onlineBots, activeBots, botRows } = generateBotDataForUser(req.session.user.username);
    res.send(renderMainDashboardPage({ totalBots, onlineBots, activeBots, botRows, user: req.session.user.username }));
});

// หน้าเพิ่มบอท
app.get("/start", requireLogin, (req, res) => {
    res.send(renderAddBotPage());
});

app.post('/start', requireLogin, async (req, res) => {
    const tokenInput = req.body.token.trim();
    const user = findUserByUsername(req.session.user.username);

    if (botSessions[tokenInput]) {
        return res.redirect('/start?error=already-running');
    }

    if (user.bots.find(b => b.token === tokenInput)) {
        return res.redirect('/start?error=duplicate-token');
    }

    botCount++;
    const botName = `Bot ${botCount}`;
    const startTime = Date.now();

    try {
        const appState = JSON.parse(tokenInput);
        await startBot(appState, tokenInput, botName, startTime, req.session.user.username);

        user.bots.push({
            token: tokenInput,
            appState: appState,
            name: botName
        });
        saveUsers(usersData);

        res.redirect('/bots');
        io.emit('updateBots');
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        botCount--;
        res.redirect('/start?error=invalid-token');
    }
});

// หน้าแสดงบอทรัน
app.get("/bots", requireLogin, (req, res) => {
    const { totalBots, onlineBots, activeBots, botRows } = generateBotDataForUser(req.session.user.username);
    res.send(renderBotsPage({ totalBots, onlineBots, activeBots, botRows, user: req.session.user.username }));
});

// หน้าแสดงคำสั่งที่ใช้
app.get("/commands", requireLogin, (req, res) => {
    const commandsData = generateCommandData();
    res.send(renderCommandsPage(commandsData));
});

// หน้าแก้ไขโทเค่นบอท
app.get("/edit-bot", requireLogin, (req, res) => {
    const token = req.query.token;
    const user = findUserByUsername(req.session.user.username);
    const botData = user.bots.find(b => b.token === token);

    if (!botData) {
        return res.redirect('/bots?error=notfound');
    }

    res.send(renderEditBotPage(botData));
});

app.post("/edit-bot", requireLogin, (req, res) => {
    const { token, newToken } = req.body;
    const user = findUserByUsername(req.session.user.username);
    const botIndex = user.bots.findIndex(b => b.token === token);

    if (botIndex === -1) {
        return res.redirect('/bots?error=notfound');
    }

    const oldBot = user.bots[botIndex];
    if (botSessions[token]) {
        stopBot(token);
    }

    try {
        const appState = JSON.parse(newToken);
        const startTime = Date.now();
        botCount++;
        const botName = oldBot.name || `Bot ${botCount}`;
        startBot(appState, newToken, botName, startTime, user.username).then(() => {
            user.bots[botIndex] = {
                token: newToken,
                appState: appState,
                name: botName
            };
            saveUsers(usersData);

            res.redirect('/bots');
        }).catch(err => {
            console.error(err);
            res.redirect('/bots?error=invalid-token');
        });
    } catch (err) {
        console.error(err);
        res.redirect('/bots?error=invalid-token');
    }
});

// ลบโทเค่นบอท
app.post("/delete-bot", requireLogin, (req, res) => {
    const { token } = req.body;
    const user = findUserByUsername(req.session.user.username);
    const botIndex = user.bots.findIndex(b => b.token === token);

    if (botIndex === -1) {
        return res.redirect('/bots?error=notfound');
    }

    stopBot(token);
    user.bots.splice(botIndex, 1);
    saveUsers(usersData);

    res.redirect('/bots');
});

// หยุดบอท
app.post("/stop-bot", requireLogin, (req, res) => {
    const { token } = req.body;
    const user = findUserByUsername(req.session.user.username);
    const botData = user.bots.find(b => b.token === token);
    if (!botData) {
        return res.redirect('/bots?error=notfound');
    }

    stopBot(token);
    res.redirect('/bots');
});

// ฟังก์ชันหยุดบอท
function stopBot(token) {
    if (botSessions[token]) {
        botSessions[token].status = 'offline';
        botSessions[token].api.logout(() => {
            scheduleBotRemoval(token);
            io.emit('updateBots');
        });
    }
}

// ฟังก์ชันเริ่มต้นบอท
async function startBot(appState, token, name, startTime, owner) {
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
                owner
            };
            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));

            api.setOptions({ listenEvents: true });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots');
                    scheduleBotRemoval(token);
                    return;
                }

                // จัดการอีเวนต์
                if (event.logMessageType && events[event.logMessageType]) {
                    for (const eventHandler of events[event.logMessageType]) {
                        try {
                            await eventHandler.run({ api, event });
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
                            commandUsage[commandName] = (commandUsage[commandName] || 0) + 1;

                            io.emit('updateBots');
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

            io.emit('updateBots');
            resolve();
        });
    });
}

// ฟังก์ชันเริ่มต้นการนับถอยหลังและลบบอทหลัง 60 วินาที
function scheduleBotRemoval(token) {
    if (removalTimers[token]) return;

    removalTimers[token] = setTimeout(() => {
        delete botSessions[token];
        delete removalTimers[token];
        console.log(chalk.yellow(`⚠️ ลบบอทที่ออฟไลน์: ${token}`));
        io.emit('updateBots');
    }, 60000);
}

// ฟังก์ชันยกเลิกการลบบอท
function clearCountdown(token) {
    if (removalTimers[token]) {
        clearTimeout(removalTimers[token]);
        delete removalTimers[token];
        io.emit('updateBots');
        console.log(chalk.yellow(`⚠️ ยกเลิกการลบบอท ${botSessions[token].name}`));
    }
}

// Socket.io
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

// ---------------------- Render HTML ---------------------- //
function renderLoginPage() {
return `
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>เข้าสู่ระบบ | ระบบจัดการบอท</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
    ${baseCss()}
    .bg-login {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
    }
</style>
</head>
<body class="bg-login">
<div class="login-card glass-card" style="max-width: 400px; width:100%;">
    <h5 class="mb-4 text-center">
        <i class="fas fa-user-circle me-2" style="color: var(--primary-color);"></i>
        เข้าสู่ระบบ
    </h5>
    <form method="POST" action="/login">
        <div class="mb-3">
            <label class="form-label">ชื่อผู้ใช้</label>
            <input type="text" name="username" class="form-control" placeholder="กรอกชื่อผู้ใช้" required>
        </div>
        <div class="mb-3">
            <label class="form-label">รหัสผ่าน</label>
            <input type="password" name="password" class="form-control" placeholder="กรอกรหัสผ่าน" required>
        </div>
        <button type="submit" class="btn btn-primary w-100 mb-2">เข้าสู่ระบบ</button>
        <div class="text-center">
            <a href="/register" class="text-decoration-none" style="color: var(--info-color);">ไม่มีบัญชี? สมัครสมาชิก</a>
        </div>
    </form>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
`;
}

function renderRegisterPage() {
return `
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>สมัครสมาชิก | ระบบจัดการบอท</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
    ${baseCss()}
    .bg-login {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
    }
</style>
</head>
<body class="bg-login">
<div class="login-card glass-card" style="max-width: 400px; width:100%;">
    <h5 class="mb-4 text-center">
        <i class="fas fa-user-plus me-2" style="color: var(--primary-color);"></i>
        สมัครสมาชิก
    </h5>
    <form method="POST" action="/register">
        <div class="mb-3">
            <label class="form-label">ชื่อผู้ใช้</label>
            <input type="text" name="username" class="form-control" placeholder="กรอกชื่อผู้ใช้" required>
        </div>
        <div class="mb-3">
            <label class="form-label">รหัสผ่าน</label>
            <input type="password" name="password" class="form-control" placeholder="กรอกรหัสผ่าน" required>
        </div>
        <button type="submit" class="btn btn-primary w-100 mb-2">สมัครสมาชิก</button>
        <div class="text-center">
            <a href="/login" class="text-decoration-none" style="color: var(--info-color);">มีบัญชีแล้ว? เข้าสู่ระบบ</a>
        </div>
    </form>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
`;
}

function renderMainDashboardPage({ totalBots, onlineBots, activeBots, botRows, user }) {
return `
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
    ${baseCss()}
</style>
</head>
<body>
    ${renderNavbar(user)}
    <div class="container">
        <div class="row mb-4">
            ${renderStatCard("fa-robot", totalBots, "บอททั้งหมด", "var(--primary-color)")}
            ${renderStatCard("fa-signal", onlineBots, "บอทออนไลน์", "var(--info-color)")}
            ${renderStatCard("fa-clock", activeBots, "บอททำงานแล้ว", "var(--secondary-color)")}
        </div>

        <div class="row">
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
                                    <th>จัดการ</th>
                                </tr>
                            </thead>
                            <tbody id="botTableBody">
                                ${botRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    ${renderFooter()}
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        ${runtimeScript()}
    </script>
</body>
</html>
`;
}

function renderAddBotPage() {
return `
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
    ${baseCss()}
</style>
</head>
<body>
    ${renderNavbar()}
    <div class="container">
        <div class="glass-card">
            <h5 class="mb-4">
                <i class="fas fa-plus-circle me-2" style="color: var(--primary-color);"></i>
                เพิ่มบอทใหม่
            </h5>
            <form method="POST" action="/start">
                <div class="mb-3">
                    <label class="form-label">โทเค็นของคุณ (AppState JSON)</label>
                    <textarea 
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
    ${renderFooter()}
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
`;
}

function renderBotsPage({ totalBots, onlineBots, activeBots, botRows, user }) {
return `
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
    ${baseCss()}
</style>
</head>
<body>
    ${renderNavbar(user)}
    <div class="container">
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
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody id="botTableBody">
                        ${botRows}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    ${renderFooter()}
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        ${runtimeScript()}
    </script>
</body>
</html>
`;
}

function renderCommandsPage(commandsData) {
return `
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
    ${baseCss()}
</style>
</head>
<body>
    ${renderNavbar()}
    <div class="container">
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
    ${renderFooter()}
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
`;
}

function renderEditBotPage(botData) {
return `
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>แก้ไขโทเค่นบอท | ระบบจัดการบอท</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
    ${baseCss()}
</style>
</head>
<body>
    ${renderNavbar()}
    <div class="container">
        <div class="glass-card">
            <h5 class="mb-4">
                <i class="fas fa-edit me-2" style="color: var(--info-color);"></i>
                แก้ไขโทเค่นบอท (${botData.name})
            </h5>
            <form method="POST" action="/edit-bot">
                <input type="hidden" name="token" value="${botData.token}">
                <div class="mb-3">
                    <label class="form-label">โทเค็นใหม่ (AppState JSON)</label>
                    <textarea 
                        name="newToken" 
                        class="form-control" 
                        rows="4" 
                        required
                    >${JSON.stringify(botData.appState, null, 2)}</textarea>
                </div>
                <button type="submit" class="btn btn-primary w-100">
                    <i class="fas fa-save me-2"></i>
                    บันทึก
                </button>
            </form>
        </div>
    </div>
    ${renderFooter()}
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
`;
}

// CSS & Scripts
function baseCss() {
return `
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
}

.bot-table th, .command-table th {
    background-color: var(--primary-color);
    color: #fff;
    font-weight: 600;
}

.bot-table tr:nth-child(even),
.command-table tr:nth-child(even) {
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

.countdown {
    font-weight: 500;
    color: var(--error-color);
    animation: blink 1s step-start infinite;
}

@keyframes blink {
    50% { opacity: 0; }
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
    border-radius: 8px;
    font-weight: 600;
}

.btn-primary:hover {
    background: var(--info-color);
}

.btn-danger, .btn-warning, .btn-info {
    border-radius: 8px;
    color: #fff;
    font-weight: 600;
    border: none;
}

.btn-info {
    background: var(--secondary-color);
}
.btn-info:hover {
    background: var(--primary-color);
}

.login-card {
    width: 100%;
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
`;
}

function renderNavbar(user) {
return `
<nav class="navbar navbar-expand-lg navbar-dark mb-4">
    <div class="container">
        <a class="navbar-brand d-flex align-items-center" href="/">
            <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
            ระบบจัดการบอท
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ms-auto">
                ${user ? `
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
                    <a class="nav-link text-danger" href="/logout"><i class="fas fa-sign-out-alt me-1"></i> ออกจากระบบ</a>
                </li>
                ` : `
                <li class="nav-item">
                    <a class="nav-link" href="/login"><i class="fas fa-user-circle me-1"></i> เข้าสู่ระบบ</a>
                </li>
                `}
            </ul>
        </div>
    </div>
</nav>
`;
}

function renderFooter() {
return `
<footer class="footer text-center">
    <div class="container">
        <p class="mb-0">© ${new Date().getFullYear()} ระบบจัดการบอท | พัฒนาด้วย ❤️</p>
    </div>
</footer>
`;
}

function renderStatCard(icon, number, label, color) {
return `
<div class="col-md-4 col-sm-6 mb-3">
    <div class="stats-card">
        <i class="fas ${icon} fa-2x mb-3" style="color: ${color};"></i>
        <div class="stats-number">${number}</div>
        <div class="stats-label">${label}</div>
    </div>
</div>
`;
}

function runtimeScript() {
return `
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

setInterval(updateRuntime, 1000);
document.addEventListener('DOMContentLoaded', updateRuntime);
`;
}
