import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

// config for backend url and browser storage key
// use to persist logged in session between refreshes
const API_BASE_URL = "http://localhost:3001";
const TOKEN_STORAGE_KEY = "mood-roulette-token";

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

// on inital page refresh, try to restore previous session 
// if token exists, check with backend on who current uesr is before
// loading chat ui
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!storedToken) {
      setIsRestoringSession(false);
      return;
    }

    // validate saved token with /auth/me so that frontend only restores
    // sessions that backend verifies
    async function restoreSession() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } finally {
        setIsRestoringSession(false);
      }
    }

    restoreSession();
  }, []);

// open single live connection for the chat's message history 
// and real time message updates 
  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const nextSocket = io(API_BASE_URL);
    setSocket(nextSocket);

    // load last 100 messages once socket connects
    nextSocket.on("chat:history", (history) => {
      setMessages(history);
    });

    // append new broadcasted messages for live updates
    nextSocket.on("chat:message", (message) => {
      setMessages((currentMessages) => [...currentMessages, message]);
    });

    // clean up listeners and disconnect socket once user logs out
    return () => {
      nextSocket.off("chat:history");
      nextSocket.off("chat:message");
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [user]);

  // have auth form controlled by React so both sign up and login
  // share same user/pass inputs
  function handleAuthFieldChange(event) {
    const { name, value } = event.target;
    setAuthForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  // submit either sign up or login form to matching backend route
  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setIsSubmittingAuth(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/${authMode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(authForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setUser(data.user);
      setMessages([]);
      setAuthForm({ username: "", password: "" });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  // clear stored token and reset local ui state so
  // the user fully exits authenticated chat session
  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setMessages([]);
    setContent("");
    setAuthError("");
  }

  // sends message to backend
  // backend modifies message and broadcasts back
  function handleSubmit(event) {
    event.preventDefault();

    if (!content.trim() || !user || !socket) return;

    socket.emit("chat:send", {
      sender: user.username,
      content,
    });

    setContent("");
  }

  // loading state while checking for existing session
  if (isRestoringSession) {
    return (
      <main className="app-shell">
        <section className="auth-card">
          <h1>Mood Roulette</h1>
          <p>Restoring your session...</p>
        </section>
      </main>
    );
  }

  // auth page if user doesn't exist yet
  if (!user) {
    return (
      // once user is logged in, display chat layout
      <main className="app-shell">
        <section className="auth-card">
          <p className="eyebrow">Real-time chat, but emotionally unreliable.</p>
          <h1>Mood Roulette</h1>
          <p className="auth-copy">
            Create an account or log in to join the shared room. Your message still
            gets tone-rolled by the server before it lands.
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={authMode === "login" ? "is-active" : ""}
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
              }}
            >
              Log In
            </button>
            <button
              type="button"
              className={authMode === "signup" ? "is-active" : ""}
              onClick={() => {
                setAuthMode("signup");
                setAuthError("");
              }}
            >
              Sign Up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label>
              Username
              <input
                name="username"
                value={authForm.username}
                onChange={handleAuthFieldChange}
                placeholder="pick-a-handle"
                autoComplete="username"
              />
            </label>

            <label>
              Password
              <input
                name="password"
                type="password"
                value={authForm.password}
                onChange={handleAuthFieldChange}
                placeholder="minimum 6 characters"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {authError ? <p className="form-error">{authError}</p> : null}

            <button type="submit" className="primary-button" disabled={isSubmittingAuth}>
              {isSubmittingAuth
                ? "Please wait..."
                : authMode === "login"
                  ? "Log In"
                  : "Create Account"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="chat-panel">
        <header className="chat-header">
          <div>
            <p className="eyebrow">Signed in as {user.username}</p>
            <h1>Mood Roulette</h1>
          </div>
          <button type="button" className="secondary-button" onClick={handleLogout}>
            Log Out
          </button>
        </header>

        <section className="message-list">
          {messages.map((message) => (
            // display messages with tone, content, and timestamp
            <article key={message.id} className="message-card">
              <div className="message-meta">
                <strong>{message.sender}</strong>
                <span className="tone-badge">{message.tone}</span>
              </div>
              <p>{message.content}</p>
              <small>
                {new Date(message.createdAt).toLocaleDateString()} {" "}
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </small>
            </article>
          ))}
        </section>

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Type a message..."
          />
          <button type="submit" className="primary-button">
            Send
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;
