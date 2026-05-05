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

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // RANDOM MESSAGE TONE SELECTION
    const tones = ["Professional", "Passive Aggressive", "Shakespearean", "Unhinged"];

    socket.on("chat:send", (message) => {
        const tone = tones[Math.floor(Math.random() * tones.length)];

        io.emit("chat:message", {
            id: crypto.randomUUID(),
            sender: message.sender || "Anonymous",
            content: message.content,
            tone,
            createdAt: new Date().toISOString(),
        });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
