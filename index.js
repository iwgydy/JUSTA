const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const login = require("ryuu-fca-api");
const chalk = require("chalk");
const request = require("request");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// ไฟล์สำหรับบันทึกข้อมูลบอท
const BOT_SESSIONS_FILE = "./botSessions.json";

// เก็บข้อมูลบอท
let botSessions = {};

// โหลดข้อมูลบอทจากไฟล์เมื่อเริ่มเซิร์ฟเวอร์
function loadBotSessions() {
  if (fs.existsSync(BOT_SESSIONS_FILE)) {
    const data = fs.readFileSync(BOT_SESSIONS_FILE, "utf8");
    const savedSessions = JSON.parse(data);
    Object.keys(savedSessions).forEach((token) => {
      const session = savedSessions[token];
      startBotFromSaved(token, session.name, session.startTime, session.prefix, session.delay);
    });
    console.log(chalk.blue(`📂 โหลดข้อมูลบอทจาก ${BOT_SESSIONS_FILE}`));
  }
}

// บันทึกข้อมูลบอทลงไฟล์
function saveBotSessions() {
  const dataToSave = {};
  Object.keys(botSessions).forEach((token) => {
    const bot = botSessions[token];
    dataToSave[token] = {
      name: bot.name,
      startTime: bot.startTime,
      prefix: bot.prefix,
      delay: bot.delay,
      token: token,
    };
  });
  fs.writeFileSync(BOT_SESSIONS_FILE, JSON.stringify(dataToSave, null, 2));
  console.log(chalk.green(`💾 บันทึกข้อมูลบอทลง ${BOT_SESSIONS_FILE}`));
}

// ลบโทเค็นที่ใช้ไม่ได้
function removeInvalidToken(token) {
  if (botSessions[token]) {
    if (botSessions[token].api) {
      botSessions[token].api.stopListening();
    }
    delete botSessions[token];
    saveBotSessions();
    console.log(chalk.red(`🗑️ ลบโทเค็นที่ใช้ไม่ได้: ${token}`));
  }
}

// โหลดคำสั่งจากโฟลเดอร์ `commands`
const commands = {};
function loadCommands() {
  for (const key in commands) {
    delete commands[key];
  }
  if (!fs.existsSync("./commands")) {
    fs.mkdirSync("./commands");
    console.log(chalk.yellow(`📁 สร้างโฟลเดอร์ commands`));
  }
  const files = fs.readdirSync("./commands").filter((file) => file.endsWith(".js"));
  console.log(chalk.blue(`📦 พบไฟล์คำสั่ง ${files.length} ไฟล์: ${files.join(", ")}`));
  files.forEach((file) => {
    try {
      const filePath = `./commands/${file}`;
      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);
      if (command.config && command.config.name) {
        const commandName = command.config.name.toLowerCase();
        commands[commandName] = command;
        console.log(chalk.green(`📦 โหลดคำสั่ง: ${commandName} จาก ${file}`));
      } else {
        console.error(chalk.red(`❌ ไฟล์ ${file} ไม่มี config.name`));
      }
    } catch (err) {
      console.error(chalk.red(`❌ ไม่สามารถโหลดคำสั่ง ${file}: ${err.message}`));
    }
  });
}
loadCommands();

// โหลดเหตุการณ์จากโฟลเดอร์ `events` (ถ้ามี)
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
      }
    }
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ฟังก์ชันคำนวณระยะเวลาการทำงาน
function calculateUptime(startTime) {
  const diffMs = Date.now() - startTime;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  return `${days} วัน ${hours} ชั่วโมง ${minutes} นาที ${seconds} วินาที`;
}

// ฟังก์ชันหน่วงเวลา
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// หน้าแรก
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BotMaster</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <style>
        body { background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%); font-family: 'Arial', sans-serif; height: 100vh; display: flex; align-items: center; justify-content: center; color: #fff; }
        .container { background: rgba(255, 255, 255, 0.05); padding: 40px; border-radius: 20px; box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3); backdrop-filter: blur(10px); width: 100%; max-width: 500px; }
        .form-control, .form-select { background: rgba(255, 255, 255, 0.1); border: none; color: #fff; border-radius: 10px; }
        .form-control:focus, .form-select:focus { background: rgba(255, 255, 255, 0.2); box-shadow: none; color: #fff; }
        .btn-success { background: linear-gradient(90deg, #28a745, #00ddeb); border: none; border-radius: 10px; transition: transform 0.3s; }
        .btn-success:hover { transform: scale(1.05); }
        .btn-info { border-radius: 10px; }
        h3 { text-align: center; margin-bottom: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h3><i class="fa-solid fa-robot me-2"></i> BotMaster</h3>
        <form method="POST" action="/start-bot">
          <div class="mb-3">
            <label for="token" class="form-label">โทเค็น</label>
            <textarea id="token" name="token" class="form-control" rows="4" placeholder='{"appState": [{"key": "c_user", "value": "YOUR_ID", ...}]} หรือ array ของ cookies' required></textarea>
          </div>
          <div class="mb-3">
            <label for="prefix" class="form-label">คำนำหน้า (เช่น /, #)</label>
            <input type="text" class="form-control" id="prefix" name="prefix" placeholder="/" required>
          </div>
          <div class="mb-3">
            <label for="delay" class="form-label">ดีเลย์ในการตอบ (วินาที)</label>
            <select class="form-select" id="delay" name="delay" required>
              ${Array.from({ length: 20 }, (_, i) => i + 1)
                .map((i) => `<option value="${i}">${i}</option>`)
                .join("")}
            </select>
          </div>
          <button type="submit" class="btn btn-success w-100"><i class="fa-solid fa-play me-2"></i> เริ่มบอท</button>
        </form>
        <a href="/get-token" class="btn btn-info w-100 mt-3"><i class="fa-solid fa-key me-2"></i> รับโทเค็น</a>
        <a href="/manage-commands" class="btn btn-info w-100 mt-3"><i class="fa-solid fa-cogs me-2"></i> จัดการคำสั่ง</a>
        <a href="/bot-status" class="btn btn-info w-100 mt-3"><i class="fa-solid fa-clock me-2"></i> สถานะบอท</a>
      </div>
    </body>
    </html>
  `);
});

// หน้าใหม่สำหรับรับโทเค็น
app.get("/get-token", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>รับโทเค็น</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      <style>
        body { background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%); font-family: 'Arial', sans-serif; height: 100vh; display: flex; align-items: center; justify-content: center; color: #fff; }
        .container { background: rgba(255, 255, 255, 0.05); padding: 40px; border-radius: 20px; box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3); backdrop-filter: blur(10px); width: 100%; max-width: 500px; }
        .form-control { background: rgba(255, 255, 255, 0.1); border: none; color: #fff; border-radius: 10px; }
        .form-control:focus { background: rgba(255, 255, 255, 0.2); box-shadow: none; color: #fff; }
        .btn-success { background: linear-gradient(90deg, #28a745, #00ddeb); border: none; border-radius: 10px; transition: transform 0.3s; }
        .btn-success:hover { transform: scale(1.05); }
        .btn-secondary { border-radius: 10px; }
        h3 { text-align: center; margin-bottom: 30px; }
        #tokenOutput { background: rgba(255, 255, 255, 0.1); padding: 10px; border-radius: 10px; display: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h3><i class="fa-solid fa-key me-2"></i> รับโทเค็น</h3>
        <form id="getTokenForm">
          <div class="mb-3">
            <label for="username" class="form-label">ชื่อผู้ใช้/อีเมล</label>
            <input type="text" class="form-control" id="username" name="username" placeholder="เช่น 61550000458249" required>
          </div>
          <div class="mb-3">
            <label for="password" class="form-label">รหัสผ่าน</label>
            <input type="password" class="form-control" id="password" name="password" placeholder="เช่น mommyday" required>
          </div>
          <button type="submit" class="btn btn-success w-100"><i class="fa-solid fa-download me-2"></i> รับโทเค็น</button>
        </form>
        <div id="tokenOutput" class="mt-3">
          <label class="form-label">โทเค็นของคุณ:</label>
          <textarea class="form-control" id="tokenResult" rows="4" readonly></textarea>
          <button class="btn btn-info w-100 mt-2" onclick="copyToken()"><i class="fa-solid fa-copy me-2"></i> คัดลอกโทเค็น</button>
        </div>
        <a href="/" class="btn btn-secondary w-100 mt-3"><i class="fa-solid fa-arrow-left me-2"></i> กลับ</a>
      </div>
      <script>
        document.getElementById('getTokenForm').onsubmit = function(e) {
          e.preventDefault();
          const formData = new FormData(this);
          fetch('/fetch-token', {
            method: 'POST',
            body: formData
          }).then(response => response.json()).then(data => {
            if (data.success) {
              document.getElementById('tokenResult').value = data.token;
              document.getElementById('tokenOutput').style.display = 'block';
              Swal.fire('สำเร็จ!', 'โทเค็นถูกดึงมาเรียบร้อยแล้ว', 'success');
            } else {
              Swal.fire('เกิดข้อผิดพลาด!', data.message || 'ไม่สามารถดึงโทเค็นได้', 'error');
            }
          }).catch(err => {
            Swal.fire('เกิดข้อผิดพลาด!', 'การเชื่อมต่อล้มเหลว: ' + err.message, 'error');
          });
        };

        function copyToken() {
          const tokenText = document.getElementById('tokenResult');
          tokenText.select();
          document.execCommand('copy');
          Swal.fire('คัดลอกสำเร็จ!', 'โทเค็นถูกคัดลอกไปยังคลิปบอร์ดแล้ว', 'success');
        }
      </script>
    </body>
    </html>
  `);
});

// Endpoint ดึงโทเค็น
app.post("/fetch-token", (req, res) => {
  const { username, password } = req.body;

  const options = {
    method: "POST",
    url: "http://apifb.cyber-safe.pro:81/api/loginfacebook",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: username,
      password: password,
      twofa: false,
    }),
  };

  request(options, (error, response, body) => {
    if (error) {
      console.error(chalk.red(`❌ ข้อผิดพลาดในการเชื่อมต่อ API: ${error.message}`));
      return res.json({ success: false, message: `การเชื่อมต่อ API ล้มเหลว: ${error.message}` });
    }

    let result;
    try {
      result = JSON.parse(body);
    } catch (parseError) {
      console.error(chalk.red(`❌ ไม่สามารถ解析การตอบกลับจาก API: ${parseError.message}`));
      return res.json({ success: false, message: "การตอบกลับจาก API ไม่ถูกต้อง!" });
    }

    if (result.status === "success" && result.data && result.data.token) {
      console.log(chalk.blue(`🔑 โทเค็นที่ได้: ${JSON.stringify(result.data.token)}`));
      res.json({ success: true, token: JSON.stringify(result.data.token) });
    } else {
      console.error(chalk.red(`❌ API ตอบกลับไม่สำเร็จ: ${JSON.stringify(result)}`));
      res.json({ success: false, message: result.message || "ล็อกอินล้มเหลว!" });
    }
  });
});

// หน้าสถานะบอท
app.get("/bot-status", (req, res) => {
  const botList = Object.keys(botSessions).map((token) => {
    const bot = botSessions[token];
    return {
      token,
      name: bot.name,
      uptime: calculateUptime(bot.startTime),
      prefix: bot.prefix,
      delay: bot.delay,
    };
  });

  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>สถานะบอท</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      <style>
        body { background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%); font-family: 'Arial', sans-serif; color: #fff; padding: 20px; }
        .container { background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 20px; box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3); backdrop-filter: blur(10px); }
        .btn { border-radius: 10px; }
        .list-group-item { background: rgba(255, 255, 255, 0.1); color: #fff; }
      </style>
    </head>
    <body>
      <div class="container">
        <h3><i class="fa-solid fa-clock me-2"></i> สถานะบอท</h3>
        ${
          botList.length === 0
            ? "<p>ยังไม่มีบอทที่ทำงานอยู่</p>"
            : `
        <ul class="list-group">
          ${botList
            .map(
              (bot) => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>${bot.name}</strong><br>
                ทำงานมาแล้ว: ${bot.uptime}<br>
                คำนำหน้า: ${bot.prefix}<br>
                ดีเลย์: ${bot.delay} วินาที
              </div>
              <div>
                <button onclick="editBot('${bot.token}')" class="btn btn-warning btn-sm me-2"><i class="fa-solid fa-edit"></i> แก้ไข</button>
                <button onclick="deleteBot('${bot.token}')" class="btn btn-danger btn-sm"><i class="fa-solid fa-trash"></i> ลบ</button>
              </div>
            </li>`
            )
            .join("")}
        </ul>`
        }
        <a href="/" class="btn btn-secondary mt-3"><i class="fa-solid fa-arrow-left me-2"></i> กลับ</a>
      </div>
      <script>
        function editBot(token) {
          Swal.fire({
            title: 'แก้ไขบอท',
            html: \`
              <input id="prefix" class="form-control mb-3" placeholder="คำนำหน้าใหม่" required>
              <select id="delay" class="form-select" required>
                ${Array.from({ length: 20 }, (_, i) => i + 1)
                  .map((i) => `<option value="${i}">${i}</option>`)
                  .join("")}
              </select>
            \`,
            showCancelButton: true,
            confirmButtonText: 'บันทึก',
            cancelButtonText: 'ยกเลิก',
            preConfirm: () => {
              const prefix = document.getElementById('prefix').value;
              const delay = document.getElementById('delay').value;
              if (!prefix || !delay) {
                Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบ');
                return false;
              }
              return { prefix, delay };
            }
          }).then((result) => {
            if (result.isConfirmed) {
              fetch('/edit-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, prefix: result.value.prefix, delay: result.value.delay })
              }).then(response => {
                if (response.ok) {
                  Swal.fire('สำเร็จ!', 'บอทถูกแก้ไขแล้ว', 'success').then(() => location.reload());
                } else {
                  Swal.fire('เกิดข้อผิดพลาด!', 'ไม่สามารถแก้ไขบอทได้', 'error');
                }
              });
            }
          });
        }

        function deleteBot(token) {
          Swal.fire({
            title: 'ยืนยันการลบ?',
            text: 'คุณต้องการลบบอทนี้ใช่หรือไม่?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
          }).then((result) => {
            if (result.isConfirmed) {
              fetch('/delete-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
              }).then(response => {
                if (response.ok) {
                  Swal.fire('ลบสำเร็จ!', 'บอทถูกลบแล้ว', 'success').then(() => location.reload());
                } else {
                  Swal.fire('เกิดข้อผิดพลาด!', 'ไม่สามารถลบบอทได้', 'error');
                }
              });
            }
          });
        }
      </script>
    </body>
    </html>
  `);
});

// Endpoint แก้ไขบอท
app.post("/edit-bot", (req, res) => {
  const { token, prefix, delay } = req.body;
  if (!botSessions[token]) {
    return res.status(404).send("ไม่พบบอทนี้!");
  }
  botSessions[token].prefix = prefix;
  botSessions[token].delay = parseInt(delay);
  console.log(chalk.yellow(`✏️ แก้ไข ${botSessions[token].name}: prefix=${prefix}, delay=${delay} วินาที`));
  saveBotSessions();
  res.status(200).send("แก้ไขบอทสำเร็จ");
});

// Endpoint ลบบอท
app.post("/delete-bot", (req, res) => {
  const { token } = req.body;
  if (!botSessions[token]) {
    return res.status(404).send("ไม่พบบอทนี้!");
  }
  botSessions[token].api.stopListening();
  delete botSessions[token];
  console.log(chalk.red(`🗑️ ลบบอทสำเร็จ: token=${token}`));
  saveBotSessions();
  res.status(200).send("ลบบอทสำเร็จ");
});

// หน้าจัดการคำสั่ง
app.get("/manage-commands", (req, res) => {
  loadCommands();
  const commandList = Object.keys(commands).map((name) => ({
    name,
    description: commands[name].config.description || "ไม่มีคำอธิบาย",
  }));

  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>จัดการคำสั่ง</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      <style>
        body { background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%); font-family: 'Arial', sans-serif; color: #fff; padding: 20px; }
        .container { background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 20px; box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3); backdrop-filter: blur(10px); }
        .form-control { background: rgba(255, 255, 255, 0.1); border: none; color: #fff; border-radius: 10px; }
        .btn { border-radius: 10px; }
        textarea.form-control { min-height: 300px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h3><i class="fa-solid fa-cogs me-2"></i> จัดการคำสั่ง</h3>
        <form method="POST" action="/add-command" class="mb-4">
          <div class="mb-3">
            <label for="commandName" class="form-label">ชื่อคำสั่ง</label>
            <input type="text" class="form-control" id="commandName" name="commandName" required>
          </div>
          <div class="mb-3">
            <label for="commandCode" class="form-label">โค้ดคำสั่ง (JavaScript)</label>
            <textarea class="form-control" id="commandCode" name="commandCode" rows="10" required></textarea>
          </div>
          <button type="submit" class="btn btn-success"><i class="fa-solid fa-plus me-2"></i> เพิ่มคำสั่ง</button>
        </form>
        <h4>คำสั่งทั้งหมด</h4>
        <ul class="list-group">
          ${commandList
            .map(
              (cmd) => `
            <li class="list-group-item d-flex justify-content-between align-items-center" style="background: rgba(255, 255, 255, 0.1); color: #fff;">
              ${cmd.name} - ${cmd.description}
              <div>
                <a href="/edit-command/${cmd.name}" class="btn btn-warning btn-sm me-2"><i class="fa-solid fa-edit"></i> แก้ไข</a>
                <button onclick="deleteCommand('${cmd.name}')" class="btn btn-danger btn-sm"><i class="fa-solid fa-trash"></i> ลบ</button>
              </div>
            </li>`
            )
            .join("")}
        </ul>
        <a href="/" class="btn btn-secondary mt-3"><i class="fa-solid fa-arrow-left me-2"></i> กลับ</a>
      </div>
      <script>
        function deleteCommand(commandName) {
          Swal.fire({
            title: 'ยืนยันการลบ?',
            text: 'คุณต้องการลบคำสั่ง ' + commandName + ' ใช่หรือไม่?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
          }).then((result) => {
            if (result.isConfirmed) {
              fetch('/delete-command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'commandName=' + encodeURIComponent(commandName)
              }).then(response => response.text()).then(data => {
                if (data === "ลบคำสั่งสำเร็จ") {
                  Swal.fire('ลบสำเร็จ!', 'คำสั่ง ' + commandName + ' ถูกลบแล้ว', 'success').then(() => location.reload());
                } else {
                  Swal.fire('เกิดข้อผิดพลาด!', data, 'error');
                }
              });
            }
          });
        }
      </script>
    </body>
    </html>
  `);
});

// หน้าแก้ไขคำสั่ง
app.get("/edit-command/:commandName", (req, res) => {
  const commandName = req.params.commandName.toLowerCase();
  const commandFile = `./commands/${commandName}.js`;
  if (!fs.existsSync(commandFile)) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>ข้อผิดพลาด</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body { background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%); color: #fff; padding: 20px; text-align: center; }
          .container { background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h3>ไม่พบคำสั่งนี้!</h3>
          <p>คำสั่ง "${commandName}" ไม่มีอยู่ในระบบ</p>
          <a href="/manage-commands" class="btn btn-secondary">กลับไปจัดการคำสั่ง</a>
        </div>
      </body>
      </html>
    `);
  }
  const commandCode = fs.readFileSync(commandFile, "utf8");

  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>แก้ไขคำสั่ง: ${commandName}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      <style>
        body { background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%); font-family: 'Arial', sans-serif; color: #fff; padding: 20px; }
        .container { background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 20px; box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3); backdrop-filter: blur(10px); }
        .form-control { background: rgba(255, 255, 255, 0.1); border: none; color: #fff; border-radius: 10px; }
        .btn { border-radius: 10px; }
        textarea.form-control { min-height: 400px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h3><i class="fa-solid fa-edit me-2"></i> แก้ไขคำสั่ง: ${commandName}</h3>
        <form id="editForm" method="POST" action="/update-command">
          <input type="hidden" name="commandName" value="${commandName}">
          <div class="mb-3">
            <label for="commandCode" class="form-label">โค้ดคำสั่ง</label>
            <textarea class="form-control" id="commandCode" name="commandCode" rows="15" required>${commandCode}</textarea>
          </div>
          <button type="submit" class="btn btn-success"><i class="fa-solid fa-save me-2"></i> บันทึก</button>
          <a href="/manage-commands" class="btn btn-secondary"><i class="fa-solid fa-arrow-left me-2"></i> กลับ</a>
        </form>
      </div>
      <script>
        document.getElementById('editForm').onsubmit = function(e) {
          e.preventDefault();
          const formData = new FormData(this);
          fetch('/update-command', {
            method: 'POST',
            body: formData
          }).then(response => response.text()).then(data => {
            if (data === "อัปเดตคำสั่งสำเร็จ") {
              Swal.fire('บันทึกสำเร็จ!', 'คำสั่ง ${commandName} ถูกอัปเดตแล้ว', 'success').then(() => window.location.href = '/manage-commands');
            } else {
              Swal.fire('เกิดข้อผิดพลาด!', data, 'error');
            }
          });
        };
      </script>
    </body>
    </html>
  `);
});

// เพิ่มคำสั่งใหม่
app.post("/add-command", (req, res) => {
  const { commandName, commandCode } = req.body;
  const filePath = `./commands/${commandName.toLowerCase()}.js`;
  if (fs.existsSync(filePath)) {
    return res.status(400).send("คำสั่งนี้มีอยู่แล้ว!");
  }
  try {
    fs.writeFileSync(filePath, commandCode);
    loadCommands();
    res.redirect("/manage-commands");
  } catch (err) {
    res.status(500).send(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
  }
});

// อัปเดตคำสั่ง
app.post("/update-command", (req, res) => {
  const { commandName, commandCode } = req.body;
  const filePath = `./commands/${commandName.toLowerCase()}.js`;
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("ไม่พบคำสั่งนี้!");
  }
  try {
    fs.writeFileSync(filePath, commandCode);
    loadCommands();
    res.status(200).send("อัปเดตคำสั่งสำเร็จ");
  } catch (err) {
    res.status(500).send(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
  }
});

// ลบคำสั่ง
app.post("/delete-command", (req, res) => {
  const { commandName } = req.body;
  const filePath = `./commands/${commandName.toLowerCase()}.js`;
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("ไม่พบคำสั่งนี้!");
  }
  try {
    fs.unlinkSync(filePath);
    delete commands[commandName.toLowerCase()];
    loadCommands();
    res.status(200).send("ลบคำสั่งสำเร็จ");
  } catch (err) {
    res.status(500).send(`เกิดข้อผิดพลาดในการลบ: ${err.message}`);
  }
});

// เริ่มบอท
app.post("/start-bot", (req, res) => {
  const { token, prefix, delay } = req.body;

  let appState;
  try {
    const parsedToken = JSON.parse(token);
    if (Array.isArray(parsedToken)) {
      appState = { appState: parsedToken };
    } else if (parsedToken.appState && Array.isArray(parsedToken.appState)) {
      appState = parsedToken;
    } else {
      throw new Error("Invalid token format");
    }
    const botName = `Bot ${Object.keys(botSessions).length + 1}`;
    const startTime = Date.now();
    startBot(appState, token, botName, startTime, prefix, parseInt(delay), (loginErr) => {
      if (loginErr) {
        console.error(chalk.red(`❌ ล็อกอินด้วยโทเค็นล้มเหลว: ${loginErr.message}`));
        removeInvalidToken(token);
        return res.send(`ล็อกอินด้วยโทเค็นล้มเหลว: ${loginErr.message}`);
      }
      saveBotSessions();
      res.send("บอทเริ่มทำงานแล้ว! กรุณาตรวจสอบ console หรือปิดหน้าเว็บนี้ได้เลย");
    });
  } catch (err) {
    return res.send("โทเค็นไม่ถูกต้อง! กรุณาใส่ JSON ที่มี 'appState' หรือ array ของ cookies");
  }
});

// ฟังก์ชันเริ่มบอท
function startBot(appState, token, name, startTime, prefix, delaySeconds, callback) {
  login(appState, (err, api) => {
    if (err) {
      console.error(chalk.red(`❌ ล็อกอินล้มเหลวสำหรับ ${name}: ${err.message}`));
      removeInvalidToken(token);
      if (callback) callback(err);
      return;
    }
    botSessions[token] = { api, name, startTime, prefix, delay: delaySeconds };
    console.log(chalk.green(`✅ ${name} กำลังทำงาน (prefix: ${prefix}, delay: ${delaySeconds} วินาที)`));

    api.setOptions({ listenEvents: true });
    api.listenMqtt(async (err, event) => {
      if (err) {
        console.error(`❌ เกิดข้อผิดพลาด: ${err}`);
        return;
      }

      if (event.logMessageType && events[event.logMessageType]) {
        for (const eventCommand of events[event.logMessageType]) {
          try {
            await eventCommand.run({ api, event });
            console.log(`🔔 ประมวลผลเหตุการณ์: ${eventCommand.config.name}`);
          } catch (error) {
            console.error(`❌ เกิดข้อผิดพลาดในเหตุการณ์ ${eventCommand.config.name}:`, error);
          }
        }
      }

      if (event.type === "message") {
        const message = event.body ? event.body.trim() : "";
        if (!message.startsWith(prefix)) return;

        const args = message.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = commands[commandName];

        if (command && typeof command.run === "function") {
          try {
            await delay(delaySeconds * 1000);
            await command.run({ api, event, args });
            console.log(`✅ รันคำสั่ง: ${commandName} (ดีเลย์ ${delaySeconds} วินาที)`);
          } catch (error) {
            console.error(`❌ เกิดข้อผิดพลาดในคำสั่ง ${commandName}:`, error);
            api.sendMessage("❗ เกิดข้อผิดพลาดในการรันคำสั่ง", event.threadID);
          }
        } else {
          await delay(delaySeconds * 1000);
          api.sendMessage(`❗ ไม่พบคำสั่ง "${commandName}"`, event.threadID);
        }
      }
    });
    if (callback) callback(null);
  });
}

// ฟังก์ชันเริ่มบอทจากข้อมูลที่บันทึก
function startBotFromSaved(token, name, startTime, prefix, delaySeconds) {
  let appState;
  try {
    const parsedToken = JSON.parse(token);
    if (Array.isArray(parsedToken)) {
      appState = { appState: parsedToken };
    } else if (parsedToken.appState && Array.isArray(parsedToken.appState)) {
      appState = parsedToken;
    } else {
      throw new Error("Invalid token format");
    }
    startBot(appState, token, name, startTime, prefix, delaySeconds, (err) => {
      if (err) {
        console.error(chalk.red(`❌ ไม่สามารถเริ่ม ${name} จากข้อมูลที่บันทึก: ${err.message}`));
      }
    });
  } catch (err) {
    console.error(chalk.red(`❌ โทเค็นไม่ถูกต้องสำหรับ ${name}: ${err.message}`));
    removeInvalidToken(token);
  }
}

// โหลดข้อมูลบอทเมื่อเริ่มเซิร์ฟเวอร์
loadBotSessions();

// เริ่มเซิร์ฟเวอร์
server.listen(PORT, () => {
  console.log(chalk.blue(`🌐 เซิร์ฟเวอร์ทำงานที่ http://localhost:${PORT}`));
});
