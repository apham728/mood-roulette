// npm run dev

require("dotenv").config();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const OpenAI = require("openai");

const prisma = new PrismaClient();
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";

// safety and cost control constants
const MAX_MESSAGE_LENGTH = 1000;
const COOLDOWN_MS = 3000;

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// create  signed JWT that the frontend stores after signup/login
//  token carries the minimum identity needed so future requests
// and socket connections can prove which user is acting
function createToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// pull the raw token string out of authorization header like:
// "Bearer <token>". If the header is invalid, we treat the
// request as unauthenticated
function getBearerToken(headerValue = "") {
  if (!headerValue.startsWith("Bearer ")) {
    return null;
  }

  return headerValue.slice(7);
}

async function findSafeUserById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, createdAt: true },
  });
}

function formatMessage(message) {
  return {
    id: message.id,
    sender: message.user?.username || message.sender,
    userId: message.userId || null,
    content: message.content,
    tone: message.tone,
    createdAt: message.createdAt,
  };
}

// verifies the JWT, loads the matching user from the database
async function requireAuth(req, res, next) {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findSafeUserById(payload.userId);

    if (!user) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

// rewrite the raw message using the AI model in the randomly selected tone.
// the raw content is only used here and is never stored or returned to any client.
// if the rewrite fails for any reason, we throw so the caller can handle it gracefully
async function rewriteMessage(content, tone) {
  const response = await openai.chat.completions.create({
    model: "nvidia/nemotron-3-nano-30b-a3b:free",
    messages: [
      {
        role: "system",
        content: `You are a message rewriter. Rewrite the user's message in a ${tone} tone. Fully commit to the style. Preserve the core meaning. Return only the rewritten message - no explanation, no preamble, no quotes.`,
      },
      { role: "user", content },
    ],
  });

  return response.choices[0].message.content;
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "mood-roulette-server" });
});

// create a new account, hash the password before storage, and return 
// a JWT so the frontend can treat signup as an authenticated session
app.post("/auth/signup", async (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    return res.status(409).json({ error: "Username is already taken." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { username, passwordHash },
    select: { id: true, username: true, createdAt: true },
  });

  return res.status(201).json({
    token: createToken(user),
    user,
  });
});

// log an existing user in by comparing the submitted password against the
// stored password hash. on success, we return the same session payload shape
// as signup so the frontend can reuse one auth flow
app.post("/auth/login", async (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    return res.status(401).json({ error: "Login failed. Check your username and password." });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({ error: "Login failed. Check your username and password." });
  }

  return res.json({
    token: createToken(user),
    user: {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    },
  });
});

// restoring the session on page refresh through the frontend 
// sending its stored token to confirm who is currently
// logged in
app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// require every socket connection to present a valid JWT before joining chat
// this lets the server own user identity instead of trusting sender fields
// coming from the browser
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required."));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findSafeUserById(payload.userId);

    if (!user) {
      return next(new Error("User no longer exists."));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error("Invalid or expired token."));
  }
});

// track the last send timestamp per user id to enforce the cooldown.
// this map lives in memory and resets if the server restarts, which is
// acceptable for a rate limiting mechanism of this kind
const lastSentAt = new Map();

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id, socket.user.username);

  // each new authenticated socket gets the last 100 persisted messages so a
  // refresh or new tab can render recent chat history immediately
  const recentMessages = await prisma.message.findMany({
    include: {
      user: {
        select: { username: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  socket.emit("chat:history", recentMessages.reverse().map(formatMessage));

  socket.on("chat:send", async ({ content }) => {
    if (!content?.trim()) {
      return;
    }

    // reject messages that exceed the character limit before hitting the AI
    if (content.trim().length > MAX_MESSAGE_LENGTH) {
      socket.emit("chat:error", {
        message: `Messages cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
      });
      return;
    }

    // enforce a per user cooldown to prevent spam and control AI API costs
    const now = Date.now();
    const lastSent = lastSentAt.get(socket.user.id) || 0;
    const elapsed = now - lastSent;

    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      socket.emit("chat:error", {
        message: `Please wait ${remaining} second${remaining !== 1 ? "s" : ""} before sending again.`,
      });
      return;
    }

    // record the send time before the async rewrite so back-to-back sends
    // from the same user are blocked even while the AI call is in flight
    lastSentAt.set(socket.user.id, now);

    const tones = ["Professional", "Passive Aggressive", "Shakespearean", "Unhinged"];
    const tone = tones[Math.floor(Math.random() * tones.length)];

    // emit a pending event back to the sender so the UI can show a
    // "rewriting..." state while the API call is in flight
    socket.emit("chat:pending");

    let rewrittenContent;

    try {
      // rewrite the raw message through the AI model before it touches the database.
      // the original content is transient and must never be stored or broadcast
      rewrittenContent = await rewriteMessage(content.trim(), tone);
    } catch (error) {
      console.error("Rewrite failed:", error.message);
      // notify only the sender that their message could not be delivered
      socket.emit("chat:error", { message: "Message could not be delivered. Please try again." });
      return;
    }

    // persist the message using the authenticated socket user instead of any
    // sender value provided by the client.
    // only the rewritten content, tone, and user identity are stored —
    // the original raw message is discarded after the rewrite above
    const savedMessage = await prisma.message.create({
      data: {
        sender: socket.user.username,
        userId: socket.user.id,
        content: rewrittenContent,
        tone,
      },
      include: {
        user: {
          select: { username: true },
        },
      },
    });

    io.emit("chat:message", formatMessage(savedMessage));
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});