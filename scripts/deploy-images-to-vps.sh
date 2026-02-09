#!/bin/bash

# Configuration
VPS_IP="43.205.215.225"
SSH_KEY="~/Downloads/urumi-key.pem"
USER="ubuntu"

deploy_image() {
    local name=$1
    local dockerfile=$2
    local build_context=$3
    local tar_file="${name}.tar"
    local image_tag="store-orchestrator-${name}:latest"

    echo "🚀 Building ${name} image..."
    docker build -t ${image_tag} -f ${dockerfile} ${build_context}

    echo "📦 Saving ${name} to tar..."
    docker save ${image_tag} > ${tar_file}

    echo "🚚 Transferring ${name} to VPS..."
    scp -i ${SSH_KEY} ${tar_file} ${USER}@${VPS_IP}:~/

    echo "📥 Importing ${name} into k3s..."
    ssh -i ${SSH_KEY} ${USER}@${VPS_IP} "sudo k3s ctr -n k8s.io images import ~/${tar_file} && rm ~/${tar_file}"

    echo "🧹 Cleaning up local tar..."
    rm ${tar_file}
    
    echo "✅ ${name} deployed!"
}

# Deploy backend
deploy_image "backend" "backend/Dockerfile" "."

# Deploy orchestrator
deploy_image "orchestrator" "orchestrator/Dockerfile" "."

# Deploy dashboard
deploy_image "dashboard" "dashboard/Dockerfile" "dashboard/"

echo "✅ All images successfully deployed to k3s on AWS!"
echo "🔄 Restarting deployments..."
ssh -i ${SSH_KEY} ${USER}@${VPS_IP} "sudo kubectl rollout restart deployment backend-api dashboard orchestrator -n platform"
