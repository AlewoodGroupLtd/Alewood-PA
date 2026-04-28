#!/bin/bash
# Script to create the Moltbot Service Account in GCP and assign basic roles

PROJECT_ID="alewood-uk-trinity"
SA_NAME="moltbot-service-account"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Creating Service Account: $SA_NAME"
gcloud iam service-accounts create $SA_NAME \
    --display-name="Moltbot Orchestrator Service Account" \
    --project=$PROJECT_ID

echo "Assigning logging and monitoring roles to the Service Account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/monitoring.metricWriter"

echo "Generating JSON key for NotebookLM Domain-Wide Delegation Auth..."
# We will save this locally so you can pass it to Moltbot later
gcloud iam service-accounts keys create moltbot-sa-key.json \
    --iam-account=$SA_EMAIL \
    --project=$PROJECT_ID

echo "--------------------------------------------------------"
echo "Service Account Created: $SA_EMAIL"
echo "JSON Key Saved: moltbot-sa-key.json"
echo "--------------------------------------------------------"
echo "ACTION REQUIRED:"
echo "To finish the NotebookLM Enterprise API setup, you must:"
echo "1. Go to Google Cloud Console -> IAM & Admin -> Service Accounts."
echo "2. Find '$SA_NAME', click it, and go to the 'Details' tab."
echo "3. Copy the 'Unique ID' (Client ID)."
echo "4. Go to Google Workspace Admin Console -> Security -> API Controls -> Domain-wide Delegation."
echo "5. Add a new API client with that Client ID and grant the NotebookLM scopes."
