import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

// frontend config for the backend URL and the browser storage key
// persist a logged-in session between page refreshes
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
  const [connectionState, setConnectionState] = useState("disconnected");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isRewriting, setIsRewriting] = useState(false);
  const [sendError, setSendError] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const composerRef = useRef(null);

  // on first page load, try to restore a previous session from local storage
  // if a token exists, confirm with the backend which user is currently logged in
  // before rendering the chat UI
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!storedToken) {
      setIsRestoringSession(false);
      return;
    }

    // validate the saved token with /auth/me so the frontend only restores
    // sessions that the backend still considers valid
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

  // open a single live socket connection for chat history, presence,
  // and real-time message updates once the user is authenticated
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

    // keep live connection state so ui can show connect and reconnect health
    const handleConnect = () => {
      setConnectionState("connected");
      setReconnectAttempt(0);
      setIsSettingsOpen(false);
      setSendError("");
    };

    const handleDisconnect = () => {
      setConnectionState("reconnecting");
    };

    const handleConnectError = (error) => {
      setConnectionState("reconnecting");

      if (error?.message === "Authentication required." || error?.message === "Invalid or expired token.") {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setUser(null);
      }
    };

    const handleReconnectAttempt = (attempt) => {
      setConnectionState("reconnecting");
      setReconnectAttempt(attempt);
    };

    const handleReconnectFailed = () => {
      setConnectionState("disconnected");
    };

    nextSocket.on("connect", handleConnect);
    nextSocket.on("disconnect", handleDisconnect);
    nextSocket.on("connect_error", handleConnectError);
    nextSocket.io.on("reconnect_attempt", handleReconnectAttempt);
    nextSocket.io.on("reconnect_failed", handleReconnectFailed);

    // load the most recent saved messages when the socket connects
    nextSocket.on("chat:history", (history) => {
      setMessages(history);
    });

    // append every newly broadcast message so the room stays live across tabs
    nextSocket.on("chat:message", (message) => {
      setIsRewriting(false);
      setSendError("");
      setMessages((currentMessages) => [...currentMessages, message]);
    });

    // append transient join and leave events without storing them in the database
    nextSocket.on("presence:event", (event) => {
      setMessages((currentMessages) => [...currentMessages, event]);
    });

    // show a rewriting indicator while the backend ai call is in flight
    nextSocket.on("chat:pending", () => {
      setIsRewriting(true);
      setSendError("");
    });

    // surface delivery failures to the sender without crashing the ui
    nextSocket.on("chat:error", ({ message }) => {
      setIsRewriting(false);
      setSendError(message);
    });

    // clean up listeners and disconnect the socket when the user logs out
    return () => {
      nextSocket.off("chat:history");
      nextSocket.off("chat:message");
      nextSocket.off("presence:event");
      nextSocket.off("chat:pending");
      nextSocket.off("chat:error");
      nextSocket.off("connect", handleConnect);
      nextSocket.off("disconnect", handleDisconnect);
      nextSocket.off("connect_error", handleConnectError);
      nextSocket.io.off("reconnect_attempt", handleReconnectAttempt);
      nextSocket.io.off("reconnect_failed", handleReconnectFailed);
      nextSocket.disconnect();
      setSocket(null);
      setConnectionState("disconnected");
      setReconnectAttempt(0);
      setIsSettingsOpen(false);
    };
  }, [user]);

  const isInitialHistoryLoad = useRef(false);

  useEffect(() => {
    if (!composerRef.current) return;

    composerRef.current.style.height = "0px";
    composerRef.current.style.height = `${composerRef.current.scrollHeight}px`;
  }, [content]);

  // scroll to the bottom on history load and new feed entries
  useEffect(() => {
    if (messages.length === 0) return;
    const behavior = isInitialHistoryLoad.current ? "smooth" : "instant";
    isInitialHistoryLoad.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [messages]);

  // keep the auth form controlled by react state so signup and login can
  // share the same username and password inputs
  function handleAuthFieldChange(event) {
    const { name, value } = event.target;
    setAuthForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  // submit either the signup or login form to the matching backend route
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

  // press enter to send quickly while still allowing shift+enter to
  // manually go to a new line
  function handleComposerKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  // clear the stored token and reset ui state so the user fully exits
  // the authenticated chat session on this device
  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setMessages([]);
    setContent("");
    setAuthError("");
    setSendError("");
    setIsRewriting(false);
    setConnectionState("disconnected");
    setReconnectAttempt(0);
    setIsSettingsOpen(false);
  }

  // send a chat message to the backend
  // backend assigns the tone, saves the message, and broadcasts it back to the room
  function handleSubmit(event) {
    event.preventDefault();

    if (!content.trim() || !user || !socket || isRewriting || connectionState !== "connected") return;

    socket.emit("chat:send", {
      content,
    });

    setContent("");
    setSendError("");
  }

  // loading state while checking for an existing session
  if (isRestoringSession) {
    return (
      <main className="app-shell app-shell-auth">
        <section className="auth-card">
          <h1>Mood Roulette</h1>
          <p>Restoring your session...</p>
        </section>
      </main>
    );
  }

  // if no authenticated user exists yet, show the auth screen instead of chat
  if (!user) {
    return (
      <main className="app-shell app-shell-auth">
        <section className="auth-card">
          <p className="eyebrow">Real-time chat, but emotionally unreliable.</p>
          <h1>Mood Roulette</h1>
          <p className="auth-copy">
            {authMode === "login"
              ? "Chat without control over your tone."
              : "Chat without control over your tone."}
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
    <main className="app-shell app-shell-chat">
      <section className="chat-panel">
        <header className="chat-header">
          <div className="chat-header-left">
            <p className="eyebrow">Signed in as {user.username}</p>
            <h1>Mood Roulette</h1>
          </div>
        </header>

        <div className="chat-body">
          <div className="chat-main">
            <section className="message-list">
              {messages.map((message, index) => {
                const previousMessage = messages[index - 1];
                const nextMessage = messages[index + 1];
                const isCompactBurst =
                  message.type !== "system" &&
                  previousMessage &&
                  previousMessage.type !== "system" &&
                  previousMessage.sender === message.sender;
                const hasNextSameSender =
                  message.type !== "system" &&
                  nextMessage &&
                  nextMessage.type !== "system" &&
                  nextMessage.sender === message.sender;
                const isLikelySingleLine =
                  typeof message.content === "string" &&
                  !message.content.includes("\n") &&
                  message.content.length <= 74;

                if (message.type === "system") {
                  return (
                    <p key={message.id} className="system-event">
                      {message.content}
                    </p>
                  );
                }

                return (
                  <article
                    key={message.id}
                    className={`message-card${isCompactBurst ? " compact" : ""}${
                      hasNextSameSender ? " burst-chain" : ""
                    }${isLikelySingleLine ? " single-line" : " multi-line"}`}
                  >
                    {!isCompactBurst && (
                      <div className="message-meta">
                        <strong>{message.sender}</strong>
                        <div className="message-meta-right">
                          <small>
                            {new Date(message.createdAt).toLocaleDateString()} {" "}
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </small>
                        </div>
                      </div>
                    )}
                    <p>{message.content}</p>
                  </article>
                );
              })}
              <div ref={messagesEndRef} />
            </section>

            <form className="chat-form" onSubmit={handleSubmit}>
              <div className="chat-input-wrapper">
                <textarea
                  ref={composerRef}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Type a message..."
                  disabled={isRewriting}
                  rows={1}
                />
                {isRewriting && <span className="rewriting-indicator">rewriting...</span>}
                {connectionState === "reconnecting" && (
                  <span className="reconnect-indicator">trying to reconnect</span>
                )}
                {connectionState === "disconnected" && (
                  <span className="send-error">connection lost</span>
                )}
                {sendError && <span className="send-error">{sendError}</span>}
              </div>
              <button type="submit" className="primary-button" disabled={isRewriting || connectionState !== "connected"}>
                Send
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="settings-dock">
        <button type="button" className="secondary-button" onClick={() => setIsSettingsOpen(true)}>
          Settings
        </button>
      </section>

      <section className="status-dock">
        <span className={`connection-pill connection-${connectionState}`}>
          {connectionState === "connected"
            ? "connected"
            : connectionState === "reconnecting"
              ? `reconnecting${reconnectAttempt > 0 ? ` (${reconnectAttempt})` : ""}`
              : "offline"}
        </span>
      </section>

      {isSettingsOpen && (
        <div className="settings-overlay" onClick={() => setIsSettingsOpen(false)}>
          <aside className="settings-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="settings-header">
              <h2>Settings</h2>
              <button type="button" className="secondary-button" onClick={() => setIsSettingsOpen(false)}>
                Close
              </button>
            </div>
            <div className="settings-body">
              <p>account: {user.username}</p>
              <p>
                status:{" "}
                {connectionState === "connected"
                  ? "connected"
                  : connectionState === "reconnecting"
                    ? `reconnecting${reconnectAttempt > 0 ? ` (${reconnectAttempt})` : ""}`
                    : "offline"}
              </p>
            </div>
            <div className="settings-footer">
              <button type="button" className="secondary-button" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

export default App;
