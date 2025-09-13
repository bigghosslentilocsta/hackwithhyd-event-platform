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

app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "script-src 'self' https://cdn.jsdelivr.net https://cdn.socket.io 'unsafe-eval'");
    next();
});
app.use(express.json());
app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ eventId }) => { socket.join(eventId); });
    socket.on('chatMessage', (data) => {
        const { eventId, userId, username, message } = data;
        const sql = `INSERT INTO chat_messages (eventId, userId, username, message) VALUES (?, ?, ?, ?)`;
        db.run(sql, [eventId, userId, username, message], function(err) {
            if (err) { console.error('DB error saving message:', err.message); return; }
            io.to(eventId).emit('message', { username: username, text: message });
        });
    });
});

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

app.get('/users', (req, res) => {
    const sql = "SELECT id, username, skills FROM users";
    db.all(sql, [], (err, rows) => {
        if (err) { return res.status(400).json({ "error": err.message }); }
        res.json({ "message": "success", "data": rows });
    });
});

app.post('/events', (req, res) => {
    const { name, description, date, organizerId } = req.body;
    if (!name || !description || !date || !organizerId) { return res.status(400).json({ error: "All fields are required." }); }
    const sql = 'INSERT INTO events (name, description, date, organizerId) VALUES (?,?,?,?)';
    db.run(sql, [name, description, date, organizerId], function(err) {
        if (err) { return res.status(400).json({ error: err.message }); }
        res.status(201).json({ "eventId": this.lastID });
    });
});

app.get('/events', (req, res) => {
    const searchTerm = req.query.search || '';
    const sql = `SELECT e.id, e.name, e.description, e.date, u.username as organizerName, COUNT(ep.userId) as participantCount FROM events e JOIN users u ON e.organizerId = u.id LEFT JOIN event_participants ep ON e.id = ep.eventId WHERE e.name LIKE ? GROUP BY e.id ORDER BY e.date DESC`;
    const params = [`%${searchTerm}%`];
    db.all(sql, params, (err, rows) => {
        if (err) { return res.status(400).json({ "error": err.message }); }
        res.json({ "message": "success", "data": rows });
    });
});

app.get('/events/:id', (req, res) => {
    const eventId = req.params.id;
    const sql = "SELECT events.id, events.name, events.description, events.date, users.username as organizerName FROM events JOIN users ON events.organizerId = users.id WHERE events.id = ?";
    db.get(sql, [eventId], (err, row) => {
        if (err) { return res.status(400).json({ "error": err.message }); }
        if (!row) { return res.status(404).json({ "error": "Event not found" }); }
        res.json({ "message": "success", "data": row });
    });
});

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

app.delete('/events/:id/join', (req, res) => {
    const eventId = req.params.id;
    const { userId } = req.body;
    if (!userId) { return res.status(400).json({ error: "User ID is required." }); }
    const sql = 'DELETE FROM event_participants WHERE eventId = ? AND userId = ?';
    db.run(sql, [eventId, userId], function(err) {
        if (err) { return res.status(500).json({ error: err.message }); }
        res.json({ message: "Successfully left event!" });
    });
});

app.get('/users/:id/joined-events', (req, res) => {
    const userId = req.params.id;
    const sql = `SELECT eventId FROM event_participants WHERE userId = ?`;
    db.all(sql, [userId], (err, rows) => {
        if (err) { return res.status(500).json({ error: err.message }); }
        const eventIds = rows.map(row => row.eventId);
        res.json({ data: eventIds });
    });
});

app.get('/events/:id/participants', (req, res) => {
    const eventId = req.params.id;
    const sql = `SELECT u.id, u.username, u.skills FROM users u JOIN event_participants ep ON u.id = ep.userId WHERE ep.eventId = ?`;
    db.all(sql, [eventId], (err, rows) => {
        if (err) { return res.status(500).json({ error: err.message }); }
        res.json({ data: rows });
    });
});

app.get('/events/:id/messages', (req, res) => {
    const eventId = req.params.id;
    const sql = `SELECT username, message as text FROM chat_messages WHERE eventId = ? ORDER BY timestamp ASC`;
    db.all(sql, [eventId], (err, rows) => {
        if (err) { return res.status(500).json({ error: err.message }); }
        res.json({ data: rows });
    });
});

server.listen(PORT, () => { console.log(`Server is running on http://localhost:${PORT}`); });