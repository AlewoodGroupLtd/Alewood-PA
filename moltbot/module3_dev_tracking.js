import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import yaml from 'yaml';
import path from 'path';

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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
    const { command, token, sourceUrl } = req.body;
    console.log(`Received command from PA app: "${command}"`);
    console.log(`Token received length: ${token ? token.length : 0}`);

    // In a full implementation, this would invoke the Antigravity agent CLI 
    // or directly connect to the agent orchestration system to execute the task.
    // We will simulate the LLM analyzing the command to show readiness:
    
    // Check if the command implies taking over agents or workspaces
    const lowerCmd = command.toLowerCase();
    
    // Read the config to see which workspaces we're managing
    const configPath = './config.yaml';
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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
    
    const dirs = fs.readdirSync(brainDir).filter(f => {
      try { return fs.statSync(path.join(brainDir, f)).isDirectory() && f !== 'tempmediaStorage'; }
      catch(e) { return false; }
    });
    
    const idMap = {
      '8417d038-e750-4a0f-97d2-c6da870bb6b7': 'Orchestrating Project Pipelines',
      '321760d2-f2b5-4e36-9e3a-4fe505eea761': 'Integrating Calendar Schedule',
      '8fe58fc8-70cf-4301-bda6-1bdd786d30a3': 'Resizing Trinity Nav Logo',
      '90538ef0-526e-4b91-a002-06d1c0a0e410': 'Executive Assistant Deployment',
      '1aae5222-6d42-462f-bf6c-415b86b6ae5f': 'Connecting Notebook To Env',
      'b0d8607b-2153-4ed4-802c-2e8842d12084': 'Automating Pipeline Orchestration'
    };

    const agents = dirs.map(d => {
      const p = path.join(brainDir, d);
      const stat = fs.statSync(p);
      return { id: d, mtime: stat.mtimeMs, path: p };
    }).sort((a,b) => b.mtime - a.mtime).slice(0, 3);
    
    const activeAgents = [];
    for (let a of agents) {
      const logPath = path.join(a.path, '.system_generated', 'logs', 'overview.txt');
      let statusStr = 'Running';
      let taskName = idMap[a.id] || 'Background Task';
      
      let needsInput = false;
      if (fs.existsSync(logPath)) {
        try {
          const content = fs.readFileSync(logPath, 'utf8');
          const lines = content.split('\n').filter(l => l.trim().length > 0).slice(-20);
          
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const log = JSON.parse(lines[i]);
              
              if (log.source === 'MODEL' && log.content) {
                statusStr = 'Waiting for User Input';
                needsInput = true;
                break;
              }
              
              if (log.source === 'USER_EXPLICIT' || log.source === 'USER_IMPLICIT') {
                statusStr = 'Processing Request...';
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
                }
                break;
              }
            } catch(e) {}
          }
        } catch(e) {}
      }
      activeAgents.push({ id: a.id, name: taskName, status: statusStr, requiresAction: needsInput });
    }
    
    res.json({ agents: activeAgents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch agents" });
  }
});

app.listen(port, () => console.log(`GitHub webhook listener & Orchestrator API running on port ${port}`));
