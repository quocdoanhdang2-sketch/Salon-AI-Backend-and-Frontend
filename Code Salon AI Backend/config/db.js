const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const database = new Database(path.join(__dirname, '..', 'salon.sqlite'));
database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');

function connectDB() {
    database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'STYLIST', 'ADMIN')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    `);
    const demoUsers = [
        ['Quản Trị Viên Salon', 'admin', 'admin123', 'ADMIN'],
        ['Alex Nguyễn (Master Balayage)', 'stylist_alex', '12345678', 'STYLIST'],
        ['Minh Tuấn (Senior Stylist)', 'stylist_tuan', '12345678', 'STYLIST'],
        ['Linh Dan (Chuyên Uốn Hàn Quốc)', 'stylist_dan', '12345678', 'STYLIST'],
        ['Nguyễn Thị Minh Anh', '0988123456', '12345678', 'USER'],
        ['Trần Văn Hoàng', '0912345678', '12345678', 'USER']
    ];
    const insertUser = database.prepare(
        'INSERT OR IGNORE INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, ?)'
    );
    const seedUsers = database.transaction(() => {
        demoUsers.forEach(([name, phone, password, role]) => {
            insertUser.run(name, phone, bcrypt.hashSync(password, 12), role);
        });
    });
    seedUsers();
    console.log('✅ Kết nối SQLite thành công!');
}

module.exports = { database, connectDB };