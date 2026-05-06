import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

// Frontend config for the backend URL and the browser storage key.
// These are used to restore the logged-in session between page refreshes.
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

  // On first page load, try to restore a previous session from localStorage.
  // If a token exists, confirm with the backend which user is currently logged in
  // before rendering the chat UI.
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!storedToken) {
      setIsRestoringSession(false);
      return;
    }

    // Validate the saved token with /auth/me so the frontend only restores
    // sessions that the backend still considers valid.
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

  // Open a single authenticated socket connection for chat history and real-time
  // message updates once the user is authenticated.
  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const nextSocket = io(API_BASE_URL, {
      auth: {
        token,
      },
    });

    setSocket(nextSocket);

    // Load the most recent saved messages when the socket connects.
    nextSocket.on("chat:history", (history) => {
      setMessages(history);
    });

    // Append every newly broadcast message so the room stays live across tabs.
    nextSocket.on("chat:message", (message) => {
      setMessages((currentMessages) => [...currentMessages, message]);
    });

    nextSocket.on("connect_error", (error) => {
      setAuthError(error.message || "Chat connection failed.");
    });

    // Clean up listeners and disconnect the socket when the user logs out
    // or the component unmounts so duplicate connections do not accumulate.
    return () => {
      nextSocket.off("chat:history");
      nextSocket.off("chat:message");
      nextSocket.off("connect_error");
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [user]);

  // Keep the auth form controlled by React state so signup and login can
  // share the same username and password inputs.
  function handleAuthFieldChange(event) {
    const { name, value } = event.target;
    setAuthForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  // Submit either the signup or login form to the matching backend route.
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

  // Clear the stored token and reset UI state so the user fully exits
  // the authenticated chat session on this device.
  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setMessages([]);
    setContent("");
    setAuthError("");
  }

  // Send a chat message through the active socket connection. The backend
  // derives the sender from the authenticated socket, saves the message, and
  // broadcasts it back to the room.
  function handleSubmit(event) {
    event.preventDefault();

    if (!content.trim() || !user || !socket) return;

    socket.emit("chat:send", {
      content,
    });

    setContent("");
  }

  // Show a lightweight loading state while checking for an existing session.
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

  // If no authenticated user exists yet, show the auth screen instead of chat.
  if (!user) {
    return (
      <main className="app-shell">
        <section className="auth-card">
          <p className="eyebrow">Real-time chat, but emotionally unreliable.</p>
          <h1>Mood Roulette</h1>
          <p className="auth-copy">
            {authMode === "login"
              ? "Log in to rejoin the shared room. Your message still gets tone-rolled by the server before it lands."
              : "Create an account to join the shared room. Your message still gets tone-rolled by the server before it lands."}
          </p>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label>
              Username
              <input
                name="username"
                value={authForm.username}
                onChange={handleAuthFieldChange}
                placeholder="minimum 3 characters"
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

            <div className="auth-switcher">
              {authMode === "login" ? (
                <p>
                  Need an account?{" "}
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError("");
                    }}
                  >
                    Sign Up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                    }}
                  >
                    Log In
                  </button>
                </p>
              )}
            </div>

            {authError ? <p className="form-error">{authError}</p> : null}

            <button type="submit" className="primary-button" disabled={isSubmittingAuth}>
              {isSubmittingAuth
                ? "Please wait..."
                : authMode === "login"
                  ? "Log In"
                  : "Sign Up"}
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
