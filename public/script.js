// script.js

// --- Global State ---
let currentUser = null;
let createEventModal;

// --- DOM Elements ---
const views = {
    login: document.getElementById('login-view'),
    register: document.getElementById('register-view'),
    dashboard: document.getElementById('dashboard-view'),
    teamFinder: document.getElementById('team-finder-view')
};
const mainNav = document.getElementById('main-nav');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const createEventForm = document.getElementById('create-event-form');
const showRegisterLink = document.getElementById('show-register-link');
const showLoginLink = document.getElementById('show-login-link');
const showDashboardLink = document.getElementById('show-dashboard-link');
const showTeamFinderLink = document.getElementById('show-team-finder-link');
const logoutButton = document.getElementById('logout-button');
const welcomeMessage = document.getElementById('welcome-message');
const eventsList = document.getElementById('events-list');
const teamFinderList = document.getElementById('team-finder-list');

// --- Functions ---

// Function to switch between views
function showView(viewName) {
    for (const key in views) {
        if(views[key]) views[key].style.display = 'none';
    }
    if (views[viewName]) {
        views[viewName].style.display = 'block';
    }
    if(mainNav) mainNav.style.display = (viewName === 'login' || viewName === 'register') ? 'none' : 'flex';
}

// Fetch and display all events
async function fetchAndDisplayEvents() {
    try {
        const response = await fetch('/events');
        const { data } = await response.json();
        eventsList.innerHTML = ''; // Clear existing list
        if (data.length === 0) {
            eventsList.innerHTML = '<p class="text-center">No events found. Be the first to create one!</p>';
            return;
        }
        data.forEach(event => {
            const eventCard = `
                <div class="col-md-4 mb-3">
                    <div class="card h-100">
                        <div class="card-body">
                            <h5 class="card-title">${event.name}</h5>
                            <h6 class="card-subtitle mb-2 text-muted">Date: ${new Date(event.date).toLocaleDateString()}</h6>
                            <p class="card-text">${event.description}</p>
                            <footer class="blockquote-footer mt-auto">Organized by ${event.organizerName}</footer>
                        </div>
                    </div>
                </div>
            `;
            eventsList.innerHTML += eventCard;
        });
    } catch (error) {
        console.error('Error fetching events:', error);
    }
}

// AI Team Finder Logic
async function findTeams() {
    try {
        const response = await fetch('/users');
        const { data: allUsers } = await response.json();
        const currentUserSkills = currentUser.skills.split(',').map(s => s.trim().toLowerCase());
        
        const matchedUsers = allUsers.filter(user => {
            if (user.id === currentUser.id) return false;
            const userSkills = user.skills.split(',').map(s => s.trim().toLowerCase());
            return userSkills.some(skill => currentUserSkills.includes(skill));
        });

        teamFinderList.innerHTML = '';
        if (matchedUsers.length === 0) {
            teamFinderList.innerHTML = '<div class="list-group-item">No matching users found. Try adding more skills to your profile!</div>';
            return;
        }
        matchedUsers.forEach(user => {
            const userElement = `
                <div class="list-group-item">
                    <h5 class="mb-1">${user.username}</h5>
                    <p class="mb-1"><strong>Skills:</strong> ${user.skills}</p>
                </div>
            `;
            teamFinderList.innerHTML += userElement;
        });
    } catch (error) {
        console.error('Error fetching users for team finder:', error);
    }
}

function updateUIForLogin(user) {
    currentUser = user;
    welcomeMessage.textContent = `Welcome, ${user.username}!`;
    showView('dashboard');
    fetchAndDisplayEvents();
}

// --- Event Listeners ---

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        try {
            const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            updateUIForLogin(data.user);
        } catch (error) { alert(`Login failed: ${error.message}`); }
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const skills = document.getElementById('register-skills').value;
        try {
            const response = await fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, skills }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            alert('Registration successful! Please login.');
            showView('login');
            registerForm.reset();
        } catch (error) { alert(`Registration failed: ${error.message}`); }
    });
}

if(createEventForm) {
    createEventForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = document.getElementById('event-name').value;
        const description = document.getElementById('event-description').value;
        const date = document.getElementById('event-date').value;
        try {
            const response = await fetch('/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, date, organizerId: currentUser.id })
            });
            if (!response.ok) throw new Error('Failed to create event.');
            createEventForm.reset();
            createEventModal.hide();
            fetchAndDisplayEvents();
        } catch (error) {
            alert(error.message);
        }
    });
}

if(showRegisterLink) showRegisterLink.addEventListener('click', () => showView('register'));
if(showLoginLink) showLoginLink.addEventListener('click', () => showView('login'));
if(showDashboardLink) showDashboardLink.addEventListener('click', () => showView('dashboard'));
if(showTeamFinderLink) showTeamFinderLink.addEventListener('click', () => {
    showView('teamFinder');
    findTeams();
});
if(logoutButton) logoutButton.addEventListener('click', () => {
    currentUser = null;
    if(loginForm) loginForm.reset();
    showView('login');
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    const modalElement = document.getElementById('create-event-modal');
    if (modalElement) {
        createEventModal = new bootstrap.Modal(modalElement);
    }
    showView('login');
});