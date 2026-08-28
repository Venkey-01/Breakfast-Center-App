# Breakfast Center - Order & Digital Billing System 🍳

A modern full-stack web application for ordering fresh breakfast items, generating instant digital receipts, sending automated email invoices, and managing orders in real-time.

---

## 🚀 Tech Stack

- **Frontend:** React 19, Vite, Lucide Icons, Canvas Confetti
- **Backend:** Node.js, Express, MongoDB Atlas, Mongoose
- **Integrations:** Resend Email API, Google Sheets CRM API

---

## 📁 Repository Structure

```text
.
├── backend/          # Express API server & Mongoose database models
├── react-frontend/   # Vite + React single-page frontend application
├── api/              # Vercel serverless functions configuration
├── .env.example      # Environment variables template
└── README.md         # Project documentation
```

---

## ⚙️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/) (Local or MongoDB Atlas cluster)

### 1. Clone the Repository
```bash
git clone https://github.com/Venkey-01/Breakfast-Center-App.git
cd Breakfast-Center-App
```

### 2. Configure Environment Variables
Copy `.env.example` to `backend/.env` and fill in your credentials:
```bash
cp .env.example backend/.env
```

### 3. Run Backend Server
```bash
cd backend
npm install
node server.js
```

### 4. Run Frontend Application
In a separate terminal window:
```bash
cd react-frontend
npm install
npm run dev
```

---

## 🌿 Git Branching & Pull Request Guide

This project follows the standard **GitHub Flow** branching model:

1. **`main` Branch**: Holds stable, production-ready code. Always keep `main` deployable!
2. **Feature/Doc Branches**: Create dedicated branches off `main` for all changes (`feature/feature-name`, `docs/doc-name`, `fix/bug-description`).
3. **Pull Requests (PRs)**: Submit PRs to merge changes back into `main` after review and testing.

### Workflow Summary
```bash
# 1. Start from updated main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b docs/improve-readme

# 3. Make changes and commit
git add README.md
git commit -m "docs: improve project documentation and setup guide"

# 4. Push branch to GitHub
git push -u origin docs/improve-readme

# 5. Open Pull Request on GitHub & Merge into main
```
