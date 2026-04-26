export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Chỉ hỗ trợ phương thức GET." });
  }

  return res.status(200).json({
    botName: process.env.BOT_NAME || "Trợ lý Công an Tân Yên 24H",
    unitName: process.env.UNIT_NAME || "Công an xã Tân Yên, Bắc Ninh",
    hotline: process.env.HOTLINE || "0240.3878.666",
    fanpageUrl: process.env.FANPAGE_URL || "https://www.facebook.com/"
  });
}
