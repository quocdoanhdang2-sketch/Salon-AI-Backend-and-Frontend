const express = require('express');
const { register, login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticate, (req, res) => {
    res.json({ success: true, message: 'Đăng xuất thành công. Hãy xóa token ở frontend.' });
});
router.get('/me', authenticate, me);

module.exports = router;
