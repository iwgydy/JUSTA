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
const PORT = process.env.PORT || 3000;

// โหลดข้อมูลผู้ใช้จาก users.json
let users = {};
if (fs.existsSync("./users.json")) {
  users = JSON.parse(fs.readFileSync("./users.json", "utf-8"));
}

// เก็บข้อมูลบอทตามผู้ใช้
const botSessions = {};

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
      const eventCommand = require(`./events/${file}`); // แก้ไขที่นี่: ลบ const fs ที่ซ้ำ
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

// CSS และ JS สำหรับแจ้งเตือน
const notificationStyles = `
  <style>
    .notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      padding: 15px 25px;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(10px);
      z-index: 1000;
      display: flex;
      align-items: center;
      animation: slideIn 0.5s ease-in-out, fadeOut 0.5s ease-in-out 4.5s;
      border-left: 5px solid;
    }
    .notification.success { border-left-color: #28a745; }
    .notification.error { border-left-color: #dc3545; }
    .notification.warning { border-left-color: #ffc107; }
    .notification i { margin-right: 10px; font-size: 1.2rem; }
    @keyframes slideIn {
      0% { transform: translateY(100px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes fadeOut {
      0% { opacity: 1; }
      100% { opacity: 0; display: none; }
    }
  </style>
`;

const notificationScript = `
  <script>
    function showNotification(message, type) {
      const notification = document.createElement('div');
      notification.className = \`notification \${type}\`;
      notification.innerHTML = \`<i class="fa-solid fa-\${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'exclamation-triangle'}"></i> \${message}\`;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
  </script>
`;

// หน้าแรก - Dashboard
app.get("/", (req, res) => {
  const user = req.query.user;
  const error = req.query.error;
  if (!user || !users[user] || !users[user].verified) {
    return res.redirect("/login");
  }
  let notification = "";
  if (error === "already-running") {
    notification = `<script>showNotification("บอทนี้ทำงานอยู่แล้ว!", "warning");</script>`;
  } else if (error === "invalid-token") {
    notification = `<script>showNotification("โทเค็นไม่ถูกต้อง! กรุณาใส่ JSON ที่มี 'appState' หรือ array ของ cookies", "error");</script>`;
  }
  return res.send(generateDashboard(user) + notification);
});

// หน้า login
app.get("/login", (req, res) => {
  const error = req.query.error;
  let notification = "";
  if (error === "invalid-credentials") {
    notification = `<script>showNotification("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง!", "error");</script>`;
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login - BotMaster</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <style>
        body {
          background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%);
          font-family: 'Poppins', sans-serif;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .login-container {
          background: rgba(255, 255, 255, 0.05);
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          width: 100%;
          max-width: 400px;
          animation: fadeIn 1s ease-in-out;
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .form-control {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #fff;
          border-radius: 10px;
        }
        .form-control:focus {
          background: rgba(255, 255, 255, 0.2);
          box-shadow: none;
          color: #fff;
        }
        .btn-primary {
          background: linear-gradient(90deg, #00ddeb, #007bff);
          border: none;
          border-radius: 10px;
          transition: transform 0.3s;
        }
        .btn-primary:hover {
          transform: scale(1.05);
        }
        h3 { font-weight: 700; text-align: center; margin-bottom: 30px; }
        a { color: #00ddeb; text-decoration: none; }
        a:hover { color: #007bff; }
      </style>
      ${notificationStyles}
    </head>
    <body>
      <div class="login-container">
        <h3><i class="fa-solid fa-robot me-2"></i> เข้าสู่ระบบ</h3>
        <form method="POST" action="/login">
          <div class="mb-3">
            <label for="username" class="form-label">ชื่อผู้ใช้</label>
            <input type="text" class="form-control" id="username" name="username" placeholder="กรอกชื่อผู้ใช้" required>
          </div>
          <div class="mb-3">
            <label for="password" class="form-label">รหัสผ่าน</label>
            <input type="password" class="form-control" id="password" name="password" placeholder="กรอกรหัสผ่าน" required>
          </div>
          <button type="submit" class="btn btn-primary w-100"><i class="fa-solid fa-sign-in-alt me-2"></i> ล็อกอิน</button>
        </form>
        <p class="text-center mt-3">ยังไม่มีบัญชี? <a href="/register">สมัครสมาชิก</a></p>
      </div>
      ${notificationScript}
      ${notification}
    </body>
    </html>
  `);
});

// หน้า register
app.get("/register", (req, res) => {
  const error = req.query.error;
  let notification = "";
  if (error === "username-taken") {
    notification = `<script>showNotification("ชื่อผู้ใช้นี้ถูกใช้แล้ว!", "error");</script>`;
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Register - BotMaster</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <style>
        body {
          background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%);
          font-family: 'Poppins', sans-serif;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .register-container {
          background: rgba(255, 255, 255, 0.05);
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          width: 100%;
          max-width: 400px;
          animation: fadeIn 1s ease-in-out;
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .form-control {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #fff;
          border-radius: 10px;
        }
        .form-control:focus {
          background: rgba(255, 255, 255, 0.2);
          box-shadow: none;
          color: #fff;
        }
        .btn-success {
          background: linear-gradient(90deg, #28a745, #00ddeb);
          border: none;
          border-radius: 10px;
          transition: transform 0.3s;
        }
        .btn-success:hover {
          transform: scale(1.05);
        }
        h3 { font-weight: 700; text-align: center; margin-bottom: 30px; }
        a { color: #00ddeb; text-decoration: none; }
        a:hover { color: #007bff; }
      </style>
      ${notificationStyles}
    </head>
    <body>
      <div class="register-container">
        <h3><i class="fa-solid fa-user-plus me-2"></i> สมัครสมาชิก</h3>
        <form method="POST" action="/register">
          <div class="mb-3">
            <label for="username" class="form-label">ชื่อผู้ใช้</label>
            <input type="text" class="form-control" id="username" name="username" placeholder="กรอกชื่อผู้ใช้" required>
          </div>
          <div class="mb-3">
            <label for="password" class="form-label">รหัสผ่าน</label>
            <input type="password" class="form-control" id="password" name="password" placeholder="กรอกรหัสผ่าน" required>
          </div>
          <button type="submit" class="btn btn-success w-100"><i class="fa-solid fa-user-check me-2"></i> สมัคร</button>
        </form>
        <p class="text-center mt-3">มีบัญชีแล้ว? <a href="/login">ล็อกอิน</a></p>
      </div>
      ${notificationScript}
      ${notification}
    </body>
    </html>
  `);
});

// หน้า verify
app.get("/verify", (req, res) => {
  const username = req.query.username;
  const error = req.query.error;
  if (!username || !users[username] || users[username].verified) {
    return res.redirect("/login");
  }
  let notification = "";
  if (error === "invalid-code") {
    notification = `<script>showNotification("รหัสยืนยันไม่ถูกต้อง!", "error");</script>`;
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify - BotMaster</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <style>
        body {
          background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%);
          font-family: 'Poppins', sans-serif;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .verify-container {
          background: rgba(255, 255, 255, 0.05);
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          width: 100%;
          max-width: 400px;
          animation: fadeIn 1s ease-in-out;
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .form-control {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #fff;
          border-radius: 10px;
        }
        .form-control:focus {
          background: rgba(255, 255, 255, 0.2);
          box-shadow: none;
          color: #fff;
        }
        .btn-primary {
          background: linear-gradient(90deg, #00ddeb, #007bff);
          border: none;
          border-radius: 10px;
          transition: transform 0.3s;
        }
        .btn-primary:hover {
          transform: scale(1.05);
        }
        h3 { font-weight: 700; text-align: center; margin-bottom: 30px; }
      </style>
      ${notificationStyles}
    </head>
    <body>
      <div class="verify-container">
        <h3><i class="fa-solid fa-shield-alt me-2"></i> ยืนยันตัวตน</h3>
        <p class="text-center">กรุณาใส่รหัส 6 หลักที่แสดงในหน้าเว็บ</p>
        <form method="POST" action="/verify">
          <input type="hidden" name="username" value="${username}">
          <div class="mb-3">
            <label for="code" class="form-label">รหัสยืนยัน</label>
            <input type="text" class="form-control" id="code" name="code" maxlength="6" placeholder="กรอกรหัส 6 หลัก" required>
          </div>
          <button type="submit" class="btn btn-primary w-100"><i class="fa-solid fa-check me-2"></i> ยืนยัน</button>
        </form>
      </div>
      ${notificationScript}
      ${notification}
    </body>
    </html>
  `);
});

// หน้าเพิ่มบอท - ขั้นตอนที่ 1 (ใส่โทเค็น)
app.post("/start", (req, res) => {
  const token = req.body.token ? req.body.token.trim() : "";
  const user = req.query.user;
  if (!user || !users[user] || !users[user].verified) {
    return res.redirect("/login");
  }
  if (!botSessions[user]) botSessions[user] = {};
  if (botSessions[user][token]) {
    return res.redirect(`/?user=${user}&error=already-running`);
  }
  if (!token) {
    return res.redirect(`/?user=${user}&error=invalid-token`);
  }

  let appState;
  try {
    const parsedToken = JSON.parse(token);
    if (Array.isArray(parsedToken)) {
      appState = { appState: parsedToken };
    } else if (parsedToken.appState && Array.isArray(parsedToken.appState)) {
      appState = parsedToken;
    } else {
      throw new Error("Invalid token format: Must be an array or object with 'appState'");
    }
  } catch (err) {
    return res.redirect(`/?user=${user}&error=invalid-token`);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bot Settings - BotMaster</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <style>
        body {
          background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%);
          font-family: 'Poppins', sans-serif;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .settings-container {
          background: rgba(255, 255, 255, 0.05);
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          width: 100%;
          max-width: 400px;
          animation: fadeIn 1s ease-in-out;
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .form-control {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #fff;
          border-radius: 10px;
        }
        .form-control:focus {
          background: rgba(255, 255, 255, 0.2);
          box-shadow: none;
          color: #fff;
        }
        .btn-success {
          background: linear-gradient(90deg, #28a745, #00ddeb);
          border: none;
          border-radius: 10px;
          transition: transform 0.3s;
        }
        .btn-success:hover {
          transform: scale(1.05);
        }
        h3 { font-weight: 700; text-align: center; margin-bottom: 30px; }
      </style>
    </head>
    <body>
      <div class="settings-container">
        <h3><i class="fa-solid fa-cog me-2"></i> ตั้งค่าบอท</h3>
        <form method="POST" action="/start-bot?user=${user}">
          <input type="hidden" name="token" value='${JSON.stringify(appState)}'>
          <div class="mb-3">
            <label for="cooldown" class="form-label">คูดาวน์ (1-10 วินาที, ไม่ใส่ = 0)</label>
            <input type="number" class="form-control" id="cooldown" name="cooldown" min="1" max="10" placeholder="0">
          </div>
          <div class="mb-3">
            <label for="prefix" class="form-label">คำนำหน้าบอท (เช่น /, #)</label>
            <input type="text" class="form-control" id="prefix" name="prefix" placeholder="/" required>
          </div>
          <button type="submit" class="btn btn-success w-100"><i class="fa-solid fa-play me-2"></i> เริ่มบอท</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// เริ่มบอท - ขั้นตอนที่ 2 (หลังใส่คูดาวน์และคำนำหน้า)
app.post("/start-bot", (req, res) => {
  const { token, cooldown, prefix } = req.body;
  const user = req.query.user;
  if (!user || !users[user] || !users[user].verified) {
    return res.redirect("/login");
  }
  const botCount = Object.keys(botSessions[user] || {}).length + 1;
  const botName = `Bot ${botCount}`;
  const startTime = Date.now();

  let appState;
  try {
    appState = JSON.parse(token);
    if (!appState.appState || !Array.isArray(appState.appState)) {
      throw new Error("Invalid token format");
    }
    const botCooldown = parseInt(cooldown) || 0;
    startBot(appState, token, botName, startTime, user, botCooldown, prefix);
    res.redirect(`/?user=${user}`);
  } catch (err) {
    res.redirect(`/?user=${user}&error=invalid-token`);
  }
});

// หน้า Console
app.get("/console", (req, res) => {
  const user = req.query.user;
  if (!user || !users[user] || !users[user].verified) {
    return res.redirect("/login");
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Console - BotMaster</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <style>
        body {
          background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%);
          font-family: 'Poppins', sans-serif;
          color: #fff;
          min-height: 100vh;
          padding: 20px;
        }
        .navbar {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }
        .navbar-brand {
          font-weight: 700;
          font-size: 1.8rem;
          color: #00ddeb;
        }
        .console-container {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 15px;
          padding: 20px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
          max-height: 80vh;
          overflow-y: auto;
        }
        .log-entry { margin: 5px 0; padding: 10px; background: rgba(0, 0, 0, 0.2); border-radius: 5px; }
        .log-success { color: #28a745; }
        .log-error { color: #dc3545; }
        .log-info { color: #00ddeb; }
      </style>
    </head>
    <body>
      <nav class="navbar navbar-expand-lg">
        <div class="container-fluid">
          <a class="navbar-brand" href="/?user=${user}"><i class="fa-solid fa-robot me-2"></i> BotMaster</a>
          <div class="d-flex">
            <a href="/?user=${user}" class="btn btn-outline-light me-2"><i class="fa-solid fa-arrow-left me-2"></i> กลับ</a>
            <a href="/login" class="btn btn-outline-light"><i class="fa-solid fa-sign-out-alt me-2"></i> ออกจากระบบ</a>
          </div>
        </div>
      </nav>
      <div class="container mt-4">
        <h3><i class="fa-solid fa-terminal me-2"></i> Console Log</h3>
        <div class="console-container" id="consoleLog"></div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        const consoleLog = document.getElementById('consoleLog');
        socket.on('consoleLog', (data) => {
          if (data.user === '${user}') {
            const logEntry = document.createElement('div');
            logEntry.className = \`log-entry log-\${data.type}\`;
            logEntry.textContent = \`[\${new Date(data.timestamp).toLocaleTimeString()}] \${data.botName}: \${data.message}\`;
            consoleLog.appendChild(logEntry);
            consoleLog.scrollTop = consoleLog.scrollHeight;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// POST login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username].password === password) {
    if (users[username].verified) {
      return res.redirect(`/?user=${username}`);
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    users[username].code = code;
    fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
    res.send(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Code</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body {
            background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%);
            font-family: 'Poppins', sans-serif;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
          }
          .code-container {
            background: rgba(255, 255, 255, 0.05);
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            text-align: center;
            animation: fadeIn 1s ease-in-out;
          }
          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(-20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          a { color: #00ddeb; text-decoration: none; }
          a:hover { color: #007bff; }
        </style>
      </head>
      <body>
        <div class="code-container">
          <h3>รหัสยืนยัน: ${code}</h3>
          <p>กรุณานำรหัสนี้ไปกรอกในหน้า <a href="/verify?username=${username}">ยืนยันตัวตน</a></p>
        </div>
      </body>
      </html>
    `);
  } else {
    res.redirect("/login?error=invalid-credentials");
  }
});

// POST register
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (users[username]) {
    return res.redirect("/register?error=username-taken");
  }
  users[username] = { password, verified: false };
  fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
  res.redirect("/login");
});

// POST verify
app.post("/verify", (req, res) => {
  const { username, code } = req.body;
  if (users[username] && users[username].code === code) {
    users[username].verified = true;
    delete users[username].code;
    fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));
    res.redirect(`/?user=${username}`);
  } else {
    res.redirect(`/verify?username=${username}&error=invalid-code`);
  }
});

// ฟังก์ชันสร้างหน้า Dashboard
function generateDashboard(user) {
  const userBots = botSessions[user] || {};
  const totalBots = Object.keys(userBots).length;
  return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BotMaster Dashboard</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          background: linear-gradient(135deg, #1e1e2f 0%, #2a2a4a 100%);
          font-family: 'Poppins', sans-serif;
          color: #fff;
          min-height: 100vh;
        }
        .navbar {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }
        .navbar-brand {
          font-weight: 700;
          font-size: 1.8rem;
          color: #00ddeb;
        }
        .container { margin-top: 40px; }
        .card {
          background: rgba(255, 255, 255, 0.05);
          border: none;
          border-radius: 15px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          transition: transform 0.3s, box-shadow 0.3s;
          backdrop-filter: blur(10px);
        }
        .card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }
        .card-body { padding: 25px; }
        .status-online { color: #28a745; font-weight: 600; }
        .status-online i { margin-right: 5px; }
        .bot-name { display: flex; align-items: center; font-weight: 500; }
        .bot-name i { margin-right: 8px; color: #00ddeb; animation: pulse 2s infinite; }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .runtime { font-weight: 500; color: #adb5bd; }
        .btn-success {
          background: linear-gradient(90deg, #28a745, #00ddeb);
          border: none;
          border-radius: 10px;
          transition: transform 0.3s;
        }
        .btn-success:hover { transform: scale(1.05); }
        .btn-outline-light { border-radius: 10px; }
        .form-control, .form-control:focus {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #fff;
          border-radius: 10px;
        }
        .footer {
          position: fixed;
          bottom: 0;
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          padding: 15px 0;
          box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.2);
        }
      </style>
      ${notificationStyles}
    </head>
    <body>
      <nav class="navbar navbar-expand-lg">
        <div class="container-fluid">
          <a class="navbar-brand" href="#"><i class="fa-solid fa-robot me-2"></i> BotMaster</a>
          <div class="d-flex">
            <a href="/console?user=${user}" class="btn btn-outline-light me-2"><i class="fa-solid fa-terminal me-2"></i> Console</a>
            <a href="/login" class="btn btn-outline-light"><i class="fa-solid fa-sign-out-alt me-2"></i> ออกจากระบบ</a>
          </div>
        </div>
      </nav>
      <div class="container">
        <div class="row mb-4">
          <div class="col-md-4 mb-3">
            <div class="card text-white">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 class="card-title">บอททั้งหมด</h5>
                    <p class="card-text display-4" id="totalBots">${totalBots}</p>
                  </div>
                  <i class="fa-solid fa-robot fa-3x" style="color: #00ddeb;"></i>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-4 mb-3">
            <div class="card text-white">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 class="card-title">บอทออนไลน์</h5>
                    <p class="card-text display-4" id="onlineBots">${totalBots}</p>
                  </div>
                  <i class="fa-solid fa-check-circle fa-3x" style="color: #28a745;"></i>
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-4 mb-3">
            <div class="card text-white">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 class="card-title">บอททำงานแล้ว</h5>
                    <p class="card-text display-4" id="activeBots">${totalBots}</p>
                  </div>
                  <i class="fa-solid fa-clock fa-3x" style="color: #ffc107;"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-lg-5 mb-4">
            <div class="card shadow">
              <div class="card-body">
                <h5 class="card-title"><i class="fa-solid fa-plus-circle me-2"></i> เพิ่มบอทใหม่</h5>
                <form method="POST" action="/start?user=${user}">
                  <div class="mb-3">
                    <label for="token" class="form-label">ใส่โทเค็นของคุณ</label>
                    <textarea id="token" name="token" class="form-control" rows="4" placeholder='{"appState": [{"key": "c_user", "value": "YOUR_ID", ...}]} หรือ array ของ cookies' required></textarea>
                  </div>
                  <button type="submit" class="btn btn-success w-100"><i class="fa-solid fa-play me-2"></i> ถัดไป</button>
                </form>
              </div>
            </div>
          </div>
          <div class="col-lg-7 mb-4">
            <div class="card shadow">
              <div class="card-body">
                <h5 class="card-title"><i class="fa-solid fa-tachometer-alt me-2"></i> บอทที่กำลังทำงาน</h5>
                <div class="table-responsive">
                  <table class="table table-hover text-white">
                    <thead style="background: rgba(255, 255, 255, 0.1);">
                      <tr>
                        <th scope="col">ชื่อบอท</th>
                        <th scope="col">สถานะ</th>
                        <th scope="col">เวลารัน</th>
                      </tr>
                    </thead>
                    <tbody id="botTableBody">
                      ${
                        totalBots > 0
                          ? Object.keys(userBots)
                              .map(
                                (token) => `
                      <tr>
                        <td><div class="bot-name"><i class="fa-solid fa-robot"></i> ${userBots[token].name}</div></td>
                        <td><span class="status-online"><i class="fa-solid fa-circle"></i> ออนไลน์</span></td>
                        <td><span class="runtime" data-start-time="${userBots[token].startTime}">00 วัน 00 ชั่วโมง 00 นาที 00 วินาที</span></td>
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
      </div>
      <footer class="footer">
        <div class="container text-center">
          <span class="text-muted">© 2024 BotMaster - All Rights Reserved</span>
        </div>
      </footer>
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
      <script src="/socket.io/socket.io.js"></script>
      <script>
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
        const socket = io();
        socket.on('updateBots', (data) => {
          if (data.user === '${user}') {
            document.getElementById('totalBots').textContent = data.totalBots;
            document.getElementById('onlineBots').textContent = data.onlineBots;
            document.getElementById('activeBots').textContent = data.activeBots;
            document.getElementById('botTableBody').innerHTML = data.botRows;
          }
        });
        document.addEventListener('DOMContentLoaded', () => {
          updateRuntime();
          setInterval(updateRuntime, 1000);
        });
      </script>
      ${notificationScript}
    </body>
    </html>
  `;
}

// ฟังก์ชันสร้างข้อมูลสำหรับ Socket.io
function generateBotData(user) {
  const userBots = botSessions[user] || {};
  const totalBots = Object.keys(userBots).length;
  const onlineBots = totalBots;
  const activeBots = totalBots;
  const botRows = totalBots > 0
    ? Object.keys(userBots)
        .map(
          (token) => `
    <tr>
      <td><div class="bot-name"><i class="fa-solid fa-robot"></i> ${userBots[token].name}</div></td>
      <td><span class="status-online"><i class="fa-solid fa-circle"></i> ออนไลน์</span></td>
      <td><span class="runtime" data-start-time="${userBots[token].startTime}">00 วัน 00 ชั่วโมง 00 นาที 00 วินาที</span></td>
    </tr>
    `
        )
        .join("")
    : `<tr><td colspan="3" class="text-center">ไม่มีบอทที่กำลังทำงาน</td></tr>`;
  return { totalBots, onlineBots, activeBots, botRows, user };
}

// ฟังก์ชันหน่วงเวลา
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ฟังก์ชันเริ่มบอท
function startBot(appState, token, name, startTime, user, cooldown, prefix) {
  login(appState, (err, api) => {
    if (err) {
      console.error(chalk.red(`❌ ไม่สามารถเข้าสู่ระบบด้วยโทเค็น: ${token}`));
      io.emit("consoleLog", {
        user,
        botName: name,
        message: `ไม่สามารถเข้าสู่ระบบด้วยโทเค็น: ${err.message}`,
        type: "error",
        timestamp: Date.now(),
      });
      return;
    }
    if (!botSessions[user]) botSessions[user] = {};
    botSessions[user][token] = { api, name, startTime, cooldown, prefix };
    console.log(chalk.green(figlet.textSync("Bot Started!", { horizontalLayout: "full" })));
    console.log(chalk.green(`✅ ${name} กำลังทำงานสำหรับผู้ใช้ ${user}`));
    io.emit("consoleLog", {
      user,
      botName: name,
      message: "บอทเริ่มทำงานแล้ว",
      type: "success",
      timestamp: Date.now(),
    });
    api.setOptions({ listenEvents: true });

    api.listenMqtt(async (err, event) => {
      if (err) {
        console.error(`❌ เกิดข้อผิดพลาด: ${err}`);
        io.emit("consoleLog", {
          user,
          botName: name,
          message: `เกิดข้อผิดพลาด: ${err.message}`,
          type: "error",
          timestamp: Date.now(),
        });
        return;
      }

      // จัดการเหตุการณ์
      if (event.logMessageType && events[event.logMessageType]) {
        for (const eventCommand of events[event.logMessageType]) {
          try {
            await eventCommand.run({ api, event });
            io.emit("consoleLog", {
              user,
              botName: name,
              message: `ประมวลผลเหตุการณ์: ${eventCommand.config.name}`,
              type: "info",
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(`❌ เกิดข้อผิดพลาดในเหตุการณ์ ${eventCommand.config.name}:`, error);
            io.emit("consoleLog", {
              user,
              botName: name,
              message: `เกิดข้อผิดพลาดในเหตุการณ์ ${eventCommand.config.name}: ${error.message}`,
              type: "error",
              timestamp: Date.now(),
            });
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
            if (cooldown > 0) await delay(cooldown * 1000);
            await command.run({ api, event, args });
            console.log(`✅ รันคำสั่ง: ${commandName}`);
            io.emit("consoleLog", {
              user,
              botName: name,
              message: `รันคำสั่ง: ${commandName}`,
              type: "success",
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(`❌ เกิดข้อผิดพลาดในคำสั่ง ${commandName}:`, error);
            io.emit("consoleLog", {
              user,
              botName: name,
              message: `เกิดข้อผิดพลาดในคำสั่ง ${commandName}: ${error.message}`,
              type: "error",
              timestamp: Date.now(),
            });
            api.sendMessage("❗ เกิดข้อผิดพลาดในการรันคำสั่ง", event.threadID);
          }
        } else {
          api.sendMessage("❗ ไม่พบคำสั่งนี้", event.threadID);
        }
      }
    });

    io.emit("updateBots", generateBotData(user));
  });
}

// เริ่มเซิร์ฟเวอร์
server.listen(PORT, () => {
  console.log(chalk.blue(`🌐 เซิร์ฟเวอร์ทำงานที่ http://localhost:${PORT}`));
});
