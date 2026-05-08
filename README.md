<img width="680" height="220" alt="mood_roulette_logo" src="https://github.com/user-attachments/assets/a6105275-cc67-45fd-a6b0-25d588cdc1dd" /><svg width="100%" viewBox="0 0 680 220" role="img" xmlns="http://www.w3.org/2000/svg" style=""><defs><mask id="imagine-text-gaps-jytmxz" maskUnits="userSpaceOnUse"><rect x="0" y="0" width="680" height="220" fill="white"/><rect x="-16.25" y="-15.765625" width="32.5" height="31.53125" fill="black" rx="2"/><rect x="-16.25" y="-15.765625" width="32.5" height="31.53125" fill="black" rx="2"/><rect x="-16.25" y="-15.765625" width="32.5" height="31.53125" fill="black" rx="2"/><rect x="-16.25" y="-15.765625" width="32.5" height="31.53125" fill="black" rx="2"/><rect x="-16.25" y="-15.765625" width="32.5" height="31.53125" fill="black" rx="2"/><rect x="-16.25" y="-15.765625" width="32.5" height="31.53125" fill="black" rx="2"/><rect x="221" y="44.953125" width="146.609375" height="64.015625" fill="black" rx="2"/><rect x="221" y="104.953125" width="216" height="64.015625" fill="black" rx="2"/><rect x="224" y="165.171875" width="299.703125" height="22.515625" fill="black" rx="2"/></mask></defs>

# Mood Roulette
> Real-time chat, but emotionally unreliable.
`Live Demo:` https://mood-roulette-six.vercel.app

Mood Roulette is a real-time chat application where every outgoing message is secretly rewritten by AI into a randomly selected tone before delivery. The sender never sees the tone chosen, they only have their rewritten message landing in the chatroom.

---

## About

Mood Roulette is a single shared chat room where users sign up, log in, and send messages. Every message is intercepted by the backend, rewritten by an AI model in one out of many randomly assigned tones, and then broadcasts to all connected users. The original raw message is never stored or shown to anyone. Only the rewritten version is revealed.
 
**The tones:**
- **Professional** — formal, polished, business-email style
- **Passive Aggressive** — technically polite, full of subtext
- **Shakespearean** — early modern English, dramatic, fully committed
- **Unhinged** — chaotic, high energy, stream-of-consciousness

**Key behaviours:**
- The sender cannot preview the rewrite before it sends
- The tone is revealed only after the message is delivered
- Messages load from history upon joining and display by most recent

---

## Features

- Real-time chat with socket.io
- AI tone rewriting on every sent message
- JWT auth (sign up, log in, session restore)
- Presence events (join/leave)
- Message history persistence (last 100 messages loaded on connect)
- Message cooldown + message length guardrails

---

## Tech Stack

### Frontend

- React + Vite
- Socket.io client

### Backend

- Node.js + Express
- Socket.io
- Prisma
- PostgreSQL

---

## Usage
 
1. Create an account on the signup screen
2. Enter the shared chat room
3. Type a message and press Send or hit Enter
4. Watch as your message gets tone-rolled by the server and delivered in a completely different voice

Sessions persist across page refreshes via JWT stored in localStorage. The last 100 messages are loaded on connect so you can catch up on the room history.
 
---

## Installation
> MacOS  
 
### Pre-Requisites

- [Homebrew](https://brew.sh/) — package manager for macOS
- [Node.js](https://nodejs.org/) v18 or higher
- [PostgreSQL](https://www.postgresql.org/) running locally
- An [OpenRouter](https://openrouter.ai/) account and API key for AI rewriting
- npm (comes with Node.js)

### 1. Install Homebrew (if you don't have it)
 
Open Terminal and run:
 
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
 
### 2. Install Node.js
 
```bash
brew install node
```
 
Verify the installation:
 
```bash
node --version && npm --version
```
 
### 3. Install PostgreSQL
 
```bash
brew install postgresql@16 && brew services start postgresql@16
```
 
Verify PostgreSQL is running:
 
```bash
brew services list
```
 
You should see `postgresql@16` with a status of `started`.
 
### 4. Create the database
 
```bash
createdb mood_roulette
```
 
### 5. Clone the repository
 
```bash
git clone https://github.com/apham728/mood-roulette.git
cd mood-roulette
```
 
### 6. Install server dependencies
 
```bash
cd server && npm install
```
 
This installs all backend dependencies including Express, Socket.IO, bcryptjs, jsonwebtoken, and the Prisma CLI.
 
### 7. Install client dependencies
 
```bash
cd ../client && npm install
```
### 8. Configure server environment variables
 
Create a `.env` file inside the `server/` directory:
 
```bash
touch ../server/.env
```
 
Open it in your editor and add the following:
 
```env
DATABASE_URL="postgresql://YOUR_MAC_USERNAME@localhost:5432/mood_roulette"
JWT_SECRET="replace-with-a-long-random-string"
OPENROUTER_API_KEY="your-openrouter-api-key"
```
 
Replace `YOUR_MAC_USERNAME` with your macOS username. If you're unsure what it is, run:
 
```bash
whoami
```
 
### 9. Set up Prisma
 
From inside the `server/` directory, first install Prisma:
 
```bash
npm install prisma@6 @prisma/client@6
```
 
Generate the Prisma client — this reads your schema and creates the database access layer inside `node_modules`:
 
```bash
npx prisma generate
```
 
Then run migrations to create all the required tables in your local `mood_roulette` database:
 
```bash
npx prisma migrate dev
```
 
When prompted for a migration name, you can enter something like `init`.
 
You should see confirmation that the `users` and `messages` tables have been created successfully.

---

## Commands
 
### Start the backend (from `/server`)
 
```bash
npm run dev
```
 
The server runs on `http://localhost:3001`
 
### Start the frontend (from `/client`)
 
```bash
npm run dev
```
 
The client runs on `http://localhost:5173`
 
Both must be running at the same time for the app to work.
 
---

## File Structure

```.
├── client
│   └── src
│       ├── App.jsx
│       └── App.css
├── server
│   ├─- prisma
│   │   └── schema.prisma
│   ├─- index.js
│   └── .env
│   
└── README.md
```
 
| No | File / Folder | Details |
|----|---------------|---------|
| 1 | `client/` | React frontend built with Vite |
| 2 | `client/src/App.jsx` | Main application component: auth screens, chat UI, socket logic |
| 3 | `client/src/App.css` | All frontend styles |
| 4 | `server/` | Node.js + Express backend |
| 5 | `server/index.js` | Express routes, Socket.IO server, AI rewrite pipeline |
| 6 | `server/prisma/schema.prisma` | Database schema for users and messages |
| 7 | `server/.env` | Environment variables (not committed) |
| 8 | `.gitignore` | Ignores node_modules, .env files, and build output |
 
---

## Build
 
### Frontend production build
 
```bash
cd client
npm run build
```
 
Output is written to `client/dist/`. This folder can be served statically or deployed to Vercel.
 
### Backend
 
The backend runs directly with Node.js and does not require a separate build step.

---

## Deployment

### Backend — Render
 
1. Go to [render.com](https://render.com) and create a new web service
2. Connect your GitHub repository
3. Set the **Root Directory** to `server`
4. Set the **Start Command** to `npx prisma migrate deploy && node index.js`
5. Set the **Build Command** to `npm ci && npx prisma generate`
6. Add the following environment variables in the dashboard:
```env
DATABASE_URL = your-production-postgres-url
JWT_SECRET = your-production-jwt-secret
OPENROUTER_API_KEY = your-openrouter-api-key
CLIENT_ORIGIN = frontend-link
```
7. Go back to [render.com](https://render.com) and create a PostgreSQL service
2. Give any name and database name as fit
3. Copy the **Internal Database URL** and enter that for `DATABASE_URL` environment variable in web service

### Frontend — Vercel
 
1. Push your repository to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Set the **Root Directory** to `client`
4. Set the **Build Command** to `npm run build`
5. Set the **Output Directory** to `dist`
6. Add the following environment variables in the dashboard:
```env
VITE_API_BASE_URL = your-backend-link
```
7. Vercel will detect Vite automatically — no build configuration needed
8. Deploy

## Production Issues I Faced 

- login worked, but socket stuck on reconnecting  
  `CLIENT_ORIGIN` mismatched in backend code, led to no server connection

- prisma table missing (`public.User` does not exist)  
  migrations were not applied; ensure start command includes  
  `npx prisma migrate deploy && node index.js`

## What I Learned

- Designing a full-stack architecture where React handles UI state, Express handles HTTP auth routes, Socket.io handles real-time chat events, and Prisma/Postgresql handles persistence
- Implementing JWT-based authentication so that only authenticated users can join chat
- Managing client-side session restoration with local storage plus `/auth/me` validation to prevent stale or invalid sessions
- Building a real-time message pipeline where raw input is rewritten by ai, stored in the database, and broadcast back to all connected clients
- Modeling relational data with prisma (users and messages)
- Loading chat history (last 100 messages) in reverse ordered queries and rendering oldest-to-newest for readable conversation flow
- Handling live connection lifecycle states (connected, reconnecting, disconnected) and reflecting those states in the UI
- Adding reliability and safety controls such as message length limits and per-user cooldowns to prevent API abuse 
- Debugging cross environment deployment issues including cors origin mismatches, socket reconnect loops, prisma migration gaps, and invalid environment variables
- Deploying backend and database (Render) and frontend (Vercel), including environment configuration and migration strategy for production
