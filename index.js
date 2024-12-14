const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const login = require("ryuu-fca-api");
const chalk = require("chalk");
const figlet = require("figlet");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3005; // เปลี่ยนพอร์ตเป็น 3005

let botCount = 0; // ตัวนับจำนวนบอท
const botSessions = {}; // เก็บสถานะ ชื่อ และเวลาเริ่มต้นของบอทแต่ละตัวตามโทเค็น
const prefix = "/"; // คำนำหน้าคำสั่ง

// โหลดคำสั่งจากโฟลเดอร์ `commands`
const commands = {};
if (fs.existsSync("./commands")) {
  fs.readdirSync("./commands").forEach((file) => {
    if (file.endsWith(".js")) {
      const command = require(`./commands/${file}`);
      if (command.config && command.config.name) {
        commands[command.config.name.toLowerCase()] = command;
        console.log(`📦 โหลดคำสั่ง: ${command.config.name}`);
      } else {
        console.log(`⚠️ ไฟล์คำสั่ง "${file}" ไม่มี config หรือ name`);
      }
    }
  });
}

// โหลดเหตุการณ์จากโฟลเดอร์ `events`
const events = {};
if (fs.existsSync("./events")) {
  fs.readdirSync("./events").forEach((file) => {
    if (file.endsWith(".js")) {
      const eventCommand = require(`./events/${file}`);
      if (eventCommand.config && eventCommand.config.eventType) {
        eventCommand.config.eventType.forEach((type) => {
          if (!events[type]) events[type] = [];
          events[type].push(eventCommand);
        });
        console.log(`🔔 โหลดเหตุการณ์: ${file}`);
      } else {
        console.log(`⚠️ ไฟล์เหตุการณ์ "${file}" ไม่มี config หรือ eventType`);
      }
    }
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// หน้าแสดงสถานะบอท
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
      <title>Bot Management</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Poppins:wght@400;600&display=swap" rel="stylesheet">
      <style>
        body {
          background-color: #f0f2f5;
          font-family: 'Poppins', sans-serif;
          transition: background-color 0.3s, color 0.3s;
        }
        .navbar-brand {
          font-family: 'Roboto', sans-serif;
          font-weight: bold;
          font-size: 1.8rem;
        }
        .container {
          margin-top: 40px;
        }
        .status-online {
          color: #28a745;
          font-weight: bold;
        }
        .status-online i {
          color: #28a745;
          margin-right: 5px;
        }
        .status-offline {
          color: #dc3545;
          font-weight: bold;
        }
        .status-offline i {
          color: #dc3545;
          margin-right: 5px;
        }
        .bot-table th, .bot-table td {
          vertical-align: middle;
        }
        .bot-name {
          display: flex;
          align-items: center;
          font-weight: 500;
        }
        .bot-name i {
          margin-right: 8px;
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
          0% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
          100% { transform: translateY(0); }
        }
        .runtime {
          font-weight: 500;
          color: #6c757d;
        }
        .card {
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }
        .footer {
          position: fixed;
          bottom: 0;
          width: 100%;
          height: 60px;
          background-color: #f8f9fa;
        }
        /* Dark Mode Styles */
        body.dark-mode {
          background-color: #121212;
          color: #ffffff;
        }
        body.dark-mode .card {
          background-color: #1e1e1e;
          color: #ffffff;
          box-shadow: 0 4px 8px rgba(255,255,255,0.1);
        }
        body.dark-mode .navbar {
          background-color: #1f1f1f;
        }
        body.dark-mode .footer {
          background-color: #1f1f1f;
        }
        body.dark-mode .status-online {
          color: #28a745;
        }
        body.dark-mode .status-offline {
          color: #dc3545;
        }
        body.dark-mode .bot-name i {
          color: #28a745;
        }
        body.dark-mode .runtime {
          color: #adb5bd;
        }
        .toggle-switch {
          cursor: pointer;
          transition: color 0.3s;
        }
        .toggle-switch:hover {
          color: #ffc107;
        }
        /* Chart Container */
        .chart-container {
          position: relative;
          height: 400px;
          width: 100%;
        }
      </style>
    </head>
    <body>
      <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container-fluid">
          <a class="navbar-brand" href="#">🤖 Bot Management</a>
          <div class="d-flex">
            <i class="fa-solid fa-moon toggle-switch" id="darkModeToggle"></i>
          </div>
        </div>
      </nav>

      <div class="container">
        <!-- Dashboard Statistics -->
        <div class="row mb-4">
          <div class="col-md-4 mb-3">
            <div class="card text-white bg-primary">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 class="card-title">บอททั้งหมด</h5>
                    <p class="card-text display-4" id="totalBots">${totalBots}</p>
                  </div>
                  <i class="fa-solid fa-robot fa-3x"></i>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-4 mb-3">
            <div class="card text-white bg-success">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 class="card-title">บอทออนไลน์</h5>
                    <p class="card-text display-4" id="onlineBots">${onlineBots}</p>
                  </div>
                  <i class="fa-solid fa-check-circle fa-3x"></i>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-4 mb-3">
            <div class="card text-white bg-warning">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 class="card-title">บอททำงานแล้ว</h5>
                    <p class="card-text display-4" id="activeBots">${activeBots}</p>
                  </div>
                  <i class="fa-solid fa-clock fa-3x"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="row">
          <!-- ฟอร์มเพิ่มบอทใหม่ -->
          <div class="col-lg-5 mb-4">
            <div class="card shadow">
              <div class="card-body">
                <h5 class="card-title"><i class="fa-solid fa-plus-circle"></i> เพิ่มบอทใหม่</h5>
                <form method="POST" action="/start">
                  <div class="mb-3">
                    <label for="token" class="form-label">ใส่โทเค็นของคุณ</label>
                    <textarea id="token" name="token" class="form-control" rows="4" placeholder='{"appState": "YOUR_APP_STATE"}' required></textarea>
                  </div>
                  <button type="submit" class="btn btn-success w-100"><i class="fa-solid fa-play"></i> เริ่มบอท</button>
                </form>
              </div>
            </div>
          </div>

          <!-- ตารางแสดงบอทที่กำลังทำงาน -->
          <div class="col-lg-7 mb-4">
            <div class="card shadow">
              <div class="card-body">
                <h5 class="card-title"><i class="fa-solid fa-tachometer-alt-fast"></i> บอทที่กำลังทำงาน</h5>
                <div class="table-responsive">
                  <table class="table table-hover bot-table">
                    <thead class="table-dark">
                      <tr>
                        <th scope="col">ชื่อบอท</th>
                        <th scope="col">สถานะ</th>
                        <th scope="col">เวลารัน</th>
                      </tr>
                    </thead>
                    <tbody id="botTableBody">
                      ${
                        Object.keys(botSessions).length > 0
                          ? Object.keys(botSessions)
                              .map(
                                (token) => `
                      <tr>
                        <td>
                          <div class="bot-name">
                            <i class="fa-solid fa-robot"></i> ${botSessions[token].name}
                          </div>
                        </td>
                        <td>
                          <span class="${botSessions[token].status === 'online' ? 'status-online' : 'status-offline'}"><i class="fa-solid fa-circle"></i> ${botSessions[token].status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}</span>
                        </td>
                        <td>
                          <span class="runtime" data-start-time="${botSessions[token].startTime}">00 วัน 00 ชั่วโมง 00 นาที 00 วินาที</span>
                        </td>
                      </tr>
                      `
                              )
                              .join("")
                          : `<tr><td colspan="3" class="text-center">ไม่มีบอทที่กำลังทำงาน</td></tr>`
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- แผนภูมิแสดงสถิติ -->
        <div class="row">
          <div class="col-12">
            <div class="card shadow">
              <div class="card-body">
                <h5 class="card-title"><i class="fa-solid fa-chart-line"></i> สถิติบอท</h5>
                <div class="chart-container">
                  <canvas id="botChart"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer class="footer py-3 bg-light">
        <div class="container text-center">
          <span class="text-muted">&copy; 2024 Bot Management System</span>
        </div>
      </footer>

      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script src="/socket.io/socket.io.js"></script>
      <script>
        // สลับโหมดมืด
        const toggleSwitch = document.getElementById('darkModeToggle');
        toggleSwitch.addEventListener('click', () => {
          document.body.classList.toggle('dark-mode');
          toggleSwitch.classList.toggle('fa-sun');
        });

        // ฟังก์ชันอัปเดตเวลารัน
        function updateRuntime() {
          const runtimeElements = document.querySelectorAll('.runtime');
          const now = Date.now();

          runtimeElements.forEach(el => {
            const startTime = parseInt(el.getAttribute('data-start-time'));
            const elapsed = now - startTime;

            const seconds = Math.floor((elapsed / 1000) % 60);
            const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
            const hours = Math.floor((elapsed / (1000 * 60 * 60)) % 24);
            const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));

            el.textContent = \`\${days.toString().padStart(2, '0')} วัน \${hours.toString().padStart(2, '0')} ชั่วโมง \${minutes.toString().padStart(2, '0')} นาที \${seconds.toString().padStart(2, '0')} วินาที\`;
          });
        }

        // ฟังก์ชันอัปเดตสถิติในกราฟ
        function updateChart(data) {
          botChart.data.labels = data.labels;
          botChart.data.datasets[0].data = data.values;
          botChart.update();
        }

        // สร้างกราฟ
        const ctx = document.getElementById('botChart').getContext('2d');
        window.botChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: [], // เวลาที่เก็บไว้
            datasets: [{
              label: 'จำนวนบอทที่กำลังทำงาน',
              data: [],
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: 'rgba(54, 162, 235, 1)',
              pointRadius: 5,
              pointHoverRadius: 7,
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: {
                display: true,
                labels: {
                  font: {
                    size: 14
                  }
                }
              },
              tooltip: {
                enabled: true
              }
            },
            scales: {
              x: {
                type: 'time',
                time: {
                  unit: 'minute',
                  displayFormats: {
                    minute: 'HH:mm'
                  }
                },
                title: {
                  display: true,
                  text: 'เวลา',
                  font: {
                    size: 16
                  }
                }
              },
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'จำนวนบอท',
                  font: {
                    size: 16
                  }
                }
              }
            }
          }
        });

        // เชื่อมต่อกับ Socket.io
        const socket = io();

        // รับข้อมูลอัปเดตจำนวนบอทจากเซิร์ฟเวอร์
        socket.on('updateBots', (data) => {
          document.getElementById('totalBots').textContent = data.totalBots;
          document.getElementById('onlineBots').textContent = data.onlineBots;
          document.getElementById('activeBots').textContent = data.activeBots;
          updateChart(data.chartData);
          // อัปเดตตารางบอท
          const botTableBody = document.getElementById('botTableBody');
          botTableBody.innerHTML = data.botRows;
        });

        // อัปเดตเวลาเริ่มต้นเมื่อโหลดหน้า
        document.addEventListener('DOMContentLoaded', () => {
          updateRuntime();
          setInterval(updateRuntime, 1000);
        });
      </script>
    </body>
    </html>
  `);
});

// เริ่มบอทเมื่อมีการใส่โทเค็น
app.post("/start", async (req, res) => {
  const token = req.body.token.trim();

  // ตรวจสอบว่าโทเค็นนี้ถูกใช้แล้วหรือไม่
  if (botSessions[token]) {
    return res.redirect("/?error=already-running");
  }

  botCount += 1;
  const botName = `Bot ${botCount}`;
  const startTime = Date.now(); // เวลาเริ่มต้นในรูปแบบ UNIX timestamp

  try {
    const appState = JSON.parse(token);
    await startBot(appState, token, botName, startTime);
    res.redirect("/");
    // อัปเดตสถิติผ่าน Socket.io
    io.emit('updateBots', generateBotData());
  } catch (err) {
    console.error(chalk.red(`❌ ไม่สามารถเริ่มบอท: ${err.message}`));
    botCount -= 1; // ลดจำนวนบอทหากเกิดข้อผิดพลาด
    res.redirect("/?error=invalid-token");
  }
});

// ฟังก์ชันสร้างข้อมูลสำหรับ Socket.io
function generateBotData() {
  const totalBots = Object.keys(botSessions).length;
  const onlineBots = Object.values(botSessions).filter(bot => bot.status === 'online').length;
  const activeBots = Object.values(botSessions).filter(bot => bot.status === 'active').length;
  const botRows = Object.keys(botSessions).length > 0
    ? Object.keys(botSessions)
        .map(
          (token) => `
    <tr>
      <td>
        <div class="bot-name">
          <i class="fa-solid fa-robot"></i> ${botSessions[token].name}
        </div>
      </td>
      <td>
        <span class="${botSessions[token].status === 'online' ? 'status-online' : 'status-offline'}"><i class="fa-solid fa-circle"></i> ${botSessions[token].status === 'online' ? 'ออนไลน์' : 'ออฟไลน์'}</span>
      </td>
      <td>
        <span class="runtime" data-start-time="${botSessions[token].startTime}">00 วัน 00 ชั่วโมง 00 นาที 00 วินาที</span>
      </td>
    </tr>
    `
        )
        .join("")
    : `<tr><td colspan="3" class="text-center">ไม่มีบอทที่กำลังทำงาน</td></tr>`;

  // สร้างข้อมูลกราฟ (ตัวอย่าง: เก็บข้อมูลจริงจากบอทของคุณได้)
  // ในตัวอย่างนี้เราจะใช้ข้อมูลสุ่มสำหรับแสดงตัวอย่าง
  const chartData = {
    labels: Array.from({ length: 10 }, (_, i) => new Date(Date.now() - (10 - i) * 60000).toLocaleTimeString()), // เวลาตั้งแต่ 10 นาทีที่แล้วจนถึงปัจจุบัน
    values: Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)) // จำนวนบอทสุ่ม
  };

  return { totalBots, onlineBots, activeBots, botRows, chartData };
}

// ฟังก์ชันเริ่มบอท
async function startBot(appState, token, name, startTime) {
  return new Promise((resolve, reject) => {
    login({ appState }, (err, api) => {
      if (err) {
        console.error(chalk.red(`❌ ไม่สามารถเข้าสู่ระบบด้วยโทเค็น: ${token}`));
        return reject(err);
      }

      // ตรวจสอบว่าบอทนี้กำลังทำงานอยู่แล้วหรือไม่
      if (botSessions[token]) {
        console.log(chalk.yellow(`⚠️ บอทด้วยโทเค็นนี้กำลังทำงานอยู่แล้ว: ${token}`));
        return reject(new Error('Bot already running with this token'));
      }

      botSessions[token] = { api, name, startTime, status: 'online' };
      console.log(
        chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" }))
      );
      console.log(chalk.green(`✅ ${name} กำลังทำงานสำหรับโทเค็น: ${token}`));

      api.setOptions({ listenEvents: true });

      api.listenMqtt(async (err, event) => {
        if (err) {
          console.error(`❌ เกิดข้อผิดพลาด: ${err}`);
          botSessions[token].status = 'offline';
          io.emit('updateBots', generateBotData());
          return;
        }

        // จัดการเหตุการณ์
        if (event.logMessageType && events[event.logMessageType]) {
          for (const eventCommand of events[event.logMessageType]) {
            try {
              await eventCommand.run({ api, event });
              console.log(`🔄 ประมวลผลเหตุการณ์: ${eventCommand.config.name}`);
            } catch (error) {
              console.error(`❌ เกิดข้อผิดพลาดในเหตุการณ์ ${eventCommand.config.name}:`, error);
            }
          }
        }

        // จัดการข้อความ
        if (event.type === "message") {
          const senderID = event.senderID;
          const message = event.body ? event.body.trim() : "";

          if (!message.startsWith(prefix)) return;

          const args = message.slice(prefix.length).trim().split(/ +/);
          const commandName = args.shift().toLowerCase();
          const command = commands[commandName];

          if (command && typeof command.run === "function") {
            try {
              await command.run({ api, event, args });
              console.log(`✅ รันคำสั่ง: ${commandName}`);
            } catch (error) {
              console.error(`❌ เกิดข้อผิดพลาดในคำสั่ง ${commandName}:`, error);
              api.sendMessage("❗ เกิดข้อผิดพลาดในการรันคำสั่ง", event.threadID);
            }
          } else {
            api.sendMessage("❗ ไม่พบคำสั่งนี้", event.threadID);
          }
        }
      });

      // อัปเดตสถิติผ่าน Socket.io เมื่อเริ่มบอท
      io.emit('updateBots', generateBotData());
      resolve();
    });
  });
}

// ฟังก์ชันหยุดบอท
app.post("/stop", (req, res) => {
  const token = req.body.token;

  if (botSessions[token]) {
    botSessions[token].api.logout();
    botSessions[token].status = 'offline'; // เปลี่ยนสถานะเป็นออฟไลน์ก่อนที่จะลบ
    delete botSessions[token];
    res.redirect("/");
    // อัปเดตสถิติผ่าน Socket.io
    io.emit('updateBots', generateBotData());
  } else {
    res.redirect("/?error=not-found");
  }
});

// เริ่มเซิร์ฟเวอร์
server.listen(PORT, () => {
  console.log(chalk.blue(`🌐 เซิร์ฟเวอร์ทำงานที่ http://localhost:${PORT}`));
});
