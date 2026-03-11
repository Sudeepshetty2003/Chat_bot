// route.ts
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { companyInfo } from "@/data/company-info";

export const runtime = "edge";

const groq = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: "https://api.groq.com/openai/v1",
});

// ==============================
// SHARED STYLE GUIDE
// Injected into every system prompt for consistent tone
// ==============================
const styleGuide = `
RESPONSE STYLE GUIDELINES — FOLLOW THESE IN EVERY REPLY:

🎨 Tone & Personality:
- Always be professional, warm, and helpful.
- Write in a confident but friendly tone — like a knowledgeable brand ambassador.
- Never sound robotic or overly formal.

😊 Emoji Usage:
- Use relevant emojis naturally throughout your response to make it engaging.
- Use emojis at the start of section headers or key points (e.g. ✅ 🔐 📦 🌍 💡 🚀 📞).
- Do NOT overuse emojis — use 1 per key point or section, not on every line.

📋 Structure & Formatting:
- Use clear headings or bold text for sections when the answer has multiple parts.
- Use bullet points for lists of features, use cases, or steps.
- Keep paragraphs short (2–3 sentences max).
- Always end your response with a friendly closing line or a follow-up offer, e.g.:
  "💬 Feel free to ask if you'd like to know more!"
  "🤝 Let me know how I can assist you further."

🚫 Never:
- Mention Llama, Meta, OpenAI, GPT, or any model/AI identity.
- Make up information not provided to you.
- Give one-line answers for multi-part questions.
`;

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
  // Filters out empty content messages to prevent API errors
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
  // GREETING DETECTION
  // ==============================
  const greetingKeywords = [
    "hi", "hello", "hey", "good morning", "good afternoon",
    "good evening", "howdy", "greetings", "what's up", "sup",
    "hiya", "hi there", "hello there",
  ];

  const isGreeting = greetingKeywords.some(
    (keyword) =>
      lastMessage.trim() === keyword ||
      lastMessage.startsWith(keyword + " ") ||
      lastMessage.startsWith(keyword + "!")
  );

  // ==============================
  // FAREWELL DETECTION
  // ==============================
  const farewellKeywords = [
    "bye", "goodbye", "see you", "see ya", "take care",
    "thanks", "thank you", "thankyou", "thank u", "cheers",
    "that's all", "thats all", "done", "ok thanks", "ok thank you",
    "great thanks", "got it thanks",
  ];

  const isFarewell = farewellKeywords.some((keyword) =>
    lastMessage.includes(keyword)
  );

  // ==============================
  // COMPANY QUERY DETECTION
  // ==============================
  const companyKeywords = [
    // General company
    "company", "about you", "about your company", "organization",
    "business details", "who are you", "linksmart", "link smart",
    "founded", "founder", "ashish anand", "headquarters",
    "hsr layout", "bengaluru",

    // Products & technology
    "smartdna", "smart dna", "non-clonable", "non clonable",
    "non-cloneable", "non cloneable", "qr code", "security label",
    "tamper", "anti-counterfeit", "anti counterfeit", "counterfeit",
    "reusable packaging", "security packaging", "authentication",
    "traceability", "track and trace", "track-and-trace",
    "warranty fraud", "refill fraud", "brand protection", "product security",

    // Differentiators & tech
    "false acceptance", "far", "zero false", "surface agnostic",
    "cyber threat", "fake site", "digital duplicate", "clone", "cloning",
    "ip portfolio",

    // Deployment
    "licensing", "bot model", "build operate transfer",
    "deployment model", "enterprise solution",

    // Industries
    "fmcg", "pharmaceutical", "pharma", "automotive", "fintech",
    "agri-tech", "agritech", "logistics", "supply chain",

    // Competitors
    "authentix", "pharmasecure", "trutag", "competitor",
    "vs ", "compare", "better than", "difference between",

    // Contact
    "contact", "contact details", "email", "phone",
    "address", "website", "reach you", "reach out",

    // Products general
    "product", "products", "services", "solution", "solutions",
    "what do you offer", "what do you do",
  ];

  const isCompanyQuery = companyKeywords.some((keyword) =>
    lastMessage.includes(keyword)
  );

  // ==============================
  // COMPETITOR COMPARISON DETECTION
  // ==============================
  const competitorKeywords = [
    "vs", "vs.", "versus", "compare", "comparison",
    "competitor", "competitors", "better than", "difference between",
    "how does linksmart compare", "authentix", "pharmasecure", "trutag",
    "other companies", "alternative", "alternatives",
    "which is better", "who is better",
  ];

  const isCompetitorQuery = competitorKeywords.some((keyword) =>
    lastMessage.includes(keyword)
  );

  // ==============================
  // PROGRAMMING QUERY DETECTION
  // ==============================
  const programmingKeywords = [
    "array", "function", "variable", "loop", "class", "object",
    "js", "javascript", "python", "java", "typescript", "react",
    "node", "html", "css", "api", "database", "algorithm",
    "data structure", "code", "coding", "programming", "debug",
    "error", "exception", "syntax",
  ];

  const isProgrammingQuery = programmingKeywords.some((keyword) =>
    lastMessage.includes(keyword)
  );

  // ==============================
  // GREETING BRANCH
  // ==============================
  if (isGreeting) {
    console.log("Greeting branch triggered");

    const result = await streamText({
      model: groq("llama-3.3-70b-versatile"),
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `You are a warm, professional AI assistant for Linksmart Technologies Pvt Ltd — a leading anti-counterfeiting and product authentication company based in Bengaluru, India.

${styleGuide}

GREETING INSTRUCTIONS:
- Warmly greet the user back using 👋 or 😊.
- Introduce yourself as the Linksmart virtual assistant in 1 sentence.
- Briefly mention 2–3 things you can help with (e.g. smartDNA® products, company info, competitor comparisons, industry solutions).
- Invite them to ask their question.
- Keep the response short, warm, and inviting — no more than 4–5 lines.`,
        },
        { role: "user", content: lastContent },
      ],
    });

    return result.toUIMessageStreamResponse();
  }

  // ==============================
  // FAREWELL BRANCH
  // ==============================
  if (isFarewell) {
    console.log("Farewell branch triggered");

    const result = await streamText({
      model: groq("llama-3.3-70b-versatile"),
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `You are a warm, professional AI assistant for Linksmart Technologies Pvt Ltd.

${styleGuide}

FAREWELL INSTRUCTIONS:
- Respond warmly and professionally to the user's farewell or thank-you message.
- Express that it was a pleasure assisting them.
- Remind them they can return anytime with questions about Linksmart or its products.
- End with a positive, encouraging sign-off using an emoji (e.g. 🚀 😊 🌟 🤝).
- Keep it short — 2–3 lines maximum.`,
        },
        { role: "user", content: lastContent },
      ],
    });

    return result.toUIMessageStreamResponse();
  }

  // ==============================
  // COMPANY QUERY BRANCH
  // ==============================
  if (isCompanyQuery || isCompetitorQuery) {
    console.log("Company branch triggered | Competitor query:", isCompetitorQuery);

    const systemPrompt = isCompetitorQuery
      ? `You are a professional AI brand ambassador for Linksmart Technologies Pvt Ltd.
Use ONLY the following company information to answer questions.
Be accurate, structured, and do not fabricate any information.

${styleGuide}

COMPETITOR COMPARISON FORMATTING RULES:
- ALWAYS present competitor comparisons using a clean, well-structured markdown table.
- Table rows = features with emojis (e.g. ✅ Unique Identity, 📱 Smartphone Auth, 🔒 Tamper Evidence, 🌐 Surface Flexibility, 0️⃣ Zero False Acceptance, 🛡️ Cyber Threat Protection, ♻️ Reusable Packaging, 📊 Enterprise Analytics).
- Table columns = one per company (LinkSmart smartDNA® + any competitors mentioned).
- Use ✅ for Yes, ❌ for No, ⚠️ for Partial/Varies in table cells.
- After the table, write a confident 2–3 sentence summary highlighting Linksmart's key advantages.

${companyInfo}`
      : `You are a professional AI brand ambassador for Linksmart Technologies Pvt Ltd.
Use ONLY the following company information to answer questions.
Be accurate, structured, and helpful. Do not fabricate any information beyond what is provided.

${styleGuide}

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
          content: `You are a skilled programming assistant. Explain concepts clearly, use examples, and format code properly.

${styleGuide}

- Use 💻 or 🧑‍💻 for code-related section headers.
- Always wrap code examples in proper markdown code blocks with the language name specified.
- Do not include any Linksmart company information in programming answers.`,
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
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `You are a professional and friendly AI assistant representing Linksmart Technologies Pvt Ltd — a leading anti-counterfeiting and product authentication company based in Bengaluru, India.

${styleGuide}

GENERAL QUERY GUIDELINES:
- Answer general knowledge questions helpfully and accurately.
- If the topic relates to supply chain, fraud, packaging, authentication, or tech — naturally mention how Linksmart's expertise is relevant.
- For completely unrelated topics, answer professionally without forcing a company connection.
- Never mention Llama, Meta, OpenAI, or any AI model identity.`,
      },
      ...history,
    ],
  });

  return result.toUIMessageStreamResponse();
}