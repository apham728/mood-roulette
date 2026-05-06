# Mood Roulette

A real-time chat app where messages are randomly assigned a tone before delivery.

## Current Status

- React + Vite frontend
- Node.js + Express backend
- Socket.IO realtime messaging
- PostgreSQL + Prisma message persistence
- Last 100 messages load on connect
- Random tone selection working
- AI rewriting and authentication not added yet

## Tech Stack

- React
- Vite
- Node.js
- Express
- Socket.IO
- PostgreSQL
- Prisma

## Run Locally

### Backend

- `cd server`
- `npm install`
- `npm run dev`

### Frontend

- `cd client`
- `npm install`
- `npm run dev`

## Environment Variables

Create `server/.env`:

DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/mood_roulette"

## Roadmap

- Add authentication
- Add Claude/OpenAI API rewriting
- Store users and associate messages with users
- Add online presence
- Deploy frontend and backend
