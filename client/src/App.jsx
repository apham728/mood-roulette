// npm run dev

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:3001");

function App() {
  const [sender, setSender] = useState("Anonymous");
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // when socket connects, receive last 100 messages from backend
    // frontend stores and displays the chat history
    socket.on("chat:history", (history) => {
      setMessages(history);
    });

    // live chat updates
    // backend receives sent message and broadcasts to all connected clients
    // frontend adds received message to React state and displays
    socket.on("chat:message", (message) => {
      setMessages((currentMessages) => [...currentMessages, message]);
    });

    return () => {
      socket.off("chat:history");
      socket.off("chat:message");
    };
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    if (!content.trim()) return;

    // when send button/form is submitted, send message information to backend
    // backend chooses tone and saves to database
    socket.emit("chat:send", {
      sender,
      content,
    });

    setContent("");
  }

  return (
    <main>
      <h1>Mood Roulette</h1>

      <form onSubmit={handleSubmit}>
        <input
          value={sender}
          onChange={(event) => setSender(event.target.value)}
          placeholder="Your name"
        />

        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Type a message..."
        />

        <button type="submit">Send</button>
      </form>

      <section>
        {messages.map((message) => (
          <article key={message.id}>
            <strong>{message.sender}</strong>
            <span>{message.tone}</span>
            <p>{message.content}</p>
            <small>
              {new Date(message.createdAt).toLocaleDateString()}{" "}
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </small>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
