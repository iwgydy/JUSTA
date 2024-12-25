// นำเข้าโมดูลที่จำเป็น
const TelegramBot = require('node-telegram-bot-api');
const request = require('request').defaults({ jar: true });
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// ใส่โทเคนบอท Telegram ของคุณที่นี่
const token = '7762209808:AAG1ziCcQt5vrT7IqA1VsKVFWkHiVbEov68'; // แทนที่ด้วยโทเคนของคุณ

// สร้างบอทที่ใช้ 'polling' ในการรับข้อความใหม่
const bot = new TelegramBot(token, { polling: true });

// เก็บสถานะของผู้ใช้ในการสนทนา
const userSessions = {};

// เบอร์มือถือที่ใช้ในการรับเงิน
const mobileNumber = '';

// เก็บชื่อผู้ใช้ของบอท
let botUsername = '';
bot.getMe().then((botInfo) => {
  botUsername = botInfo.username;
});

// ฟังก์ชันสำหรับแรนดอม UUID
function generateUUID() {
  return uuidv4();
}

// ฟังก์ชันสำหรับสร้างเวลา expiryTime (ตามจำนวนวันที่กำหนด)
function generateExpiryTime(days) {
  const now = new Date();
  const expiryDate = new Date(now.setDate(now.getDate() + days));
  return expiryDate.getTime();
}

// ฟังก์ชันสำหรับเข้าสู่ระบบ (รองรับหลาย VPS)
function login(vpsType, callback) {
  let loginOptions = {
    method: 'POST',
    url: '', // จะกำหนดตาม vpsType
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {}
  };

  // กำหนด URL และข้อมูลเข้าสู่ระบบตามประเภทของ VPS
  if (vpsType === 'xvre') {
    loginOptions.url = 'http://IaSIr/login';
    loginOptions.form = {
      'username': '',
      'password': ''
    };
  } else if (vpsType === 'idc') {
    loginOptions.url = 'http://www.open/login';
    loginOptions.form = {
      'username': '',
      'password': ''
    };
  } else {
    console.error('Unknown VPS type:', vpsType);
    callback(new Error('Unknown VPS type'));
    return;
  }

  request(loginOptions, function (error, response) {
    if (error) {
      console.error('เกิดข้อผิดพลาดในการเข้าสู่ระบบ:', error);
      callback(error);
      return;
    }
    try {
      const body = JSON.parse(response.body);
      if (body.success) {
        console.log('เข้าสู่ระบบสำเร็จ:', body.msg);
        callback(null); // เรียกใช้ฟังก์ชันถัดไป
      } else {
        console.log('เข้าสู่ระบบล้มเหลว:', body.msg);
        callback(new Error(body.msg));
      }
    } catch (e) {
      console.error('ไม่สามารถแปลงข้อมูลการตอบกลับเป็น JSON ได้:', e);
      console.log('Response Body:', response.body);
      callback(e);
    }
  });
}

// ฟังก์ชันสำหรับเพิ่มลูกค้าใหม่ (รองรับหลาย VPS)
function addNewClient(session, successCallback, errorCallback) {
  const clientUUID = generateUUID();
  const expiryTime = generateExpiryTime(session.days);
  const totalGB = session.gbLimit > 0 ? session.gbLimit * 1024 * 1024 * 1024 : 0; // Convert GB to bytes

  // กำหนด API URL และ settings ตามประเภทของ VPS และโปรไฟล์
  let apiUrl = '';
  let apiSettings = {};

  if (session.vpsType === 'xvre') {
    apiUrl = 'http://botunds/addClient';
    apiSettings = {
      clients: [{
        id: clientUUID,
        alterId: 0,
        email: session.codeName, // ใช้ชื่อที่ผู้ใช้ตั้ง
        limitIp: 2,
        totalGB: totalGB > 0 ? totalGB : 0,
        expiryTime: expiryTime,
        enable: true,
        tgId: '',
        subId: ''
      }]
    };
  } else if (session.vpsType === 'idc') {
    apiUrl = 'http://ounds/addClient';
    apiSettings = {
      clients: [{
        id: clientUUID,
        alterId: 0,
        email: session.codeName, // ใช้ชื่อที่ผู้ใช้ตั้ง
        limitIp: 2,
        totalGB: totalGB > 0 ? totalGB : 0,
        expiryTime: expiryTime,
        enable: true,
        tgId: '',
        subId: ''
      }]
    };
  } else {
    console.error('Unknown VPS type in session:', session.vpsType);
    errorCallback('Unknown VPS type');
    return;
  }

  const options = {
    method: 'POST',
    url: apiUrl,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: session.apiId, // ใช้ id ตามประเภทของลูกค้า
      settings: JSON.stringify(apiSettings)
    })
  };

  request(options, function (error, response) {
    if (error) {
      console.error('เกิดข้อผิดพลาดในการส่งคำขอ:', error);
      errorCallback('เกิดข้อผิดพลาดในการส่งคำขอ');
      return;
    }
    try {
      const body = JSON.parse(response.body);
      if (body.success) {
        console.log('เพิ่มลูกค้าสำเร็จ:', body.msg);
        // สร้างโค้ดตามที่ต้องการ
        let clientCode = '';
        if (session.vpsType === 'xvre') {
          if (session.type === 'true_pro_facebook') {
            clientCode = `vless://${clientUUID}@botvipicopc.vipv2boxth.xyz:2052?type=ws&path=%2F&host=botvipicopc.vipv2boxth.xyz&security=none#${encodeURIComponent(session.codeName)}`;
          } else if (session.type === 'ais') {
            clientCode = `vless://${clientUUID}@botvipicopc.vipv2boxth.xyz:8080?type=ws&path=%2F&host=speedtest.net&security=none#${encodeURIComponent(session.codeName)}`;
          } else if (session.type === 'true_nopro') {
            clientCode = `vless://${clientUUID}@104.18.34.21:80?type=ws&path=%2F&host=botvipicopc.vipv2boxth.xyz&security=none#${encodeURIComponent(session.codeName)}`;
          }
        } else if (session.vpsType === 'idc') {
          if (session.type === 'true_pro_facebook') {
            clientCode = `vless://${clientUUID}@www.opensignal.com.esnfvpnfreevip_bot.itow.online:80?path=%2F&security=none&encryption=none&host=www.opensignal.com.esnfvpnfreevip_bot.itow.online&type=ws#${encodeURIComponent(session.codeName)}`;
          } else if (session.type === 'ais') {
            clientCode = `vless://${clientUUID}@www.opensignal.com.esnfvpnfreevip_bot.itow.online:8080?type=ws&path=%2F&security=none&host=speedtest.net#${encodeURIComponent(session.codeName)}`;
          } else if (session.type === 'true_nopro') {
            clientCode = `vless://${clientUUID}@www.opensignal.com:80?path=%2F&security=none&encryption=none&host=www.opensignal.com.esnfvpnfreevip_bot.itow.online&type=ws#${encodeURIComponent(session.codeName)}`;
          }
        }
        successCallback(clientCode, expiryTime);
      } else {
        console.log('การเพิ่มลูกค้าล้มเหลว:', body.msg);
        errorCallback(body.msg);
      }
    } catch (e) {
      console.error('ไม่สามารถแปลงข้อมูลการตอบกลับเป็น JSON ได้:', e);
      console.log('Response Body:', response.body);
      errorCallback('ไม่สามารถแปลงข้อมูลการตอบกลับเป็น JSON ได้');
    }
  });
}

// ฟังก์ชันสำหรับจัดการลิงก์ซองอั่งเปา
function processTrueMoneyGiftCode(chatId, code) {
  const options = {
    method: 'POST',
    url: `https://gift.truemoney.com/campaign/vouchers/${code}/redeem`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': 'https://gift.truemoney.com',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive'
    },
    body: JSON.stringify({
      mobile: mobileNumber,
      voucher_hash: code
    })
  };

  request(options, function(error, response) {
    if (error) {
      console.error('เกิดข้อผิดพลาดในการส่งคำขอ:', error);
      bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการรับเงิน โปรดลองใหม่อีกครั้ง');
      return;
    }

    if (response.statusCode === 200) {
      // แปลงข้อมูลการตอบกลับเพื่อรับจำนวนเงิน
      try {
        const body = JSON.parse(response.body);
        if (body && body.data && body.data.my_ticket && body.data.my_ticket.amount_baht) {
          const amount = parseFloat(body.data.my_ticket.amount_baht);
          let creditsToAdd = amount;
          if (amount === 10) {
            creditsToAdd += 4; // เติม 10 บาท รับเพิ่มอีก 4 เครดิต
          }
          bot.sendMessage(chatId, `✅ รับเงินจำนวน ${amount} บาท เรียบร้อยแล้ว! คุณได้รับ ${creditsToAdd} เครดิต ขอบคุณที่โดเนทครับ 🙏`);
          // อัปเดตเครดิตของผู้ใช้
          updateUserCredits(chatId, creditsToAdd);
        } else {
          bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการรับข้อมูลจำนวนเงิน');
        }
      } catch (e) {
        console.error('Error parsing response:', e);
        bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการประมวลผลข้อมูล');
      }

    } else {
      console.log('Response:', response.body);
      bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการรับเงิน โปรดตรวจสอบลิงก์และลองใหม่อีกครั้ง');
    }
  });
}

// ฟังก์ชันสำหรับอัปเดตเครดิตของผู้ใช้
let usersData = {};

// ชื่อไฟล์ที่ใช้เก็บข้อมูลผู้ใช้
const dataFilePath = path.join(__dirname, 'transactions.json');

// อ่านข้อมูลผู้ใช้จากไฟล์เมื่อเริ่มต้นโปรแกรม
if (fs.existsSync(dataFilePath)) {
  // ถ้าไฟล์มีอยู่ ให้อ่านข้อมูลจากไฟล์
  try {
    const data = fs.readFileSync(dataFilePath, 'utf8');
    usersData = JSON.parse(data);
  } catch (err) {
    console.error('Error reading transactions.json:', err);
    usersData = {};
  }
} else {
  // ถ้าไฟล์ไม่พบ ให้สร้างไฟล์ใหม่ที่มีเนื้อหาเป็นออบเจกต์ว่าง
  usersData = {};
  fs.writeFileSync(dataFilePath, JSON.stringify(usersData, null, 2));
}

function getUserData(userId) {
  return usersData[userId] || { credits: 0, codes: [] };
}

function saveUserData(userId, data) {
  usersData[userId] = data;
  fs.writeFile(dataFilePath, JSON.stringify(usersData, null, 2), (err) => {
    if (err) {
      console.error(`Error writing ${dataFilePath}:`, err);
    }
  });
}

function updateUserCredits(chatId, amount) {
  const userId = chatId.toString();
  let userData = getUserData(userId);
  let currentCredits = userData.credits || 0;

  // สมมติว่า 1 บาท = 1 เครดิต, เติม 10 บาท รับเพิ่มอีก 4 เครดิต
  const newCredits = currentCredits + amount;

  userData.credits = newCredits;
  saveUserData(userId, userData);

  bot.sendMessage(chatId, `💰 ยอดเครดิตปัจจุบันของคุณคือ ${newCredits} เครดิต`);
}

// เพิ่มรายการของแอดมิน
const adminIds = [123456789]; // แทนที่ด้วย Telegram ID ของแอดมิน

// รับคำสั่ง /start จากผู้ใช้
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const message = '🤖 ยินดีต้อนรับสู่บอทสุดล้ำ! คุณสามารถใช้คำสั่งต่อไปนี้:\n\n' +
                  '💠 /addclient - เพิ่มลูกค้าใหม่\n' +
                  '💰 /topup - เติมเงินเพื่อซื้อเครดิต\n' +
                  '💳 /mycredits - ตรวจสอบเครดิตของคุณ\n' +
                  '📝 /mycodes - ดูโค้ดที่คุณสร้าง\n\n' +
                  '📌 โปรดใช้คำสั่ง /topup เพื่อเติมเครดิตก่อนใช้งาน';
  bot.sendMessage(chatId, message);
});

// รับคำสั่ง /topup จากผู้ใช้
bot.onText(/\/topup/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (msg.chat.type === 'private') {
    // ในแชทส่วนตัว
    const message = '💳 กรุณาส่งลิงก์ซองอั่งเปาวอเลทเพื่อเติมเครดิตของคุณ!\n\n📥 ตัวอย่าง: https://gift.truemoney.com/campaign/?v=xxxxx\n\n🔖 โปรโมชัน: \n- เติม 1 บาท รับ 1 เครดิต\n- เติม 10 บาท รับ 14 เครดิต';
    bot.sendMessage(chatId, message);
  } else {
    // ในกลุ่ม
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'เริ่มเติมเงินกับบอท', url: `https://t.me/${botUsername}?start=topup` }]
        ]
      }
    };
    const message = `⚠️ กรุณาเติมเงินผ่านแชทส่วนตัวกับบอท\n\n🔖 โปรโมชัน: \n- เติม 1 บาท รับ 1 เครดิต\n- เติม 10 บาท รับ 14 เครดิต`;
    bot.sendMessage(chatId, message, options);
  }
});

// รับคำสั่ง /mycredits
bot.onText(/\/mycredits/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  let userData = getUserData(userId);
  let credits = userData.credits || 0;
  bot.sendMessage(chatId, `💰 ยอดเครดิตปัจจุบันของคุณคือ ${credits} เครดิต`);
});

// รับคำสั่ง /mycodes
bot.onText(/\/mycodes/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  let userData = getUserData(userId);
  if (userData.codes && userData.codes.length > 0) {
    let response = '📜 คุณได้สร้างโค้ดดังต่อไปนี้:\n';
    const nowTime = Date.now();
    userData.codes.forEach((codeEntry, index) => {
      if (codeEntry.expiryTime > nowTime) {
        const daysRemaining = Math.ceil((codeEntry.expiryTime - nowTime) / (24 * 60 * 60 * 1000));
        response += `🔹 ${index + 1}. ${codeEntry.codeName} - เหลืออีก ${daysRemaining} วัน\n`;
      } else {
        response += `🔹 ${index + 1}. ${codeEntry.codeName} - หมดอายุแล้ว\n`;
      }
    });
    bot.sendMessage(chatId, response);
  } else {
    bot.sendMessage(chatId, '❌ คุณยังไม่ได้สร้างโค้ดใดๆ');
  }
});

// รับคำสั่ง /givecredits สำหรับแอดมิน
bot.onText(/\/givecredits/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (adminIds.includes(userId)) {
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'เพิ่มให้ผู้ใช้', callback_data: 'givecredits_to_user' }],
          [{ text: 'เพิ่มให้ตัวเอง', callback_data: 'givecredits_to_self' }]
        ]
      }
    };
    bot.sendMessage(chatId, '🔧 กรุณาเลือกตัวเลือก:', options);
  } else {
    bot.sendMessage(chatId, '🚫 คำสั่งนี้สำหรับแอดมินเท่านั้น');
  }
});

// รับคำสั่ง /allcodes สำหรับแอดมิน
bot.onText(/\/allcodes/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (adminIds.includes(userId)) {
    let response = '📄 รายการโค้ดทั้งหมด:\n';
    for (let uid in usersData) {
      if (usersData[uid].codes && usersData[uid].codes.length > 0) {
        response += `👤 ผู้ใช้ ${uid}:\n`;
        const nowTime = Date.now();
        usersData[uid].codes.forEach((codeEntry, index) => {
          if (codeEntry.expiryTime > nowTime) {
            const daysRemaining = Math.ceil((codeEntry.expiryTime - nowTime) / (24 * 60 * 60 * 1000));
            response += ` - ${codeEntry.codeName}: ${codeEntry.code} - เหลืออีก ${daysRemaining} วัน\n`;
          } else {
            response += ` - ${codeEntry.codeName}: ${codeEntry.code} - หมดอายุแล้ว\n`;
          }
        });
      }
    }
    bot.sendMessage(chatId, response);
  } else {
    bot.sendMessage(chatId, '🚫 คำสั่งนี้สำหรับแอดมินเท่านั้น');
  }
});

// รับคำสั่ง /addclient
bot.onText(/\/addclient/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // ตรวจสอบว่าเป็นกลุ่มที่กำหนดหรือไม่
  if (chatId === -1002344075247) { // แทนที่ด้วย Chat ID ของกลุ่มที่คุณต้องการ
    // ส่งปุ่ม 'เลือก VPS' พร้อมเก็บ message_id
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 xvre VPS', callback_data: 'vps_xvre' }],
          [{ text: '🌐 idc VPS', callback_data: 'vps_idc' }]
        ]
      }
    };
    bot.sendMessage(chatId, '🔧 กรุณาเลือกประเภทของ VPS ที่ต้องการใช้:', options).then(sentMessage => {
      // เก็บ chatId ของผู้ใช้ใน session
      if (!userSessions[userId]) {
        userSessions[userId] = {};
      }
      userSessions[userId].chatId = chatId;
      userSessions[userId].originalMessageId = sentMessage.message_id;
    });
  } else {
    bot.sendMessage(chatId, '⚠️ คำสั่งนี้สามารถใช้ได้เฉพาะในกลุ่มที่กำหนดเท่านั้น');
  }
});

// จัดการการกดปุ่ม
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;

  if (data === 'vps_xvre' || data === 'vps_idc') {
    // เก็บประเภทของ VPS ใน session
    const vpsType = data === 'vps_xvre' ? 'xvre' : 'idc';
    userSessions[userId].vpsType = vpsType;

    // แสดงปุ่มเลือกโปรไฟล์ตาม VPS ที่เลือก
    const profileOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 TRUE PRO เฟสบุค', callback_data: 'profile_true_pro_facebook' }],
          [{ text: '📱 AIS', callback_data: 'profile_ais' }],
          [{ text: '🔧 TRUE NOPRO', callback_data: 'profile_true_nopro' }]
        ]
      }
    };
    bot.editMessageText('🔍 กรุณาเลือกโปรไฟล์ที่ต้องการ:', {
      chat_id: chatId,
      message_id: messageId
    }).then(() => {
      bot.sendMessage(chatId, '🔍 กรุณาเลือกโปรไฟล์ที่ต้องการ:', profileOptions).then(sentMessage => {
        userSessions[userId].originalMessageId = sentMessage.message_id;
      });
    }).catch((error) => {
      console.error('Error editing message:', error);
    });
  }
  else if (data === 'profile_true_pro_facebook' || data === 'profile_ais' || data === 'profile_true_nopro') {
    // เริ่มต้นการสนทนาเพื่อเก็บข้อมูล
    let apiId;
    let profileType;

    // กำหนด apiId และ profileType ตาม VPS Type และโปรไฟล์
    if (userSessions[userId].vpsType === 'xvre') {
      if (data === 'profile_true_pro_facebook') {
        apiId = 4;
        profileType = 'true_pro_facebook';
      } else if (data === 'profile_ais') {
        apiId = 3;
        profileType = 'ais';
      } else if (data === 'profile_true_nopro') {
        apiId = 2;
        profileType = 'true_nopro';
      }
    } else if (userSessions[userId].vpsType === 'idc') {
      if (data === 'profile_true_pro_facebook') {
        apiId = 12;
        profileType = 'true_pro_facebook';
      } else if (data === 'profile_ais') {
        apiId = 9;
        profileType = 'ais';
      } else if (data === 'profile_true_nopro') {
        apiId = 7;
        profileType = 'true_nopro';
      }
    }

    userSessions[userId].step = 'ask_code_name';
    userSessions[userId].type = profileType; // เก็บประเภทของโปรไฟล์
    userSessions[userId].apiId = apiId;

    // แก้ไขข้อความเดิมเป็น '📝 กรุณาตั้งชื่อโค้ดของคุณ'
    bot.editMessageText('📝 กรุณาตั้งชื่อโค้ดของคุณ', {
      chat_id: chatId,
      message_id: messageId
    }).then(() => {
      // เพิ่มการตั้งค่า messageId สำหรับขั้นตอนต่อไปหากต้องการ
    }).catch((error) => {
      console.error('Error editing message:', error);
    });
  }
  else if (data === 'givecredits_to_user') {
    if (adminIds.includes(userId)) {
      userSessions[userId] = { step: 'givecredits_ask_user' };
      bot.sendMessage(chatId, '🔍 กรุณาตอบกลับข้อความของผู้ใช้ที่ต้องการเพิ่มเครดิตให้');
    } else {
      bot.answerCallbackQuery(callbackQuery.id, '🚫 คำสั่งนี้สำหรับแอดมินเท่านั้น');
    }
  } else if (data === 'givecredits_to_self') {
    if (adminIds.includes(userId)) {
      userSessions[userId] = { step: 'givecredits_ask_amount', targetUserId: userId };
      bot.sendMessage(chatId, '💰 กรุณาระบุจำนวนเครดิตที่ต้องการเพิ่มให้ตัวเอง');
    } else {
      bot.answerCallbackQuery(callbackQuery.id, '🚫 คำสั่งนี้สำหรับแอดมินเท่านั้น');
    }
  }
});

// จัดการข้อความจากผู้ใช้
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  // ตรวจสอบการเข้าร่วมกลุ่มใหม่
  if (msg.new_chat_members) {
    msg.new_chat_members.forEach((newMember) => {
      if (newMember.id !== bot.id) { // ตรวจสอบไม่ให้บอทต้อนรับตัวเอง
        const welcomeMessage = `🎉 ยินดีต้อนรับคุณ ${newMember.first_name} สู่กลุ่ม!\n\n🤖 ยินดีต้อนรับสู่บอทสุดล้ำ! คุณสามารถใช้คำสั่งต่อไปนี้:\n\n` +
                               `💠 /addclient - เพิ่มลูกค้าใหม่\n` +
                               `💰 /topup - เติมเงินเพื่อซื้อเครดิต\n` +
                               `💳 /mycredits - ตรวจสอบเครดิตของคุณ\n` +
                               `📝 /mycodes - ดูโค้ดที่คุณสร้าง\n\n` +
                               `📌 โปรดใช้คำสั่ง /topup เพื่อเติมเครดิตก่อนใช้งาน`;
        bot.sendMessage(chatId, welcomeMessage);
      }
    });
    return; // หยุดการประมวลผลข้อความเพิ่มเติม
  }

  // หากผู้ใช้อยู่ในสถานะการสนทนา
  if (userSessions[userId]) {
    const session = userSessions[userId];

    if (session.step === 'ask_code_name') {
      // เก็บชื่อโค้ด
      session.codeName = text;
      session.step = 'ask_days';
      bot.sendMessage(chatId, '📅 กรุณาเลือกจำนวนวันที่ต้องการ (1-30 วัน)').then(sentMessage => {
        session.daysMessageId = sentMessage.message_id;
      });
    } else if (session.step === 'ask_days') {
      const days = parseInt(text);
      if (isNaN(days) || days <= 0 || days > 30) {
        bot.sendMessage(chatId, '⚠️ กรุณาระบุจำนวนวันที่ถูกต้อง (1-30 วัน)')
          .then((sentMessage) => {
            // ลบข้อความหลังจาก 6 วินาที
            setTimeout(() => {
              bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
                console.error('Error deleting invalid days message:', error);
              });
            }, 6000);
          })
          .catch((error) => {
            console.error('Error sending invalid days message:', error);
          });
      } else {
        session.days = days;
        session.expiryTime = generateExpiryTime(days); // เก็บ expiryTime ใน session
        session.step = 'ask_gb_limit';
        bot.sendMessage(chatId, '💾 กรุณาระบุ GB ที่ต้องการจำกัด (หากไม่จำกัดพิมพ์ 0)').then(sentMessage => {
          session.gbMessageId = sentMessage.message_id;
        });
      }
    } else if (session.step === 'ask_gb_limit') {
      const gbLimit = parseInt(text);
      if (isNaN(gbLimit) || gbLimit < 0) {
        bot.sendMessage(chatId, '⚠️ กรุณาระบุจำนวน GB ที่ถูกต้อง')
          .then((sentMessage) => {
            // ลบข้อความหลังจาก 6 วินาที
            setTimeout(() => {
              bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
                console.error('Error deleting invalid GB limit message:', error);
              });
            }, 6000);
          })
          .catch((error) => {
            console.error('Error sending invalid GB limit message:', error);
          });
      } else {
        session.gbLimit = gbLimit;
        session.step = 'creating_code';

        // ส่งข้อความแอนิเมชันพร้อมคำอธิบาย
        bot.sendAnimation(chatId, 'https://i.imgur.com/CiAYAcN.gif', {
          caption: '⏳ กำลังสร้างโค้ดของคุณ โปรดรอสักครู่...',
          parse_mode: 'Markdown'
        }).then((loadingMessage) => {
          session.loadingMessageId = loadingMessage.message_id;

          // สร้างโค้ดหลังจาก 4 วินาที
          setTimeout(() => {
            const userIdStr = userId.toString();
            let userData = getUserData(userIdStr);
            let currentCredits = userData.credits || 0;

            // ตรวจสอบเครดิตเพียงพอก่อนสร้างโค้ด
            const requiredCredits = session.days; // 1 วัน = 1 เครดิต

            if (currentCredits >= requiredCredits) {
              // ทำการเข้าสู่ระบบและเพิ่มลูกค้าใหม่
              login(session.vpsType, (loginError) => {
                if (loginError) {
                  bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการเข้าสู่ระบบ โปรดลองใหม่อีกครั้ง')
                    .then((sentMessage) => {
                      // ลบข้อความหลังจาก 6 วินาที
                      setTimeout(() => {
                        bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
                          console.error('Error deleting login error message:', error);
                        });
                      }, 6000);
                    })
                    .catch((error) => {
                      console.error('Error sending login error message:', error);
                    });
                  // ลบข้อความแอนิเมชัน
                  if (session.loadingMessageId) {
                    bot.deleteMessage(chatId, session.loadingMessageId).catch((error) => {
                      console.error('Error deleting loading message:', error);
                    });
                  }
                  delete userSessions[userId];
                  return;
                }

                addNewClient(session, (clientCode, expiryTime) => {
                  // ส่งโค้ดไปยังแชทส่วนตัวของผู้ใช้
                  sendCodeToUser(userId, chatId, clientCode, session, msg, expiryTime);

                  // ลบข้อความแอนิเมชัน
                  if (session.loadingMessageId) {
                    bot.deleteMessage(chatId, session.loadingMessageId).catch((error) => {
                      console.error('Error deleting loading message:', error);
                    });
                  }

                  // ส่งข้อความแจ้งเตือน
                  bot.sendMessage(chatId, '✅ โค้ดของคุณถูกส่งไปยังแชทส่วนตัวแล้ว! โปรดตรวจสอบแชทส่วนตัวของคุณ 📬');

                  delete userSessions[userId];
                }, (errorMsg) => {
                  bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการสร้างโค้ด: ' + errorMsg)
                    .then((sentMessage) => {
                      // ลบข้อความหลังจาก 6 วินาที
                      setTimeout(() => {
                        bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
                          console.error('Error deleting error message:', error);
                        });
                      }, 6000);
                    })
                    .catch((error) => {
                      console.error('Error sending error message:', error);
                    });
                  // ลบข้อความแอนิเมชัน
                  if (session.loadingMessageId) {
                    bot.deleteMessage(chatId, session.loadingMessageId).catch((error) => {
                      console.error('Error deleting loading message:', error);
                    });
                  }
                  delete userSessions[userId];
                });
              });
            } else {
              bot.sendMessage(chatId, `⚠️ เครดิตของคุณไม่เพียงพอ คุณมี ${currentCredits} เครดิต แต่ต้องการ ${requiredCredits} เครดิต\nโปรดเติมเครดิตโดยใช้คำสั่ง /topup`)
                .then((sentMessage) => {
                  // ลบข้อความหลังจาก 6 วินาที
                  setTimeout(() => {
                    bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
                      console.error('Error deleting insufficient credits message:', error);
                    });
                    // ลบสถานะการสนทนา
                    delete userSessions[userId];
                  }, 6000);
                })
                .catch((error) => {
                  console.error('Error sending insufficient credits message:', error);
                });

              // ลบข้อความแอนิเมชัน
              if (session.loadingMessageId) {
                setTimeout(() => {
                  bot.deleteMessage(chatId, session.loadingMessageId).catch((error) => {
                    console.error('Error deleting loading message:', error);
                  });
                }, 6000);
              }

              return; // หยุดการดำเนินการเพิ่มเติม
            }
          }, 4000); // รอ 4 วินาทีเพื่อจำลองเวลาประมวลผล
        }).catch((error) => {
          console.error('Error sending loading animation:', error);
          bot.sendMessage(chatId, '🚫 เกิดข้อผิดพลาดในการส่งข้อความ โปรดลองใหม่อีกครั้ง')
            .then((sentMessage) => {
              // ลบข้อความหลังจาก 6 วินาที
              setTimeout(() => {
                bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
                  console.error('Error deleting loading message error:', error);
                });
              }, 6000);
            })
            .catch((error) => {
              console.error('Error sending loading message error:', error);
            });
          delete userSessions[userId];
        });
      }
    } else if (session.step === 'givecredits_ask_user') {
      if (msg.reply_to_message && msg.reply_to_message.from) {
        const targetUserId = msg.reply_to_message.from.id;
        session.targetUserId = targetUserId;
        session.step = 'givecredits_ask_amount';
        bot.sendMessage(chatId, '💰 กรุณาระบุจำนวนเครดิตที่ต้องการเพิ่มให้ผู้ใช้');
      } else {
        bot.sendMessage(chatId, '⚠️ กรุณาตอบกลับข้อความของผู้ใช้ที่ต้องการเพิ่มเครดิตให้')
          .then((sentMessage) => {
            // ลบข้อความหลังจาก 6 วินาที
            setTimeout(() => {
              bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
                console.error('Error deleting ask to reply message:', error);
              });
            }, 6000);
          })
          .catch((error) => {
            console.error('Error sending ask to reply message:', error);
          });
      }
    } else if (session.step === 'givecredits_ask_amount') {
      const amount = parseInt(text);
      if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(chatId, '⚠️ กรุณาระบุจำนวนเครดิตที่ถูกต้อง')
          .then((sentMessage) => {
            // ลบข้อความหลังจาก 6 วินาที
            setTimeout(() => {
              bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
                console.error('Error deleting invalid amount message:', error);
              });
            }, 6000);
          })
          .catch((error) => {
            console.error('Error sending invalid amount message:', error);
          });
      } else {
        const targetUserId = session.targetUserId.toString();
        let targetUserData = getUserData(targetUserId);
        let currentCredits = targetUserData.credits || 0;
        targetUserData.credits = currentCredits + amount;
        saveUserData(targetUserId, targetUserData);

        bot.sendMessage(chatId, `✅ เพิ่มเครดิตให้กับผู้ใช้ ${targetUserId} จำนวน ${amount} เครดิตแล้ว`)
          .then((sentMessage) => {
            // ลบข้อความหลังจาก 6 วินาที
            setTimeout(() => {
              bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
                console.error('Error deleting credit added message:', error);
              });
            }, 6000);
          })
          .catch((error) => {
            console.error('Error sending credit added message:', error);
          });

        if (targetUserId !== userId.toString()) {
          // แจ้งเตือนผู้ใช้เป้าหมายในแชทส่วนตัว
          bot.sendMessage(targetUserId, `💰 คุณได้รับเครดิตเพิ่ม ${amount} เครดิต จากแอดมิน`)
            .catch((error) => {
              console.error('Error notifying target user:', error);
            });
        }
        delete userSessions[userId];
      }
    }
  } else if (msg.chat.type === 'private') {
    // จัดการข้อความในแชทส่วนตัว

    // ตรวจสอบว่าผู้ใช้เข้ามาเติมเงินผ่านลิงก์หรือไม่
    if (msg.text && msg.text.startsWith('/start')) {
      const args = msg.text.split(' ');
      if (args.length > 1 && args[1] === 'topup') {
        // เริ่มกระบวนการเติมเงิน
        const chatId = msg.chat.id;
        const userIdStr = userId.toString();
        let userData = getUserData(userIdStr);

        // ส่งคำแนะนำให้เติมเงิน
        const message = `💳 กรุณาเติมเงินตามจำนวนที่ต้องการเพื่อรับเครดิต\n\n` +
                        `🔖 โปรโมชัน: \n- เติม 1 บาท รับ 1 เครดิต\n- เติม 10 บาท รับ 14 เครดิต\n\n` +
                        `📥 ตัวอย่าง: https://gift.truemoney.com/campaign/?v=xxxxx`;
        bot.sendMessage(chatId, message);
      }
    }

    // จัดการลิงก์ซองอั่งเปา
    if (text && text.includes('https://gift.truemoney.com/campaign/?v=')) {
      // ตรวจสอบว่ามีลิงก์ซองอั่งเปาหรือไม่
      const codeMatch = text.match(/v=([a-zA-Z0-9]+)/);
      if (codeMatch && codeMatch[1]) {
        const code = codeMatch[1];

        // ทำการเรียก API เพื่อรับเงิน
        processTrueMoneyGiftCode(chatId, code);
      } else {
        bot.sendMessage(chatId, '⚠️ ลิงก์ไม่ถูกต้อง โปรดส่งลิงก์ซองอั่งเปาวอเลทที่ถูกต้อง')
          .then((sentMessage) => {
            // ลบข้อความหลังจาก 6 วินาที
            setTimeout(() => {
              bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
                console.error('Error deleting invalid gift code link message:', error);
              });
            }, 6000);
          })
          .catch((error) => {
            console.error('Error sending invalid gift code link message:', error);
          });
      }
    }
  } else {
    // ไม่ตอบสนองต่อข้อความอื่นๆ ในกลุ่ม
    if (text && !text.startsWith('/')) {
      bot.sendMessage(chatId, '❓ ไม่เข้าใจคำสั่งของคุณ โปรดใช้คำสั่งที่กำหนด')
        .then((sentMessage) => {
          // ลบข้อความหลังจาก 6 วินาที
          setTimeout(() => {
            bot.deleteMessage(chatId, sentMessage.message_id).catch((error) => {
              console.error('Error deleting unknown command message:', error);
            });
          }, 6000);
        })
        .catch((error) => {
          console.error('Error sending unknown command message:', error);
        });
    }
  }
});

// ฟังก์ชันสำหรับส่งโค้ดไปยังผู้ใช้
function sendCodeToUser(userId, chatId, clientCode, session, msg, expiryTime) {
  // ส่งโค้ดไปยังแชทส่วนตัวของผู้ใช้
  bot.sendMessage(userId, `✅ *โค้ดของคุณถูกสร้างสำเร็จ!*\n\n📬 กรุณาตรวจสอบโค้ดของคุณด้านล่าง:\n\n\`${clientCode}\``, { parse_mode: 'Markdown' })
    .then(() => {
      // หลังจากส่งโค้ดสำเร็จ อัปเดตข้อมูลผู้ใช้
      const userIdStr = userId.toString();
      let userData = getUserData(userIdStr);
      if (!userData.codes) {
        userData.codes = [];
      }
      userData.codes.push({
        code: clientCode,
        codeName: session.codeName,
        creationDate: new Date().toLocaleString(),
        expiryTime: expiryTime
      });
      saveUserData(userIdStr, userData);

      // หลังจากโค้ดถูกสร้างและส่งสำเร็จแล้ว หักเครดิต
      let requiredCredits = session.days; // 1 วัน = 1 เครดิต
      let currentCredits = userData.credits || 0;

      if (currentCredits >= requiredCredits) {
        userData.credits = currentCredits - requiredCredits;
        saveUserData(userIdStr, userData);
        bot.sendMessage(chatId, `💰 คุณได้หักเครดิต ${requiredCredits} เครดิตจากยอดเครดิตปัจจุบันของคุณ`);
      } else {
        bot.sendMessage(chatId, `⚠️ เครดิตของคุณไม่เพียงพอสำหรับการหักเครดิต (${requiredCredits} เครดิต). กรุณาเติมเครดิตเพิ่มเติม`);
      }

      delete userSessions[userId];
    })
    .catch((error) => {
      if (error.response && error.response.statusCode === 403) {
        // ผู้ใช้ยังไม่ได้เริ่มแชทกับบอท
        const options = {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'เริ่มแชทกับบอท', url: `https://t.me/${botUsername}?start` }]
            ]
          }
        };
        const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
        // ส่งข้อความในกลุ่ม
        bot.sendMessage(chatId, `${username} กรุณากดปุ่มด้านล่างเพื่อเริ่มแชทส่วนตัวกับบอท`, options);
      } else {
        console.error('Error sending code to user:', error);
      }
    });
}
