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

  const { subject, sender, snippet, sentStyle, calendar } = request.data;
  
  if (!subject) {
    throw new HttpsError("invalid-argument", "Subject is required.");
  }

  const prompt = `You are Moltbot, the highly intelligent and professional executive assistant for Craig Alewood (CEO of Alewood Group Ltd).
Your job is to read incoming emails and determine the appropriate action.

If the email is an automated system message (like a GitHub alert, a calendar notification, a marketing email, or a system status update), DO NOT draft a reply. Instead, create a task for the CEO.
If the email is from a human or requires a direct response, draft an email response on behalf of Craig.

IMPORTANT GUIDELINES FOR REPLIES:
1. Tone & Style: Use a more relaxed, conversational tone that matches Craig's style. Here are a few snippets of emails Craig has sent recently to understand his style:
---
${sentStyle || "Keep it relaxed, professional, and brief."}
---
Write the response in this exact style. Do not be overly formal or robotic. Sign off with whatever sign-off Craig typically uses in the examples, or just "Best,\nCraig".

2. Calendar & Meetings: If the sender is proposing a meeting date/time, check Craig's upcoming calendar events below:
---
${calendar || "No calendar context provided. Assume open availability but ask to confirm."}
---
If the proposed time is free, confirm it in the draft. If it conflicts with an existing event, politely reject that time and propose an alternative time based on his availability.

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

exports.bufferGetProfiles = onCall({ 
  region: "europe-west2", 
  enforceAppCheck: false 
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");
  const { bufferToken } = request.data;
  if (!bufferToken) throw new HttpsError("invalid-argument", "Buffer token required.");

  try {
    // 1. Get Organization
    const orgRes = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bufferToken}`
      },
      body: JSON.stringify({
        query: `query { account { organizations { id } } }`
      })
    });
    
    if (!orgRes.ok) {
      const errText = await orgRes.text();
      throw new Error(`Buffer API Error (${orgRes.status}): ${errText}`);
    }
    
    const orgData = await orgRes.json();
    if (orgData.errors) throw new Error(JSON.stringify(orgData.errors));
    
    const orgs = orgData.data?.account?.organizations || [];
    if (orgs.length === 0) throw new Error("No Buffer organizations found for this account.");
    
    const orgId = orgs[0].id;

    // 2. Get Channels
    const chanRes = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bufferToken}`
      },
      body: JSON.stringify({
        query: `query { channels(input: { organizationId: "${orgId}" }) { id name service avatar } }`
      })
    });

    if (!chanRes.ok) {
      const errText = await chanRes.text();
      throw new Error(`Buffer API Error (${chanRes.status}): ${errText}`);
    }

    const chanData = await chanRes.json();
    if (chanData.errors) throw new Error(JSON.stringify(chanData.errors));

    const channels = chanData.data?.channels || [];
    
    // Map to old profiles format for frontend compatibility
    return channels.map(c => ({
      id: c.id,
      service: c.service,
      avatar: c.avatar,
      formatted_username: c.name
    }));

  } catch (err) {
    console.error(err);
    throw new HttpsError("internal", err.message);
  }
});

exports.bufferCreateUpdate = onCall({ 
  region: "europe-west2", 
  enforceAppCheck: false 
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");
  const { bufferToken, text, profileIds } = request.data;
  if (!bufferToken || !text || !profileIds || !profileIds.length) {
    throw new HttpsError("invalid-argument", "Missing required arguments.");
  }

  try {
    // We post to each channel sequentially
    for (const channelId of profileIds) {
      const res = await fetch('https://api.buffer.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bufferToken}`
        },
        body: JSON.stringify({
          query: `
            mutation CreatePost($channelId: ChannelId!, $text: String!) {
              createPost(input: {
                text: $text,
                channelId: $channelId,
                schedulingType: automatic,
                mode: addToQueue
              }) {
                ... on PostActionSuccess {
                  post { id }
                }
                ... on MutationError {
                  message
                }
              }
            }
          `,
          variables: {
            channelId: channelId,
            text: text
          }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Buffer API Error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      if (data.errors) throw new Error(JSON.stringify(data.errors));
      
      const createPostResult = data.data?.createPost;
      if (createPostResult?.message) {
        // MutationError returned a message
        throw new Error(createPostResult.message);
      }
    }

    return { success: true };
  } catch (err) {
    console.error(err);
    throw new HttpsError("internal", err.message);
  }
});
