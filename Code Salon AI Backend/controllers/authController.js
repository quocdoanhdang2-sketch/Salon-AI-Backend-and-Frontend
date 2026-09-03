const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { database } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function publicUser(user) {
    return { id: user.id, name: user.name, phone: user.phone, role: user.role };
}

function issueToken(user) {
    return jwt.sign({ id: user.id, name: user.name, phone: user.phone, role: user.role }, JWT_SECRET, {
        expiresIn: TOKEN_EXPIRES_IN
    });
}

function register(req, res) {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    // Public registration must never grant staff privileges. Staff accounts are
    // created by an administrator (or the explicit local demo seed) instead.
    const role = 'USER';

    if (!name || !/^\d{9,11}$/.test(phone) || password.length < 8) {
        return res.status(400).json({
            success: false,
            message: 'Họ tên, số điện thoại hợp lệ và mật khẩu tối thiểu 8 ký tự là bắt buộc.'
        });
    }

    try {
        const existingUser = database.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Số điện thoại đã được đăng ký.' });
        }

        const passwordHash = bcrypt.hashSync(password, 12);
        const result = database.prepare(
            'INSERT INTO users (name, phone, password_hash, role) VALUES (?, ?, ?, ?)'
        ).run(name, phone, passwordHash, role);
        const user = database.prepare('SELECT id, name, phone, role FROM users WHERE id = ?').get(result.lastInsertRowid);

        res.status(201).json({ success: true, data: { user, token: issueToken(user) } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Không thể tạo tài khoản.' });
    }
}

function login(req, res) {
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = database.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ success: false, message: 'Số điện thoại hoặc mật khẩu không đúng.' });
    }

    res.json({ success: true, data: { user: publicUser(user), token: issueToken(user) } });
}

function me(req, res) {
    const user = database.prepare('SELECT id, name, phone, role FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'Tài khoản không còn tồn tại.' });
    res.json({ success: true, data: user });
}

module.exports = { register, login, me };
