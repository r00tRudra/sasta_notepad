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
        const response = await fetch('http://localhost:8000/login', {
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
            // Redirect or load app
        } else {
            messageDiv.textContent = data.detail || 'Login failed.';
        }
    } catch (error) {
        messageDiv.textContent = 'Error connecting to server.';
    }
});
