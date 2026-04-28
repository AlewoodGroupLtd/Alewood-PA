import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize APIs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_CREDENTIALS });

const SPREADSHEET_ID = process.env.TRINITY_MASTER_PIPELINE_SHEET_ID;
const SHEET_NAME = 'Pipeline'; // e.g., "Pipeline!A:D"

/**
 * Parses new notes and appends extracted tasks to the Google Sheet.
 */
export async function processNewNotes(noteContent) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  
  const prompt = `System Prompt:
You are an expert executive assistant. Analyze the following meeting notes, brain dumps, or NotebookLM insights and extract all actionable tasks. 
For each task, provide a concise summary, an assignee (if explicitly mentioned or implied for the CEO), a priority level (High, Medium, Low), and a due date (if mentioned, format as YYYY-MM-DD; if not, use 'TBD').
Your response must be STRICTLY in valid JSON format containing an array of objects. Do not include any markdown formatting or explanatory text outside the JSON block.

Expected JSON schema:
[
  {
    "task": "Brief description of the task",
    "assignee": "Name or 'CEO'",
    "priority": "High | Medium | Low",
    "dueDate": "YYYY-MM-DD or 'TBD'"
  }
]

Notes Content:
${noteContent}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
  
  try {
    const tasks = JSON.parse(responseText);
    
    if (tasks.length > 0) {
      const rows = tasks.map(t => [t.task, t.assignee, t.priority, "Open", t.dueDate || "TBD"]);
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:E`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows }
      });
      console.log(`Appended ${tasks.length} tasks to Master Pipeline.`);
    }
  } catch (err) {
    console.error("Failed to parse task extraction response:", err);
  }
}

/**
 * Checks emails/communications to update existing tasks to "Done".
 */
export async function processStatusUpdates(communicationContent) {
  try {
    // Fetch current open tasks
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:E`
    });
    
    const rows = sheetData.data.values;
    if (!rows || rows.length === 0) return;
    
    const openTasks = rows.map((row, index) => ({ id: index + 1, desc: row[0], status: row[3] }))
                          .filter(t => t.status !== 'Done');
    
    if (openTasks.length === 0) return;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `System Prompt:
You are an AI assistant managing a project pipeline. Analyze the provided email or notebook update alongside the list of currently open tasks.
Determine if the communication confirms that any of the open tasks have been successfully completed.
Your response must be STRICTLY in valid JSON format containing an array of exactly matched task descriptions that are now "Done". Return an empty array if no tasks are confirmed complete.

Expected JSON schema:
{
  "completed_tasks": ["Exact string of task 1 from the provided list", "Exact string of task 2"]
}

Open Tasks:
${JSON.stringify(openTasks.map(t => t.desc))}

Communication:
${communicationContent}`;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const { completed_tasks } = JSON.parse(responseText);
    
    for (const completedTask of completed_tasks) {
      const taskObj = openTasks.find(t => t.desc === completedTask);
      if (taskObj) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!D${taskObj.id}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['Done']] }
        });
        console.log(`Marked task '${completedTask}' as Done.`);
      }
    }
  } catch (err) {
    console.error("Failed to process status update:", err);
  }
}

/**
 * Polls Google Drive for new files in a specific folder and extracts their text.
 */
export async function startDrivePolling(folderName, intervalMinutes = 15) {
  const drive = google.drive({ version: 'v3', auth: process.env.GOOGLE_CREDENTIALS });
  const docs = google.docs({ version: 'v1', auth: process.env.GOOGLE_CREDENTIALS });
  
  // Keep track of the last time we synced to avoid duplicate parsing
  let lastSyncTime = new Date().toISOString(); 
  console.log(`Started Google Drive polling for folder: "${folderName}". Syncing every ${intervalMinutes} minutes.`);

  setInterval(async () => {
    try {
      // Find the specific folder by name
      const folderRes = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });
      
      if (folderRes.data.files.length === 0) {
        console.warn(`Drive Polling Warning: Folder '${folderName}' not found in Google Drive.`);
        return;
      }
      const folderId = folderRes.data.files[0].id;

      // Find Document files modified since lastSyncTime inside the folder
      const filesRes = await drive.files.list({
        q: `'${folderId}' in parents and modifiedTime > '${lastSyncTime}' and mimeType='application/vnd.google-apps.document' and trashed=false`,
        fields: 'files(id, name, modifiedTime)',
      });

      const files = filesRes.data.files;
      if (files && files.length > 0) {
        console.log(`Found ${files.length} new or updated document(s). Processing...`);
        
        for (const file of files) {
          try {
            const doc = await docs.documents.get({ documentId: file.id });
            let content = '';
            
            if (doc.data.body && doc.data.body.content) {
              doc.data.body.content.forEach(element => {
                if (element.paragraph) {
                  element.paragraph.elements.forEach(el => {
                    if (el.textRun) content += el.textRun.content;
                  });
                }
              });
            }
            
            if (content.trim()) {
              console.log(`Extracting tasks from: ${file.name}`);
              await processNewNotes(content);
            }
          } catch (err) {
            console.error(`Error processing file ${file.name}:`, err);
          }
        }
      }
      
      // Update sync time so we only process future changes next time
      lastSyncTime = new Date().toISOString(); 
    } catch (err) {
      console.error("Error polling Google Drive:", err);
    }
  }, intervalMinutes * 60 * 1000);
}

/**
 * Polls NotebookLM Enterprise API for newly added notes and responses.
 */
export async function startNotebookLMPolling(notebookId, intervalMinutes = 15) {
  let lastSyncTime = new Date().toISOString();
  console.log(`Started NotebookLM polling for Notebook ID: "${notebookId}". Syncing every ${intervalMinutes} minutes.`);

  setInterval(async () => {
    try {
      // Simulate fetching new notes since lastSyncTime using standard REST structure
      const response = await fetch(`https://notebooklm.googleapis.com/v1/notebooks/${notebookId}/notes?updatedAfter=${lastSyncTime}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.GOOGLE_CREDENTIALS}`, // Assuming service account token
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
           console.warn(`NotebookLM API returned ${response.status}. Ensure the API is fully enabled for Alewood.`);
           return;
        }
        throw new Error(`NotebookLM API Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const notes = data.notes || [];

      if (notes.length > 0) {
        console.log(`Found ${notes.length} new or updated NotebookLM note(s). Processing...`);
        
        for (const note of notes) {
          if (note.textContent && note.textContent.trim()) {
            console.log(`Extracting tasks from NotebookLM Note ID: ${note.id}`);
            await processNewNotes(note.textContent);
          }
        }
      }
      
      lastSyncTime = new Date().toISOString(); 
    } catch (err) {
      console.error("Error polling NotebookLM:", err);
    }
  }, intervalMinutes * 60 * 1000);
}
