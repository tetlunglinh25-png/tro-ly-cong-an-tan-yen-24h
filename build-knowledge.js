import "dotenv/config";
import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import pdf from "pdf-parse/lib/pdf-parse.js";

const DOCS_DIR = path.resolve("docs");
const DATA_DIR = path.resolve("data");
const OUTPUT_FILE = path.join(DATA_DIR, "knowledge.json");

const allowedExtensions = new Set([".txt", ".md", ".docx", ".pdf", ".json", ".csv"]);

const VI_STOPWORDS = new Set([
  "và", "là", "của", "có", "cho", "các", "theo", "được", "trong", "với", "về", "từ", "khi", "nào",
  "gì", "như", "này", "đó", "một", "những", "thì", "mà", "để", "cần", "hồ", "sơ", "thủ", "tục",
  "xin", "hỏi", "tôi", "muốn", "biết", "phải", "làm", "ở", "đâu", "ai", "bao", "lâu", "không",
  "bà", "con", "nhân", "dân", "anh", "chị", "em", "giúp", "hướng", "dẫn"
]);

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

function cleanText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getFiles(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return fs.readdirSync(dir)
    .map(name => path.join(dir, name))
    .filter(filePath => fs.statSync(filePath).isFile())
    .filter(filePath => allowedExtensions.has(path.extname(filePath).toLowerCase()));
}

async function readFileText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".txt" || ext === ".md" || ext === ".json" || ext === ".csv") {
    return fs.readFileSync(filePath, "utf8");
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  }

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const result = await pdf(buffer);
    return result.text || "";
  }

  return "";
}

function inferTitle(text, fileName) {
  const lines = String(text || "")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length >= 4);

  const candidates = lines.slice(0, 8);
  for (const line of candidates) {
    if (line.length <= 120) return line;
  }

  return fileName;
}

function splitIntoChunks(text, fileName, maxLength = 1200, overlap = 160) {
  const paragraphs = cleanText(text).split(/\n\s*\n/g).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n" + paragraph).length <= maxLength) {
      current = current ? current + "\n" + paragraph : paragraph;
    } else {
      if (current) chunks.push(current);

      if (paragraph.length > maxLength) {
        for (let i = 0; i < paragraph.length; i += maxLength - overlap) {
          chunks.push(paragraph.slice(i, i + maxLength));
        }
        current = "";
      } else {
        current = paragraph;
      }
    }
  }

  if (current) chunks.push(current);

  return chunks.map((chunkText, index) => ({
    id: `${fileName}-${index + 1}`,
    fileName,
    title: inferTitle(chunkText, fileName),
    text: chunkText,
    normalized: normalize(chunkText),
    tokens: tokenize(chunkText)
  }));
}

async function main() {
  const files = getFiles(DOCS_DIR);

  if (!files.length) {
    console.log("Chưa có tài liệu trong thư mục docs.");
    console.log("Hãy copy file DOCX/PDF/TXT/MD vào docs rồi chạy lại: npm run build-knowledge");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
      builtAt: new Date().toISOString(),
      totalFiles: 0,
      totalChunks: 0,
      chunks: []
    }, null, 2), "utf8");
    return;
  }

  const chunks = [];
  const filesInfo = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    console.log("Đang đọc:", fileName);

    try {
      const rawText = await readFileText(filePath);
      const text = cleanText(rawText);

      if (!text || text.length < 30) {
        console.log("  ⚠️ Không đọc được hoặc nội dung quá ngắn:", fileName);
        continue;
      }

      const fileChunks = splitIntoChunks(text, fileName);
      chunks.push(...fileChunks);

      filesInfo.push({
        fileName,
        chars: text.length,
        chunks: fileChunks.length
      });

      console.log(`  ✅ ${fileChunks.length} đoạn dữ liệu`);
    } catch (error) {
      console.error("  ❌ Lỗi đọc file:", fileName, error.message);
    }
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const output = {
    builtAt: new Date().toISOString(),
    method: "local-keyword-retrieval + Gemini generation",
    totalFiles: filesInfo.length,
    totalChunks: chunks.length,
    files: filesInfo,
    chunks
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

  console.log("\nHOÀN TẤT.");
  console.log(`Đã tạo ${OUTPUT_FILE}`);
  console.log(`Tổng file: ${output.totalFiles}`);
  console.log(`Tổng đoạn dữ liệu: ${output.totalChunks}`);
  console.log("\nLưu ý: Hãy commit file data/knowledge.json lên GitHub để Vercel sử dụng.");
}

main().catch(error => {
  console.error("Lỗi build knowledge:", error);
  process.exit(1);
});
