const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

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
