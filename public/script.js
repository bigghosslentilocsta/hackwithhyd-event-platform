// script.js
const socket = io();
let currentUser = null;
let currentEventId = null;
let createEventModal, participantsModal;
let joinedEvents = new Set();

const toast = document.getElementById('toast');
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    const views = { login: document.getElementById('login-view'), register: document.getElementById('register-view'), dashboard: document.getElementById('dashboard-view'), teamFinder: document.getElementById('team-finder-view'), eventDetails: document.getElementById('event-details-view') };
    const mainNav = document.getElementById('main-nav');
    const loginForm = document.getElementById('login-form'); const registerForm = document.getElementById('register-form'); const createEventForm = document.getElementById('create-event-form');
    const showRegisterLink = document.getElementById('show-register-link'); const showLoginLink = document.getElementById('show-login-link'); const showDashboardLink = document.getElementById('show-dashboard-link'); const showTeamFinderLink = document.getElementById('show-team-finder-link');
    const logoutButton = document.getElementById('logout-button'); const welcomeMessage = document.getElementById('welcome-message'); const eventsList = document.getElementById('events-list');
    const teamFinderList = document.getElementById('team-finder-list'); const participantsList = document.getElementById('participants-list'); const participantsModalTitle = document.getElementById('participants-modal-title');
    const eventDetailsTitle = document.getElementById('event-details-title'); const eventDetailsDescription = document.getElementById('event-details-description');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn'); const chatForm = document.getElementById('chat-form'); const chatInput = document.getElementById('chat-input'); const chatBox = document.getElementById('chat-box'); const searchForm = document.getElementById('search-form'); const searchInput = document.getElementById('search-input');
    
    createEventModal = new bootstrap.Modal(document.getElementById('create-event-modal'));
    participantsModal = new bootstrap.Modal(document.getElementById('participants-modal'));

    async function fetchJoinedEvents() {
        if (!currentUser) return;
        try {
            const response = await fetch(`/users/${currentUser.id}/joined-events`);
            const { data } = await response.json();
            joinedEvents = new Set(data);
        } catch (error) { console.error("Could not fetch joined events:", error); }
    }

    function showView(viewName) { for (const key in views) { if (views[key]) views[key].style.display = 'none'; } if (views[viewName]) { views[viewName].style.display = 'block'; } if (mainNav) mainNav.style.display = (viewName === 'login' || viewName === 'register') ? 'none' : 'flex'; }
    async function showEventDetails(eventId) { try { const response = await fetch(`/events/${eventId}`); const { data } = await response.json(); currentEventId = eventId; eventDetailsTitle.textContent = data.name; eventDetailsDescription.textContent = data.description; chatBox.innerHTML = ''; const messagesResponse = await fetch(`/events/${eventId}/messages`); const { data: messages } = await messagesResponse.json(); messages.forEach(message => outputMessage(message)); socket.emit('joinRoom', { eventId }); showView('eventDetails'); } catch (error) { showToast("Could not load event details."); } }
    function outputMessage(message) { const div = document.createElement('div'); div.classList.add('message-bubble'); if (message.username === currentUser.username) { div.classList.add('sent'); } else { div.classList.add('received'); } const metaText = (message.username === currentUser.username) ? 'You' : message.username; div.innerHTML = `<p class="message-meta">${metaText}</p><p class="message-text">${message.text}</p>`; chatBox.appendChild(div); chatBox.scrollTop = chatBox.scrollHeight; }
    
    async function fetchAndDisplayEvents(searchTerm = '') {
        await fetchJoinedEvents();
        try {
            const response = await fetch(`/events?search=${encodeURIComponent(searchTerm)}`);
            const { data } = await response.json();
            eventsList.innerHTML = '';
            if (data.length === 0) {
                eventsList.innerHTML = '<p class="text-center">No events found.</p>';
                return;
            }
            data.forEach(event => {
                const isJoined = joinedEvents.has(event.id);
                const joinButtonHTML = isJoined
                    ? `<button class="btn btn-danger btn-sm leave-event-btn" data-event-id="${event.id}">Leave Event</button>`
                    : `<button class="btn btn-primary btn-sm join-event-btn" data-event-id="${event.id}">Join Event</button>`;
                const eventCardHTML = `<div class="col-md-4 mb-3"><div class="card h-100" data-event-id="${event.id}" style="cursor: pointer;"><div class="card-body d-flex flex-column"><h5 class="card-title">${event.name}</h5><h6 class="card-subtitle mb-2">Date: ${new Date(event.date).toLocaleDateString()}</h6><p class="card-text text-muted small mb-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-people-fill" viewBox="0 0 16 16"><path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"/></svg> ${event.participantCount} Participants</p><p class="card-text">${event.description}</p><footer class="blockquote-footer">Organized by ${event.organizerName}</footer><div class="mt-auto pt-3">${joinButtonHTML}<a href="#" class="card-link view-participants-link ms-2" data-event-id="${event.id}" data-event-name="${event.name}">See Who's Going</a></div></div></div></div>`;
                eventsList.innerHTML += eventCardHTML;
            });
        } catch (error) { console.error('Error fetching events:', error); }
    }
    
    async function findTeams() { try { const response = await fetch('/users'); const { data: allUsers } = await response.json(); const currentUserSkills = currentUser.skills.split(',').map(s => s.trim().toLowerCase()); const matchedUsers = allUsers.filter(user => { if (user.id === currentUser.id) return false; const userSkills = user.skills.split(',').map(s => s.trim().toLowerCase()); return userSkills.some(skill => currentUserSkills.includes(skill)); }); teamFinderList.innerHTML = ''; if (matchedUsers.length === 0) { teamFinderList.innerHTML = '<div class="list-group-item">No matching users found.</div>'; return; } matchedUsers.forEach(user => { const userElement = `<div class="list-group-item"><h5 class="mb-1">${user.username}</h5><p class="mb-1"><strong>Skills:</strong> ${user.skills}</p></div>`; teamFinderList.innerHTML += userElement; }); } catch (error) { console.error('Error fetching users for team finder:', error); } }
    async function updateUIForLogin(user) { currentUser = user; welcomeMessage.textContent = `Welcome, ${user.username}!`; await fetchAndDisplayEvents(); showView('dashboard'); }
    
    loginForm.addEventListener('submit', async (event) => { event.preventDefault(); const username = document.getElementById('login-username').value; const password = document.getElementById('login-password').value; try { const response = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); updateUIForLogin(data.user); } catch (error) { showToast(`Login failed: ${error.message}`); } });
    registerForm.addEventListener('submit', async (event) => { event.preventDefault(); const username = document.getElementById('register-username').value; const password = document.getElementById('register-password').value; const skills = document.getElementById('register-skills').value; try { const response = await fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, skills }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); showToast('Registration successful! Please login.'); showView('login'); registerForm.reset(); } catch (error) { showToast(`Registration failed: ${error.message}`); } });
    createEventForm.addEventListener('submit', async (event) => { event.preventDefault(); const name = document.getElementById('event-name').value; const description = document.getElementById('event-description').value; const date = document.getElementById('event-date').value; try { const response = await fetch('/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, date, organizerId: currentUser.id }) }); if (!response.ok) throw new Error('Failed to create event.'); createEventForm.reset(); createEventModal.hide(); fetchAndDisplayEvents(); showToast("Event created successfully!"); } catch (error) { showToast(error.message); } });
    
    eventsList.addEventListener('click', async (event) => {
        const target = event.target;
        if (target.classList.contains('join-event-btn')) {
            const eventId = target.dataset.eventId;
            try { const response = await fetch(`/events/${eventId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id }) }); const data = await response.json(); showToast(data.message); fetchAndDisplayEvents(searchInput.value); } catch (error) { showToast('Failed to join event.'); }
        } else if (target.classList.contains('leave-event-btn')) {
            const eventId = target.dataset.eventId;
            try { const response = await fetch(`/events/${eventId}/join`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser.id }) }); const data = await response.json(); showToast(data.message); fetchAndDisplayEvents(searchInput.value); } catch (error) { showToast('Failed to leave event.'); }
        } else if (target.classList.contains('view-participants-link')) {
            event.preventDefault();
            const eventId = target.dataset.eventId;
            const eventName = target.dataset.eventName;
            participantsModalTitle.textContent = `Participants for ${eventName}`;
            try { const response = await fetch(`/events/${eventId}/participants`); const { data } = await response.json(); participantsList.innerHTML = ''; if (data.length === 0) { participantsList.innerHTML = '<li class="list-group-item">No one has joined yet.</li>'; } else { data.forEach(participant => { const li = document.createElement('li'); li.className = 'list-group-item'; li.textContent = participant.username; participantsList.appendChild(li); }); } participantsModal.show(); } catch (error) { showToast('Could not fetch participants.'); }
        } else {
            const card = target.closest('.card');
            if (card && card.dataset.eventId) {
                showEventDetails(card.dataset.eventId);
            }
        }
    });

    chatForm.addEventListener('submit', (event) => { event.preventDefault(); const message = chatInput.value; if (!message) return; socket.emit('chatMessage', { eventId: currentEventId, userId: currentUser.id, username: currentUser.username, message: message }); chatInput.value = ''; chatInput.focus(); });
    searchForm.addEventListener('submit', (event) => { event.preventDefault(); });
    searchInput.addEventListener('input', (event) => { fetchAndDisplayEvents(event.target.value); });
    socket.on('message', (message) => { outputMessage(message); });
    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); showView('register'); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showView('login'); });
    showDashboardLink.addEventListener('click', (e) => { e.preventDefault(); showView('dashboard'); });
    showTeamFinderLink.addEventListener('click', (e) => { e.preventDefault(); showView('teamFinder'); findTeams(); });
    logoutButton.addEventListener('click', () => { currentUser = null; loginForm.reset(); showView('login'); });
    backToDashboardBtn.addEventListener('click', () => { showView('dashboard'); });
    
    showView('login');
});