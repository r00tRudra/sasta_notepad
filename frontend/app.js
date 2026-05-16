const API_BASE_URL = "http://127.0.0.1:8000";

const form = document.getElementById("auth-form");
const loginTab = document.getElementById("login-tab");
const registerTab = document.getElementById("register-tab");
const submitButton = document.getElementById("submit-button");
const statusEl = document.getElementById("status");
const pathDisplay = document.getElementById("path-display");

let mode = "login";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "mt-4 min-h-[24px] text-sm text-rose-300" : "mt-4 min-h-[24px] text-sm text-slate-300";
}

function formatAuthError(error) {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return `Cannot reach the API at ${API_BASE_URL}. Make sure the backend is running and open the frontend at http://localhost:3000.`;
  }
  return error?.message || "Something went wrong.";
}

function setMode(nextMode) {
  mode = nextMode;
  const isLogin = mode === "login";
  loginTab.className = isLogin
    ? "flex-1 rounded-full bg-lime-300 px-4 py-2 font-medium text-slate-900 transition"
    : "flex-1 rounded-full px-4 py-2 font-medium text-slate-200 transition";
  registerTab.className = !isLogin
    ? "flex-1 rounded-full bg-lime-300 px-4 py-2 font-medium text-slate-900 transition"
    : "flex-1 rounded-full px-4 py-2 font-medium text-slate-200 transition";
  submitButton.textContent = isLogin ? "Login" : "Register";
  setStatus("");
}

function storeTokens(payload) {
  localStorage.setItem("access_token", payload.access_token);
  localStorage.setItem("refresh_token", payload.refresh_token);
  localStorage.setItem("token_type", payload.token_type);
  localStorage.setItem("expires_in", String(payload.expires_in));
  localStorage.setItem("issued_at", String(Date.now()));
}

async function login(username, password) {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);

  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Login failed.");
  }

  const payload = await response.json();
  storeTokens(payload);
}

async function register(username, password) {
  const response = await fetch(`${API_BASE_URL}/users/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Registration failed.");
  }
}

function redirectToMain() {
  window.location.href = "main.html";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    setStatus("Please fill in both fields.", true);
    return;
  }

  if (window.location.protocol === "file:") {
    setStatus("Open this page at http://localhost:3000 so the API calls work.", true);
    return;
  }

  try {
    setStatus("Working...");
    if (mode === "register") {
      await register(username, password);
      await login(username, password);
    } else {
      await login(username, password);
    }
    setStatus("Success! Redirecting...");
    setTimeout(redirectToMain, 600);
  } catch (error) {
    setStatus(formatAuthError(error), true);
  }
});

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

pathDisplay.textContent = window.location.pathname || "/";

const existingToken = localStorage.getItem("access_token");
if (existingToken) {
  redirectToMain();
}

setMode("login");
