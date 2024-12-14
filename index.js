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
const io = new Server(server);
const PORT = 3005;

let botCount = 0;
const botSessions = {};
const removalTimers = {}; // เก็บตัวจับเวลาการลบบอท
const prefix = "/";
const commands = {};
const commandDescriptions = [];
const commandUsage = {}; // เก็บจำนวนการใช้แต่ละคำสั่ง

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
        commandUsage[command.config.name.toLowerCase()] = 0; // เริ่มนับที่ 0
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

// เส้นทางหน้าเพิ่มบอท
app.get("/add", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>เพิ่มบอท | Bot Management System</title>
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
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
                    aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav ms-auto">
                        <li class="nav-item">
                            <a class="nav-link" href="/add">เพิ่มบอท</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/">บอทรัน</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/commands">คำสั่งที่ใช้ได้</a>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>

        <div class="container">
            <!-- ฟอร์มเพิ่มบอท -->
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <div class="glass-card">
                        <h5 class="mb-4 text-center">
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

// เส้นทางหน้าดูบอทรัน
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
        <title>บอทรัน | Bot Management System</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link rel="stylesheet" href="/css/styles.css">
        <style>
            /* เพิ่มสไตล์เฉพาะหน้านี้ได้ที่นี่ */
        </style>
    </head>
    <body>
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
                        <li class="nav-item">
                            <a class="nav-link" href="/add">เพิ่มบอท</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link active" href="/">บอทรัน</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/commands">คำสั่งที่ใช้ได้</a>
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
                        <div class="stats-number" id="totalBots">${totalBots}</div>
                        <div class="stats-label">บอททั้งหมด</div>
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

            <!-- ตารางบอท -->
            <div class="row">
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
                                        <th>คำสั่งที่ใช้</th>
                                        <th>ผู้ใช้</th>
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
                                            <td>
                                                ${bot.commandsUsed || 0}
                                            </td>
                                            <td>
                                                ${bot.users || 0}
                                            </td>
                                        </tr>
                                    `).join('') || `
                                        <tr>
                                            <td colspan="5" class="text-center">ไม่มีบอทที่กำลังทำงาน</td>
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
        </script>
    </body>
    </html>
  `);
});

// เส้นทางหน้าคำสั่งที่ใช้ได้
app.get("/commands", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>คำสั่งที่ใช้ได้ | Bot Management System</title>
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
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
                    aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav ms-auto">
                        <li class="nav-item">
                            <a class="nav-link" href="/add">เพิ่มบอท</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/">บอทรัน</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link active" href="/commands">คำสั่งที่ใช้ได้</a>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>

        <div class="container">
            <!-- รายการคำสั่ง -->
            <div class="row">
                <div class="col-12">
                    <div class="glass-card">
                        <h5 class="mb-4">
                            <i class="fas fa-terminal me-2" style="color: var(--secondary-color);"></i>
                            คำสั่งที่ใช้ได้
                        </h5>
                        <div class="table-responsive">
                            <table class="table bot-table">
                                <thead>
                                    <tr>
                                        <th>ชื่อคำสั่ง</th>
                                        <th>จำนวนที่ใช้</th>
                                        <th>คำอธิบาย</th>
                                    </tr>
                                </thead>
                                <tbody id="commandTableBody">
                                    ${commandDescriptions.map(cmd => `
                                        <tr>
                                            <td><strong>${prefix}${cmd.name}</strong></td>
                                            <td>${commandUsage[cmd.name.toLowerCase()] || 0}</td>
                                            <td>${cmd.description}</td>
                                        </tr>
                                    `).join('') || `
                                        <tr>
                                            <td colspan="3" class="text-center">ไม่มีคำสั่งที่กำหนดไว้</td>
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
        <script src="/js/scripts.js"></script>
        <script>
            const socket = io();

            // ฟังก์ชันอัปเดตคำสั่งที่ใช้ได้
            function updateCommands(data) {
                const commandTableBody = document.getElementById('commandTableBody');
                if (commandTableBody) {
                    let rows = '';
                    for (const cmd of data.commandDescriptions) {
                        rows += \`
                            <tr>
                                <td><strong>\${prefix}\${cmd.name}</strong></td>
                                <td>\${data.commandUsage[cmd.name.toLowerCase()] || 0}</td>
                                <td>\${cmd.description}</td>
                            </tr>
                        \`;
                    }
                    commandTableBody.innerHTML = rows || \`
                        <tr>
                            <td colspan="3" class="text-center">ไม่มีคำสั่งที่กำหนดไว้</td>
                        </tr>
                    \`;
                }
            }

            // รับข้อมูลอัปเดตจากเซิร์ฟเวอร์
            socket.on('updateBots', (data) => {
                // Update Command Usage
                updateCommands(data);
            });
        </script>
    </body>
    </html>
  `);
});

// จุดเริ่มต้นของบอท
app.post('/start', async (req, res) => {
    const tokenInput = req.body.token.trim();

    if (botSessions[tokenInput]) {
        return res.redirect('/add?error=already-running');
    }

    botCount++;
    const botName = `Bot ${botCount}`;
    const startTime = Date.now();

    try {
        const appState = JSON.parse(tokenInput);
        await startBot(appState, tokenInput, botName, startTime);
        res.redirect('/');
        io.emit('updateBots', generateBotData());
    } catch (err) {
        console.error(chalk.red(`❌ เกิดข้อผิดพลาดในการเริ่มบอท: ${err.message}`));
        botCount--;
        res.redirect('/add?error=invalid-token');
    }
});

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
            <td>
                ${bot.commandsUsed || 0}
            </td>
            <td>
                ${bot.users || 0}
            </td>
        </tr>
    `).join('') || `
        <tr>
            <td colspan="5" class="text-center">ไม่มีบอทที่กำลังทำงาน</td>
        </tr>
    `;

    // รวบรวมบอทที่ออฟไลน์เพื่อให้ frontend จัดการนับถอยหลัง
    const offlineBots = Object.entries(botSessions)
        .filter(([token, bot]) => bot.status === 'offline')
        .map(([token, bot]) => token);

    return { totalBots, onlineBots, activeBots, botRows, commandDescriptions, commandUsage, offlineBots };
}

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
                status: 'online',
                commandsUsed: 0, // เพิ่มตัวนับคำสั่ง
                users: 0         // เพิ่มตัวนับผู้ใช้
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
                            botSessions[token].commandsUsed += 1; // เพิ่มตัวนับคำสั่ง

                            // เพิ่มตัวนับคำสั่งใน commandUsage
                            if (commandUsage[commandName] !== undefined) {
                                commandUsage[commandName] += 1;
                            } else {
                                commandUsage[commandName] = 1;
                            }

                            // สมมติว่าเราสามารถนับผู้ใช้ได้จาก event
                            if (event.threadID) {
                                botSessions[token].users += 1;  // เพิ่มตัวนับผู้ใช้
                            }

                            io.emit('updateBots', generateBotData());
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

// เริ่มต้นเซิร์ฟเวอร์
server.listen(PORT, () => {
    console.log(chalk.blue(`🌐 เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${PORT}`));
    console.log(chalk.green(figlet.textSync("Bot Management", { horizontalLayout: "full" })));
});

// Socket.io การเชื่อมต่อ
io.on('connection', (socket) => {
    console.log(chalk.green('🔗 มีผู้เชื่อมต่อเข้ามาใหม่'));
    socket.emit('updateBots', generateBotData());

    socket.on('disconnect', () => {
        console.log(chalk.red('🔌 ผู้ใช้บางคนได้ตัดการเชื่อมต่อ'));
    });
});
