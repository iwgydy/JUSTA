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
const prefix = "/";
const commands = {};
const commandDescriptions = [];

// โหลดคำสั่งจากโฟลเดอร์ commands
if (fs.existsSync("./commands")) {
  fs.readdirSync("./commands").forEach((file) => {
    if (file.endsWith(".js")) {
      const command = require(`./commands/${file}`);
      if (command.config && command.config.name) {
        commands[command.config.name.toLowerCase()] = command;
        commandDescriptions.push({
          name: command.config.name,
          description: command.config.description || "ไม่มีคำอธิบาย",
        });
        console.log(`📦 โหลดคำสั่ง: ${command.config.name}`);
      }
    }
  });
}

// โหลดอีเวนต์จากโฟลเดอร์ events
const events = {};
if (fs.existsSync("./events")) {
  fs.readdirSync("./events").forEach((file) => {
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

// เส้นทางแดชบอร์ดหลัก
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
        <title>ระบบจัดการบอท | Bot Management System</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            :root {
                --primary-color: #ff9a9e;
                --secondary-color: #fad0c4;
                --accent-color: #fad0c4;
                --background-color: #f0f8ff;
                --card-bg: rgba(255, 255, 255, 0.8);
                --card-border: rgba(255, 255, 255, 0.2);
                --text-color: #333;
                --success-color: #a8e6cf;
                --error-color: #ff8b94;
                --info-color: #a0c4ff;
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
                    radial-gradient(circle at 20% 20%, rgba(255, 154, 158, 0.15) 0%, transparent 40%),
                    radial-gradient(circle at 80% 80%, rgba(250, 208, 196, 0.15) 0%, transparent 40%);
                pointer-events: none;
                z-index: -1;
            }

            .navbar {
                background: rgba(255, 255, 255, 0.9);
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
                background-color: rgba(255, 154, 158, 0.05);
            }

            .status-online {
                background: var(--success-color);
                color: #2d6a4f;
                padding: 5px 10px;
                border-radius: 20px;
                font-size: 0.9rem;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .status-offline {
                background: var(--error-color);
                color: #d00000;
                padding: 5px 10px;
                border-radius: 20px;
                font-size: 0.9rem;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .add-bot-form .form-label {
                font-weight: 500;
                color: var(--text-color);
            }

            .form-control {
                background: #fff;
                border: 1px solid #ced4da;
                border-radius: 8px;
                padding: 10px 12px;
                font-size: 1rem;
                transition: border-color 0.3s ease;
            }

            .form-control:focus {
                border-color: var(--primary-color);
                box-shadow: 0 0 0 0.2rem rgba(255, 154, 158, 0.25);
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
                background: var(--secondary-color);
                transform: translateY(-2px);
            }

            .command-list {
                margin-top: 20px;
            }

            .command-item {
                background: #fff;
                border: 1px solid #ced4da;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 10px;
                transition: background 0.3s ease, transform 0.3s ease;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            }

            .command-item:hover {
                background: var(--primary-color);
                color: #fff;
                transform: translateX(5px);
            }

            .footer {
                background: rgba(255, 255, 255, 0.9);
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

            @media (max-width: 768px) {
                .stats-card {
                    margin-bottom: 20px;
                }
                .glass-card {
                    margin-bottom: 20px;
                }
            }
        </style>
    </head>
    <body>
        <nav class="navbar navbar-expand-lg navbar-light mb-4">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="#">
                    <i class="fas fa-robot fa-lg me-2 animate-float" style="color: var(--primary-color);"></i>
                    ระบบจัดการบอท
                </a>
            </div>
        </nav>

        <div class="container">
            <!-- สถิติ -->
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="stats-card">
                        <i class="fas fa-robot fa-2x mb-3" style="color: var(--primary-color);"></i>
                        <div class="stats-number" id="totalBots">${totalBots}</div>
                        <div class="stats-label">บอททั้งหมด</div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stats-card">
                        <i class="fas fa-signal fa-2x mb-3" style="color: var(--info-color);"></i>
                        <div class="stats-number" id="onlineBots">${onlineBots}</div>
                        <div class="stats-label">บอทออนไลน์</div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stats-card">
                        <i class="fas fa-clock fa-2x mb-3" style="color: var(--secondary-color);"></i>
                        <div class="stats-number" id="activeBots">${activeBots}</div>
                        <div class="stats-label">บอททำงานแล้ว</div>
                    </div>
                </div>
            </div>

            <div class="row">
                <!-- ฟอร์มเพิ่มบอท -->
                <div class="col-md-6 mb-4">
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

                <!-- ตารางบอท -->
                <div class="col-md-6 mb-4">
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
                                        <tr>
                                            <td>
                                                <i class="fas fa-robot me-2" style="color: var(--primary-color);"></i>
                                                ${bot.name}
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

            <!-- รายการคำสั่ง -->
            <div class="row">
                <div class="col-12">
                    <div class="glass-card">
                        <h5 class="mb-4">
                            <i class="fas fa-terminal me-2" style="color: var(--secondary-color);"></i>
                            คำสั่งที่ใช้ได้
                        </h5>
                        <div class="command-list">
                            ${commandDescriptions.map(cmd => `
                                <div class="command-item">
                                    <strong>${prefix}${cmd.name}</strong>
                                    <p class="mb-0">${cmd.description}</p>
                                </div>
                            `).join('') || `
                                <div class="command-item">
                                    <p class="mb-0 text-center">ไม่มีคำสั่งที่กำหนดไว้</p>
                                </div>
                            `}
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

            socket.on('updateBots', (data) => {
                document.getElementById('totalBots').textContent = data.totalBots;
                document.getElementById('onlineBots').textContent = data.onlineBots;
                document.getElementById('activeBots').textContent = data.activeBots;
                
                const botTableBody = document.getElementById('botTableBody');
                if (botTableBody) {
                    botTableBody.innerHTML = data.botRows;
                }
                
                updateRuntime();
            });

            setInterval(updateRuntime, 1000);
            document.addEventListener('DOMContentLoaded', updateRuntime);
        </script>
    </body>
    </html>
  `);
});

// จุดเริ่มต้นของบอท
app.post('/start', async (req, res) => {
    const tokenInput = req.body.token.trim();

    if (botSessions[tokenInput]) {
        return res.redirect('/?error=already-running');
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
        res.redirect('/?error=invalid-token');
    }
});

// ฟังก์ชันช่วยเหลือในการสร้างข้อมูลบอทสำหรับการอัปเดตแบบเรียลไทม์
function generateBotData() {
    const totalBots = Object.keys(botSessions).length;
    const onlineBots = Object.values(botSessions).filter(bot => bot.status === 'online').length;
    const activeBots = Object.values(botSessions).filter(bot => bot.status === 'active').length;
    
    const botRows = Object.entries(botSessions).map(([token, bot]) => `
        <tr>
            <td>
                <i class="fas fa-robot me-2" style="color: var(--primary-color);"></i>
                ${bot.name}
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
        </tr>
    `).join('') || `
        <tr>
            <td colspan="3" class="text-center">ไม่มีบอทที่กำลังทำงาน</td>
        </tr>
    `;

    return { totalBots, onlineBots, activeBots, botRows, commandDescriptions };
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

            botSessions[token] = { api, name, startTime, status: 'online' };
            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} กำลังทำงานด้วยโทเค็น: ${token}`));

            api.setOptions({ listenEvents: true });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ เกิดข้อผิดพลาด: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots', generateBotData());
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
                        } catch (error) {
                            console.error(chalk.red(`❌ เกิดข้อผิดพลาดในคำสั่ง ${commandName}:`, error));
                            api.sendMessage("❗ การรันคำสั่งล้มเหลว", event.threadID);
                        }
                    } else {
                        api.sendMessage("❗ ไม่พบคำสั่งที่ระบุ", event.threadID);
                    }
                }
            });

            io.emit('updateBots', generateBotData());
            resolve();
        });
    });
}

// เริ่มต้นเซิร์ฟเวอร์
server.listen(PORT, () => {
    console.log(chalk.blue(`🌐 เซิร์ฟเวอร์กำลังทำงานที่ http://localhost:${PORT}`));
    console.log(chalk.green(figlet.textSync("Bot Management", { horizontalLayout: "full" })));
});
