import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:3001");

function App() {
  const [sender, setSender] = useState("Anonymous");
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on("chat:message", (message) => {
      setMessages((currentMessages) => [...currentMessages, message]);
    });

    return () => {
      socket.off("chat:message");
    };
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    if (!content.trim()) return;

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
            <small>{new Date(message.createdAt).toLocaleTimeString()}</small>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
