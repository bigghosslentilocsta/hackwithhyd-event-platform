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
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        skills TEXT
    )`, (err) => {
        if (err) { console.error("Error creating users table", err.message); }
    });

    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        date TEXT,
        organizerId INTEGER,
        FOREIGN KEY(organizerId) REFERENCES users(id)
    )`, (err) => {
        if (err) { console.error("Error creating events table", err.message); }
    });
});

module.exports = db;