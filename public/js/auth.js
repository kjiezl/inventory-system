document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('signupForm').classList.remove('active');

    document.getElementById('showSignup').addEventListener('click', (e) => {
        e.preventDefault();
        switchForms('signup');
    });

    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        switchForms('login');
    });

    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('signupFormElement').addEventListener('submit', handleSignup);
});

function switchForms(targetForm) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    loginForm.classList.add('form-transition');
    signupForm.classList.add('form-transition');

    setTimeout(() => {
        if (targetForm === 'signup') {
            loginForm.classList.remove('active');
            signupForm.classList.add('active');
        } else {
            signupForm.classList.remove('active');
            loginForm.classList.add('active');
        }

        setTimeout(() => {
            loginForm.classList.remove('form-transition');
            signupForm.classList.remove('form-transition');
        }, 300);
    }, 10);
}

function checkAuthState() {
    const token = localStorage.getItem('token');
    if (token) {
        validateToken(token);
    } else {
        showLoginScreen();
    }
}

function setupAuthEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;

    try {
        const formData = {
            username: form.elements.username.value.trim(),
            password: form.elements.password.value.trim()
        };

        if (!formData.username || !formData.password) {
            throw new Error('All fields are required');
        }

        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const responseData = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid credentials');
            }
            throw new Error(responseData.error || `Login failed: ${response.statusText}`);
        }

        const { token, roleId } = responseData;
        localStorage.setItem('token', token);
        localStorage.setItem('roleId', roleId);
        showSuccessNotification('Logged in successfully!');

        form.reset();

        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('dashboard').style.display = 'grid';
        initializeDashboard();

    } catch (error) {
        console.error('Login Error:', error);
        showErrorNotification(error.message);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const form = e.target;
    try {
        const formData = {
            username: form.elements.username.value.trim(),
            password: form.elements.password.value.trim(),
            roleId: parseInt(form.elements.role.value)
        };

        if (!formData.username || !formData.password || isNaN(formData.roleId)) {
            throw new Error('All fields are required');
        }

        const response = await fetch('http://localhost:3000/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });

        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(responseData.error || `Signup failed: ${response.statusText}`);
        }

        showSuccessNotification('Account created successfully!');
        form.reset();
        document.getElementById('showLogin').click();

    } catch (error) {
        console.error('Signup Error:', error);
        showErrorNotification(error.message);
        const response = await fetch('http://localhost:3000/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        }).catch(console.error);
        console.log('Server Response:', response);
    }
}

function handleSuccessfulLogin(token, roleId) {
    localStorage.setItem('token', token);
    localStorage.setItem('roleId', roleId);
    
    hideLoginScreen();
    showDashboard();
    initializeDashboard();
}

function handleLogout() {
    localStorage.clear();
    showLoginScreen();
    hideDashboard();
    // window.location.reload();
}

async function validateToken(token) {
    try {
        const response = await fetch('/api/validate-token', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Invalid token');
        
        const { roleId } = await response.json();
        handleSuccessfulLogin(token, roleId);
    } catch (error) {
        handleAuthError(error.message);
        handleLogout();
    }
}

function handleAuthError(message) {
    showErrorNotification(message);
    clearPasswordField();
}

function showLoginScreen() {
    const loginContainer = document.getElementById('loginContainer');
    if (loginContainer) loginContainer.style.display = 'flex';
}

function hideLoginScreen() {
    const loginContainer = document.getElementById('loginContainer');
    if (loginContainer) loginContainer.style.display = 'none';
}

function showDashboard() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.style.display = 'grid';
        setTimeout(() => dashboard.classList.add('active'), 10);
    }
}

function hideDashboard() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.classList.remove('active');
        setTimeout(() => dashboard.style.display = 'none', 300);
    }
}

function clearPasswordField() {
    const passwordInput = document.getElementById('password');
    if (passwordInput) passwordInput.value = '';
}

function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function initializeDashboard() {
    if (typeof initStockChart === 'function') initStockChart();
    if (typeof loadRecentSales === 'function') loadRecentSales();
}