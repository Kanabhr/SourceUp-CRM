import { GoogleGenAI } from "@google/genai";

export async function verifyLeadsWithGemini(leads) {
  if (!leads || leads.length === 0) return leads;

  // Initialise lazily — env vars are guaranteed to be loaded by call time
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set — skipping AI verification");
    return leads.map((lead) => ({
      ...lead,
      verificationStatus: "Unverified",
      verificationRemarks: "AI verification unavailable — API key not configured",
    }));
  }

  const ai = new GoogleGenAI({ apiKey });

  // Build numbered list for the prompt — same pattern as BMS
  const numberedList = leads
    .map((lead, i) => {
      const parts = [`${i + 1}.`];
      if (lead.company) parts.push(`Company: ${lead.company}`);
      if (lead.websiteUrl) parts.push(`Web/Instagram: ${lead.websiteUrl}`);
      if (lead.location) parts.push(`Location: ${lead.location}`);
      if (lead.contactPerson) parts.push(`Contact: ${lead.contactPerson}`);
      if (lead.designation) parts.push(`Designation: ${lead.designation}`);
      return parts.join(" | ");
    })
    .join("\n");

  const systemInstruction = `You are a business verification assistant for a sourcing CRM.
You will be given a numbered list of business leads.
For each lead, assess whether the business appears legitimate based on the company name, website/instagram handle, and location.

Rules:
- Reply with exactly ${leads.length} lines, one per lead, in the same order.
- Each line must be: <number>. <verdict> | <one sentence reason>
- verdict must be exactly one of: Verified, Unverified, Fraud
- Use "Verified" if the business name and web presence seem legitimate and consistent.
- Use "Unverified" if there is insufficient information to confirm legitimacy.
- Use "Fraud" only if there are clear red flags (fake-looking domain, suspicious name, obvious scam patterns).
- Do not add extra explanation, headers, or blank lines.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      config: {
        systemInstruction,
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents: numberedList,
    });

    const lines = response.text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return leads.map((lead, i) => {
      const line = lines[i] || "";
      // Extract verdict and reason — format: "1. Verified | reason text"
      const withoutNum = line.replace(/^\d+\.\s*/, "");
      const [verdictRaw, ...reasonParts] = withoutNum.split("|");
      const verdict = verdictRaw?.trim() || "Unverified";
      const reason = reasonParts.join("|").trim() || "";

      // Normalise to schema enum values
      const statusMap = {
        verified: "Verified",
        fraud: "Fraud",
        unverified: "Unverified",
      };
      const verificationStatus =
        statusMap[verdict.toLowerCase()] || "Unverified";

      return {
        ...lead,
        verificationStatus,
        verificationRemarks: reason,
      };
    });
  } catch (err) {
    console.error("Gemini verification error:", err.message);
    // Fallback — mark all as Unverified so import still works
    return leads.map((lead) => ({
      ...lead,
      verificationStatus: "Unverified",
      verificationRemarks: "AI verification unavailable",
    }));
  }
}
