require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function fetchListingData(asin) {
  const url = `https://www.amazon.in/dp/${asin}`;
  const res = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const html = res.data;
  const titleMatch = html.match(/id="productTitle"[^>]*>([\s\S]*?)<\/span>/);
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
    : "Title not found";

  const bulletMatches = html.match(/class="a-list-item"[^>]*>([\s\S]*?)<\/span>/g);
  const bullets = bulletMatches
    ? bulletMatches
        .slice(0, 5)
        .map((b) => b.replace(/<[^>]+>/g, "").trim())
        .filter((b) => b.length > 10)
    : [];

  return { title, bullets, asin, url };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { asin } = req.body;
    if (!asin) return res.status(400).json({ error: "ASIN is required" });

    const cleanAsin = asin.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

    let listingData;
    try {
      listingData = await fetchListingData(cleanAsin);
    } catch (e) {
      listingData = {
        asin: cleanAsin,
        title: "Could not fetch — analyzing ASIN only",
        bullets: [],
        url: `https://www.amazon.in/dp/${cleanAsin}`,
      };
    }

    const prompt = `You are an Amazon listing optimization expert. Analyze this Amazon product listing and provide actionable feedback.

ASIN: ${listingData.asin}
Product URL: ${listingData.url}
Title: ${listingData.title}
Bullet Points Found: ${listingData.bullets.length > 0 ? listingData.bullets.join("\n") : "Could not extract bullet points"}

Respond with ONLY raw JSON, no markdown, no backticks, no explanation. Use this exact format:
{
  "overallScore": <number 0-100>,
  "titleScore": <number 0-100>,
  "titleFeedback": "<specific feedback on the title>",
  "bulletScore": <number 0-100>,
  "bulletFeedback": "<specific feedback on bullet points>",
  "keywordScore": <number 0-100>,
  "keywordFeedback": "<feedback on keyword usage>",
  "topIssues": ["<issue 1>", "<issue 2>", "<issue 3>"],
  "quickWins": ["<actionable fix 1>", "<actionable fix 2>", "<actionable fix 3>"],
  "improvedTitle": "<your suggested better title>"
}`;

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const clean = responseText.replace(/```json|```/g, "").trim();
    const analysis = JSON.parse(clean);

    res.status(200).json({ success: true, listing: listingData, analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};