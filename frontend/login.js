const API_BASE = 'http://localhost:8000';

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('loginMessage');
    messageDiv.textContent = '';

    const formBody = new URLSearchParams();
    formBody.append('username', username);
    formBody.append('password', password);

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formBody
        });
        const data = await response.json();
        if (response.ok) {
            messageDiv.textContent = 'Login successful!';
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('token_expires_in', data.expires_in);
            window.location.href = 'index.html';
        } else {
            messageDiv.textContent = data.detail || 'Login failed.';
        }
    } catch (error) {
        messageDiv.textContent = 'Error connecting to server.';
    }
});

document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = '';

    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            messageDiv.textContent = 'Account created! You can sign in now.';
        } else {
            messageDiv.textContent = data.detail || 'Registration failed.';
        }
    } catch (error) {
        messageDiv.textContent = 'Error connecting to server.';
    }
});
