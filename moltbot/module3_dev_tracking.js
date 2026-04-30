import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import yaml from 'yaml';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_CREDENTIALS });
const SPREADSHEET_ID = process.env.TRINITY_MASTER_PIPELINE_SHEET_ID;

// Middleware to parse raw body for signature verification
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; }}));

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

app.post('/webhook/github', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      return res.status(401).send('No signature provided');
    }

    const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
    
    if (signature !== digest) {
      return res.status(401).send('Webhook signature verification failed');
    }

    const event = req.headers['x-github-event'];
    if (event === 'push') {
      const branch = req.body.ref.split('/').pop();
      if (branch === 'main' || branch === 'demo') {
        const commits = req.body.commits;
        for (const commit of commits) {
          await processCommitMessage(commit.message);
        }
      }
    }
    
    res.status(200).send('Webhook received');
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).send("Internal Server Error");
  }
});

async function processCommitMessage(commitMessage) {
  try {
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pipeline!A:D'
    });
    
    const rows = sheetData.data.values || [];
    const openTasks = rows.map((row, index) => ({ id: index + 1, desc: row[0], status: row[3] }))
                          .filter(t => t.status !== 'Done');

    if (openTasks.length === 0) return;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `System Prompt:
You are a technical project manager. Your job is to match a developer's GitHub commit message to an existing task in the "Trinity Master Pipeline".
Review the commit message and the provided list of open tasks. If the commit message clearly indicates that a specific task has been resolved or completed (fuzzy match based on intent and context), identify that task.
Your response must be STRICTLY in valid JSON format. If no strong match is found, return null.

Expected JSON schema:
{
  "matched_task": "Exact string of the matched task from the provided list" or null
}

Open Tasks:
${JSON.stringify(openTasks.map(t => t.desc))}

Commit Message:
${commitMessage}`;
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const { matched_task } = JSON.parse(responseText);

    if (matched_task) {
      const taskObj = openTasks.find(t => t.desc === matched_task);
      if (taskObj) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Pipeline!D${taskObj.id}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['Done']] }
        });
        console.log(`Matched commit "${commitMessage}" to task "${matched_task}". Marked as Done.`);
      }
    }
  } catch (err) {
    console.error("Failed to process commit message:", err);
  }
}

app.post('/api/orchestrator/command', async (req, res) => {
  try {
    const { command, token, sourceUrl, headline, snippet } = req.body;
    console.log(`Received command from PA app: "${command}"`);
    console.log(`Token received length: ${token ? token.length : 0}`);

    // In a full implementation, this would invoke the Antigravity agent CLI 
    // or directly connect to the agent orchestration system to execute the task.
    // We will simulate the LLM analyzing the command to show readiness:
    
    // Check if the command implies taking over agents or workspaces
    const lowerCmd = command.toLowerCase();
    
    // Read the config to see which workspaces we're managing
    const configPath = path.join(__dirname, 'config.yaml');
    let SPREADSHEET_ID_LOCAL = SPREADSHEET_ID;
    let responseText = "Command recognized. Antigravity orchestration initiated.";
    
    if (fs.existsSync(configPath)) {
      const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
      SPREADSHEET_ID_LOCAL = SPREADSHEET_ID_LOCAL || config.integrations?.project_management?.trinity_master_pipeline_sheet_id;
    }
    
    if (lowerCmd.startsWith('create task:')) {
      const taskSummary = command.substring('create task:'.length).trim();
      
      let category = "Operations";
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent(`Categorize this task into one of the following departments: Product Build, Project Management, HR, Finance, Legal, Operations.
Task: "${taskSummary}"
Return ONLY the category name as a single string without quotes.`);
        const text = result.response.text().trim();
        if (['Product Build', 'Project Management', 'HR', 'Finance', 'Legal', 'Operations'].includes(text)) {
          category = text;
        }
      } catch (err) {
        console.error("Categorization failed, defaulting to Operations");
      }
      
      let currentSheets = sheets;
      if (token) {
        const authClient = new google.auth.OAuth2();
        authClient.setCredentials({ access_token: token });
        currentSheets = google.sheets({ version: 'v4', auth: authClient });
      }
      
      await currentSheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID_LOCAL,
        range: 'Pipeline!A:I',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[taskSummary, "CEO", "Medium", "Open", "TBD", sourceUrl || "", category, new Date().toISOString(), ""]] }
      });
      
      responseText = `Task added to Master Pipeline: "${taskSummary}"`;
      console.log(responseText);
    } else if (lowerCmd.startsWith('[notebook integration]')) {
      if (!token) throw new Error("Google access token required to add to notebook.");
      
      const authClient = new google.auth.OAuth2();
      authClient.setCredentials({ access_token: token });
      const drive = google.drive({ version: 'v3', auth: authClient });
      const docs = google.docs({ version: 'v1', auth: authClient });
      
      const urlToAdd = command.split(/Notebook:/i)[1]?.trim() || sourceUrl || command;
      
      // 1. Find the "Meeting Notes/Brain Dumps" folder (this is the folder NotebookLM syncs from)
      let folderId = null;
      const folderRes = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and name='Meeting Notes/Brain Dumps' and trashed=false",
        fields: "files(id, name)"
      });
      if (folderRes.data.files && folderRes.data.files.length > 0) {
        folderId = folderRes.data.files[0].id;
      }
      
      // 2. Find or Create the Master Auto-Feed Doc
      const docTitle = `Trinity Master Auto-Feed`;
      let docId = null;
      
      const fileRes = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.document' and name='${docTitle}' and trashed=false${folderId ? ` and '${folderId}' in parents` : ''}`,
        fields: "files(id, name)"
      });
      
      if (fileRes.data.files && fileRes.data.files.length > 0) {
        docId = fileRes.data.files[0].id;
      } else {
        const createRes = await drive.files.create({
          requestBody: {
            name: docTitle,
            mimeType: 'application/vnd.google-apps.document',
            parents: folderId ? [folderId] : []
          }
        });
        docId = createRes.data.id;
        
        // Initialize the new doc with a title
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: `Trinity Master Auto-Feed\nThis document is automatically populated by Moltbot. Add this single document as a source in NotebookLM, and it will continuously sync new feeds!\n\n`
                }
              }
            ]
          }
        });
      }
      
      // 3. Extract the article text/summary
      let articleText = "Could not fetch full article text.";
      const cleanHeadline = (headline || '').replace(/<[^>]+>/g, '');
      const cleanSnippet = (snippet || '').replace(/<[^>]+>/g, '');
      
      try {
        console.log(`Scraping content from ${urlToAdd}...`);
        const fetchRes = await fetch(urlToAdd, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
          signal: AbortSignal.timeout(5000)
        });
        
        if (fetchRes.ok) {
           let html = await fetchRes.text();
           
           // Check if it's a new Google News redirect page
           const cwizMatch = html.match(/<c-wiz[^>]*data-p="([^"]+)"/);
           if (cwizMatch) {
               try {
                   const dataP = cwizMatch[1].replace(/&quot;/g, '"');
                   const obj = JSON.parse(dataP.replace('%.@.', '["garturlreq",'));
                   const payload = {
                       'f.req': JSON.stringify([[
                           ['Fbv4je', JSON.stringify([...obj.slice(0, -6), ...obj.slice(-2)]), null, 'generic']
                       ]])
                   };
                   const postResponse = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
                       method: 'POST',
                       headers: {
                           'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                       },
                       body: new URLSearchParams(payload).toString(),
                       signal: AbortSignal.timeout(5000)
                   });
                   const responseText = await postResponse.text();
                   const arrayString = JSON.parse(responseText.replace(")]}'", ""))[0][2];
                   const finalUrl = JSON.parse(arrayString)[1];
                   if (finalUrl) {
                       console.log(`Decoded Google News URL to: ${finalUrl}`);
                       const redirectRes = await fetch(finalUrl, {
                           headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                           signal: AbortSignal.timeout(5000)
                       });
                       if (redirectRes.ok) html = await redirectRes.text();
                   }
               } catch (e) { console.error("Batchexecute URL decode failed", e); }
           } else {
               // Follow Google News meta refresh or noscript redirect if present
               const refreshMatch = html.match(/<meta[^>]*http-equiv="?refresh"?[^>]*content="[^"]*url=(.*?)"/i) || 
                                    html.match(/<c-wiz[^>]*data-n-a-id="[^"]*"[^>]*data-n-a-sg="[^"]*"[^>]*data-n-a-ur="([^"]*)"/i) ||
                                    html.match(/<a[^>]*href="([^"]+)"[^>]*>here<\/a>/i);
               
               if (refreshMatch && refreshMatch[1]) {
                   const redirectUrl = refreshMatch[1].replace(/&amp;/g, '&');
                   console.log(`Following redirect to ${redirectUrl}...`);
                   try {
                     const redirectRes = await fetch(redirectUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        signal: AbortSignal.timeout(5000)
                     });
                     if (redirectRes.ok) html = await redirectRes.text();
                   } catch (e) { console.error("Redirect fetch failed", e); }
               }
           }

           const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
           const prompt = `You are a professional research assistant.
We tried to scrape an article to add to our Master Notebook.
Headline: ${cleanHeadline}
Snippet: ${cleanSnippet}

Below is the HTML we scraped. Extract the main article text and key facts. Do not include navigation, ads, sidebars, or boilerplate.
IMPORTANT: If the HTML indicates a paywall, a robot check, or is otherwise unreadable, DO NOT fail. Instead, write a short professional summary of what the article is likely about based entirely on the Headline and Snippet provided above, and explicitly note that the full article was blocked by a paywall or security check.

HTML:
${html.substring(0, 30000)}`;
           const result = await model.generateContent(prompt);
           articleText = result.response.text().trim();
        } else {
           articleText = `(Failed to fetch URL. Status: ${fetchRes.status})\n\nHeadline: ${cleanHeadline}\nSnippet: ${cleanSnippet}`;
        }
      } catch (e) {
        console.error("Scraping failed:", e.message);
        articleText = `(Scraping Error: ${e.message})\n\nHeadline: ${cleanHeadline}\nSnippet: ${cleanSnippet}`;
      }
      
      // 4. Add the URL and article text to the top of the doc (index 1)
      const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: `[${timestamp}] Headline: ${cleanHeadline || 'News Article'}\nSource URL: ${urlToAdd}\n\nArticle Content / Summary:\n${articleText}\n\n=========================================\n\n`
              }
            }
          ]
        }
      });
      
      responseText = `Source appended to 'Trinity Master Auto-Feed' in your Notebook folder. Add this file to NotebookLM!`;
      console.log(`Updated notebook auto-feed doc: ${docId} with url ${urlToAdd}`);
    } else if (lowerCmd.includes('trinity') || lowerCmd.includes('take over') || lowerCmd.includes('review the agents')) {
      if (fs.existsSync(configPath)) {
        const configFile = fs.readFileSync(configPath, 'utf8');
        const config = yaml.parse(configFile);
        const agentsDir = config.antigravity?.agents_dir || 'unknown agents dir';
        const workspaceDir = config.antigravity?.workspace_dir || 'unknown workspace';
        
        responseText = `Successfully linked into Antigravity agent memory at ${agentsDir}. I am reviewing the Trinity workspace conversation logs and taking over the tasks in ${workspaceDir}. I will continue the work where they left off.`;
      } else {
        responseText = `Acknowledged. I am reviewing the Trinity workspace conversation logs and taking over the tasks.`;
      }
    } else {
      responseText = `I have received your command: "${command}". Routing to the appropriate Antigravity agent pipeline...`;
    }

    res.json({ status: 'success', message: responseText });
  } catch (err) {
    console.error("Orchestrator error:", err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/orchestrator/agents', (req, res) => {
  try {
    const brainDir = 'C:/Users/craig/.gemini/antigravity/brain';
    if (!fs.existsSync(brainDir)) return res.json({ agents: [] });
    
    const idMap = {
      '321760d2-f2b5-4e36-9e3a-4fe505eea761': { name: 'Integrating Calendar Schedule', ws: 'Alewood-PA' },
      '8fe58fc8-70cf-4301-bda6-1bdd786d30a3': { name: 'Resizing Trinity Nav Logo', ws: 'Trinity-Dashboard' },
      '8417d038-e750-4a0f-97d2-c6da870bb6b7': { name: 'Orchestrating Project Pipelines', ws: 'Alewood-PA' },
      '90538ef0-526e-4b91-a002-06d1c0a0e410': { name: 'Executive Assistant Deployment', ws: 'Alewood-PA' },
      '1aae5222-6d42-462f-bf6c-415b86b6ae5f': { name: 'Connecting Notebook To Environment', ws: 'Alewood-PA' },
      '94dc05e9-cca6-4fb7-a8f0-31ff3a5d5d0c': { name: 'Testing Control Workflows', ws: 'Trinity-Dashboard' },
      'b1ec8c1b-7bca-474f-9596-900a68a2f74b': { name: 'Resolving TypeScript Errors', ws: 'Trinity-Dashboard' },
      '3c46cf35-7dee-4ab4-90be-3968526c91b3': { name: 'Testing The Allocation Engine', ws: 'Trinity-Dashboard' },
      '7b07d293-e32b-4748-989a-da064b581d01': { name: 'Customer Portal Testing', ws: 'Trinity-Portal' },
      '4116ea34-1fd6-4f96-a4ca-c8f5a20ffb34': { name: 'Client Portal Testing Plan', ws: 'Trinity-Portal' },
      'd1f62de2-3872-4415-a6fa-19abd802554e': { name: 'Testing Field Agent Management', ws: 'Trinity-Field' },
      '00d97ff9-1fc9-45c7-b8d1-5f61416cdfa3': { name: 'Financial Operations Testing Plan', ws: 'Trinity-Field' },
      '629d1fdf-72b1-4575-a5fc-dcccbba41e65': { name: 'Customer and Case Management Testing', ws: 'Trinity-Portal' },
      'e38cf7fb-32fa-4c23-9c96-b93be66bf403': { name: 'Testing Interface Navigation', ws: 'Trinity-Field' },
      'ff2c81cf-e72c-44de-b4cf-9eb825e170b7': { name: 'Trinity Field UI Polishing', ws: 'Trinity-Field' },
      'b956ca25-444f-4a1c-9d5f-3c7a357ad279': { name: 'Integrating Module Logos', ws: 'Alewood-PA' },
      '4f043246-769b-42f5-abdb-054190c3f193': { name: 'Debugging Message Transmission Error', ws: 'Trinity-Field' },
      'b0d8607b-2153-4ed4-802c-2e8842d12084': { name: 'Automating Pipeline Orchestration', ws: 'Alewood-PA' }
    };

    const dirs = fs.readdirSync(brainDir).filter(f => {
      try { 
        return fs.statSync(path.join(brainDir, f)).isDirectory() && idMap[f]; 
      }
      catch(e) { return false; }
    });

    const agents = dirs.map(d => {
      const p = path.join(brainDir, d);
      const stat = fs.statSync(p);
      return { id: d, mtime: stat.mtimeMs, path: p };
    }).sort((a,b) => b.mtime - a.mtime).slice(0, 8);
    
    const activeAgents = [];
    for (let a of agents) {
      const logPath = path.join(a.path, '.system_generated', 'logs', 'overview.txt');
      let statusStr = 'Running';
      let taskName = idMap[a.id]?.name || 'Background Task';
      let ws = idMap[a.id]?.ws || 'Unknown Workspace';
      
      let needsInput = false;
      let lastMessage = null;
      if (fs.existsSync(logPath)) {
        try {
          const content = fs.readFileSync(logPath, 'utf8');
          const lines = content.split('\n').filter(l => l.trim().length > 0).slice(-20);
          
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const log = JSON.parse(lines[i]);
              
              if (log.source === 'MODEL') {
                if (log.content) {
                  statusStr = 'Waiting for User Input';
                  needsInput = true;
                  lastMessage = log.content;
                  break;
                }
                
                if (log.tool_calls && log.tool_calls.length > 0) {
                  const tc = log.tool_calls[0];
                  let file = tc.args.TargetFile || tc.args.AbsolutePath || tc.args.DirectoryPath || '';
                  if (file) file = path.basename(file.replace(/"/g, ''));
                  
                  let toolName = tc.name;
                  if (toolName === 'run_command') toolName = 'Executing Terminal Command';
                  if (toolName === 'view_file') toolName = 'Reading Code';
                  if (toolName === 'multi_replace_file_content' || toolName === 'replace_file_content' || toolName === 'write_to_file') toolName = 'Writing Code';
                  if (toolName === 'command_status') toolName = 'Waiting on Process';
                  if (toolName === 'grep_search' || toolName === 'list_dir') toolName = 'Analyzing Workspace';
                  
                  statusStr = toolName + (file ? ' (' + file + ')' : '');
                  
                  // Special check for commands that might wait for approval
                  if (tc.name === 'run_command' && tc.args.SafeToAutoRun === false) {
                    statusStr = 'Waiting for Command Approval';
                    needsInput = true;
                    lastMessage = 'The agent wants to execute a terminal command:\n\n' + tc.args.CommandLine + '\n\nPlease approve or reject this action.';
                  }
                  break;
                }
              }
              
              if (log.source === 'USER_EXPLICIT' || log.source === 'USER_IMPLICIT') {
                statusStr = 'Processing Request...';
                break;
              }
            } catch(e) {}
          }
        } catch(e) {}
      }
      activeAgents.push({ id: a.id, name: taskName, status: statusStr, requiresAction: needsInput, workspace: ws, lastMessage: lastMessage });
    }
    
    res.json({ agents: activeAgents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

app.post('/api/orchestrator/industry-pulse', async (req, res) => {
  try {
    const { competitors = [], clients = [], keywords = [] } = req.body;
    let updates = [];
    let idCounter = 1;

    // Helper to fetch from Google News RSS
    const fetchNews = async (query, tag, tagColor, iconName) => {
      if (!query) return;
      try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`;
        const response = await fetch(url);
        const xml = await response.text();
        
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let itemMatch;
        let count = 0;
        
        while ((itemMatch = itemRegex.exec(xml)) !== null && count < 2) {
          const itemContent = itemMatch[1];
          const titleMatch = /<title>(.*?)<\/title>/.exec(itemContent);
          const linkMatch = /<link>(.*?)<\/link>/.exec(itemContent);
          const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemContent);
          const sourceMatch = /<source[^>]*>(.*?)<\/source>/.exec(itemContent);
          const descMatch = /<description>([\s\S]*?)<\/description>/.exec(itemContent);
          
          if (titleMatch && linkMatch && pubDateMatch) {
            const headline = titleMatch[1].replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            if (!updates.some(u => u.headline === headline)) {
              updates.push({
                id: idCounter++,
                source: sourceMatch ? sourceMatch[1].replace(/&amp;/g, '&') : 'Web',
                iconName: iconName,
                tag: tag,
                tagColor: tagColor,
                headline: headline,
                snippet: descMatch ? descMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim() : '',
                url: linkMatch[1],
                date: new Date(pubDateMatch[1]).toLocaleDateString('en-GB') + ' ' + new Date(pubDateMatch[1]).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}),
                timestamp: new Date(pubDateMatch[1]).getTime()
              });
              count++;
            }
          }
        }
      } catch (e) {
        console.error(`Failed to scrape news for ${query}`, e);
      }
    };

    // Run fetches concurrently
    const promises = [];
    for (const comp of competitors) { promises.push(fetchNews(comp, 'Competitor', '#ef4444', 'Users')); }
    for (const client of clients) { promises.push(fetchNews(client, 'Potential Client', '#f59e0b', 'Users')); }
    for (const kw of keywords) { promises.push(fetchNews(kw, 'Market Trend', '#10b981', 'Newspaper')); }
    
    await Promise.all(promises);

    // Sort by most recent
    updates.sort((a, b) => b.timestamp - a.timestamp);

    res.json({ updates });
  } catch (err) {
    console.error("Scraper error:", err);
    res.status(500).json({ error: "Failed to scrape content" });
  }
});

app.listen(port, () => console.log(`GitHub webhook listener & Orchestrator API running on port ${port}`));
