#!/bin/bash
# Alewood Executive Assistant - GCP VM Provisioning Script
# Requires gcloud CLI to be authenticated and configured

PROJECT_ID="alewood-uk-trinity"
ZONE="europe-west2-a" # Adhering to the user rule to keep resources in europe-west2
MACHINE_TYPE="e2-standard-4"
VM_NAME="alewood-moltbot-orchestrator"

echo "Creating GCP Compute Engine VM for Moltbot..."
gcloud compute instances create $VM_NAME \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --network-interface=network-tier=PREMIUM,subnet=default \
    --maintenance-policy=MIGRATE \
    --provisioning-model=STANDARD \
    --service-account=moltbot-service-account@${PROJECT_ID}.iam.gserviceaccount.com \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --tags=http-server,https-server \
    --create-disk=auto-delete=yes,boot=yes,device-name=$VM_NAME,image=projects/debian-cloud/global/images/family/debian-12,mode=rw,size=50 \
    --metadata-from-file startup-script=moltbot/setup.sh

echo "VM Creation requested."
