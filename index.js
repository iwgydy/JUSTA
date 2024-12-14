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

// Load commands from commands folder
if (fs.existsSync("./commands")) {
  fs.readdirSync("./commands").forEach((file) => {
    if (file.endsWith(".js")) {
      const command = require(`./commands/${file}`);
      if (command.config && command.config.name) {
        commands[command.config.name.toLowerCase()] = command;
        commandDescriptions.push({
          name: command.config.name,
          description: command.config.description || "No description available",
        });
        console.log(`📦 Loaded command: ${command.config.name}`);
      }
    }
  });
}

// Load events from events folder
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
        console.log(`🔔 Loaded event: ${file}`);
      }
    }
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Main dashboard route
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
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            :root {
                --primary-gradient: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                --secondary-gradient: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                --accent-gradient: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
                --glass-bg: rgba(30, 41, 59, 0.7);
                --glass-border: rgba(255, 255, 255, 0.1);
            }

            body {
                background: #0f172a;
                color: #f8fafc;
                font-family: 'Kanit', sans-serif;
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
                    radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%),
                    radial-gradient(circle at 80% 80%, rgba(79, 70, 229, 0.15) 0%, transparent 40%);
                pointer-events: none;
                z-index: -1;
            }

            .glass-card {
                background: var(--glass-bg);
                backdrop-filter: blur(12px);
                border: 1px solid var(--glass-border);
                border-radius: 16px;
                padding: 24px;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }

            .glass-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            }

            .navbar {
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(10px);
                border-bottom: 1px solid var(--glass-border);
            }

            .stats-card {
                background: var(--primary-gradient);
                border-radius: 16px;
                padding: 24px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }

            .stats-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(45deg, transparent 0%, rgba(255, 255, 255, 0.1) 100%);
                pointer-events: none;
            }

            .stats-number {
                font-size: 2.5rem;
                font-weight: bold;
                margin: 10px 0;
                background: linear-gradient(to right, #fff, #e2e8f0);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }

            .bot-table {
                background: var(--glass-bg);
                border-radius: 12px;
                overflow: hidden;
            }

            .bot-table th {
                background: rgba(30, 41, 59, 0.9);
                color: #f8fafc;
                font-weight: 500;
                border: none;
            }

            .bot-table td {
                border: none;
                color: #f8fafc;
                padding: 16px;
            }

            .status-online {
                background: rgba(34, 197, 94, 0.2);
                color: #4ade80;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 0.9rem;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .status-offline {
                background: rgba(239, 68, 68, 0.2);
                color: #f87171;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 0.9rem;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .add-bot-form {
                background: var(--glass-bg);
                border-radius: 16px;
                padding: 24px;
            }

            .form-control {
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid var(--glass-border);
                color: #f8fafc;
                transition: all 0.3s ease;
            }

            .form-control:focus {
                background: rgba(15, 23, 42, 0.8);
                border-color: #6366f1;
                box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
            }

            .btn-primary {
                background: var(--primary-gradient);
                border: none;
                padding: 12px 24px;
                transition: all 0.3s ease;
            }

            .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 16px rgba(99, 102, 241, 0.3);
            }

            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }

            .animate-float {
                animation: float 3s ease-in-out infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }

            .animate-pulse {
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }

            .command-list {
                background: var(--glass-bg);
                border-radius: 12px;
                padding: 16px;
            }

            .command-item {
                background: rgba(30, 41, 59, 0.5);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 8px;
                transition: all 0.3s ease;
            }

            .command-item:hover {
                background: rgba(30, 41, 59, 0.8);
                transform: translateX(5px);
            }

            .footer {
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(10px);
                border-top: 1px solid var(--glass-border);
                padding: 20px 0;
                margin-top: 40px;
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
        <nav class="navbar navbar-expand-lg navbar-dark mb-4">
            <div class="container">
                <a class="navbar-brand d-flex align-items-center" href="#">
                    <i class="fas fa-robot me-2 animate-float"></i>
                    ระบบจัดการบอท
                </a>
            </div>
        </nav>

        <div class="container">
            <!-- สถิติ -->
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="stats-card">
                        <i class="fas fa-robot fa-2x mb-3"></i>
                        <div class="stats-number" id="totalBots">${totalBots}</div>
                        <div class="stats-label">บอททั้งหมด</div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stats-card">
                        <i class="fas fa-signal fa-2x mb-3"></i>
                        <div class="stats-number" id="onlineBots">${onlineBots}</div>
                        <div class="stats-label">บอทออนไลน์</div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="stats-card">
                        <i class="fas fa-clock fa-2x mb-3"></i>
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
                            <i class="fas fa-plus-circle me-2"></i>
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
                            <i class="fas fa-list me-2"></i>
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
                                                <i class="fas fa-robot me-2 animate-float"></i>
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
                            <i class="fas fa-terminal me-2"></i>
                            คำสั่งที่ใช้ได้
                        </h5>
                        <div class="command-list">
                            ${commandDescriptions.map(cmd => `
                                <div class="command-item">
                                    <strong>${prefix}${cmd.name}</strong>
                                    <p class="mb-0 text-muted">${cmd.description}</p>
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

// Start bot endpoint
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
        console.error(chalk.red(`❌ Error starting bot: ${err.message}`));
        botCount--;
        res.redirect('/?error=invalid-token');
    }
});

// Helper function to generate bot data for socket updates
function generateBotData() {
    const totalBots = Object.keys(botSessions).length;
    const onlineBots = Object.values(botSessions).filter(bot => bot.status === 'online').length;
    const activeBots = Object.values(botSessions).filter(bot => bot.status === 'active').length;
    
    const botRows = Object.entries(botSessions).map(([token, bot]) => `
        <tr>
            <td>
                <i class="fas fa-robot me-2"></i>
                ${bot.name}
            </td>
            <td>
                <span class="bot-status ${bot.status === 'online' ? 'status-online' : 'status-offline'}">
                    <i class="fas fa-circle me-1"></i>
                    ${bot.status === 'online' ? 'Online' : 'Offline'}
                </span>
            </td>
            <td>
                <span class="runtime" data-start-time="${bot.startTime}">
                    Calculating...
                </span>
            </td>
        </tr>
    `).join('') || `
        <tr>
            <td colspan="3" class="text-center">No active bots</td>
        </tr>
    `;

    return { totalBots, onlineBots, activeBots, botRows, commandDescriptions };
}

// Bot startup function
async function startBot(appState, token, name, startTime) {
    return new Promise((resolve, reject) => {
        login({ appState }, (err, api) => {
            if (err) {
                console.error(chalk.red(`❌ Login failed for token: ${token}`));
                return reject(err);
            }

            if (botSessions[token]) {
                console.log(chalk.yellow(`⚠️ Bot already running with token: ${token}`));
                return reject(new Error('Bot already running'));
            }

            botSessions[token] = { api, name, startTime, status: 'online' };
            console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
            console.log(chalk.green(`✅ ${name} is running with token: ${token}`));

            api.setOptions({ listenEvents: true });

            api.listenMqtt(async (err, event) => {
                if (err) {
                    console.error(chalk.red(`❌ Error: ${err}`));
                    botSessions[token].status = 'offline';
                    io.emit('updateBots', generateBotData());
                    return;
                }

                // Handle events
                if (event.logMessageType && events[event.logMessageType]) {
                    for (const eventHandler of events[event.logMessageType]) {
                        try {
                            await eventHandler.run({ api, event });
                            console.log(chalk.blue(`🔄 Processed event: ${eventHandler.config.name}`));
                        } catch (error) {
                            console.error(chalk.red(`❌ Error in event ${eventHandler.config.name}:`, error));
                        }
                    }
                }

                // Handle messages
                if (event.type === "message") {
                    const message = event.body ? event.body.trim() : "";
                    
                    if (!message.startsWith(prefix)) return;

                    const args = message.slice(prefix.length).trim().split(/ +/);
                    const commandName = args.shift().toLowerCase();
                    const command = commands[commandName];

                    if (command && typeof command.run === "function") {
                        try {
                            await command.run({ api, event, args });
                            console.log(chalk.green(`✅ Executed command: ${commandName}`));
                        } catch (error) {
                            console.error(chalk.red(`❌ Error in command ${commandName}:`, error));
                            api.sendMessage("❗ Command execution failed", event.threadID);
                        }
                    } else {
                        api.sendMessage("❗ Command not found", event.threadID);
                    }
                }
            });

            io.emit('updateBots', generateBotData());
            resolve();
        });
    });
}

// Start server
server.listen(PORT, () => {
    console.log(chalk.blue(`🌐 Server running at http://localhost:${PORT}`));
    console.log(chalk.green(figlet.textSync("Bot Management", { horizontalLayout: "full" })));
});
