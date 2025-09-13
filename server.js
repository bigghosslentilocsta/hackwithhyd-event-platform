// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const db = require('./database.js');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;
const saltRounds = 10;

// --- CRITICAL FIX: The Content Security Policy Middleware ---
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "script-src 'self' https://cdn.jsdelivr.net https://cdn.socket.io 'unsafe-eval'"
    );
    next();
});

// Standard Middleware
app.use(express.json());
app.use(express.static('public'));

// Real-time Chat Logic
io.on('connection', (socket) => {
    socket.on('joinRoom', ({ eventId }) => {
        socket.join(eventId);
    });
    socket.on('chatMessage', (data) => {
        const { eventId, userId, username, message } = data;
        const sql = `INSERT INTO chat_messages (eventId, userId, username, message) VALUES (?, ?, ?, ?)`;
        db.run(sql, [eventId, userId, username, message], function(err) {
            if (err) { console.error('DB error saving message:', err.message); return; }
            io.to(eventId).emit('message', { username: username, text: message });
        });
    });
});

// API Endpoint: Register
app.post('/register', (req, res) => {
    const { username, password, skills } = req.body;
    if (!username || !password || !skills) { return res.status(400).json({ error: "All fields are required." }); }
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) { return res.status(500).json({ error: "Error hashing password." }); }
        const sql = 'INSERT INTO users (username, password, skills) VALUES (?, ?, ?)';
        db.run(sql, [username, hash, skills], function(err) {
            if (err) { return res.status(400).json({ error: "Username already taken." }); }
            res.status(201).json({ message: "User successfully registered!", userId: this.lastID });
        });
    });
});

// API Endpoint: Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) { return res.status(400).json({ error: "Username and password are required." }); }
    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], (err, user) => {
        if (err || !user) { return res.status(400).json({ error: "Invalid username or password." }); }
        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                res.json({ message: "Login successful!", user: { id: user.id, username: user.username, skills: user.skills } });
            } else {
                res.status(400).json({ error: "Invalid username or password." });
            }
        });
    });
});

// API Endpoint: Get All Users
app.get('/users', (req, res) => {
    const sql = "SELECT id, username, skills FROM users";
    db.all(sql, [], (err, rows) => {
        if (err) { return res.status(400).json({ "error": err.message }); }
        res.json({ "message": "success", "data": rows });
    });
});

// API Endpoint: Create Event
app.post('/events', (req, res) => {
    const { name, description, date, organizerId } = req.body;
    if (!name || !description || !date || !organizerId) { return res.status(400).json({ error: "All fields are required." }); }
    const sql = 'INSERT INTO events (name, description, date, organizerId) VALUES (?,?,?,?)';
    db.run(sql, [name, description, date, organizerId], function(err) {
        if (err) { return res.status(400).json({ error: err.message }); }
        res.status(201).json({ "eventId": this.lastID });
    });
});

// API Endpoint: Get All Events (with Search)
app.get('/events', (req, res) => {
    const searchTerm = req.query.search || '';
    const sql = `SELECT events.id, events.name, events.description, events.date, users.username as organizerName FROM events JOIN users ON events.organizerId = users.id WHERE events.name LIKE ? ORDER BY events.date DESC`;
    const params = [`%${searchTerm}%`];
    db.all(sql, params, (err, rows) => {
        if (err) { return res.status(400).json({ "error": err.message }); }
        res.json({ "message": "success", "data": rows });
    });
});

// API Endpoint: Get Single Event
app.get('/events/:id', (req, res) => {
    const eventId = req.params.id;
    const sql = "SELECT events.id, events.name, events.description, events.date, users.username as organizerName FROM events JOIN users ON events.organizerId = users.id WHERE events.id = ?";
    db.get(sql, [eventId], (err, row) => {
        if (err) { return res.status(400).json({ "error": err.message }); }
        if (!row) { return res.status(404).json({ "error": "Event not found" }); }
        res.json({ "message": "success", "data": row });
    });
});

// API Endpoint: Join Event
app.post('/events/:id/join', (req, res) => {
    const eventId = req.params.id;
    const { userId } = req.body;
    if (!userId) { return res.status(400).json({ error: "User ID is required." }); }
    const sql = 'INSERT INTO event_participants (eventId, userId) VALUES (?, ?)';
    db.run(sql, [eventId, userId], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) { return res.json({ message: "You have already joined this event." }); }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "Successfully joined event!" });
    });
});

// API Endpoint: Get Event Participants
app.get('/events/:id/participants', (req, res) => {
    const eventId = req.params.id;
    const sql = `SELECT u.id, u.username, u.skills FROM users u JOIN event_participants ep ON u.id = ep.userId WHERE ep.eventId = ?`;
    db.all(sql, [eventId], (err, rows) => {
        if (err) { return res.status(500).json({ error: err.message }); }
        res.json({ data: rows });
    });
});

// API Endpoint: Get Chat History
app.get('/events/:id/messages', (req, res) => {
    const eventId = req.params.id;
    const sql = `SELECT username, message as text FROM chat_messages WHERE eventId = ? ORDER BY timestamp ASC`;
    db.all(sql, [eventId], (err, rows) => {
        if (err) { return res.status(500).json({ error: err.message }); }
        res.json({ data: rows });
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});