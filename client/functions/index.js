const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenAI, Type } = require("@google/genai");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

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
  const { bufferToken, text, profileIds, mode, dueAt, mediaAssets, youtubeProfileIds, youtubeTitle, youtubeCategory } = request.data;
  if (!bufferToken || (!text && (!mediaAssets || !mediaAssets.length)) || !profileIds || !profileIds.length) {
    throw new HttpsError("invalid-argument", "Missing required arguments.");
  }

  let postMode = 'addToQueue';
  if (mode === 'shareNow') postMode = 'shareNow';
  if (mode === 'customScheduled') postMode = 'customScheduled';

  try {
    // We post to each channel sequentially
    for (const channelId of profileIds) {
      let assetsStr = '';
      if (mediaAssets && mediaAssets.length > 0) {
        const assetsList = mediaAssets.map(a => {
          if (a.type === 'video') return `{ video: { url: "${a.url}" } }`;
          return `{ image: { url: "${a.url}" } }`;
        }).join(', ');
        assetsStr = `, assets: [${assetsList}]`;
      }

      let metadataStr = '';
      if (youtubeProfileIds && youtubeProfileIds.includes(channelId)) {
        metadataStr = `, metadata: { youtube: { title: ${JSON.stringify(youtubeTitle || text.substring(0, 50))}, categoryId: "${youtubeCategory || '22'}" } }`;
      }

      const inputStr = postMode === 'customScheduled' && dueAt 
        ? `text: $text, channelId: $channelId, schedulingType: automatic, mode: customScheduled, dueAt: "${new Date(dueAt).toISOString()}"${assetsStr}${metadataStr}`
        : `text: $text, channelId: $channelId, schedulingType: automatic, mode: ${postMode}${assetsStr}${metadataStr}`;

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
                ${inputStr}
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

exports.generateUploadUrl = onCall({
  region: "europe-west2",
  enforceAppCheck: false
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");
  
  const { filename, contentType } = request.data;
  if (!filename) throw new HttpsError("invalid-argument", "Filename required.");

  try {
    const bucket = admin.storage().bucket("alewood-uk-marketing-media");
    const file = bucket.file(`marketing-media/${Date.now()}_${filename}`);
    
    // Generate a signed URL for uploading (expires in 15 minutes)
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: contentType || 'application/octet-stream',
    });

    // Public read URL since the bucket has objectViewer for allUsers
    const publicUrl = `https://storage.googleapis.com/alewood-uk-marketing-media/${file.name}`;

    return { uploadUrl, publicUrl };
  } catch (err) {
    console.error(err);
    throw new HttpsError("internal", err.message);
  }
});

exports.processMeetingAudio = onCall({
  region: "europe-west2",
  enforceAppCheck: false,
  timeoutSeconds: 540,
  memory: "1GiB"
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");
  
  const { fileId, googleAccessToken, mimeType, contextCompany, contextPerson } = request.data;
  if (!fileId || !googleAccessToken) {
    throw new HttpsError("invalid-argument", "Missing fileId or googleAccessToken.");
  }

  try {
    // 1. Download audio file from Google Drive using the provided token
    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${googleAccessToken}` }
    });

    if (!driveRes.ok) {
      const err = await driveRes.text();
      console.error("Drive download failed:", err);
      throw new Error(`Failed to download from Drive: ${driveRes.statusText}`);
    }

    const arrayBuffer = await driveRes.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    
    // 2. Call Gemini
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    let prompt = `You are an expert executive assistant. Listen to the provided meeting audio and generate a comprehensive response.
    
The current date and time is: ${new Date().toISOString()}.

1. transcript: A full transcript of the meeting with speaker diarization if possible (Speaker A, Speaker B, etc.).
2. summary: A concise summary of the main points discussed.
3. tasks: Any follow-up tasks that Craig or the user needs to do.
4. activities: A summary of the conversation to be logged as a CRM activity.
5. opportunities: Any sales opportunities mentioned that should be tracked.
6. events: Any calendar events or meetings scheduled during the conversation. Estimate the exact start and end times in ISO 8601 format using the current date and time as reference. Default to 1 hour duration if not specified. Extract attendee emails or names if mentioned.`;

    if (contextCompany || contextPerson) {
      prompt += `\n\nCRITICAL CONTEXT: This meeting is with ${contextPerson || 'someone'} from ${contextCompany || 'a company'}. 
Please explicitly use this context when identifying the company or person in the 'activities' and 'opportunities' fields! Ensure you extract these exact names where applicable.`;
    }
    
    prompt += `\n\nReturn a JSON object matching the provided schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        transcript: { type: Type.STRING },
        summary: { type: Type.STRING },
        tasks: { 
          type: Type.ARRAY, 
          items: {
            type: Type.OBJECT,
            properties: {
              task: { type: Type.STRING },
              priority: { type: Type.STRING },
              dueDate: { type: Type.STRING, description: "YYYY-MM-DD format if mentioned, else empty string" }
            }
          }
        },
        activities: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              company: { type: Type.STRING },
              person: { type: Type.STRING },
              notes: { type: Type.STRING }
            }
          }
        },
        opportunities: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              company: { type: Type.STRING },
              description: { type: Type.STRING },
              value: { type: Type.STRING }
            }
          }
        },
        events: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              startTime: { type: Type.STRING, description: "ISO 8601 format" },
              endTime: { type: Type.STRING, description: "ISO 8601 format" },
              description: { type: Type.STRING },
              attendees: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Array of attendee names or email addresses"
              }
            }
          }
        }
      },
      required: ["transcript", "summary", "tasks", "activities", "opportunities", "events"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Audio,
                  mimeType: mimeType || 'audio/webm'
                }
              },
              { text: prompt }
            ]
          }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    });

    const rawText = response.text;
    const parsedData = JSON.parse(rawText);

    // NotebookLM GCS Drop
    try {
      const bucket = admin.storage().bucket('alewood-notebooklm-sources-2026');
      const filename = `meetings/Meeting_${Date.now()}.txt`;
      const fileContext = `Meeting Context: ${contextPerson || 'someone'} from ${contextCompany || 'a company'}\n\n`;
      const content = `[Meeting]\n${fileContext}Summary:\n${parsedData.summary}\n\nTranscript:\n${parsedData.transcript}`;
      
      await bucket.file(filename).save(content, {
        contentType: 'text/plain'
      });
      console.log(`Successfully dropped ${filename} to NotebookLM GCS bucket.`);
    } catch (e) {
      console.error("Failed to drop to NotebookLM GCS:", e);
      // Non-fatal, don't throw
    }

    return parsedData;

  } catch (err) {
    console.error("Meeting Audio Processing Error:", err);
    throw new HttpsError("invalid-argument", err.message || "Unknown error occurred");
  }
});

exports.sendNewsToNotebook = onCall({
  region: "europe-west2",
  enforceAppCheck: false
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");
  
  const { headline, snippet, sourceUrl } = request.data;
  if (!headline) throw new HttpsError("invalid-argument", "Missing headline.");
  
  try {
    const bucket = admin.storage().bucket('alewood-notebooklm-sources-2026');
    const filename = `news/News_${Date.now()}.txt`;
    const content = `[Industry News]\nHeadline: ${headline}\nSource: ${sourceUrl || 'Unknown'}\n\n${snippet || ''}`;
    
    await bucket.file(filename).save(content, {
      contentType: 'text/plain'
    });
    
    return { success: true };
  } catch (err) {
    console.error("News Drop Error:", err);
    throw new HttpsError("internal", err.message);
  }
});

exports.processReceiptImage = onCall({
  region: "europe-west2",
  enforceAppCheck: false,
  timeoutSeconds: 300
}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated.");
  
  const { base64Image, mimeType } = request.data;
  if (!base64Image) {
    throw new HttpsError("invalid-argument", "Missing base64Image.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    let prompt = `You are an expert expense and receipt data extractor. I am providing you with an image of a receipt.
Please extract the following information and return it as a JSON object:
- supplier: The name of the company or store.
- amount: The total amount paid as a string (e.g. "£45.00").
- vat: The VAT/Tax amount if visible, otherwise "£0.00".
- type: A brief categorization like "Software", "Travel", "Office Supplies", "Meals", etc.
- category: A more specific sub-category if applicable.

If any field cannot be found, provide a reasonable default or an empty string, but ensure the JSON schema is matched.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        supplier: { type: Type.STRING },
        amount: { type: Type.STRING },
        vat: { type: Type.STRING },
        type: { type: Type.STRING },
        category: { type: Type.STRING }
      },
      required: ["supplier", "amount", "vat", "type", "category"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Image,
                  mimeType: mimeType || 'image/jpeg'
                }
              },
              { text: prompt }
            ]
          }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    });

    const rawText = response.text;
    const parsedData = JSON.parse(rawText);

    return parsedData;

  } catch (err) {
    console.error("Receipt Processing Error:", err);
    throw new HttpsError("internal", err.message || "Unknown error occurred while processing receipt");
  }
});

