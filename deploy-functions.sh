#!/bin/bash

# Firebase Cloud Functions Deployment Script
# Run this script to deploy the functions to Firebase

echo "🚀 Deploying Firebase Cloud Functions for Track Your Truck Load..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null
then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Login to Firebase (if not already logged in)
echo "📝 Checking Firebase authentication..."
firebase projects:list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "🔑 Please login to Firebase:"
    firebase login
fi

# Navigate to functions directory
cd functions

# Install dependencies
echo "📦 Installing function dependencies..."
npm install

# Navigate back to root
cd ..

# Set Firebase project (replace with your actual project ID)
echo "🎯 Setting Firebase project..."
firebase use captain-truck-242e5

# Deploy functions
echo "🚀 Deploying Cloud Functions..."
firebase deploy --only functions

echo "✅ Deployment completed!"
echo ""
echo "📊 Your Cloud Functions are now running and will:"
echo "   • ✅ Automatically sync dispatch statuses when drivers update status"
echo "   • ✅ Send real-time notifications to customers and drivers"
echo "   • ✅ Keep assignment records synchronized"
echo "   • ✅ Run scheduled checks every 5 minutes"
echo "   • ✅ Work even when admin panel is offline"
echo ""
echo "🔗 Functions deployed:"
echo "   1. updateDispatchStatusOnDriverChange (Firestore trigger)"
echo "   2. updateDriverStatus (HTTP callable)"
echo "   3. scheduledStatusSync (Scheduled task)"
echo ""
echo "🎉 Real-time updates are now active!"
