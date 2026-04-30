import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export function startAutonomousManager(brainDir, intervalMs = 30000) {
  console.log("Starting Moltbot Autonomous Manager...");

  setInterval(async () => {
    try {
      if (!fs.existsSync(brainDir)) return;
      
      const dirs = fs.readdirSync(brainDir).filter(f => {
        try { 
          return fs.statSync(path.join(brainDir, f)).isDirectory() && f.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i); 
        } catch(e) { return false; }
      });

      for (let agentId of dirs) {
        const logPath = path.join(brainDir, agentId, '.system_generated', 'logs', 'overview.txt');
        if (!fs.existsSync(logPath)) continue;

        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim().length > 0).slice(-20);
        
        let needsInput = false;
        let lastMessage = null;
        
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const log = JSON.parse(lines[i]);
            if (log.source === 'MODEL' && (log.content || (log.tool_calls && log.tool_calls[0].name === 'run_command' && log.tool_calls[0].args.SafeToAutoRun === false))) {
              needsInput = true;
              lastMessage = log.content || `Agent requesting to run command: ${log.tool_calls[0].args.CommandLine}`;
              break;
            } else if (log.source === 'USER_EXPLICIT' || log.source === 'USER_IMPLICIT') {
              break; // User or system already responded
            }
          } catch(e) {}
        }

        if (needsInput && lastMessage) {
          console.log(`[Autonomous Manager] Agent ${agentId} is blocked. Evaluating response...`);
          await evaluateAndRespond(agentId, lastMessage);
        }
      }
    } catch (e) {
      console.error("[Autonomous Manager] Polling error:", e);
    }
  }, intervalMs);
}

async function evaluateAndRespond(agentId, promptText) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `You are a Senior Technical Project Manager autonomously overseeing an AI coding agent. 
The agent has paused its work and is asking for your input or approval to proceed.
Agent Request:
"${promptText}"

Decide how to respond to keep the agent working productively on the product build without breaking anything.
If it is asking to run a command, approve it if it looks safe (e.g. npm install, git status, building).
Respond with ONLY the exact text you want to send back to the agent to unblock it.`;

    const result = await model.generateContent(prompt);
    const decision = result.response.text().trim();
    
    console.log(`[Autonomous Manager] Decision for ${agentId}: ${decision}`);
    
    // TODO: Actually send the decision to the Antigravity agent.
    // Since Antigravity is a standalone CLI/extension, we need an API hook here.
    // e.g. execute `antigravity respond ${agentId} "${decision}"`
    console.log(`[Autonomous Manager] Action required: Implement the communication bridge to push this response to the agent's input stream.`);
    
  } catch(e) {
    console.error("[Autonomous Manager] Evaluation error:", e);
  }
}
