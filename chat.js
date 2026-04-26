import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

const knowledgePath = path.join(process.cwd(), "data", "knowledge.json");

const knowledge = JSON.parse(
  fs.readFileSync(knowledgePath, "utf8")
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const VI_STOPWORDS = new Set([
  "và", "là", "của", "có", "cho", "các", "theo", "được", "trong", "với", "về", "từ", "khi", "nào",
  "gì", "như", "này", "đó", "một", "những", "thì", "mà", "để", "cần", "hồ", "sơ", "thủ", "tục",
  "xin", "hỏi", "tôi", "muốn", "biết", "phải", "làm", "ở", "đâu", "ai", "bao", "lâu", "không",
  "bà", "con", "nhân", "dân", "anh", "chị", "em", "giúp", "hướng", "dẫn"
]);

function getConfig() {
  return {
    botName: process.env.BOT_NAME || "Trợ lý Công an Tân Yên 24H",
    unitName: process.env.UNIT_NAME || "Công an xã Tân Yên, Bắc Ninh",
    hotline: process.env.HOTLINE || "0240.3878.666",
    fanpageUrl: process.env.FANPAGE_URL || "https://www.facebook.com/",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
    minSearchScore: Number(process.env.MIN_SEARCH_SCORE || 2.2),
    maxContextChunks: Number(process.env.MAX_CONTEXT_CHUNKS || 5),
    maxChunkChars: Number(process.env.MAX_CHUNK_CHARS || 1200)
  };
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter(token => token && token.length > 1 && !VI_STOPWORDS.has(token));
}

function buildPhrases(normalizedText) {
  const words = normalizedText.split(" ").filter(Boolean);
  const phrases = [];
  for (let size = 2; size <= 5; size++) {
    for (let i = 0; i <= words.length - size; i++) {
      phrases.push(words.slice(i, i + size).join(" "));
    }
  }
  return phrases;
}

function scoreChunk(question, chunk) {
  const qNorm = normalize(question);
  const cNorm = chunk.normalized || normalize(chunk.text);
  const qTokens = tokenize(question);
  const cTokenSet = new Set(chunk.tokens || tokenize(chunk.text));
  const phrases = buildPhrases(qNorm);

  let score = 0;

  for (const token of qTokens) {
    if (cTokenSet.has(token)) score += 1.0;
    if (cNorm.includes(token)) score += 0.25;
  }

  for (const phrase of phrases) {
    if (phrase.length >= 8 && cNorm.includes(phrase)) score += 2.1;
  }

  const domainKeywords = [
    "tam tru", "thuong tru", "cu tru", "can cuoc", "dinh danh", "luu tru",
    "ho so", "thanh phan", "trinh tu", "thoi han", "co quan", "noi nop",
    "an ninh", "trat tu", "to giac", "tin bao", "lua dao", "tin dung den", "co bac"
  ];

  for (const kw of domainKeywords) {
    if (qNorm.includes(kw) && cNorm.includes(kw)) score += 1.4;
  }

  const titleNorm = normalize(chunk.title || "");
  const fileNorm = normalize(chunk.fileName || "");
  for (const token of qTokens) {
    if (titleNorm.includes(token)) score += 1.6;
    if (fileNorm.includes(token)) score += 0.9;
  }

  return score;
}

function retrieve(question, config) {
  const chunks = Array.isArray(knowledge.chunks) ? knowledge.chunks : [];

  const ranked = chunks
    .map(chunk => ({
      ...chunk,
      score: scoreChunk(question, chunk)
    }))
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, config.maxContextChunks);
  const bestScore = top.length ? top[0].score : 0;

  return { top, bestScore, totalChunks: chunks.length };
}

function fallbackAnswer(config) {
  return `👮‍♂️ Kính chào bà con nhân dân, Tôi là ${config.botName}, cảm ơn bạn đã đặt câu hỏi cho chúng tôi.\n\nĐối với nội dung này, đề nghị bà con nhân dân liên hệ với Công an xã Tân Yên qua số trực ban ${config.hotline} hoặc qua trang Fanpage Công an xã Tân Yên, Bắc Ninh để được hỗ trợ cụ thể hơn.\n\n🙏 Xin cảm ơn bà con nhân dân!`;
}

function unclearAnswer(config) {
  return `👮‍♂️ Kính chào bà con nhân dân, Tôi là ${config.botName}, cảm ơn bạn đã đặt câu hỏi cho chúng tôi.\n\n📌 Nội dung bà con hỏi hiện chưa xác định rõ thủ tục hoặc vấn đề cần tra cứu.\n\n👉 Bà con vui lòng hỏi cụ thể hơn, ví dụ:\n- Thủ tục đăng ký tạm trú cần giấy tờ gì?\n- Mục đích của xác nhận thông tin cư trú để làm gì?\n- Làm căn cước cần chuẩn bị hồ sơ nào?\n- Thủ tục khai báo lưu trú thực hiện như thế nào?\n- Tôi cần liên hệ Công an xã Tân Yên bằng cách nào?\n\n🙏 Xin cảm ơn bà con nhân dân!`;
}

function defaultSuggestions(question = "") {
  const q = normalize(question);

  if (q.includes("tam tru")) {
    return [
      "Đăng ký tạm trú cần chuẩn bị giấy tờ gì?",
      "Trình tự đăng ký tạm trú thực hiện như thế nào?",
      "Thời hạn giải quyết đăng ký tạm trú là bao lâu?",
      "Cơ quan nào tiếp nhận đăng ký tạm trú?"
    ];
  }

  if (q.includes("cu tru")) {
    return [
      "Xác nhận thông tin cư trú dùng để làm gì?",
      "Hồ sơ xác nhận thông tin cư trú gồm những gì?",
      "Thời hạn giải quyết xác nhận thông tin cư trú là bao lâu?",
      "Tôi cần nộp hồ sơ xác nhận cư trú ở đâu?"
    ];
  }

  if (q.includes("vneid") || q.includes("chu ky so") || q.includes("dinh danh muc hai") || q.includes("dinh danh muc 2")) {
    return [
      "Hướng dẫn cài đặt định danh mức hai",
      "Hướng dẫn cài đặt chữ ký số trên VNeID",
      "Cần chuẩn bị gì khi cài đặt VNeID?",
      "Những lưu ý khi sử dụng tài khoản định danh điện tử?"
    ];
  }

  if (q.includes("can cuoc") || q.includes("dinh danh")) {
    return [
      "Làm căn cước cần chuẩn bị hồ sơ nào?",
      "Trình tự cấp căn cước thực hiện như thế nào?",
      "Thời hạn giải quyết cấp căn cước là bao lâu?",
      "Cần lưu ý gì khi làm căn cước?"
    ];
  }

  return [
    "Hướng dẫn cài đặt định danh mức hai",
    "Hướng dẫn cài đặt chữ ký số trên VNeID",
    "Hướng dẫn đăng ký thường trú",
    "Hướng dẫn đăng ký tạm trú",
    "Những lưu ý khi thực hiện thủ tục này là gì?"
  ];
}

function extractJsonArray(text) {
  const raw = String(text || "").trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.suggestions)) return parsed.suggestions;
  } catch {}

  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return [];
}

function sanitizeSuggestions(list, fallback) {
  const cleaned = [];

  for (const item of list || []) {
    const text = String(item || "")
      .replace(/^[\s\-\d\.\)\(]+/g, "")
      .replace(/[“”"]/g, "")
      .trim();

    if (!text) continue;
    if (text.length > 120) continue;
    if (!text.endsWith("?")) continue;
    if (cleaned.some(x => normalize(x) === normalize(text))) continue;

    cleaned.push(text);
    if (cleaned.length >= 5) break;
  }

  if (cleaned.length >= 3) return cleaned;
  return fallback.slice(0, 5);
}

async function generateSmartSuggestions(question, answer, contexts, config) {
  const fallback = defaultSuggestions(question);

  // Không gọi AI riêng để tiết kiệm nếu không có nguồn dữ liệu.
  if (!contexts || contexts.length === 0) return fallback;

  const dataForSuggest = contexts
    .slice(0, 3)
    .map((c, i) => `NGUỒN ${i + 1}: ${String(c.text || "").slice(0, 600)}`)
    .join("\n\n");

  const prompt = `
Dựa CHỈ trên dữ liệu sau và câu trả lời vừa tạo, hãy sinh 4-5 câu hỏi gợi ý tiếp theo cho người dân.

Yêu cầu:
- Chỉ xuất JSON array, không giải thích.
- Mỗi câu hỏi ngắn gọn, dễ hiểu, tiếng Việt.
- Câu hỏi phải liên quan trực tiếp dữ liệu.
- Không hỏi về phí/lệ phí, trừ khi dữ liệu có nêu rõ.
- Ưu tiên các hướng: hồ sơ, trình tự, thời hạn, cơ quan tiếp nhận, mục đích, lưu ý.
- Không yêu cầu thông tin cá nhân.

Câu hỏi ban đầu: ${question}

Câu trả lời vừa tạo:
${String(answer || "").slice(0, 1000)}

Dữ liệu:
${dataForSuggest}

Ví dụ định dạng:
["Thủ tục này cần chuẩn bị giấy tờ gì?","Trình tự thực hiện gồm những bước nào?"]
`;

  try {
    const response = await ai.models.generateContent({
      model: config.model,
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 220
      }
    });

    const list = extractJsonArray(response.text);
    return sanitizeSuggestions(list, fallback);
  } catch (error) {
    console.error("Suggestion error:", error);
    return fallback;
  }
}

function buildPrompt(question, contexts, config) {
  const contextText = contexts.map((item, index) => {
    const text = String(item.text || "").slice(0, config.maxChunkChars);
    return `NGUỒN ${index + 1}\nTên file: ${item.fileName}\nTiêu đề/mục: ${item.title || "Không có"}\nNội dung:\n${text}`;
  }).join("\n\n---\n\n");

  return `
Bạn là "${config.botName}", trợ lý ảo của ${config.unitName}.

YÊU CẦU BẮT BUỘC:
- Chỉ được trả lời dựa trên phần "DỮ LIỆU ĐƯỢC CUNG CẤP" bên dưới.
- Không sử dụng kiến thức ngoài dữ liệu.
- Không tự suy đoán, không bịa quy định, không bổ sung thành phần hồ sơ/thời hạn/thẩm quyền nếu dữ liệu không có.
- Không đề cập phí/lệ phí, trừ khi người dân hỏi trực tiếp và dữ liệu có nêu rõ.
- Nếu dữ liệu không đủ để trả lời, trả lời đúng câu liên hệ trực ban/Fanpage.
- Không yêu cầu người dân cung cấp CCCD, số điện thoại, địa chỉ cụ thể, biển số xe hoặc thông tin vụ việc riêng tư.
- Văn phong ngắn gọn, dễ hiểu, có icon ở đầu ý chính.
- Mỗi câu trả lời luôn bắt đầu bằng lời chào bắt buộc và kết thúc bằng câu cảm ơn bắt buộc.

LỜI CHÀO BẮT BUỘC:
👮‍♂️ Kính chào bà con nhân dân, Tôi là ${config.botName}, cảm ơn bạn đã đặt câu hỏi cho chúng tôi.

CÂU LIÊN HỆ KHI KHÔNG ĐỦ DỮ LIỆU:
Đối với nội dung này, đề nghị bà con nhân dân liên hệ với Công an xã Tân Yên qua số trực ban ${config.hotline} hoặc qua trang Fanpage Công an xã Tân Yên, Bắc Ninh để được hỗ trợ cụ thể hơn.

CẤU TRÚC BẮT BUỘC KHI TRẢ LỜI THỦ TỤC HÀNH CHÍNH:
Khi dữ liệu có đủ thông tin, phải trình bày đầy đủ các mục sau:

📄 1. Tên thủ tục:
- Nêu đúng tên thủ tục theo dữ liệu.

🎯 2. Mục đích để làm gì:
- Giải thích ngắn gọn thủ tục này dùng để làm gì, người dân thực hiện để đạt kết quả gì.

👥 3. Đối tượng thực hiện:
- Nêu ai là người thực hiện hoặc được áp dụng.

📝 4. Thành phần hồ sơ:
- Liệt kê từng loại giấy tờ cần chuẩn bị.
- Nếu dữ liệu không nêu đầy đủ, ghi rõ: “Dữ liệu hiện chưa nêu đầy đủ thành phần hồ sơ.”

🔁 5. Trình tự thực hiện:
- Phải trình bày thành các bước cụ thể:
  Bước 1: ...
  Bước 2: ...
  Bước 3: ...
- Không gộp chung thành một đoạn dài.

⏱️ 6. Thời hạn giải quyết:
- Nêu thời hạn nếu dữ liệu có.
- Nếu dữ liệu không nêu, ghi rõ: “Dữ liệu hiện chưa nêu thời hạn giải quyết.”

🏢 7. Cơ quan tiếp nhận/thực hiện:
- Nêu nơi tiếp nhận hoặc cơ quan thực hiện nếu dữ liệu có.

📌 8. Lưu ý:
- Nêu các lưu ý quan trọng nếu dữ liệu có.
- Nếu không có lưu ý, có thể bỏ mục này.

CUỐI CÂU TRẢ LỜI, NẾU ĐÃ TRẢ LỜI ĐƯỢC, THÊM:
👉 Bà con có thể bấm vào các câu hỏi gợi ý bên dưới để tìm hiểu thêm.

CÂU KẾT BẮT BUỘC:
🙏 Xin cảm ơn bà con nhân dân!

DỮ LIỆU ĐƯỢC CUNG CẤP:
${contextText}

CÂU HỎI CỦA NGƯỜI DÂN:
${question}

Hãy trả lời ngắn gọn nhưng phải đủ ý, đủ các bước cụ thể nếu dữ liệu có. Không trả lời chung chung.`;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Chỉ hỗ trợ phương thức POST." });
  }

  const config = getConfig();

  try {
    const { question } = req.body || {};
    const cleanQuestion = String(question || "").trim();

    if (!cleanQuestion) {
      return res.status(400).json({ error: "Vui lòng nhập câu hỏi." });
    }

    if (cleanQuestion.length > 800) {
      return res.status(400).json({
        error: "Câu hỏi quá dài. Bà con vui lòng nhập ngắn gọn hơn, không đưa thông tin cá nhân vào khung chat."
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Máy chủ chưa cấu hình GEMINI_API_KEY." });
    }

    if (!knowledge || !Array.isArray(knowledge.chunks) || knowledge.chunks.length === 0) {
      return res.status(200).json({
        answer: fallbackAnswer(config),
        suggestions: [
          "Tôi cần liên hệ Công an xã Tân Yên bằng cách nào?",
          "Tôi có thể hỏi về những thủ tục nào?",
          "Số trực ban Công an xã Tân Yên là bao nhiêu?"
        ],
        sources: [],
        note: "Kho dữ liệu đang trống. Cần chạy npm run build-knowledge trước khi deploy.",
        ...config
      });
    }

    const tokens = tokenize(cleanQuestion);
    if (tokens.length < 2) {
      return res.status(200).json({
        answer: unclearAnswer(config),
        suggestions: defaultSuggestions(cleanQuestion),
        sources: [],
        ...config
      });
    }

    const { top, bestScore, totalChunks } = retrieve(cleanQuestion, config);

    // TIẾT KIỆM CHI PHÍ: nếu không tìm thấy dữ liệu đủ gần, không gọi Gemini.
    if (!top.length || bestScore < config.minSearchScore) {
      return res.status(200).json({
        answer: fallbackAnswer(config),
        suggestions: [
          "Tôi cần liên hệ Công an xã Tân Yên bằng cách nào?",
          "Tôi có thể hỏi về thủ tục hành chính nào?",
          "Tôi cần gọi số trực ban trong trường hợp nào?"
        ],
        sources: [],
        searchScore: Number(bestScore.toFixed(2)),
        totalChunks,
        savedCost: true,
        ...config
      });
    }

    const prompt = buildPrompt(cleanQuestion, top, config);

    const response = await ai.models.generateContent({
      model: config.model,
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 760
      }
    });

    let answer = response.text || "";

    if (!answer.trim()) {
      answer = fallbackAnswer(config);
    }

    const suggestions = defaultSuggestions(cleanQuestion);

    return res.status(200).json({
      answer,
      suggestions,
      sources: top.map(item => ({
        fileName: item.fileName,
        title: item.title || "",
        score: Number(item.score.toFixed(2))
      })),
      searchScore: Number(bestScore.toFixed(2)),
      totalChunks,
      ...config
    });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      error: `Hệ thống đang gặp lỗi khi xử lý câu hỏi. Đề nghị bà con nhân dân liên hệ Công an xã Tân Yên qua số trực ban ${config.hotline} hoặc Fanpage để được hỗ trợ.`
    });
  }
}
