# Linkedin Scrapper

## Overview

This repository contains a LinkedIn scraper application that uses:

- **Frontend (React)**  
  Located in the `frontend` folder, running by default on port `3000`.

- **Backend (Express)**  
  The `server.js` file in the root directory, running by default on port `3001` (HTTP) and port `4000` (WebSocket).

## Prerequisites

1. **Node.js and npm**  
   Make sure you have Node.js (v14 or higher recommended) and npm installed.

2. **Environment Variables**  
   In the project root, create a `.env` file containing your LinkedIn credentials. For example:
   ```bash
   LINKEDIN_USERNAME=yourLinkedInEmail
   LINKEDIN_PASSWORD=yourLinkedInPassword
   ```
   These are used by Puppeteer to log in to LinkedIn.

## Installation

1. **Clone the Repository**  
   ```bash
   git clone https://github.com/yourusername/linkedin-scraper.git
   cd linkedin-scraper
   ```

2. **Install Root Dependencies**  
   In the root folder (where `server.js` and `package.json` reside):
   ```bash
   npm install
   ```

3. **Install Frontend Dependencies**  
   Change directory into `frontend` and install:
   ```bash
   cd frontend
   npm install
   ```
   Then navigate back to the root directory:
   ```bash
   cd ..
   ```

## Running the Application

From the root directory, you can run both the Express server and the React frontend simultaneously with a single command:

```bash
npm run dev
```

This will:
- Start the Express server on **port 3001** (and WebSocket on **port 4000**).
- Start the React application on **port 3000**.

You can then open your browser and go to:
```
http://localhost:3000
```
to access the React UI for the LinkedIn scraper.

## Additional Scripts

- **`npm run start`**  
  Runs only the Express server (`server.js`).

- **`npm run client`**  
  Starts the React development server (`npm start --prefix frontend`).

- **`npm run server`**  
  Runs only the Express server (same as `start`, but separated for clarity).

- **`npm run format`**  
  Uses Prettier to format all files in the project.

- **`npm run lint`**  
  Runs ESLint for code quality checks.

- **`npm run lint:fix`**  
  Attempts to automatically fix lint issues.

## Points to Remember

- This application only works for LinkedIn People pages like the one shown in the attached video.
- This uses static class name tags wo ensure that the script will work even after dynamic tags are changed by LinkedIn.

## Notes

- Make sure you keep your `.env` file out of version control (as indicated by the included `.gitignore`) to protect sensitive credentials.
- If you need to change ports or other settings, update them in both your Express code (`server.js`) and your frontend (for example, adjusting API calls from `http://localhost:3001` if you choose a different port).

---