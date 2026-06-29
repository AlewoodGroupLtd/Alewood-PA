const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 3600000 }
});

async function main() {
  const filePath = 'C:\\Github\\Alewood-PA\\Meeting_2026-06-29T13_03_58.317Z.webm';
  console.log('Uploading file to Gemini...');
  
  const uploadRes = await ai.files.upload({
    file: filePath,
    config: { mimeType: 'audio/webm' }
  });
  
  console.log(`Upload complete. URI: ${uploadRes.uri}`);
  
  console.log('Waiting for file to finish processing...');
  while (true) {
    const fileInfo = await ai.files.get({ name: uploadRes.name });
    console.log(`State: ${fileInfo.state}`);
    if (fileInfo.state === 'ACTIVE') break;
    if (fileInfo.state === 'FAILED') throw new Error('File processing failed.');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('File is ready. Generating content...');
  
  const schema = {
    type: 'OBJECT',
    properties: {
      transcript: { type: 'STRING', description: "Full transcript of the meeting" },
      summary: { type: 'STRING', description: "Detailed executive summary" },
      tasks: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            task: { type: 'STRING' },
            assignee: { type: 'STRING' },
            dueDate: { type: 'STRING' },
            priority: { type: 'STRING' },
            status: { type: 'STRING' }
          }
        }
      },
      activities: { type: 'ARRAY', items: { type: 'STRING' } },
      opportunities: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            description: { type: 'STRING' },
            value: { type: 'NUMBER' },
            probability: { type: 'NUMBER' }
          }
        }
      },
      events: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            description: { type: 'STRING' },
            date: { type: 'STRING' },
            attendees: { type: 'ARRAY', items: { type: 'STRING' } }
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
              fileData: {
                fileUri: uploadRes.uri,
                mimeType: 'audio/webm'
              }
            },
            {
              text: 'Analyze this meeting recording and provide the transcript, a summary, action items/tasks, activities discussed, potential opportunities, and upcoming events.'
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema
      }
  });

  const outputFilePath = 'C:\\Github\\Alewood-PA\\Meeting_Analysis.json';
  fs.writeFileSync(outputFilePath, response.text, 'utf-8');
  console.log(`Successfully generated and saved to ${outputFilePath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
