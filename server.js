// server.js
const express = require('express');
const db = require('./database.js');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;
const saltRounds = 10;

// --- CSP Middleware (The Security Fix) ---
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "script-src 'self' https://cdn.jsdelivr.net 'unsafe-eval'"
    );
    next();
});

// Standard Middleware
app.use(express.json());
app.use(express.static('public'));

// --- API ENDPOINTS ---

// POST /register
app.post('/register', (req, res) => {
    const { username, password, skills } = req.body;
    if (!username || !password || !skills) { return res.status(400).json({ error: "Username, password, and skills are required." }); }
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) { return res.status(500).json({ error: "Error hashing password." }); }
        const sql = 'INSERT INTO users (username, password, skills) VALUES (?, ?, ?)';
        db.run(sql, [username, hash, skills], function(err) {
            if (err) { return res.status(400).json({ error: err.message.includes('UNIQUE') ? "Username already taken." : err.message }); }
            res.status(201).json({ message: "User successfully registered!", userId: this.lastID });
        });
    });
});

// POST /login
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

// GET /users
app.get('/users', (req, res) => {
    const sql = "SELECT id, username, skills FROM users";
    db.all(sql, [], (err, rows) => {
        if (err) { return res.status(400).json({ "error": err.message }); }
        res.json({ "message": "success", "data": rows });
    });
});

// POST /events
app.post('/events', (req, res) => {
    const { name, description, date, organizerId } = req.body;
    if (!name || !description || !date || !organizerId) { return res.status(400).json({ error: "All fields are required for an event." }); }
    const sql = 'INSERT INTO events (name, description, date, organizerId) VALUES (?,?,?,?)';
    db.run(sql, [name, description, date, organizerId], function(err) {
        if (err) { return res.status(400).json({ error: err.message }); }
        res.status(201).json({ "eventId": this.lastID });
    });
});

// GET /events
app.get('/events', (req, res) => {
    const sql = "SELECT events.id, events.name, events.description, events.date, users.username as organizerName FROM events JOIN users ON events.organizerId = users.id";
    db.all(sql, [], (err, rows) => {
        if (err) { return res.status(400).json({ "error": err.message }); }
        res.json({ "message": "success", "data": rows });
    });
});

// POST /events/:id/join
app.post('/events/:id/join', (req, res) => {
    const eventId = req.params.id;
    const { userId } = req.body;
    if (!userId) { return res.status(400).json({ error: "User ID is required." }); }
    const sql = 'INSERT INTO event_participants (eventId, userId) VALUES (?, ?)';
    db.run(sql, [eventId, userId], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.json({ message: "User has already joined this event." });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "Successfully joined event." });
    });
});

// GET /events/:id/participants
app.get('/events/:id/participants', (req, res) => {
    const eventId = req.params.id;
    const sql = `
        SELECT u.id, u.username, u.skills 
        FROM users u
        JOIN event_participants ep ON u.id = ep.userId
        WHERE ep.eventId = ?
    `;
    db.all(sql, [eventId], (err, rows) => {
        if (err) { return res.status(500).json({ error: err.message }); }
        res.json({ data: rows });
    });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});