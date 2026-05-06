# Mood Roulette

A real-time chat app where messages are randomly assigned a tone before delivery.

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

## Completed

- User signup and login with JWT authentication
- Session restore on refresh using `/auth/me`
- Frontend token storage with authenticated chat access
- Socket.IO connections now require a valid JWT
- Messages are now linked to authenticated users in PostgreSQL with Prisma
- The backend now derives the sender from the authenticated socket instead of trusting the client payload
- Last 100 messages still load on connect, now with real user identity attached
- Random tone assignment still works on persisted chat messages

## Roadmap

- Add Claude/OpenAI API rewriting
- Add online presence
- Deploy frontend and backend
