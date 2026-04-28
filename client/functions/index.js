const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenAI, Type } = require("@google/genai");

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

  const { subject, sender, snippet } = request.data;
  
  if (!subject) {
    throw new HttpsError("invalid-argument", "Subject is required.");
  }

  const prompt = `You are Moltbot, the highly intelligent and professional executive assistant for Craig Alewood (CEO of Alewood Group Ltd).
Your job is to read incoming emails and determine the appropriate action.

If the email is an automated system message (like a GitHub alert, a calendar notification, a marketing email, or a system status update), DO NOT draft a reply. Instead, create a task for the CEO.
If the email is from a human or requires a direct response, draft a brief, professional, and clear executive email response on behalf of Craig. Sign off with "Best,\nCraig".

Email Details:
From: ${sender}
Subject: ${subject}
Snippet: ${snippet || "No snippet available"}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      type: { 
        type: Type.STRING, 
        description: "Either 'task' if it's an automated/alert email, or 'reply' if it requires a direct response."
      },
      content: { 
        type: Type.STRING, 
        description: "A short summary of the task to be reviewed/fixed (if 'task'), or the actual text of the drafted response (if 'reply')." 
      }
    },
    required: ["type", "content"]
  };

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    });

    let rawText = response.text || "{}";
    // Remove markdown json wrappers if present
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(rawText);

    return { 
      type: parsed.type === "task" ? "task" : "reply", 
      draft: parsed.content 
    };
  } catch (error) {
    console.error("Draft Generation Error:", error);
    throw new HttpsError("internal", `Failed to generate draft: ${error.message}`);
  }
});
