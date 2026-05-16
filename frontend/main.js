const API_BASE_URL = "http://127.0.0.1:8000";

const statusEl = document.getElementById("status");
const refreshButton = document.getElementById("refresh-button");
const logoutButton = document.getElementById("logout-button");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? "min-h-[24px] text-sm text-rose-300" : "min-h-[24px] text-sm text-slate-300";
}

function getTokenPayload(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base64).split("").map((char) => `%${("00" + char.charCodeAt(0).toString(16)).slice(-2)}`).join(""));
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

function renderTokens() {
  const accessToken = localStorage.getItem("access_token") || "";
  const refreshToken = localStorage.getItem("refresh_token") || "";
  const expiresIn = localStorage.getItem("expires_in") || "";

  document.getElementById("access-token").textContent = accessToken || "-";
  document.getElementById("refresh-token").textContent = refreshToken || "-";
  document.getElementById("expires-in").textContent = expiresIn ? `${expiresIn}s` : "-";

  const payload = getTokenPayload(accessToken);
  const username = payload?.sub || "user";
  document.getElementById("username").textContent = username;
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("token_type");
  localStorage.removeItem("expires_in");
  localStorage.removeItem("issued_at");
}

async function refreshTokens() {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    setStatus("No refresh token available.", true);
    return;
  }

  const response = await fetch(`${API_BASE_URL}/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    setStatus(data.detail || "Refresh failed.", true);
    return;
  }

  const payload = await response.json();
  localStorage.setItem("access_token", payload.access_token);
  localStorage.setItem("refresh_token", payload.refresh_token);
  localStorage.setItem("token_type", payload.token_type);
  localStorage.setItem("expires_in", String(payload.expires_in));
  localStorage.setItem("issued_at", String(Date.now()));

  renderTokens();
  setStatus("Token refreshed.");
}

refreshButton.addEventListener("click", () => {
  setStatus("Refreshing...");
  refreshTokens().catch(() => setStatus("Refresh failed.", true));
});

logoutButton.addEventListener("click", () => {
  clearTokens();
  window.location.href = "index.html";
});

const hasAccessToken = localStorage.getItem("access_token");
if (!hasAccessToken) {
  window.location.href = "index.html";
}

renderTokens();
