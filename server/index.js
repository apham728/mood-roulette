// npm run dev

require("dotenv").config();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-in-production";


const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

function createToken(user) {
    return jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
}
  
function getBearerToken(headerValue = "") {
    if (!headerValue.startsWith("Bearer ")) {
      return null;
    }
  
    return headerValue.slice(7);
}
  
async function requireAuth(req, res, next) {
    const token = getBearerToken(req.headers.authorization);
  
    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }
  
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, username: true, createdAt: true },
      });
  
      if (!user) {
        return res.status(401).json({ error: "User no longer exists." });
      }
  
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
}  

app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "mood-roulette-server" });
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
    },
});

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
      return res.status(401).json({ error: "Invalid username or password." });
    }
  
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid username or password." });
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
  
app.get("/auth/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
});  

io.on("connection", async (socket) => {
    // client connects
    console.log("User connected:", socket.id);

    // query database for the last 100 messages 
    const recentMessages = await prisma.message.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
    });

    // reverse recentMessages since it grabbed by most recent and
    // we want the chat history to be oldest --> most recent
    socket.emit("chat:history", recentMessages.reverse());
  
    
    socket.on("chat:send", async (message) => {
        // select random message mood/tone 
        const tones = ["Professional", "Passive Aggressive", "Shakespearean", "Unhinged"];
        const tone = tones[Math.floor(Math.random() * tones.length)];
        
        // saves sent message from to PostgreSQL through Prisma
        const savedMessage = await prisma.message.create({
            data: {
                sender: message.sender || "Anonymous",
                content: message.content,
                tone,
            },
        });
  
      // sends new saved message to every connected client 
      io.emit("chat:message", savedMessage);
    });
  
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        });
});  

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
