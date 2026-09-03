const express = require('express');
const router = express.Router();
const {
	createBooking,
	getBookings,
	getBookingById,
	updateBookingStatus,
	getBookingHistory,
	cancelBooking
} = require('../controllers/bookingController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/dat-lich', authenticate, authorize('USER', 'ADMIN'), createBooking);
router.get('/dat-lich', authenticate, authorize('ADMIN', 'STYLIST', 'USER'), getBookings);
router.post('/bookings', authenticate, authorize('USER', 'ADMIN'), createBooking);
router.get('/bookings', authenticate, authorize('ADMIN', 'STYLIST', 'USER'), getBookings);
router.get('/bookings/history', authenticate, getBookingHistory);
router.get('/bookings/:id', authenticate, getBookingById);
router.patch('/bookings/:id/status', authenticate, authorize('ADMIN', 'STYLIST'), updateBookingStatus);
router.delete('/bookings/:id', authenticate, authorize('USER', 'ADMIN'), cancelBooking);

module.exports = router;
