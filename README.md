# Mood Roulette
`Live Demo:` https://mood-roulette-six.vercel.app

A real-time chat app where every message is rewritten in a random tone before delivery.

Users type normally, but the app spins the wheel and sends the rewritten result in one of several styles. The sender does not control the final tone.

## Features

- Real-time chat with socket.io
- AI tone rewriting on every sent message
- JWT auth (sign up, log in, session restore)
- Presence events (join/leave)
- Message history persistence (last 100 messages loaded on connect)
- Message cooldown + message length guardrails
- Dark UI theme with purple accents
- Settings drawer with logout + connection status indicators

## Tech Stack

### Frontend

- React + Vite
- Socket.io client

### Backend

- Node.js + Express
- Socket.io
- Prisma

### Database

- Postgresql

## Project Structure

mood-roulette/
  client/                  # react + vite frontend
  server/                  # express + socket.io backend
    prisma/
      schema.prisma
      migrations/

## Local Development

### 1) Install dependencies

`cd client && npm install`  
`cd ../server && npm install`

### 2) Configure server env

create `server/.env`:

`DATABASE_URL=postgresql://...`  
`JWT_SECRET=your-long-random-secret`  
`OPENROUTER_API_KEY=your_openrouter_key`  
`CLIENT_ORIGIN=http://localhost:5173`

### 3) Run prisma

`cd server`  
`npx prisma generate`  
`npx prisma migrate dev`  

### 4) Start app

in one terminal:  
`cd server`
`npm run dev`  

in another terminal:  
`cd client`
`npm run dev`

frontend: http://localhost:5173  
backend: http://localhost:3001

## Environment Variables

### server (`server/.env`)

- `DATABASE_URL` - postgres connection string
- `JWT_SECRET` - token signing secret
- `OPENROUTER_API_KEY` - ai provider key
- `CLIENT_ORIGIN` - allow frontend to utilize sockets

### frontend (vercel env)

- `VITE_API_BASE_URL` - backend public url (example: https://mood-roulette.onrender.com)

## Deployment

### backend (render)

- root directory: `server`
- build command: `npm ci && npx prisma generate`
- start command: `npx prisma migrate deploy && node index.js`
- set all server env vars in Render dashboard

### frontend (vercel)

- root directory: `client`
- framework: `vite`
- build command: `npm run build`
- output directory: `dist`
- set `VITE_API_BASE_URL` to your Render backend url

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