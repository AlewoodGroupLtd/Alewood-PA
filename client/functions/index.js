const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenAI } = require("@google/genai");

exports.generateDraft = onCall({ 
  region: "europe-west2", 
  enforceAppCheck: false,
  serviceAccount: "moltbot-service-account@alewood-uk-trinity.iam.gserviceaccount.com"
}, async (request) => {
  // Ensure the user is authenticated
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Ensure only the CEO can call it
  if (request.auth.token.email !== 'craig@alewood.co.uk') {
    throw new HttpsError(
      "permission-denied",
      "Only the CEO is authorized to generate drafts."
    );
  }

  const { subject, sender } = request.data;
  
  if (!subject) {
    throw new HttpsError("invalid-argument", "Subject is required.");
  }

  const prompt = `You are Moltbot, the highly intelligent and professional executive assistant for Craig Alewood (CEO of Alewood Group Ltd).
You need to write a brief, professional, and clear email response draft on behalf of Craig.
Keep the tone confident, concise, and executive. Do not use generic pleasantries, just get straight to the point.
Sign off with "Best,\nCraig".

Email Details:
From: ${sender}
Subject: ${subject}

Please provide ONLY the text for the drafted response. Do not include any formatting or markdown around it.`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY" });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    const draft = response.text;

    if (!draft) {
        throw new Error("Empty response from Gemini");
    }

    return { draft: draft.trim() };
  } catch (error) {
    console.error("Draft Generation Error:", error);
    throw new HttpsError("internal", `Failed to generate draft: ${error.message}`);
  }
});
