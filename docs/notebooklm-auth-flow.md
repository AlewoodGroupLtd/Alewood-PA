# NotebookLM Enterprise API Authentication Flow

To allow Moltbot to programmatically interact with the Trinity Master Notebook via the NotebookLM Enterprise API, we use a robust OAuth 2.0 flow integrated with Google Cloud Service Accounts and Domain-Wide Delegation.

## 1. Google Cloud Project Setup
- **Service Account**: A dedicated Google Cloud Service Account (`moltbot-service-account@alewood-uk-trinity.iam.gserviceaccount.com`) is attached directly to the Compute Engine VM.
- **Authentication Method**: Because of organizational security policies preventing JSON key exports, Moltbot leverages Google Application Default Credentials directly from the VM's metadata server.

## 2. Workspace Domain-Wide Delegation
- **Admin Console**: In the Google Workspace Admin Console, navigate to Security -> API Controls -> Domain-wide Delegation.
- **Add API Client**: Grant Domain-Wide Delegation to the Moltbot Service Account using its Client ID: `106727428560835185197`
- **Scopes**: Assign the necessary NotebookLM and Drive scopes:
  - `https://www.googleapis.com/auth/notebooklm.enterprise`
  - `https://www.googleapis.com/auth/drive.readonly` (for reading transcripts to ingest).

## 3. Token Acquisition & Caching (Moltbot Implementation)
- **JWT Assertion**: Moltbot uses the Google Auth Library natively to assert the identity of the CEO (e.g., `ceo@alewoodgroup.com`) using the Compute Engine metadata credentials.
- **Access Token Request**: The JWT is exchanged at the Google OAuth2 token endpoint (`https://oauth2.googleapis.com/token`) for a short-lived access token.
- **Caching**: The access token is cached locally in Redis or memory until expiration (typically 1 hour) to reduce API overhead.
- **Refresh**: When the token approaches expiration, Moltbot automatically generates a new JWT and fetches a fresh token transparently.

## 4. API Invocation
- All HTTP requests to the NotebookLM Enterprise API include the header: `Authorization: Bearer <CACHED_ACCESS_TOKEN>`.
- **Data Syncing**: 
  - **Meeting Transcripts**: Extracted via Drive API, converted to text, and uploaded as new sources to NotebookLM.
  - **GitHub PRs**: Webhook listener inside Moltbot captures merged PRs and pushes summaries to NotebookLM.
