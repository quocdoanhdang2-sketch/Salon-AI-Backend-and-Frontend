const fs = require('fs');
const path = require('path');

const bookingsFile = path.join(__dirname, '..', 'danh-sach-dat-lich.json');
const historyFile = path.join(__dirname, '..', 'lich-su-dat-lich.json');
const ACTIVE_STATUSES = ['Xác nhận', 'Đang phục vụ'];
const STATUS_TRANSITIONS = {
    'Xác nhận': ['Đang phục vụ', 'Đã hủy'],
    'Đang phục vụ': ['Hoàn thành', 'Đã hủy']
};

function readBookings() {
    try {
        if (!fs.existsSync(bookingsFile)) return [];
        const content = fs.readFileSync(bookingsFile, 'utf8');
        return content.trim() ? JSON.parse(content) : [];
    } catch (error) {
        throw new Error('Không thể đọc danh sách đặt lịch.');
    }
}

function writeBookings(bookings) {
    fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2), 'utf8');
}

function readHistory() {
    try {
        if (!fs.existsSync(historyFile)) return [];
        const content = fs.readFileSync(historyFile, 'utf8');
        return content.trim() ? JSON.parse(content) : [];
    } catch (error) {
        throw new Error('Không thể đọc lịch sử đặt lịch.');
    }
}

function writeHistory(history) {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');
}

function createBookingId(bookings) {
    let id;
    do {
        id = `HANA-${String(Date.now()).slice(-8)}-${Math.floor(100 + Math.random() * 900)}`;
    } while (bookings.some((booking) => booking.id === id));
    return id;
}

function isValidDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const [year, month, day] = date.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day;
}

function isValidTime(time) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

const getBookings = (req, res) => {
    try {
        let bookings = readBookings();
        if (req.user?.role === 'USER') {
            bookings = bookings.filter((booking) => booking.phone === req.user.phone);
        } else if (req.user?.role === 'STYLIST') {
            bookings = bookings.filter((booking) => booking.stylist === req.user.name);
        }
        res.json({ success: true, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getBookingById = (req, res) => {
    try {
        const booking = readBookings().find((item) => item.id === req.params.id);
        if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch đặt.' });
        if (req.user?.role === 'USER' && booking.phone !== req.user.phone) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch hẹn này.' });
        }
        if (req.user?.role === 'STYLIST' && booking.stylist !== req.user.name) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch hẹn này.' });
        }
        res.json({ success: true, data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createBooking = (req, res) => {
    const { name, phone, service, date, branch, time, stylist, price, note } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
    const trimmedService = typeof service === 'string' ? service.trim() : '';
    const trimmedDate = typeof date === 'string' ? date.trim() : '';
    const trimmedTime = typeof time === 'string' ? time.trim() : '09:00';
    const trimmedBranch = typeof branch === 'string' ? branch.trim() : 'Hà Nội - 123 Cầu Giấy';
    const trimmedStylist = typeof stylist === 'string' ? stylist.trim() : 'Salon Tự Sắp Xếp';
    const trimmedNote = typeof note === 'string' ? note.trim() : '';

    if (!trimmedName || !/^\d{9,11}$/.test(trimmedPhone) || !trimmedService || !isValidDate(trimmedDate) || !isValidTime(trimmedTime)) {
        return res.status(400).json({
            success: false,
            message: 'Vui lòng nhập đúng họ tên, số điện thoại, dịch vụ và ngày đặt lịch.'
        });
    }

    if (req.user?.role === 'USER' && req.user.phone !== trimmedPhone) {
        return res.status(403).json({ success: false, message: 'Bạn chỉ được đặt lịch bằng số điện thoại của tài khoản.' });
    }

    try {
        const bookings = readBookings();
        const conflict = bookings.some((item) =>
            ACTIVE_STATUSES.includes(item.status) &&
            item.date === trimmedDate &&
            item.time === trimmedTime &&
            item.branch === trimmedBranch &&
            (trimmedStylist === 'Salon Tự Sắp Xếp' || item.stylist === trimmedStylist)
        );
        if (conflict) {
            return res.status(409).json({ success: false, message: 'Khung giờ này đã có lịch đặt.' });
        }

        const booking = {
            id: createBookingId(bookings),
            name: trimmedName,
            phone: trimmedPhone,
            branch: trimmedBranch,
            service: trimmedService,
            date: trimmedDate,
            time: trimmedTime,
            stylist: trimmedStylist,
            price: Number.isFinite(Number(price)) ? Number(price) : 0,
            note: trimmedNote,
            status: 'Xác nhận',
            createdAt: new Date().toISOString()
        };

        bookings.unshift(booking);
        writeBookings(bookings);

        res.status(201).json({
            success: true,
            message: 'Đặt lịch thành công! Cảm ơn bạn.',
            data: booking
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateBookingStatus = (req, res) => {
    const { status } = req.body;
    try {
        const bookings = readBookings();
        const bookingIndex = bookings.findIndex((item) => item.id === req.params.id);
        if (bookingIndex === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch đặt.' });

        const booking = bookings[bookingIndex];
        if (req.user?.role === 'USER' && booking.phone !== req.user.phone) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật lịch hẹn này.' });
        }
        if (req.user?.role === 'STYLIST' && booking.stylist !== req.user.name) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật lịch hẹn này.' });
        }
        if (!Object.prototype.hasOwnProperty.call(STATUS_TRANSITIONS, booking.status) ||
            !STATUS_TRANSITIONS[booking.status].includes(status)) {
            return res.status(409).json({ success: false, message: `Không thể chuyển từ "${booking.status}" sang "${status}".` });
        }

        booking.status = status;
        booking.updatedAt = new Date().toISOString();
        if (status === 'Hoàn thành') {
            booking.completedAt = booking.updatedAt;
            const history = readHistory();
            history.unshift(booking);
            writeHistory(history);
            bookings.splice(bookingIndex, 1);
        }
        writeBookings(bookings);
        res.json({ success: true, message: 'Cập nhật trạng thái thành công.', data: booking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getBookingHistory = (req, res) => {
    try {
        const history = readHistory();
        const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
        if (req.user?.role === 'USER') {
            return res.json({ success: true, data: history.filter((item) => item.phone === req.user.phone) });
        }
        if (req.user?.role === 'STYLIST') {
            return res.json({ success: true, data: history.filter((item) => item.stylist === req.user.name) });
        }
        res.json({ success: true, data: phone ? history.filter((item) => item.phone === phone) : history });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const cancelBooking = (req, res) => updateBookingStatus({ ...req, body: { status: 'Đã hủy' } }, res);

module.exports = { createBooking, getBookings, getBookingById, updateBookingStatus, getBookingHistory, cancelBooking };
