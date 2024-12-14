const axios = require("axios");

module.exports = {
  name: "gemini",
  description: "โต้ตอบกับ Gemini AI Advanced และ Flash Vision",
  author: "Rized",

  async execute(senderId, args, pageAccessToken, event, imageUrl) {
    const userPrompt = args.join(" ").trim().toLowerCase();

    if (!userPrompt && !imageUrl) {
      return sendMessage(
        senderId,
        { 
          text: `❌ กรุณาระบุคำถามสำหรับ Gemini Advanced หรือส่งภาพพร้อมคำอธิบายเพื่อใช้ Flash Vision` 
        }, 
        pageAccessToken
      );
    }

    sendMessage(
      senderId,
      { text: "⌛ Gemini กำลังประมวลผล กรุณารอสักครู่..." },
      pageAccessToken
    );

    try {
      if (!imageUrl) {
        if (event.message?.reply_to?.mid) {
          imageUrl = await getRepliedImage(event.message.reply_to.mid, pageAccessToken);
        } else if (event.message?.attachments?.[0]?.type === 'image') {
          imageUrl = event.message.attachments[0].payload.url;
        }
      }

      const textApiUrl = "http://sgp1.hmvhostings.com:25721/gemini";
      const imageRecognitionUrl = "https://api.joshweb.click/gemini";

      const useImageRecognition =
        imageUrl || 
        ["recognize", "analyze", "analyst", "answer", "analysis"].some(term => userPrompt.includes(term)); 

      let responseMessage;
      let responseImage;

      if (useImageRecognition) {
        const imageApiResponse = await axios.get(imageRecognitionUrl, {
          params: { prompt: userPrompt, url: imageUrl || "" }
        });
        const imageRecognitionResponse = imageApiResponse.data.gemini || "❌ ไม่พบคำตอบจาก Gemini Flash Vision.";
        responseMessage = `${imageRecognitionResponse}`;
        responseImage = imageApiResponse.data.image || null;
      } else {
        // Fetch from Gemini Advanced (text)
        const textApiResponse = await axios.get(textApiUrl, { params: { question: userPrompt } });
        const textResponse = textApiResponse.data.answer || "❌ ไม่พบคำตอบจาก Gemini Advanced.";
        responseMessage = `${textResponse}`;
        responseImage = null; // ไม่ส่งภาพเมื่อเป็นข้อความ
      }

      const responseTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false });

      // Final formatted response
      const finalResponse = `✨• Gemini Advanced AI\n━━━━━━━━━━━━━━━━━━
${responseMessage}
━━━━━━━━━━━━━━━━━━
📅 วันที่/เวลา: ${responseTime}`;

      // ส่งข้อความพร้อมภาพ (ถ้ามี)
      if (responseImage) {
        await sendImageWithText(senderId, finalResponse, responseImage, pageAccessToken);
      } else {
        await sendConcatenatedMessage(senderId, finalResponse, pageAccessToken);
      }

    } catch (error) {
      console.error("❌ Error in Gemini command:", error);
      sendMessage(
        senderId,
        { text: `❌ เกิดข้อผิดพลาด: ${error.message || "ไม่สามารถประมวลผลได้"}` },
        pageAccessToken
      );
    }
  }
};

async function getRepliedImage(mid, pageAccessToken) {
  const { data } = await axios.get(`https://graph.facebook.com/v21.0/${mid}/attachments`, {
    params: { access_token: pageAccessToken }
  });

  if (data?.data?.[0]?.image_data?.url) {
    return data.data[0].image_data.url;
  }
  return "";
}

async function sendConcatenatedMessage(senderId, text, pageAccessToken) {
  const maxMessageLength = 2000;

  if (text.length > maxMessageLength) {
    const messages = splitMessageIntoChunks(text, maxMessageLength);

    for (const message of messages) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await sendMessage(senderId, { text: message }, pageAccessToken);
    }
  } else {
    await sendMessage(senderId, { text }, pageAccessToken);
  }
}

function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}

async function sendImageWithText(senderId, text, imageUrl, pageAccessToken) {
  const messageData = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: "image",
        payload: { url: imageUrl, is_reusable: false }
      },
      text
    }
  };

  await axios.post(`https://graph.facebook.com/v11.0/me/messages`, messageData, {
    params: { access_token: pageAccessToken }
  });
}

async function sendMessage(senderId, message, pageAccessToken) {
  await axios.post(`https://graph.facebook.com/v11.0/me/messages`, {
    recipient: { id: senderId },
    message
  }, {
    params: { access_token: pageAccessToken }
  });
}
