#!/bin/bash

# Traffic Assist - Quick Deploy Script
# Chooses deployment based on current branch

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Traffic Assist - Smart Deployment${NC}"
echo "====================================="

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${BLUE}📋 Current branch: ${CURRENT_BRANCH}${NC}"

# Check git status
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes:${NC}"
    git status --porcelain | head -5
    echo ""
    read -p "Continue with deployment? (y/N): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

# Auto-select deployment based on branch
if [ "$CURRENT_BRANCH" = "development" ]; then
    echo -e "${BLUE}🚧 Development branch detected - deploying to DEV environment${NC}"
    exec ./server/deploy-dev.sh
elif [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    echo -e "${GREEN}🏭 Main/Master branch detected - deploying to PRODUCTION${NC}"
    echo -e "${YELLOW}⚠️  This will deploy to PRODUCTION environment!${NC}"
    read -p "Continue with PRODUCTION deployment? (y/N): " CONFIRM
    if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "Production deployment cancelled"
        exit 1
    fi
    exec ./server/deploy-final.sh
else
    echo -e "${YELLOW}⚠️  Unknown branch: $CURRENT_BRANCH${NC}"
    echo ""
    echo "Please choose deployment target:"
    echo "1) Development (recommended for feature branches)"
    echo "2) Production (only for stable releases)"
    echo "3) Cancel"
    echo ""
    read -p "Enter choice (1-3): " CHOICE
    
    case $CHOICE in
        1)
            echo -e "${BLUE}🚧 Deploying to DEVELOPMENT${NC}"
            exec ./server/deploy-dev.sh
            ;;
        2)
            echo -e "${RED}🚨 WARNING: Deploying feature branch to PRODUCTION!${NC}"
            read -p "Are you absolutely sure? (yes/NO): " FINAL_CONFIRM
            if [ "$FINAL_CONFIRM" = "yes" ]; then
                exec ./server/deploy-final.sh
            else
                echo "Production deployment cancelled"
                exit 1
            fi
            ;;
        3)
            echo "Deployment cancelled"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
fi
