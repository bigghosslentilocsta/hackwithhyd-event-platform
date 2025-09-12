// database.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./hackathon.db', (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    }
    console.log('Connected to the SQLite database.');
});

db.serialize(() => {
    // Users table (no changes)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        skills TEXT
    )`);

    // Events table (no changes)
    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        date TEXT,
        organizerId INTEGER,
        FOREIGN KEY(organizerId) REFERENCES users(id)
    )`);

    // --- NEW --- Event Participants table
    // This table links users to the events they've joined.
    db.run(`CREATE TABLE IF NOT EXISTS event_participants (
        eventId INTEGER,
        userId INTEGER,
        PRIMARY KEY (eventId, userId),
        FOREIGN KEY (eventId) REFERENCES events(id),
        FOREIGN KEY (userId) REFERENCES users(id)
    )`);
});

module.exports = db;