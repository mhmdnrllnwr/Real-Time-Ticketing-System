#!/bin/bash
# deploy-gcp.sh — Deploy Cinema Ticketing System to GCP Cloud Run
# Usage: bash deploy-gcp.sh YOUR_PROJECT_ID [REGION]

set -e

PROJECT_ID="${1}"
REGION="${2:-asia-southeast1}"

if [ -z "$PROJECT_ID" ]; then
  echo "Usage: bash deploy-gcp.sh PROJECT_ID [REGION]"
  echo "  PROJECT_ID — your GCP project ID"
  echo "  REGION     — Cloud Run region (default: asia-southeast1)"
  exit 1
fi

IMAGE="asia-southeast1-docker.pkg.dev/${PROJECT_ID}/ticketing/cinema:latest"

echo "=================================="
echo " Cinema Ticketing — GCP Deploy"
echo "=================================="
echo " Project: ${PROJECT_ID}"
echo " Region:  ${REGION}"
echo " Image:   ${IMAGE}"
echo ""

# 1. Check gcloud
if ! command -v gcloud &> /dev/null; then
  echo "[ERROR] gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

# 2. Enable required services
echo "[1/6] Enabling GCP services..."
gcloud services enable artifactregistry.googleapis.com run.googleapis.com redis.googleapis.com --project="${PROJECT_ID}" 2>/dev/null

# 3. Create Artifact Registry repo
echo "[2/6] Creating Artifact Registry repository..."
gcloud artifacts repositories create ticketing \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  (already exists)"

# 4. Configure Docker auth
echo "[3/6] Configuring Docker authentication..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# 5. Build & push Docker image
echo "[4/6] Building Docker image..."
docker build -t "${IMAGE}" .

echo "[5/6] Pushing Docker image..."
docker push "${IMAGE}"

# 6. Create Redis instance (Memorystore)
echo "[6/6] Creating Redis instance (Memorystore)..."
REDIS_NAME="cinema-redis"
REDIS_HOST=""
REDIS_PORT=6379

gcloud redis instances create "${REDIS_NAME}" \
  --size=1 \
  --region="${REGION}" \
  --redis-version=redis_7_x \
  --project="${PROJECT_ID}" 2>/dev/null && {
  echo "  Redis instance created — waiting for it to be ready (this takes 2-3 min)..."
  # Get Redis host
  REDIS_HOST=$(gcloud redis instances describe "${REDIS_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --format="value(host)")
  echo "  Redis host: ${REDIS_HOST}"
} || {
  echo "  Redis instance already exists — getting host..."
  REDIS_HOST=$(gcloud redis instances describe "${REDIS_NAME}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" \
    --format="value(host)")
}

# Build REDIS_URL
REDIS_URL="redis://${REDIS_HOST}:${REDIS_PORT}"

# 7. Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy cinema-ticketing \
  --image="${IMAGE}" \
  --port=3000 \
  --session-affinity \
  --allow-unauthenticated \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --set-env-vars="REDIS_URL=${REDIS_URL}" \
  --vpc-connector="redis-connector" 2>/dev/null || {
  echo ""
  echo "  NOTE: If this fails with VPC connector error, run:"
  echo "    gcloud run deploy cinema-ticketing \\"
  echo "      --image=${IMAGE} \\"
  echo "      --port=3000 \\"
  echo "      --session-affinity \\"
  echo "      --allow-unauthenticated \\"
  echo "      --region=${REGION} \\"
  echo "      --project=${PROJECT_ID}"
  echo ""
  echo "  (Without Redis — single instance mode)"
  echo "  Or create VPC connector: https://cloud.google.com/vpc/docs/configure-serverless-vpc-access"
}

echo ""
echo "=================================="
echo " Deploy complete!"
echo "=================================="
echo ""
echo " URLs:"
gcloud run services describe cinema-ticketing --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)" 2>/dev/null || echo "  (check Cloud Run console)"
