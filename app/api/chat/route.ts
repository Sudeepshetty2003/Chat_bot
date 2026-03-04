// route.js
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { companyInfo } from "@/data/company-info";

export const runtime = "edge";

const groq = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: "https://api.groq.com/openai/v1",
});


export async function POST(req: Request) {
  const { messages } = await req.json();

  // ==============================
  // EXTRACT LAST USER MESSAGE
  // ==============================
  const lastUserMessageObj = [...messages].reverse().find((m) => m.role === "user");

  let lastMessage = "";
  if (lastUserMessageObj?.parts) {
    for (const part of lastUserMessageObj.parts) {
      if (part.type === "text" && part.text) {
        lastMessage += part.text + " ";
      }
    }
  }
  lastMessage = lastMessage.trim().toLowerCase();
  console.log("Extracted message:", lastMessage);

  const lastContent = messages[messages.length - 1]?.content || "";

  // ==============================
  // CLEAN CONVERSATION HISTORY
  // Build filtered history for all branches (excludes empty content messages)
  // ==============================
  const buildHistory = async () => {
    const converted = await convertToModelMessages(messages);
    return converted.filter((m) => {
      if (Array.isArray(m.content)) return m.content.length > 0;
      if (typeof m.content === "string") return m.content.trim().length > 0;
      return false;
    });
  };

  // ==============================
  // COMPANY QUERY DETECTION
  // ==============================
  const companyKeywords = [
    // General company
    "company",
    "about you",
    "about your company",
    "organization",
    "business details",
    "who are you",
    "linksmart",
    "link smart",
    "founded",
    "founder",
    "ashish anand",
    "headquarters",
    "hsr layout",
    "bengaluru",

    // Products & technology
    "smartdna",
    "smart dna",
    "non-clonable",
    "non clonable",
    "non-cloneable",
    "non cloneable",
    "qr code",
    "security label",
    "tamper",
    "anti-counterfeit",
    "anti counterfeit",
    "counterfeit",
    "reusable packaging",
    "security packaging",
    "authentication",
    "traceability",
    "track and trace",
    "track-and-trace",
    "warranty fraud",
    "refill fraud",
    "brand protection",
    "product security",

    // Differentiators & tech
    "false acceptance",
    "far",
    "zero false",
    "surface agnostic",
    "cyber threat",
    "fake site",
    "digital duplicate",
    "clone",
    "cloning",
    "ip portfolio",

    // Deployment
    "licensing",
    "bot model",
    "build operate transfer",
    "deployment model",
    "enterprise solution",

    // Industries
    "fmcg",
    "pharmaceutical",
    "pharma",
    "automotive",
    "fintech",
    "agri-tech",
    "agritech",
    "logistics",
    "supply chain",

    // Competitors
    "authentix",
    "pharmasecure",
    "trutag",
    "competitor",
    "vs ",
    "compare",
    "better than",
    "difference between",

    // Contact
    "contact",
    "contact details",
    "email",
    "phone",
    "address",
    "website",
    "reach you",
    "reach out",
  ];

  const isCompanyQuery = companyKeywords.some((keyword) =>
    lastMessage.includes(keyword)
  );

  // ==============================
  // COMPETITOR COMPARISON DETECTION
  // ==============================
  const competitorKeywords = [
    "vs",
    "vs.",
    "versus",
    "compare",
    "comparison",
    "competitor",
    "competitors",
    "better than",
    "difference between",
    "how does linksmart compare",
    "authentix",
    "pharmasecure",
    "trutag",
    "other companies",
    "alternative",
    "alternatives",
    "which is better",
    "who is better",
  ];

  const isCompetitorQuery = competitorKeywords.some((keyword) =>
    lastMessage.includes(keyword)
  );

  // ==============================
  // PROGRAMMING QUERY DETECTION
  // ==============================
  const programmingKeywords = [
    "array",
    "function",
    "variable",
    "loop",
    "class",
    "object",
    "js",
    "javascript",
    "python",
    "java",
    "typescript",
    "react",
    "node",
    "html",
    "css",
    "api",
    "database",
    "algorithm",
    "data structure",
    "code",
    "coding",
    "programming",
    "debug",
    "error",
    "exception",
    "syntax",
  ];

  const isProgrammingQuery = programmingKeywords.some((keyword) =>
    lastMessage.includes(keyword)
  );

  // ==============================
  // COMPANY QUERY BRANCH
  // ==============================
  if (isCompanyQuery || isCompetitorQuery) {
    console.log("Company branch triggered | Competitor query:", isCompetitorQuery);

    const systemPrompt = isCompetitorQuery
      ? `You are an AI assistant for Linksmart Technologies Pvt Ltd.
Use ONLY the following company information to answer questions.
Be concise, accurate, and helpful. Do not make up information beyond what is provided below.

IMPORTANT FORMATTING RULE — COMPETITOR COMPARISONS:
Whenever the user asks to compare Linksmart with other companies, or asks about competitors, differences, or alternatives:
- ALWAYS present the comparison using a well-structured markdown table.
- The table should include relevant feature rows (e.g. Unique Identity, Smartphone Auth, Tamper Evidence, Surface Flexibility, Zero False Acceptance, Cyber Threat Protection, Reusable Packaging, Enterprise Analytics).
- Each column should represent one company (Linksmart + competitors mentioned).
- After the table, add a short 2–3 sentence summary highlighting Linksmart's key advantages.

${companyInfo}`
      : `You are an AI assistant for Linksmart Technologies Pvt Ltd.
Use ONLY the following company information to answer questions.
Be concise, accurate, and helpful. Do not make up information beyond what is provided below.

${companyInfo}`;

    const history = await buildHistory();

    const result = await streamText({
      model: groq("llama-3.3-70b-versatile"),
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...history,
      ],
    });

    return result.toUIMessageStreamResponse();
  }

  // ==============================
  // PROGRAMMING QUERY BRANCH
  // ==============================
  if (isProgrammingQuery) {
    console.log("Programming branch triggered");

    const history = await buildHistory();

    const result = await streamText({
      model: groq("llama-3.3-70b-versatile"),
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant that explains programming concepts clearly and concisely. Do not include any company information in your answers.",
        },
        ...history,
      ],
    });

    return result.toUIMessageStreamResponse();
  }

  // ==============================
  // GENERAL QUERY BRANCH
  // ==============================
  console.log("General query branch triggered");

  const history = await buildHistory();

  const result = await streamText({
    model: groq("llama-3.3-70b-versatile"),
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful AI assistant representing Linksmart Technologies Pvt Ltd. Never mention Llama, Meta, OpenAI, or any model identity.",
      },
      ...history,
    ],
  });

  return result.toUIMessageStreamResponse();
}