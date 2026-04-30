import fs from 'fs';
import yaml from 'yaml';
import './module3_dev_tracking.js';
import { startDrivePolling, startNotebookLMPolling } from './module2_pm_sync.js';
import { startAutonomousManager } from './autonomous_manager.js';

console.log("Starting Moltbot Orchestrator...");

try {
  const configFile = fs.readFileSync('./config.yaml', 'utf8');
  const config = yaml.parse(configFile);
  console.log(`Moltbot Configuration Loaded. Mode: ${config.orchestrator.mode}`);
  
  if (config.github?.webhook_enabled) {
    console.log(`GitHub Webhook Tracking is ACTIVE.`);
  }

  if (config.project_management?.sync_enabled) {
    const folderToMonitor = config.project_management.docs_folder_monitor;
    console.log(`Google Drive PM Sync is ACTIVE. Starting monitor on folder: "${folderToMonitor}"`);
    startDrivePolling(folderToMonitor, 5);
  }

  if (config.integrations?.notebooklm?.auto_sync?.enabled) {
    const notebookId = config.integrations.notebooklm.trinity_master_notebook_id;
    const interval = config.integrations.notebooklm.auto_sync.sync_interval_minutes || 15;
    console.log(`NotebookLM PM Sync is ACTIVE. Starting monitor on Notebook: "${notebookId}"`);
    startNotebookLMPolling(notebookId, interval);
  }

  // Start the Autonomous Agent Manager loop
  const brainDir = 'C:/Users/craig/.gemini/antigravity/brain';
  startAutonomousManager(brainDir, 30000); // Check every 30 seconds

} catch (e) {
  console.error("Error reading config.yaml:", e);
}

console.log("Moltbot Orchestrator is running and listening for webhooks on port 3000.");
