# Alewood Executive Assistant

Autonomous AI Personal Assistant for the CEO of Alewood Group Ltd, powered by **Moltbot** and **Google Antigravity**.

## Modules Planned
1. **Antigravity Orchestration**: Moltbot acts as the bridge for natural language commands to asynchronous Antigravity agents.
2. **NotebookLM Integration**: Syncs meeting transcripts, project updates, and GitHub PRs to the Trinity Master Notebook.
3. **Workspace Triage**: Gmail polling, automated reply drafting, and calendar focus-time blocking.
4. **PWA & Notifications**: Mobile-first PWA with Web Push Notifications and WhatsApp fallback.

## Initial Setup Files
- `provision-gcp.sh`: Script to provision the Google Cloud Compute Engine instance in `europe-west2`.
- `moltbot/setup.sh`: Startup script to configure dependencies and services.
- `moltbot/config.yaml`: Configuration settings for Moltbot and Antigravity.
- `docs/notebooklm-auth-flow.md`: Specification for NotebookLM Enterprise API Authentication.

**Note:** Please review the scripts and configuration files. Execute `provision-gcp.sh` only after approval.
