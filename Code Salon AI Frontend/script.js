/* ==========================================================================
   HANA HAIR SALON - INTERACTIVE JAVASCRIPT
   Multi-Actor System: Admin, Hair Stylist & Customer Roles (Bug-Free & Polished)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    const API_BASE = '/api';

    async function apiRequest(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        const token = localStorage.getItem('hana_access_token');
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        const result = await response.json().catch(() => ({ success: false, message: 'Phản hồi từ server không hợp lệ.' }));
        if (!response.ok) throw new Error(result.message || 'Yêu cầu thất bại.');
        return result;
    }

    /* --------------------------------------------------------------------------
       1. MOCK DATA FOR ALL ACTORS (ADMIN, STYLIST, USER)
       -------------------------------------------------------------------------- */
    const DEFAULT_USERS = [
        {
            phone: 'admin',
            password: 'admin123',
            name: 'Quản Trị Viên Salon',
            role: 'ADMIN',
            points: 9999,
            vouchers: [],
            history: []
        },
        {
            phone: 'stylist_alex',
            password: '12345678',
            name: 'Alex Nguyễn (Master Balayage)',
            keyword: 'Alex',
            role: 'STYLIST',
            points: 0,
            vouchers: [],
            history: []
        },
        {
            phone: 'stylist_tuan',
            password: '12345678',
            name: 'Minh Tuấn (Senior Stylist)',
            keyword: 'Minh Tuấn',
            role: 'STYLIST',
            points: 0,
            vouchers: [],
            history: []
        },
        {
            phone: 'stylist_dan',
            password: '12345678',
            name: 'Linh Dan (Chuyên Uốn Hàn Quốc)',
            keyword: 'Linh Dan',
            role: 'STYLIST',
            points: 0,
            vouchers: [],
            history: []
        },
        {
            phone: '0988123456',
            password: '12345678',
            name: 'Nguyễn Thị Minh Anh',
            role: 'USER',
            points: 1250,
            vouchers: [
                { id: 'v50', name: 'Voucher Giảm 50K', discount: 50000 }
            ],
            history: [
                { text: 'Tích +950 điểm từ đơn HANA-8821', date: '2026-08-10' },
                { text: 'Thưởng 300 điểm mừng đăng ký VIP', date: '2026-08-01' }
            ]
        },
        {
            phone: '0912345678',
            password: '12345678',
            name: 'Trần Văn Hoàng',
            role: 'USER',
            points: 450,
            vouchers: [],
            history: [
                { text: 'Tích +250 điểm từ đơn HANA-8822', date: '2026-08-14' },
                { text: 'Thưởng 200 điểm tài khoản mới', date: '2026-08-12' }
            ]
        }
    ];

    const DEFAULT_BOOKINGS = [
        {
            id: 'HANA-8821',
            name: 'Nguyễn Thị Minh Anh',
            phone: '0988123456',
            branch: 'Hà Nội - 123 Cầu Giấy',
            service: 'Nhuộm Thời Trang & Balayage Hàn Quốc',
            date: '2026-08-15',
            time: '09:30 AM',
            stylist: 'Alex Nguyễn (Master Balayage)',
            price: 950000,
            status: 'Xác nhận'
        },
        {
            id: 'HANA-8822',
            name: 'Trần Văn Hoàng',
            phone: '0912345678',
            branch: 'Hà Nội - 456 Trần Duy Hưng',
            service: 'Combo Cắt & Stylist Thiết Kế Form Tóc',
            date: '2026-08-14',
            time: '14:00 PM',
            stylist: 'Minh Tuấn (Senior Stylist)',
            price: 250000,
            status: 'Hoàn thành'
        },
        {
            id: 'HANA-8823',
            name: 'Lê Thu Hà',
            phone: '0977654321',
            branch: 'TP.HCM - 88 Nguyễn Trãi, Q.1',
            service: 'Phục Hồi Tóc Hư Tổn Chuyên Sâu Olaplex',
            date: '2026-08-16',
            time: '10:30 AM',
            stylist: 'Linh Dan (Chuyên Uốn Hàn Quốc)',
            price: 600000,
            status: 'Đang phục vụ'
        },
        {
            id: 'HANA-8824',
            name: 'Phạm Thị Lan',
            phone: '0966778899',
            branch: 'Hà Nội - 123 Cầu Giấy',
            service: 'Nhuộm Highlight / Ombre Sáng Tôn Da',
            date: '2026-08-17',
            time: '14:30 PM',
            stylist: 'Alex Nguyễn (Master Balayage)',
            price: 850000,
            status: 'Xác nhận'
        }
    ];

    /* --------------------------------------------------------------------------
       ROBUST DATA MANAGEMENT (AUTO-MIGRATE & SYNC DEFAULTS)
       -------------------------------------------------------------------------- */
    function getStoredUsers() {
        const stored = localStorage.getItem('hana_salon_users');
        let users = [];
        try {
            users = stored ? JSON.parse(stored) : [];
        } catch (e) {
            users = [];
        }

        // Always ensure system default accounts (admin, stylists, sample users) are present & updated
        DEFAULT_USERS.forEach(defUser => {
            const existingIdx = users.findIndex(u => u.phone.toLowerCase() === defUser.phone.toLowerCase());
            if (existingIdx === -1) {
                users.push(defUser);
            } else {
                users[existingIdx].role = defUser.role;
                users[existingIdx].password = defUser.password;
                if (defUser.keyword) users[existingIdx].keyword = defUser.keyword;
            }
        });

        localStorage.setItem('hana_salon_users', JSON.stringify(users));
        return users;
    }

    function saveUsers(users) {
        localStorage.setItem('hana_salon_users', JSON.stringify(users));
        updateAuthUI();
    }

    function getCurrentUser() {
        try {
            const serverUser = JSON.parse(localStorage.getItem('hana_current_user_data') || 'null');
            if (serverUser) {
                return {
                    points: 0,
                    vouchers: [],
                    history: [],
                    ...serverUser
                };
            }
        } catch (e) {
            localStorage.removeItem('hana_current_user_data');
        }
        const phone = localStorage.getItem('hana_current_user');
        if (!phone) return null;
        const users = getStoredUsers();
        return users.find(u => u.phone.toLowerCase() === phone.toLowerCase()) || null;
    }

    function setCurrentUser(phone, user = null) {
        if (phone) {
            localStorage.setItem('hana_current_user', phone);
            if (user) localStorage.setItem('hana_current_user_data', JSON.stringify(user));
        } else {
            localStorage.removeItem('hana_current_user');
            localStorage.removeItem('hana_current_user_data');
            localStorage.removeItem('hana_access_token');
        }
        updateAuthUI();
        renderBookingTable();
    }

    function getStoredBookings() {
        const stored = localStorage.getItem('hana_salon_bookings');
        let bookings = [];
        try {
            bookings = stored ? JSON.parse(stored) : [];
        } catch (e) {
            bookings = [];
        }

        const completedBookings = bookings.filter(booking => booking.status === 'Hoàn thành');
        if (completedBookings.length > 0) {
            const history = getStoredBookingHistory();
            const knownIds = new Set(history.map(booking => booking.id));
            completedBookings.forEach(booking => {
                if (!knownIds.has(booking.id)) history.push(booking);
            });
            localStorage.setItem('hana_salon_booking_history', JSON.stringify(history));
            bookings = bookings.filter(booking => booking.status !== 'Hoàn thành');
        }

        if (bookings.length === 0) {
            bookings = DEFAULT_BOOKINGS;
            const defaultCompleted = bookings.filter(booking => booking.status === 'Hoàn thành');
            if (defaultCompleted.length > 0) {
                const history = getStoredBookingHistory();
                const knownIds = new Set(history.map(booking => booking.id));
                defaultCompleted.forEach(booking => {
                    if (!knownIds.has(booking.id)) history.push(booking);
                });
                localStorage.setItem('hana_salon_booking_history', JSON.stringify(history));
                bookings = bookings.filter(booking => booking.status !== 'Hoàn thành');
            }
            localStorage.setItem('hana_salon_bookings', JSON.stringify(bookings));
        } else {
            DEFAULT_BOOKINGS.forEach(defB => {
                if (!bookings.some(b => b.id === defB.id)) {
                    bookings.push(defB);
                }
            });
            const newlyCompleted = bookings.filter(booking => booking.status === 'Hoàn thành');
            if (newlyCompleted.length > 0) {
                const history = getStoredBookingHistory();
                const knownIds = new Set(history.map(booking => booking.id));
                newlyCompleted.forEach(booking => {
                    if (!knownIds.has(booking.id)) history.push(booking);
                });
                localStorage.setItem('hana_salon_booking_history', JSON.stringify(history));
                bookings = bookings.filter(booking => booking.status !== 'Hoàn thành');
            }
            localStorage.setItem('hana_salon_bookings', JSON.stringify(bookings));
        }
        return bookings;
    }

    function getStoredBookingHistory() {
        try {
            return JSON.parse(localStorage.getItem('hana_salon_booking_history') || '[]');
        } catch (e) {
            return [];
        }
    }

    function archiveCompletedBooking(bookings, item) {
        const history = getStoredBookingHistory();
        if (!history.some(booking => booking.id === item.id)) history.push({ ...item, status: 'Hoàn thành' });
        localStorage.setItem('hana_salon_booking_history', JSON.stringify(history));
        bookings.splice(bookings.indexOf(item), 1);
    }

    function saveBookings(bookings) {
        localStorage.setItem('hana_salon_bookings', JSON.stringify(bookings));
        renderBookingTable();
        updateAdminStats();
        updateStylistStats();
    }

    async function syncBookingsFromServer() {
        if (!localStorage.getItem('hana_access_token')) return;
        try {
            const bookingsResult = await apiRequest('/bookings');
            localStorage.setItem('hana_salon_bookings', JSON.stringify(bookingsResult.data || []));
            const historyResult = await apiRequest('/bookings/history');
            localStorage.setItem('hana_salon_booking_history', JSON.stringify(historyResult.data || []));
            renderBookingTable();
            updateAdminStats();
            updateStylistStats();
        } catch (error) {
            console.warn('Không thể đồng bộ booking:', error.message);
        }
    }

    /* --------------------------------------------------------------------------
       2. TIER CALCULATIONS & BENEFITS
       -------------------------------------------------------------------------- */
    function getTierInfo(points) {
        if (points >= 2500) {
            return { name: 'Hạng Kim Cương', discountPct: 15, badgeClass: 'tier-diamond', maxPoints: 5000, nextTier: null };
        } else if (points >= 1000) {
            return { name: 'Hạng Vàng', discountPct: 10, badgeClass: 'tier-gold', maxPoints: 2500, nextTier: 'Kim Cương (2.500 Pts)' };
        } else if (points >= 500) {
            return { name: 'Hạng Bạc', discountPct: 5, badgeClass: 'tier-silver', maxPoints: 1000, nextTier: 'Vàng (1.000 Pts)' };
        } else {
            return { name: 'Hạng Đồng', discountPct: 0, badgeClass: 'tier-bronze', maxPoints: 500, nextTier: 'Bạc (500 Pts)' };
        }
    }

    /* --------------------------------------------------------------------------
       3. HERO SLIDER CAROUSEL LOGIC
       -------------------------------------------------------------------------- */
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = document.getElementById('sliderPrev');
    const nextBtn = document.getElementById('sliderNext');
    let currentSlide = 0;
    let slideInterval;

    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));

        currentSlide = (index + slides.length) % slides.length;
        slides[currentSlide].classList.add('active');
        if (dots[currentSlide]) dots[currentSlide].classList.add('active');
    }

    function startAutoSlide() {
        slideInterval = setInterval(() => showSlide(currentSlide + 1), 5000);
    }

    function resetAutoSlide() {
        clearInterval(slideInterval);
        startAutoSlide();
    }

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => { showSlide(currentSlide - 1); resetAutoSlide(); });
        nextBtn.addEventListener('click', () => { showSlide(currentSlide + 1); resetAutoSlide(); });
        dots.forEach((dot, idx) => {
            dot.addEventListener('click', () => { showSlide(idx); resetAutoSlide(); });
        });
        startAutoSlide();
    }

    /* --------------------------------------------------------------------------
       4. TOAST NOTIFICATIONS
       -------------------------------------------------------------------------- */
    const toastContainer = document.getElementById('toastContainer');

    function showToast(message, iconClass = 'fa-circle-check') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fa-solid ${iconClass} text-gold"></i> <span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    /* --------------------------------------------------------------------------
       5. AUTHENTICATION LOGIC (3 ACTORS: ADMIN, STYLIST, USER)
       -------------------------------------------------------------------------- */
    const authHeaderContainer = document.getElementById('authHeaderContainer');
    const authModal = document.getElementById('authModal');
    const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    const tabLoginBtn = document.getElementById('tabLoginBtn');
    const tabRegisterBtn = document.getElementById('tabRegisterBtn');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    const btnQuickLoginUser = document.getElementById('btnQuickLoginUser');
    const btnQuickLoginStylist = document.getElementById('btnQuickLoginStylist');
    const btnQuickLoginAdmin = document.getElementById('btnQuickLoginAdmin');

    function openAuthModal(mode = 'login') {
        switchAuthTab(mode);
        if (authModal) authModal.classList.add('active');
    }

    function switchAuthTab(mode) {
        if (mode === 'login') {
            if (tabLoginBtn) tabLoginBtn.classList.add('active');
            if (tabRegisterBtn) tabRegisterBtn.classList.remove('active');
            if (loginForm) loginForm.classList.add('active');
            if (registerForm) registerForm.classList.remove('active');
            const titleEl = document.getElementById('authModalTitle');
            if (titleEl) titleEl.textContent = 'ĐĂNG NHẬP TÀI KHOẢN';
        } else {
            if (tabRegisterBtn) tabRegisterBtn.classList.add('active');
            if (tabLoginBtn) tabLoginBtn.classList.remove('active');
            if (registerForm) registerForm.classList.add('active');
            if (loginForm) loginForm.classList.remove('active');
            const titleEl = document.getElementById('authModalTitle');
            if (titleEl) titleEl.textContent = 'ĐĂNG KÝ THÀNH VIÊN VIP';
        }
    }

    if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
    if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', () => switchAuthTab('register'));
    if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', () => authModal.classList.remove('active'));

    // Quick login auto-fills account + password and logs in instantly
    async function prepareQuickLogin(account) {
        openAuthModal('login');
        const phoneInput = document.getElementById('loginPhone');
        const passwordInput = document.getElementById('loginPassword');
        let pass = '12345678';
        if (account === 'admin') pass = 'admin123';

        if (phoneInput) phoneInput.value = account;
        if (passwordInput) passwordInput.value = pass;

        await performLogin(account, pass);
    }

    if (btnQuickLoginUser) btnQuickLoginUser.addEventListener('click', () => prepareQuickLogin('0988123456'));
    if (btnQuickLoginStylist) btnQuickLoginStylist.addEventListener('click', () => prepareQuickLogin('stylist_alex'));
    if (btnQuickLoginAdmin) btnQuickLoginAdmin.addEventListener('click', () => prepareQuickLogin('admin'));

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = document.getElementById('loginPhone').value.trim();
            const pass = document.getElementById('loginPassword').value;
            await performLogin(phone, pass);
        });
    }

    async function performLogin(phoneOrUsername, password) {
        try {
            const result = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ phone: phoneOrUsername.trim(), password })
            });
            localStorage.setItem('hana_access_token', result.data.token);
            setCurrentUser(result.data.user.phone, result.data.user);
            if (authModal) authModal.classList.remove('active');
            let roleTitle = 'Khách hàng VIP';
            if (result.data.user.role === 'ADMIN') roleTitle = 'Quản trị viên';
            if (result.data.user.role === 'STYLIST') roleTitle = 'Thợ làm tóc (Master Stylist)';

            showToast(`Chào mừng ${result.data.user.name} (${roleTitle}) đã đăng nhập!`);
        } catch (error) {
            alert(error.message || 'Tên đăng nhập hoặc mật khẩu không chính xác!');
        }
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            const pass = document.getElementById('regPassword').value;
            const role = document.getElementById('regRole')?.value || 'USER';

            try {
                const result = await apiRequest('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ name, phone, password: pass, role })
                });
                localStorage.setItem('hana_access_token', result.data.token);
                setCurrentUser(result.data.user.phone, result.data.user);
                if (authModal) authModal.classList.remove('active');
                showToast('Đăng ký thành công!');
            } catch (error) {
                alert(error.message || 'Không thể đăng ký tài khoản.');
            }
        });
    }

    function logout() {
        setCurrentUser(null);
        showToast('Đã đăng xuất tài khoản.', 'fa-circle-info');
    }

    function updateAuthUI() {
        const currentUser = getCurrentUser();
        // Luôn hiển thị nút Đặt Lịch cho tất cả khách hàng và khách vãng lai
        document.querySelectorAll('[data-booking-ui], .open-booking-trigger').forEach((element) => {
            element.classList.remove('hidden');
            element.setAttribute('aria-hidden', 'false');
        });
        if (!authHeaderContainer) return;

        if (!currentUser) {
            authHeaderContainer.innerHTML = `
                <button class="btn-login-trigger" id="openAuthBtn">
                    <i class="fa-solid fa-user"></i> ĐĂNG NHẬP / ĐĂNG KÝ
                </button>
            `;
            const openBtn = document.getElementById('openAuthBtn');
            if (openBtn) openBtn.addEventListener('click', () => openAuthModal('login'));

            const roleBadge = document.getElementById('roleCurrentBadge');
            if (roleBadge) {
                roleBadge.className = 'role-badge role-guest';
                roleBadge.innerHTML = '<i class="fa-solid fa-lock"></i> CHẾ ĐỘ: KHÁCH HÀNG (BẢO MẬT PHÂN QUYỀN)';
            }
        } else {
            const isAdmin = currentUser.role === 'ADMIN';
            const isStylist = currentUser.role === 'STYLIST';
            const tierInfo = getTierInfo(currentUser.points);

            let avatarStyle = '';
            let avatarIcon = 'fa-user';
            let roleLabel = `⭐ ${currentUser.points.toLocaleString()} Pts`;

            if (isAdmin) {
                avatarStyle = 'background: #e53e3e;';
                avatarIcon = 'fa-user-shield';
                roleLabel = 'QUẢN TRỊ VIỆN';
            } else if (isStylist) {
                avatarStyle = 'background: #f59e0b;';
                avatarIcon = 'fa-scissors';
                roleLabel = 'THỢ LÀM TÓC';
            }

            authHeaderContainer.innerHTML = `
                <div class="user-header-menu">
                    <div class="user-profile-pill" id="userPillBtn">
                        <div class="user-avatar-sm" style="${avatarStyle}">
                            <i class="fa-solid ${avatarIcon}"></i>
                        </div>
                        <div class="user-info-sm">
                            <span class="user-name-sm">${currentUser.name}</span>
                            <span class="user-pts-sm">${roleLabel}</span>
                        </div>
                        <i class="fa-solid fa-chevron-down" style="font-size: 0.7rem;"></i>
                    </div>

                    <div class="auth-dropdown-menu" id="authDropdown">
                        ${isAdmin ? `<div class="dropdown-item" id="menuAdminBtn"><i class="fa-solid fa-chart-line text-gold"></i> Bảng Quản Lý Salon</div>` : ''}
                        ${isStylist ? `<div class="dropdown-item" id="menuStylistBtn"><i class="fa-solid fa-calendar-check text-gold"></i> Lịch Hẹn Được Phân Công</div>` : ''}
                        ${(!isAdmin && !isStylist) ? `
                            <div class="dropdown-item" id="menuProfileBtn"><i class="fa-solid fa-crown text-gold"></i> Ví Điểm & Ưu Đãi VIP</div>
                            <div class="dropdown-item" id="menuMyBookingsBtn"><i class="fa-solid fa-calendar-days text-teal"></i> Lịch Hẹn Của Tôi</div>
                        ` : ''}
                        <div class="dropdown-item danger-item" id="menuLogoutBtn"><i class="fa-solid fa-right-from-bracket"></i> Đăng Xuất</div>
                    </div>
                </div>
            `;

            const pillBtn = document.getElementById('userPillBtn');
            const dropdown = document.getElementById('authDropdown');

            if (pillBtn && dropdown) {
                pillBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('active');
                });
                document.addEventListener('click', () => dropdown.classList.remove('active'));
            }

            const menuProfileBtn = document.getElementById('menuProfileBtn');
            if (menuProfileBtn) menuProfileBtn.addEventListener('click', openUserProfileModal);

            const menuMyBookingsBtn = document.getElementById('menuMyBookingsBtn');
            const menuStylistBtn = document.getElementById('menuStylistBtn');
            const menuAdminBtn = document.getElementById('menuAdminBtn');

            [menuMyBookingsBtn, menuStylistBtn, menuAdminBtn].forEach(btn => {
                if (btn) {
                    btn.addEventListener('click', () => {
                        document.getElementById('management').scrollIntoView({ behavior: 'smooth' });
                    });
                }
            });

            const menuLogoutBtn = document.getElementById('menuLogoutBtn');
            if (menuLogoutBtn) menuLogoutBtn.addEventListener('click', logout);

            const roleBadge = document.getElementById('roleCurrentBadge');
            if (roleBadge) {
                if (isAdmin) {
                    roleBadge.className = 'role-badge role-admin';
                    roleBadge.innerHTML = '<i class="fa-solid fa-user-shield"></i> Quyền: QUẢN TRỊ VIỆN (Toàn quyền Sửa/Xóa)';
                } else if (isStylist) {
                    roleBadge.className = 'role-badge role-stylist';
                    roleBadge.innerHTML = `<i class="fa-solid fa-scissors"></i> Quyền: THỢ LÀM TÓC (${currentUser.name})`;
                } else {
                    roleBadge.className = 'role-badge role-user';
                    roleBadge.innerHTML = `<i class="fa-solid fa-user-check text-gold"></i> Tài khoản: ${currentUser.name} (${tierInfo.name})`;
                }
            }
        }

        updateAdminStats();
        updateStylistStats();
    }

    /* --------------------------------------------------------------------------
       6. STYLIST PERFORMANCE STATS
       -------------------------------------------------------------------------- */
    const stylistStatsBar = document.getElementById('stylistStatsBar');

    function updateStylistStats() {
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.role === 'STYLIST') {
            if (stylistStatsBar) stylistStatsBar.classList.remove('hidden');

            const bookings = getStoredBookings();
            const bookingHistory = getStoredBookingHistory();
            const keyword = currentUser.keyword || currentUser.name.split(' ')[0];

            const myAssigned = bookings.filter(b => b.stylist && b.stylist.toLowerCase().includes(keyword.toLowerCase()));
            const myCompleted = bookingHistory.filter(b => b.stylist && b.stylist.toLowerCase().includes(keyword.toLowerCase()));
            const myRevenue = myCompleted.reduce((sum, b) => sum + (b.price || 0), 0);

            const assignedEl = document.getElementById('stylistTotalAssigned');
            const completedEl = document.getElementById('stylistCompletedCount');
            const revEl = document.getElementById('stylistRevenue');

            if (assignedEl) assignedEl.textContent = `${myAssigned.length} ca`;
            if (completedEl) completedEl.textContent = `${myCompleted.length} ca`;
            if (revEl) revEl.textContent = `${myRevenue.toLocaleString('vi-VN')} đ`;
        } else {
            if (stylistStatsBar) stylistStatsBar.classList.add('hidden');
        }
    }

    /* --------------------------------------------------------------------------
       7. USER PROFILE & WALLET MODAL LOGIC
       -------------------------------------------------------------------------- */
    const userProfileModal = document.getElementById('userProfileModal');
    const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
    const openUserProfileRewardsBtn = document.getElementById('openUserProfileRewardsBtn');

    function openUserProfileModal() {
        const user = getCurrentUser();
        if (!user) {
            openAuthModal('login');
            return;
        }

        const tier = getTierInfo(user.points);

        const nameEl = document.getElementById('upUserName');
        const phoneEl = document.getElementById('upUserPhone');
        const badgeEl = document.getElementById('upUserTierBadge');
        const pointsEl = document.getElementById('upUserPoints');
        const progressEl = document.getElementById('upProgressBar');
        const hintEl = document.getElementById('upProgressHint');

        if (nameEl) nameEl.textContent = user.name;
        if (phoneEl) phoneEl.textContent = `SĐT: ${user.phone}`;
        if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid fa-crown"></i> ${tier.name.toUpperCase()}`;
        if (pointsEl) pointsEl.textContent = user.points.toLocaleString();

        const pct = Math.min(100, Math.round((user.points / tier.maxPoints) * 100));
        if (progressEl) progressEl.style.width = `${pct}%`;
        
        if (hintEl) {
            if (tier.nextTier) {
                hintEl.textContent = `Hiện đang có ${user.points} điểm. Cần thêm ${tier.maxPoints - user.points} điểm để nâng hạng ${tier.nextTier}`;
            } else {
                hintEl.textContent = 'Chúc mừng! Bạn đã đạt Hạng Kim Cương cao nhất với đặc quyền ưu đãi 15%!';
            }
        }

        const voucherListEl = document.getElementById('userVoucherList');
        const countEl = document.getElementById('userVoucherCount');
        if (countEl) countEl.textContent = user.vouchers ? user.vouchers.length : 0;
        
        if (voucherListEl) {
            voucherListEl.innerHTML = '';
            if (!user.vouchers || user.vouchers.length === 0) {
                voucherListEl.innerHTML = '<p class="text-muted font-size-sm">Bạn chưa có Voucher nào trong ví. Hãy đổi điểm thưởng bên dưới!</p>';
            } else {
                user.vouchers.forEach(v => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML = `
                        <span><i class="fa-solid fa-ticket text-gold"></i> <strong>${v.name}</strong> (Giảm ${v.discount.toLocaleString()}đ)</span>
                        <span class="text-teal">Sẵn sàng sử dụng</span>
                    `;
                    voucherListEl.appendChild(div);
                });
            }
        }

        const historyListEl = document.getElementById('pointHistoryList');
        if (historyListEl) {
            historyListEl.innerHTML = '';
            if (!user.history || user.history.length === 0) {
                historyListEl.innerHTML = '<p class="text-muted font-size-sm">Chưa có lịch sử điểm.</p>';
            } else {
                user.history.slice().reverse().forEach(h => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML = `
                        <span>${h.text}</span>
                        <small class="text-muted">${h.date}</small>
                    `;
                    historyListEl.appendChild(div);
                });
            }
        }

        if (userProfileModal) userProfileModal.classList.add('active');
    }

    if (closeProfileModalBtn) closeProfileModalBtn.addEventListener('click', () => userProfileModal.classList.remove('active'));
    if (openUserProfileRewardsBtn) openUserProfileRewardsBtn.addEventListener('click', openUserProfileModal);

    document.querySelectorAll('.btn-redeem-voucher').forEach(btn => {
        btn.addEventListener('click', () => {
            const user = getCurrentUser();
            if (!user) {
                alert('Vui lòng đăng nhập để đổi điểm lấy Voucher!');
                openAuthModal('login');
                return;
            }

            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            const ptsReq = parseInt(btn.getAttribute('data-points') || '0');
            const discount = parseInt(btn.getAttribute('data-discount') || '0');

            if (user.points < ptsReq) {
                alert(`Bạn chưa đủ điểm! Cần ${ptsReq} điểm (Hiện có ${user.points} điểm).`);
                return;
            }

            user.points -= ptsReq;
            if (!user.vouchers) user.vouchers = [];
            user.vouchers.push({ id, name, discount });
            if (!user.history) user.history = [];
            user.history.push({ text: `Đổi -${ptsReq} điểm lấy ${name}`, date: new Date().toISOString().split('T')[0] });

            const users = getStoredUsers();
            const idx = users.findIndex(u => u.phone.toLowerCase() === user.phone.toLowerCase());
            if (idx !== -1) users[idx] = user;
            saveUsers(users);
            localStorage.setItem('hana_current_user_data', JSON.stringify(user));

            showToast(`Đổi quà thành công! Bạn nhận được ${name}`);
            openUserProfileModal();
        });
    });

    /* --------------------------------------------------------------------------
       8. MULTI-STEP BOOKING MODAL LOGIC
       -------------------------------------------------------------------------- */
    const bookingModal = document.getElementById('bookingModal');
    const closeBookingModalBtn = document.getElementById('closeBookingModalBtn');
    const openBookingTriggers = document.querySelectorAll('.open-booking-trigger, #openBookingModalBtn');

    const stepInd1 = document.getElementById('stepInd1');
    const stepInd2 = document.getElementById('stepInd2');
    const stepInd3 = document.getElementById('stepInd3');

    const formStep1 = document.getElementById('formStep1');
    const formStep2 = document.getElementById('formStep2');
    const formStep3 = document.getElementById('formStep3');

    const btnGoToStep2 = document.getElementById('btnGoToStep2');
    const btnBackToStep1 = document.getElementById('btnBackToStep1');
    const btnGoToStep3 = document.getElementById('btnGoToStep3');
    const btnBackToStep2 = document.getElementById('btnBackToStep2');

    const fullBookingForm = document.getElementById('fullBookingForm');
    const modalBookingDateInput = document.getElementById('modalBookingDate');
    const qbDateInput = document.getElementById('qbDate');

    const todayStr = new Date().toISOString().split('T')[0];
    if (modalBookingDateInput) modalBookingDateInput.value = todayStr;
    if (qbDateInput) qbDateInput.value = todayStr;

    openBookingTriggers.forEach(btn => {
        btn.addEventListener('click', () => {
            const preSelectedService = btn.getAttribute('data-service');
            const preSelectedBranch = btn.getAttribute('data-branch');

            const currentUser = getCurrentUser();
            if (currentUser && currentUser.role === 'USER') {
                const nameInp = document.getElementById('modalCustomerName');
                const phoneInp = document.getElementById('modalCustomerPhone');
                if (nameInp) nameInp.value = currentUser.name;
                if (phoneInp) phoneInp.value = currentUser.phone;
            }

            // Preselect service if clicked from service card
            if (preSelectedService) {
                const serviceSelect = document.getElementById('modalServiceSelect');
                if (serviceSelect) {
                    for (let opt of serviceSelect.options) {
                        if (opt.value.toLowerCase().includes(preSelectedService.toLowerCase()) || 
                            preSelectedService.toLowerCase().includes(opt.value.toLowerCase())) {
                            opt.selected = true;
                            break;
                        }
                    }
                }
            }

            // Preselect branch if clicked from branch card
            if (preSelectedBranch) {
                const branchRadios = document.querySelectorAll('input[name="modalBranch"]');
                branchRadios.forEach(radio => {
                    if (radio.value.toLowerCase().includes(preSelectedBranch.toLowerCase())) {
                        radio.checked = true;
                    }
                });
            }

            populateModalVouchers();
            goToStep(1);
            if (bookingModal) bookingModal.classList.add('active');
        });
    });

    if (closeBookingModalBtn) closeBookingModalBtn.addEventListener('click', () => bookingModal.classList.remove('active'));

    function populateModalVouchers() {
        const voucherSelect = document.getElementById('modalVoucherSelect');
        if (!voucherSelect) return;
        voucherSelect.innerHTML = '<option value="" data-discount="0">--- Không sử dụng Voucher ---</option>';

        const user = getCurrentUser();
        if (user && user.vouchers && user.vouchers.length > 0) {
            user.vouchers.forEach((v) => {
                const opt = document.createElement('option');
                opt.value = v.id;
                opt.setAttribute('data-discount', v.discount);
                opt.textContent = `${v.name} (Giảm ${v.discount.toLocaleString()}đ)`;
                voucherSelect.appendChild(opt);
            });
        }
    }

    function goToStep(stepNumber) {
        if (formStep1) formStep1.classList.remove('active');
        if (formStep2) formStep2.classList.remove('active');
        if (formStep3) formStep3.classList.remove('active');

        if (stepInd1) stepInd1.classList.remove('active');
        if (stepInd2) stepInd2.classList.remove('active');
        if (stepInd3) stepInd3.classList.remove('active');

        if (stepNumber === 1) {
            if (formStep1) formStep1.classList.add('active');
            if (stepInd1) stepInd1.classList.add('active');
        } else if (stepNumber === 2) {
            if (formStep2) formStep2.classList.add('active');
            if (stepInd2) stepInd2.classList.add('active');
        } else if (stepNumber === 3) {
            if (formStep3) formStep3.classList.add('active');
            if (stepInd3) stepInd3.classList.add('active');
            updateSummaryDetails();
        }
    }

    if (btnGoToStep2) btnGoToStep2.addEventListener('click', () => goToStep(2));
    if (btnBackToStep1) btnBackToStep1.addEventListener('click', () => goToStep(1));
    if (btnGoToStep3) btnGoToStep3.addEventListener('click', () => goToStep(3));
    if (btnBackToStep2) btnBackToStep2.addEventListener('click', () => goToStep(2));

    const modalVoucherSelect = document.getElementById('modalVoucherSelect');
    if (modalVoucherSelect) modalVoucherSelect.addEventListener('change', updateSummaryDetails);

    function updateSummaryDetails() {
        const selectedBranch = document.querySelector('input[name="modalBranch"]:checked')?.value || 'Hà Nội - 123 Cầu Giấy';
        const serviceSelect = document.getElementById('modalServiceSelect');
        const selectedOption = serviceSelect ? serviceSelect.options[serviceSelect.selectedIndex] : null;
        const serviceName = selectedOption ? selectedOption.value : 'Combo Cắt & Stylist Thiết Kế Form Tóc';
        const basePrice = selectedOption ? parseInt(selectedOption.getAttribute('data-price') || '250000') : 250000;

        const dateVal = document.getElementById('modalBookingDate')?.value || todayStr;
        const timeVal = document.getElementById('modalBookingTime')?.value || '09:00';

        const currentUser = getCurrentUser();
        const tier = currentUser ? getTierInfo(currentUser.points) : { discountPct: 0 };
        const tierDiscountVal = Math.round((basePrice * tier.discountPct) / 100);

        const vOption = modalVoucherSelect ? modalVoucherSelect.options[modalVoucherSelect.selectedIndex] : null;
        const voucherDiscountVal = vOption ? parseInt(vOption.getAttribute('data-discount') || '0') : 0;

        const totalDiscount = tierDiscountVal + voucherDiscountVal;
        const finalPrice = Math.max(0, basePrice - totalDiscount);
        const pointsToEarn = Math.floor(finalPrice / 1000);

        const sServ = document.getElementById('summaryServiceText');
        const sBranch = document.getElementById('summaryBranchText');
        const sTime = document.getElementById('summaryTimeText');
        const sDisc = document.getElementById('summaryDiscountText');
        const sPrice = document.getElementById('summaryPriceText');
        const sPts = document.getElementById('summaryPointsEarnedText');

        if (sServ) sServ.textContent = serviceName;
        if (sBranch) sBranch.textContent = selectedBranch;
        if (sTime) sTime.textContent = `${dateVal} - ${timeVal}`;
        if (sDisc) sDisc.textContent = `-${totalDiscount.toLocaleString('vi-VN')} đ (Hạng ${tier.discountPct}% + Voucher)`;
        if (sPrice) sPrice.textContent = `${finalPrice.toLocaleString('vi-VN')} đ`;
        if (sPts) sPts.textContent = `+${pointsToEarn.toLocaleString()} Pts`;
    }

    if (fullBookingForm) {
        fullBookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!getCurrentUser()) {
                alert('Vui lòng đăng nhập trước khi đặt lịch.');
                openAuthModal('login');
                return;
            }

            const name = document.getElementById('modalCustomerName')?.value;
            const phone = document.getElementById('modalCustomerPhone')?.value;
            const branch = document.querySelector('input[name="modalBranch"]:checked')?.value || 'Hà Nội - 123 Cầu Giấy';
            const serviceSelect = document.getElementById('modalServiceSelect');
            const service = serviceSelect?.value;
            const basePrice = parseInt(serviceSelect?.options[serviceSelect.selectedIndex]?.getAttribute('data-price') || '250000');
            const date = document.getElementById('modalBookingDate')?.value;
            const time = document.getElementById('modalBookingTime')?.value || '08:30';
            const stylist = document.querySelector('input[name="modalStylist"]:checked')?.value || 'Salon Tự Sắp Xếp';
            const note = document.getElementById('bookingNote')?.value?.trim() || '';

            const currentUser = getCurrentUser();
            const tier = currentUser ? getTierInfo(currentUser.points) : { discountPct: 0 };
            const voucherOption = modalVoucherSelect ? modalVoucherSelect.options[modalVoucherSelect.selectedIndex] : null;
            const voucherDiscount = voucherOption ? parseInt(voucherOption.getAttribute('data-discount') || '0') : 0;
            const tierDiscount = Math.round((basePrice * tier.discountPct) / 100);
            const finalPrice = Math.max(0, basePrice - tierDiscount - voucherDiscount);

            try {
                const result = await apiRequest('/bookings', {
                    method: 'POST',
                    body: JSON.stringify({ name, phone, branch, service, date, time, stylist, price: finalPrice, note })
                });

                if (result.success) {
                    alert('🎉 ' + result.message);
                    if (currentUser && voucherOption && voucherOption.value) {
                        const voucherIndex = currentUser.vouchers.findIndex(v => v.id === voucherOption.value);
                        if (voucherIndex !== -1) currentUser.vouchers.splice(voucherIndex, 1);
                        localStorage.setItem('hana_current_user_data', JSON.stringify(currentUser));
                    }
                    const bookings = getStoredBookings();
                    bookings.unshift(result.data);
                    saveBookings(bookings);
                    if (bookingModal) bookingModal.classList.remove('active');
                    fullBookingForm.reset();
                    if (modalBookingDateInput) modalBookingDateInput.value = todayStr;
                } else {
                    alert('❌ Lỗi: ' + result.message);
                }
            } catch (error) {
                console.error('Lỗi kết nối Backend:', error);
                alert('❌ ' + (error.message || 'Không thể kết nối tới Server Backend.'));
            }
        });
    }

    // Quick Booking Form Submission
    const quickBookingForm = document.getElementById('quickBookingForm');
    if (quickBookingForm) {
        quickBookingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const branch = document.getElementById('qbBranch').value;
            const service = document.getElementById('qbService').value;
            const date = document.getElementById('qbDate').value;
            const time = document.getElementById('qbTime').value;

            const branchRadios = document.querySelectorAll('input[name="modalBranch"]');
            branchRadios.forEach(radio => {
                if (radio.value.toLowerCase().includes(branch.toLowerCase())) radio.checked = true;
            });

            const serviceSelect = document.getElementById('modalServiceSelect');
            if (serviceSelect) {
                for (let opt of serviceSelect.options) {
                    if (opt.value.toLowerCase().includes(service.toLowerCase()) || service.toLowerCase().includes(opt.value.toLowerCase())) {
                        opt.selected = true;
                        break;
                    }
                }
            }

            const mDate = document.getElementById('modalBookingDate');
            const mTime = document.getElementById('modalBookingTime');
            if (mDate) mDate.value = date;
            if (mTime) mTime.value = time;

            goToStep(3);
            if (bookingModal) bookingModal.classList.add('active');
        });
    }

    /* --------------------------------------------------------------------------
       9. MULTI-ACTOR BOOKINGS MANAGEMENT TABLE (ADMIN, STYLIST & USER)
       -------------------------------------------------------------------------- */
    const bookingTableBody = document.getElementById('bookingTableBody');
    const emptyBookingState = document.getElementById('emptyBookingState');
    const bookingSearchInput = document.getElementById('bookingSearchInput');
    const bookingStatusFilter = document.getElementById('bookingStatusFilter');
    const adminStatsBar = document.getElementById('adminStatsBar');

    function updateAdminStats() {
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.role === 'ADMIN') {
            if (adminStatsBar) adminStatsBar.classList.remove('hidden');

            const bookings = getStoredBookings();
            const users = getStoredUsers();

            const completed = getStoredBookingHistory();
            const totalRev = completed.reduce((sum, b) => sum + (b.price || 0), 0);
            const totalPts = users.reduce((sum, u) => sum + (u.points || 0), 0);

            const revEl = document.getElementById('statTotalRevenue');
            const compEl = document.getElementById('statCompletedBookings');
            const ptsEl = document.getElementById('statTotalPoints');
            const usrEl = document.getElementById('statTotalUsers');

            if (revEl) revEl.textContent = `${totalRev.toLocaleString('vi-VN')} đ`;
            if (compEl) compEl.textContent = completed.length;
            if (ptsEl) ptsEl.textContent = `${totalPts.toLocaleString()} Pts`;
            if (usrEl) usrEl.textContent = users.length;
        } else {
            if (adminStatsBar) adminStatsBar.classList.add('hidden');
        }
    }

    function renderBookingTable() {
        const bookings = getStoredBookings();
        const currentUser = getCurrentUser();
        const searchQuery = (bookingSearchInput ? bookingSearchInput.value.trim().toLowerCase() : '');
        const statusFilter = (bookingStatusFilter ? bookingStatusFilter.value : 'all');

        const isUserAdmin = currentUser && currentUser.role === 'ADMIN';
        const isUserStylist = currentUser && currentUser.role === 'STYLIST';
        const isNormalUser = currentUser && currentUser.role === 'USER';
        const bookingHistory = getStoredBookingHistory();

        const actionTh = document.getElementById('actionTableHeader');
        if (actionTh) {
            actionTh.style.display = (isUserAdmin || isUserStylist) ? 'table-cell' : 'none';
        }

        let filtered = [];

        if (isUserAdmin) {
            filtered = bookings.filter(b => {
                const matchesSearch = b.phone.toLowerCase().includes(searchQuery) || 
                                      b.name.toLowerCase().includes(searchQuery) ||
                                      b.id.toLowerCase().includes(searchQuery);
                const matchesStatus = (statusFilter === 'all') || (b.status === statusFilter);
                return matchesSearch && matchesStatus;
            });
        } else if (isUserStylist) {
            const keyword = currentUser.keyword || currentUser.name.split(' ')[0];
            filtered = bookings.filter(b => {
                const isAssignedToMe = b.stylist && b.stylist.toLowerCase().includes(keyword.toLowerCase());
                const matchesSearch = b.phone.toLowerCase().includes(searchQuery) || 
                                      b.name.toLowerCase().includes(searchQuery) ||
                                      b.id.toLowerCase().includes(searchQuery);
                const matchesStatus = (statusFilter === 'all') || (b.status === statusFilter);
                return isAssignedToMe && matchesSearch && matchesStatus;
            });
        } else if (isNormalUser) {
            filtered = bookings.filter(b => {
                const isMine = b.phone === currentUser.phone;
                const matchesStatus = (statusFilter === 'all') || (b.status === statusFilter);
                return isMine && matchesStatus;
            });
        } else {
            if (searchQuery.length >= 4) {
                filtered = bookings.filter(b => {
                    const isExactMatch = b.phone.toLowerCase() === searchQuery || b.id.toLowerCase() === searchQuery;
                    const matchesStatus = (statusFilter === 'all') || (b.status === statusFilter);
                    return isExactMatch && matchesStatus;
                });
            } else {
                filtered = [];
            }
        }

        if (!bookingTableBody) return;
        bookingTableBody.innerHTML = '';

        if (filtered.length === 0) {
            if (emptyBookingState) emptyBookingState.classList.remove('hidden');
            const tableEl = document.getElementById('bookingTable');
            if (tableEl) tableEl.classList.add('hidden');

            const emptyTitle = emptyBookingState ? emptyBookingState.querySelector('h3') : null;
            const emptyMsg = emptyBookingState ? emptyBookingState.querySelector('p') : null;

            if (!currentUser) {
                if (emptyTitle) emptyTitle.textContent = '🔒 Tra cứu bảo mật';
                if (emptyMsg) emptyMsg.textContent = 'Vui lòng Đăng nhập tài khoản hoặc nhập chính xác Số điện thoại / Mã đặt lịch của bạn để tra cứu.';
            } else if (isUserStylist) {
                if (emptyTitle) emptyTitle.textContent = 'Chưa có ca làm tóc nào được phân công!';
                if (emptyMsg) emptyMsg.textContent = `Thợ làm tóc ${currentUser.name} hiện chưa có ca hẹn nào trong danh sách.`;
            } else if (isNormalUser) {
                if (emptyTitle) emptyTitle.textContent = 'Chưa có lịch hẹn nào!';
                if (emptyMsg) emptyMsg.textContent = `Tài khoản ${currentUser.name} (${currentUser.phone}) chưa có lịch hẹn nào. Hãy đặt lịch mới ngay bên dưới!`;
            } else {
                if (emptyTitle) emptyTitle.textContent = 'Chưa tìm thấy lịch hẹn!';
                if (emptyMsg) emptyMsg.textContent = 'Không có kết quả khớp với điều kiện tìm kiếm.';
            }
        } else {
            if (emptyBookingState) emptyBookingState.classList.add('hidden');
            const tableEl = document.getElementById('bookingTable');
            if (tableEl) tableEl.classList.remove('hidden');

            filtered.forEach(item => {
                const tr = document.createElement('tr');
                let badgeClass = 'badge-confirmed';
                if (item.status === 'Đang phục vụ') badgeClass = 'badge-serving';
                if (item.status === 'Hoàn thành') badgeClass = 'badge-completed';
                if (item.status === 'Đã hủy') badgeClass = 'badge-cancelled';

                let actionCellHTML = '';
                if (isUserAdmin) {
                    actionCellHTML = `
                        <td>
                            <button class="btn-action-icon edit-btn" data-id="${item.id}" title="Sửa / Duyệt lịch">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn-action-icon cancel-btn" data-id="${item.id}" title="Hủy lịch">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </td>
                    `;
                } else if (isUserStylist) {
                    actionCellHTML = `
                        <td>
                            <button class="btn-stylist-update update-status-btn" data-id="${item.id}">
                                <i class="fa-solid fa-scissors"></i> Cập Nhật Tiến Độ
                            </button>
                        </td>
                    `;
                }

                tr.innerHTML = `
                    <td><strong>${item.id}</strong></td>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.phone}</td>
                    <td>${item.branch}</td>
                    <td>${item.service}</td>
                    <td>${item.date} <br><small class="text-gold">${item.time}</small></td>
                    <td><strong class="text-teal">${item.stylist}</strong></td>
                    <td><span class="status-badge ${badgeClass}">${item.status}</span></td>
                    ${actionCellHTML}
                `;
                bookingTableBody.appendChild(tr);
            });

            if (isUserAdmin) {
                document.querySelectorAll('.edit-btn').forEach(btn => {
                    btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-id')));
                });
                document.querySelectorAll('.cancel-btn').forEach(btn => {
                    btn.addEventListener('click', () => cancelBookingQuick(btn.getAttribute('data-id')));
                });
            }

            if (isUserStylist) {
                document.querySelectorAll('.update-status-btn').forEach(btn => {
                    btn.addEventListener('click', () => openStylistStatusModal(btn.getAttribute('data-id')));
                });
            }
        }

        const historySection = document.getElementById('bookingHistorySection');
        const historyBody = document.getElementById('bookingHistoryBody');
        if (historySection && historyBody) {
            let visibleHistory = [];
            if (isUserAdmin) visibleHistory = bookingHistory;
            if (isNormalUser) visibleHistory = bookingHistory.filter(booking => booking.phone === currentUser.phone);
            historyBody.innerHTML = visibleHistory.length ? visibleHistory.map(item => `
                <tr>
                    <td><strong>${item.id}</strong></td>
                    <td>${item.name}</td>
                    <td>${item.phone}</td>
                    <td>${item.service}</td>
                    <td>${item.date}<br><small class="text-gold">${item.time}</small></td>
                    <td><span class="status-badge badge-completed">Hoàn thành</span></td>
                </tr>
            `).join('') : '<tr><td colspan="6" class="text-center text-muted">Chưa có lịch sử đặt lịch.</td></tr>';
            historySection.classList.toggle('hidden', !(isUserAdmin || isNormalUser));
        }
    }

    if (bookingSearchInput) bookingSearchInput.addEventListener('input', renderBookingTable);
    if (bookingStatusFilter) bookingStatusFilter.addEventListener('change', renderBookingTable);

    async function cancelBookingQuick(id) {
        const currentUser = getCurrentUser();
        if (!currentUser || currentUser.role !== 'ADMIN') {
            alert('Bạn không có quyền thực hiện thao tác này!');
            return;
        }

        if (confirm(`ADMIN: Bạn có chắc chắn muốn hủy lịch hẹn mã ${id}?`)) {
            try {
                await apiRequest(`/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' });
                await syncBookingsFromServer();
                showToast(`Đã hủy lịch hẹn ${id}`, 'fa-circle-xmark');
            } catch (error) {
                alert(error.message || 'Không thể hủy lịch hẹn.');
            }
        }
    }

    /* --------------------------------------------------------------------------
       10. STYLIST STATUS UPDATE MODAL LOGIC
       -------------------------------------------------------------------------- */
    const stylistStatusModal = document.getElementById('stylistStatusModal');
    const closeStylistModalBtn = document.getElementById('closeStylistModalBtn');
    const btnCancelStylistModal = document.getElementById('btnCancelStylistModal');
    const stylistStatusForm = document.getElementById('stylistStatusForm');

    function openStylistStatusModal(id) {
        const bookings = getStoredBookings();
        const item = bookings.find(b => b.id === id);
        if (!item) return;

        const idTag = document.getElementById('stylistBookingIdTag');
        const idInp = document.getElementById('stylistBookingId');
        const custName = document.getElementById('stylistCustName');
        const srvText = document.getElementById('stylistServiceText');
        const statusSelect = document.getElementById('stylistNewStatus');

        if (idTag) idTag.textContent = item.id;
        if (idInp) idInp.value = item.id;
        if (custName) custName.value = item.name;
        if (srvText) srvText.value = item.service;
        if (statusSelect) statusSelect.value = item.status;

        if (stylistStatusModal) stylistStatusModal.classList.add('active');
    }

    if (closeStylistModalBtn) closeStylistModalBtn.addEventListener('click', () => stylistStatusModal.classList.remove('active'));
    if (btnCancelStylistModal) btnCancelStylistModal.addEventListener('click', () => stylistStatusModal.classList.remove('active'));

    if (stylistStatusForm) {
        stylistStatusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('stylistBookingId').value;
            const newStatus = document.getElementById('stylistNewStatus').value;

            try {
                await apiRequest(`/bookings/${encodeURIComponent(id)}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: newStatus })
                });
                await syncBookingsFromServer();
                if (stylistStatusModal) stylistStatusModal.classList.remove('active');
                showToast(`Đã cập nhật tiến độ ca làm tóc ${id} thành '${newStatus}'`);
            } catch (error) {
                alert(error.message || 'Không thể cập nhật tiến độ.');
            }
        });
    }

    /* --------------------------------------------------------------------------
       11. EDIT BOOKING MODAL (ADMIN ONLY)
       -------------------------------------------------------------------------- */
    const editBookingModal = document.getElementById('editBookingModal');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const editBookingForm = document.getElementById('editBookingForm');
    const btnDeleteBooking = document.getElementById('btnDeleteBooking');

    function openEditModal(id) {
        const currentUser = getCurrentUser();
        if (!currentUser || currentUser.role !== 'ADMIN') {
            alert('Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa toàn bộ lịch hẹn!');
            return;
        }

        const bookings = getStoredBookings();
        const item = bookings.find(b => b.id === id);
        if (!item) return;

        document.getElementById('editBookingIdTag').textContent = item.id;
        document.getElementById('editBookingId').value = item.id;
        document.getElementById('editCustomerName').value = item.name;
        document.getElementById('editCustomerPhone').value = item.phone;
        document.getElementById('editBranch').value = item.branch;
        document.getElementById('editBookingDate').value = item.date;
        document.getElementById('editBookingTime').value = item.time;
        document.getElementById('editBookingStatus').value = item.status;

        if (editBookingModal) editBookingModal.classList.add('active');
    }

    if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', () => editBookingModal.classList.remove('active'));

    if (editBookingForm) {
        editBookingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const currentUser = getCurrentUser();
            if (!currentUser || currentUser.role !== 'ADMIN') return;

            const id = document.getElementById('editBookingId').value;
            const bookings = getStoredBookings();
            const item = bookings.find(b => b.id === id);

            if (item) {
                const prevStatus = item.status;
                const newStatus = document.getElementById('editBookingStatus').value;

                item.name = document.getElementById('editCustomerName').value.trim();
                item.phone = document.getElementById('editCustomerPhone').value.trim();
                item.branch = document.getElementById('editBranch').value;
                item.date = document.getElementById('editBookingDate').value;
                item.time = document.getElementById('editBookingTime').value;
                item.status = newStatus;

                if (prevStatus !== 'Hoàn thành' && newStatus === 'Hoàn thành') {
                    const pointsEarned = Math.floor((item.price || 0) / 1000);
                    const users = getStoredUsers();
                    const customer = users.find(u => u.phone.toLowerCase() === item.phone.toLowerCase());
                    if (customer) {
                        customer.points += pointsEarned;
                        if (!customer.history) customer.history = [];
                        customer.history.push({
                            text: `Tích +${pointsEarned.toLocaleString()} điểm từ đơn ${item.id} (${item.service})`,
                            date: new Date().toISOString().split('T')[0]
                        });
                        saveUsers(users);
                        const cur = getCurrentUser();
                        if (cur && cur.phone.toLowerCase() === customer.phone.toLowerCase()) {
                            localStorage.setItem('hana_current_user_data', JSON.stringify(customer));
                        }
                        showToast(`ADMIN: Đã cộng +${pointsEarned} điểm thưởng cho khách hàng ${item.name}!`);
                    }
                }

                if (newStatus === 'Hoàn thành') archiveCompletedBooking(bookings, item);
                saveBookings(bookings);
                if (editBookingModal) editBookingModal.classList.remove('active');
                showToast(`Đã cập nhật thành công lịch hẹn ${id}`);
            }
        });
    }

    if (btnDeleteBooking) {
        btnDeleteBooking.addEventListener('click', () => {
            const id = document.getElementById('editBookingId').value;
            cancelBookingQuick(id);
            if (editBookingModal) editBookingModal.classList.remove('active');
        });
    }

    /* --------------------------------------------------------------------------
       12. SHOPPING CART DRAWER LOGIC
       -------------------------------------------------------------------------- */
    let cart = [];
    const cartToggleBtn = document.getElementById('cartToggleBtn');
    const cartDrawer = document.getElementById('cartDrawer');
    const cartDrawerOverlay = document.getElementById('cartDrawerOverlay');
    const closeCartDrawerBtn = document.getElementById('closeCartDrawerBtn');
    const cartBadge = document.getElementById('cartBadge');
    const cartItemsList = document.getElementById('cartItemsList');
    const cartTotalPrice = document.getElementById('cartTotalPrice');

    function toggleCartDrawer(open) {
        if (open) {
            if (cartDrawer) cartDrawer.classList.add('active');
            if (cartDrawerOverlay) cartDrawerOverlay.classList.add('active');
        } else {
            if (cartDrawer) cartDrawer.classList.remove('active');
            if (cartDrawerOverlay) cartDrawerOverlay.classList.remove('active');
        }
    }

    if (cartToggleBtn) cartToggleBtn.addEventListener('click', () => toggleCartDrawer(true));
    if (closeCartDrawerBtn) closeCartDrawerBtn.addEventListener('click', () => toggleCartDrawer(false));
    if (cartDrawerOverlay) cartDrawerOverlay.addEventListener('click', () => toggleCartDrawer(false));

    document.querySelectorAll('.btn-add-cart').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            const price = parseInt(btn.getAttribute('data-price') || '0');

            const existing = cart.find(item => item.id === id);
            if (existing) {
                existing.qty += 1;
            } else {
                cart.push({ id, name, price, qty: 1 });
            }

            updateCartUI();
            showToast(`Đã thêm ${name} vào giỏ hàng`);
        });
    });

    function updateCartUI() {
        const totalQty = cart.reduce((sum, i) => sum + i.qty, 0);
        if (cartBadge) cartBadge.textContent = totalQty;

        if (!cartItemsList) return;
        cartItemsList.innerHTML = '';

        if (cart.length === 0) {
            cartItemsList.innerHTML = '<p class="text-center text-muted mt-4">Giỏ hàng của bạn đang trống.</p>';
            if (cartTotalPrice) cartTotalPrice.textContent = '0 đ';
            return;
        }

        let total = 0;
        cart.forEach(item => {
            const itemTotal = item.price * item.qty;
            total += itemTotal;

            const div = document.createElement('div');
            div.className = 'cart-item-row';
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);';
            div.innerHTML = `
                <div>
                    <strong style="font-size: 0.85rem;">${item.name}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${item.qty} x ${item.price.toLocaleString('vi-VN')} đ</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <strong class="text-gold" style="font-size: 0.9rem;">${itemTotal.toLocaleString('vi-VN')} đ</strong>
                    <button class="remove-cart-item" data-id="${item.id}" style="background:none; border:none; color:red; cursor:pointer;">&times;</button>
                </div>
            `;
            cartItemsList.appendChild(div);
        });

        if (cartTotalPrice) cartTotalPrice.textContent = `${total.toLocaleString('vi-VN')} đ`;

        document.querySelectorAll('.remove-cart-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                cart = cart.filter(i => i.id !== id);
                updateCartUI();
            });
        });
    }

    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                alert('Giỏ hàng trống!');
                return;
            }
            alert('Cảm ơn bạn đã đặt mua sản phẩm! Nhân viên Hana Hair sẽ liên hệ giao hàng cho bạn ngay.');
            cart = [];
            updateCartUI();
            toggleCartDrawer(false);
        });
    }

    /* --------------------------------------------------------------------------
       13. SERVICES FILTERING & MOBILE TOGGLE
       -------------------------------------------------------------------------- */
    const serviceFilterBtns = document.querySelectorAll('#serviceFilters .s-tab-btn, #serviceFilters .filter-btn');
    const serviceCards = document.querySelectorAll('#servicesGrid .service-premium-card, #servicesGrid .service-card');

    serviceFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            serviceFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');
            serviceCards.forEach(card => {
                const cardCat = card.getAttribute('data-category');
                if (filter === 'all' || cardCat === filter) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    const mobileToggleBtn = document.getElementById('mobileToggleBtn');
    const mainNav = document.getElementById('mainNav');

    if (mobileToggleBtn && mainNav) {
        mobileToggleBtn.addEventListener('click', () => {
            mainNav.classList.toggle('active');
        });
    }

    /* --------------------------------------------------------------------------
       14. 3D AR FACE SCAN & VIRTUAL HAIRSTYLE MIRROR
       -------------------------------------------------------------------------- */
    let cvEngine = null;
    let arVideoTrackStream = null;
    let arTrackingLoopId = null;

    const canvas2dEngine = document.getElementById('aiTryOnCanvasEngine');
    const ar3dVideo = document.getElementById('ar3dVideo');
    const ar3dMeshCanvas = document.getElementById('ar3dMeshCanvas');
    const ar3dThreeContainer = document.getElementById('ar3dThreeContainer');
    const btnStart3dCamera = document.getElementById('btnStart3dCamera');
    const btnArSnap = document.getElementById('btnArSnap');
    const btnBook3dStyle = document.getElementById('btnBook3dStyle');
    const arFaceShapeVal = document.getElementById('arFaceShapeVal');
    const arSkinToneVal = document.getElementById('arSkinToneVal');
    const arTrackingStatus = document.getElementById('arTrackingStatus');

    // Init CVHairEngine (có callback hiển thị trạng thái AI Engine lên badge gương 3D)
    if (window.CVHairEngine) {
        cvEngine = new window.CVHairEngine({
            canvas: canvas2dEngine,
            onStatus: (message) => {
                if (arTrackingStatus && message) arTrackingStatus.textContent = message;
            }
        });
    }

    // The old 2D overlay studio is intentionally disabled. The visible flow is
    // the real-time 3D mirror, started only after the user presses the camera button.
    const tabModePhotoAi = document.getElementById('tabModePhotoAi');
    const tabMode3dMirror = document.getElementById('tabMode3dMirror');
    const aiStudioPanel = document.querySelector('.ai-studio-panel');
    const ai3dMirrorContainer = document.getElementById('ai3dMirrorContainer');

    if (aiStudioPanel) aiStudioPanel.style.display = 'none';
    if (ai3dMirrorContainer) ai3dMirrorContainer.classList.remove('hidden');

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function setAdviceList(id, items) {
        const list = document.getElementById(id);
        if (!list) return;
        list.innerHTML = items.map((item) => `<li>${item}</li>`).join('');
    }

    let lastConsultationKey = '';

    function update3dFaceConsultation(metrics) {
        const shape = metrics?.faceShape || 'Oval (Trái Xoan)';
        const skinTone = metrics?.skinTone || 'Warm Beige';

        // Chỉ cập nhật DOM khi dáng mặt / tone da thay đổi (tránh ghi DOM 60 lần/giây)
        const consultKey = `${shape}|${skinTone}`;
        if (consultKey === lastConsultationKey) return;
        lastConsultationKey = consultKey;

        const lower = shape.toLowerCase();
        const shapeKey = lower.includes('tròn') || lower.includes('round') ? 'round'
            : lower.includes('vuông') || lower.includes('square') ? 'square'
                : lower.includes('dài') || lower.includes('oblong') ? 'oblong'
                    : lower.includes('tim') || lower.includes('heart') ? 'heart'
                        : lower.includes('kim cương') || lower.includes('diamond') ? 'diamond' : 'oval';

        const adviceMap = {
            oval: {
                summary: 'Tỷ lệ khuôn mặt Oval cân đối chuẩn tỷ lệ vàng. Rất dễ phối các kiểu tóc từ dài bồng bềnh đến bob ngắn cá tính.',
                strengths: [
                    'Tỷ lệ chiều dài và chiều ngang đạt chuẩn tỷ lệ vàng hoàn mỹ.',
                    'Đường xương cằm thon thả V-line, trán và sống mũi thanh tú hài hòa.'
                ],
                cautions: [
                    'Hạn chế kiểu tóc mái bằng quá dày che khuất hoàn toàn vầng trán.',
                    'Tránh tóc thẳng xẹp ép sát vào hai bên thái dương làm giảm độ thoáng của mặt.'
                ],
                style: 'Gợi ý: Layer Dài Cúp Ngọn, Sóng Lơi Bồng Bềnh, Bob Balayage. Màu tôn da nhất: Caramel, Nâu Hạt Dẻ, Balayage Khói.'
            },
            round: {
                summary: 'Khuôn mặt tròn mang nét trẻ trung, đáng yêu. Mục tiêu tạo kiểu là tăng độ phồng đỉnh đầu và tạo lớp tóc bay dọc hai bên để thon gọn xương gò má.',
                strengths: [
                    'Nét mặt trẻ lâu, bầu bĩnh phúc hậu, đường nét mềm mại tự nhiên.',
                    'Rất hợp với các kiểu tóc layer tỉa tầng ôm sát má và tóc mái bay dài.'
                ],
                cautions: [
                    'Tuyệt đối tránh tóc bob ngắn cắt bằng ngay cằm hoặc tóc uốn phồng ngang tai.',
                    'Tránh tóc ép thẳng đuỗn không có độ dốc che khuyết điểm má.'
                ],
                style: 'Gợi ý: Layer Nữ Dài, Mái Bay Hàn Quốc, Side Part 7/3 rẽ ngôi lệch; Màu nhuộm: Nâu Lạnh, Nâu Socola, Nâu Rêu Khói.'
            },
            square: {
                summary: 'Gương mặt vuông chữ điền có xương quai hàm sắc sảo, cá tính. Cần các sóng tóc lượn mềm mại để làm dịu góc cạnh và kéo dài khuôn mặt.',
                strengths: [
                    'Khung xương hàm sắc nét, tạo vẻ đẹp quý phái, quyền lực và cuốn hút.',
                    'Phù hợp với các kiểu tóc uốn sóng lơi nhẹ nhàng, wolf cut hoặc side part bồng bềnh.'
                ],
                cautions: [
                    'Không nên cắt tóc ngắn ngang bằng quai hàm làm nổi bật góc cạnh vuông.',
                    'Tránh buộc tóc túm gọn ra sau để lộ toàn bộ đường quai hàm.'
                ],
                style: 'Gợi ý: Sóng Lơi Hàn Quốc, Wolf Cut Shag, Side Part 7/3 uốn phồng; Màu nhuộm: Nâu Hạt Dẻ, Nâu Caramel, Xám Khói Balayage.'
            },
            heart: {
                summary: 'Khuôn mặt trái tim có trán rộng và cằm V-line nhỏ gọn. Kiểu tóc lý tưởng nên tạo độ phồng ở ngang cằm và mái thưa nhẹ để cân bằng trán.',
                strengths: [
                    'Cằm nhọn V-line thanh tú, đôi mắt và gò má thu hút ánh nhìn.',
                    'Rất hợp tóc Bob uốn cúp, tóc xoăn sóng dài ngang vai hoặc Pixie cá tính.'
                ],
                cautions: [
                    'Tránh phồng quá mức ở phần đỉnh đầu hoặc thái dương.',
                    'Hạn chế kiểu tóc vuốt ngược hoàn toàn ra sau làm lộ trán rộng.'
                ],
                style: 'Gợi ý: Bob Balayage, Layer Cúp Ngang Vai, Mái Thưa Hàn Quốc; Màu nhuộm: Nâu Mật Ong, Vàng Caramel, Hồng Pastel.'
            },
            oblong: {
                summary: 'Gương mặt dài có chiều dài lớn hơn nhiều so với chiều ngang. Cần tạo độ bồng bềnh hai bên má và mái bay để thu ngắn tỷ lệ khuôn mặt.',
                strengths: [
                    'Gương mặt thanh mảnh, quý phái, dáng cổ cao sang trọng.',
                    'Rất hợp với tóc uốn xoăn sóng to bồng bềnh hai bên và mái bằng/mái bay.'
                ],
                cautions: [
                    'Tuyệt đối tránh tóc thẳng đuột dài quá ngực hoặc vuốt dựng đỉnh đầu.',
                    'Tránh rẽ ngôi giữa ép sát hai bên má.'
                ],
                style: 'Gợi ý: Sóng Lơi Bồng Bềnh, Bob Uốn Cúp Phồng, Layer Ngang Lưng; Màu nhuộm: Nâu Socola, Vàng Caramel, Nâu Hạt Dẻ.'
            },
            diamond: {
                summary: 'Khuôn mặt kim cương có gò má nổi bật, trán và cằm thon gọn. Tóc layer hoặc sóng lơi che nhẹ gò má sẽ tôn trọn nét đẹp kiêu kỳ.',
                strengths: [
                    'Gò má cao thời thượng chuẩn người mẫu quốc tế.',
                    'Cằm thon gọn, đường nét sắc sảo, thần thái cuốn hút.'
                ],
                cautions: [
                    'Tránh tóc mái quá ngắn làm gò má trông rộng hơn.',
                    'Hạn chế tóc tém quá ngắn để lộ xương gò má góc cạnh.'
                ],
                style: 'Gợi ý: Mái Bay Hàn Quốc, Layer Dài Lơi, Wolf Cut Shag; Màu nhuộm: Xám Khói, Nâu Rêu, Bạch Kim.'
            }
        }[shapeKey];

        setText('arFaceShapeVal', `Khuôn mặt: ${shape}`);
        setText('arSkinToneVal', `Tone da: ${skinTone}`);
        setText('arFaceSummary', adviceMap.summary);
        setAdviceList('arFaceStrengths', adviceMap.strengths);
        setAdviceList('arFaceCautions', adviceMap.cautions);
        setText('arStyleAdvice', adviceMap.style);
    }

    if (tabModePhotoAi && tabMode3dMirror) {
        tabModePhotoAi.addEventListener('click', () => {
            tabModePhotoAi.classList.add('active');
            tabMode3dMirror.classList.remove('active');
            if (aiStudioPanel) {
                aiStudioPanel.classList.remove('hidden');
                aiStudioPanel.style.display = 'block';
            }
            if (ai3dMirrorContainer) {
                ai3dMirrorContainer.classList.add('hidden');
                ai3dMirrorContainer.style.display = 'none';
            }
            stop3dCamera();
        });

        tabMode3dMirror.addEventListener('click', () => {
            tabMode3dMirror.classList.add('active');
            tabModePhotoAi.classList.remove('active');
            if (aiStudioPanel) {
                aiStudioPanel.classList.add('hidden');
                aiStudioPanel.style.display = 'none';
            }
            if (ai3dMirrorContainer) {
                ai3dMirrorContainer.classList.remove('hidden');
                ai3dMirrorContainer.style.display = 'block';
            }
            start3dCamera();
        });
    }

    // 3-Step Stepper Navigation
    function showAiStep(stepNum) {
        [1, 2, 3].forEach(num => {
            const stepEl = document.getElementById(`aiStudioStep${num}`);
            const indEl = document.getElementById(`aiStep${num}Indicator`);
            if (stepEl) stepEl.classList.toggle('active', num === stepNum);
            if (indEl) indEl.classList.toggle('active', num === stepNum);
        });
    }

    // --- BƯỚC 1: FILE UPLOAD & PRESET MODELS ---
    const aiFileInput = document.getElementById('aiFileInput');
    const aiUploadArea = document.getElementById('aiUploadArea');
    const aiPreviewImg = document.getElementById('aiPreviewImg');

    async function handleUserPhoto(src) {
        if (!src) return;
        showAiStep(2);

        const scanOverlay = document.getElementById('aiScanOverlay');
        if (scanOverlay) scanOverlay.style.display = 'flex';

        if (aiPreviewImg) aiPreviewImg.src = src;

        try {
            if (!cvEngine && window.CVHairEngine) {
                cvEngine = new window.CVHairEngine({ canvas: canvas2dEngine });
            }

            const metrics = await cvEngine.setUserImage(src);
            await cvEngine.setHairImage('layer_nu');

            // Render Result Metrics in Step 2
            const shapeEl = document.getElementById('aiResultFaceShape');
            const toneEl = document.getElementById('aiResultSkinTone');
            const recEl = document.getElementById('aiRecommendText');

            if (shapeEl) shapeEl.textContent = metrics.faceShape || 'Oval';
            if (toneEl) toneEl.textContent = metrics.skinTone || 'Warm Beige';
            if (recEl && metrics.faceShapeDetail) {
                recEl.textContent = `${metrics.faceShapeDetail}. AI khuyến nghị bạn dùng kiểu Layer Nữ Hàn Quốc, Sóng Lơi hoặc Bob Balayage.`;
            }

            setTimeout(() => {
                if (scanOverlay) scanOverlay.style.display = 'none';
            }, 800);
        } catch (e) {
            console.error('Lỗi xử lý ảnh 2D:', e);
            if (scanOverlay) scanOverlay.style.display = 'none';
        }
    }

    if (aiFileInput) {
        aiFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (evt) => handleUserPhoto(evt.target.result);
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }

    if (aiUploadArea) {
        aiUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            aiUploadArea.style.borderColor = '#dfa132';
        });
        aiUploadArea.addEventListener('dragleave', () => {
            aiUploadArea.style.borderColor = 'rgba(255,255,255,0.15)';
        });
        aiUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            aiUploadArea.style.borderColor = 'rgba(255,255,255,0.15)';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const reader = new FileReader();
                reader.onload = (evt) => handleUserPhoto(evt.target.result);
                reader.readAsDataURL(e.dataTransfer.files[0]);
            }
        });
    }

    // Nút "Chụp ảnh trực tiếp": mở webcam, chụp khung hình rồi đưa vào AI Studio
    const btnOpenCamera = document.getElementById('btnOpenCamera');
    let userCameraStream = null;

    function closeCameraCaptureDialog() {
        if (userCameraStream) {
            userCameraStream.getTracks().forEach(t => t.stop());
            userCameraStream = null;
        }
        const dialog = document.getElementById('hanaCameraCaptureDialog');
        if (dialog) dialog.remove();
    }

    function openCameraCaptureDialog() {
        if (document.getElementById('hanaCameraCaptureDialog')) return;

        const dialog = document.createElement('div');
        dialog.id = 'hanaCameraCaptureDialog';
        dialog.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);';
        dialog.innerHTML = `
            <div style="background:#101318;border:1px solid rgba(223,161,50,0.4);border-radius:20px;padding:22px;max-width:640px;width:92%;">
                <h3 style="color:#dfa132;margin:0 0 14px;font-size:1.05rem;"><i class="fa-solid fa-camera"></i> Chụp ảnh khuôn mặt</h3>
                <div style="position:relative;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:4/3;">
                    <video id="hanaCaptureVideo" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1);"></video>
                </div>
                <div style="display:flex;gap:12px;margin-top:16px;justify-content:flex-end;">
                    <button id="hanaCaptureCancel" class="btn btn-sm" style="padding:10px 18px;border-radius:24px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);cursor:pointer;">Hủy</button>
                    <button id="hanaCaptureSnap" class="btn btn-gold btn-sm" style="padding:10px 22px;border-radius:24px;font-weight:700;background:linear-gradient(135deg,#dfa132,#c5861b);color:#000;border:none;cursor:pointer;"><i class="fa-solid fa-camera"></i> CHỤP ẢNH</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        const video = dialog.querySelector('#hanaCaptureVideo');
        dialog.querySelector('#hanaCaptureCancel').addEventListener('click', closeCameraCaptureDialog);
        dialog.addEventListener('click', (e) => { if (e.target === dialog) closeCameraCaptureDialog(); });

        dialog.querySelector('#hanaCaptureSnap').addEventListener('click', () => {
            if (!video.videoWidth) {
                showToast('Camera chưa sẵn sàng, vui lòng đợi một nhịp!', 'fa-circle-exclamation');
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            closeCameraCaptureDialog();
            handleUserPhoto(dataUrl);
        });

        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
            .then(stream => {
                userCameraStream = stream;
                video.srcObject = stream;
            })
            .catch(() => {
                showToast('Không truy cập được camera. Hãy cấp quyền trình duyệt!', 'fa-camera');
                closeCameraCaptureDialog();
            });
    }

    if (btnOpenCamera) btnOpenCamera.addEventListener('click', openCameraCaptureDialog);

    // Preset Model Face Cards
    const presetCards = document.querySelectorAll('.ai-preset-card');
    presetCards.forEach(card => {
        card.addEventListener('click', () => {
            const img = card.querySelector('img');
            if (img && img.src) {
                handleUserPhoto(img.src);
            }
        });
    });

    // Step 2 & 3 Navigation Buttons
    const btnReupload = document.getElementById('btnReupload');
    const btnGoToStep3AI = document.getElementById('btnGoToStep3AI');

    if (btnReupload) {
        btnReupload.addEventListener('click', () => showAiStep(1));
    }

    if (btnGoToStep3AI) {
        btnGoToStep3AI.addEventListener('click', () => {
            showAiStep(3);
            if (cvEngine) cvEngine.render();
        });
    }

    // Compare Toolbar Modes (After, Before, Split)
    const compareBtns = document.querySelectorAll('.btn-compare-mode');
    compareBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            compareBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.getAttribute('data-mode') || 'after';
            if (cvEngine) cvEngine.setViewMode(mode);
        });
    });

    // 2D Fine-Tuning Sliders
    const tuneOffsetX = document.getElementById('tuneOffsetX');
    const tuneOffsetY = document.getElementById('tuneOffsetY');
    const tuneScale = document.getElementById('tuneScale');
    const tuneRotate = document.getElementById('tuneRotate');
    const tuneOpacity = document.getElementById('tuneOpacity');
    const btnResetTuning = document.getElementById('btnResetTuning');

    function apply2dTuning() {
        if (!cvEngine) return;
        cvEngine.updateTransform({
            offsetX: parseFloat(tuneOffsetX?.value || 0),
            offsetY: parseFloat(tuneOffsetY?.value || -15),
            scale: parseFloat(tuneScale?.value || 1.15),
            rotation: parseFloat(tuneRotate?.value || 0),
            opacity: parseFloat(tuneOpacity?.value || 0.96)
        });
    }

    [tuneOffsetX, tuneOffsetY, tuneScale, tuneRotate, tuneOpacity].forEach(slider => {
        if (slider) slider.addEventListener('input', apply2dTuning);
    });

    if (btnResetTuning) {
        btnResetTuning.addEventListener('click', () => {
            if (tuneOffsetX) tuneOffsetX.value = 0;
            if (tuneOffsetY) tuneOffsetY.value = -15;
            if (tuneScale) tuneScale.value = 1.15;
            if (tuneRotate) tuneRotate.value = 0;
            if (tuneOpacity) tuneOpacity.value = 0.96;
            apply2dTuning();
            showToast('Đã đặt lại vị trí tóc ban đầu.', 'fa-rotate-left');
        });
    }

    // 2D Hair Color Palette Chips (map key màu -> mã hex để nhuộm được trên canvas)
    const HAIR_COLOR_HEX = {
        original: '#36241b',
        caramel: '#d79137',
        chocolate: '#2b1810',
        honey: '#e4aa4b',
        moss: '#5a7841',
        platinum: '#ebf0fa',
        rose: '#e17396',
        ash: '#8796a5'
    };
    const hairColorChips = document.querySelectorAll('#hairColorPalette .color-chip');
    hairColorChips.forEach(chip => {
        chip.addEventListener('click', () => {
            hairColorChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const colorKey = chip.getAttribute('data-color') || 'original';
            if (cvEngine) cvEngine.updateTransform({ color: HAIR_COLOR_HEX[colorKey] || colorKey });
        });
    });

    // Hairstyle Category Filter Buttons & Cards Selection
    const filterBtns = document.querySelectorAll('.ai-filter-btn');
    const hairCards = document.querySelectorAll('.ai-hair-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.getAttribute('data-filter') || 'all';

            hairCards.forEach(card => {
                const cat = card.getAttribute('data-cat') || '';
                if (filter === 'all' || cat.includes(filter)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    hairCards.forEach(card => {
        card.addEventListener('click', async () => {
            hairCards.forEach(c => c.classList.remove('active-hair'));
            card.classList.add('active-hair');
            const hairKey = card.getAttribute('data-hair') || 'layer_nu';
            const hairName = card.getAttribute('data-name') || 'Mẫu tóc Salon';

            if (cvEngine) {
                await cvEngine.setHairImage(hairKey);

                // Update Pros & Cons Analysis Card
                const analysis = cvEngine.getHairstyleAnalysis(hairKey);
                const nameEl = document.getElementById('analysisHairName');
                const matchEl = document.getElementById('analysisMatchVal');
                const prosEl = document.getElementById('analysisProsList');
                const consEl = document.getElementById('analysisConsList');
                const tipEl = document.getElementById('analysisCareTip');

                if (nameEl) nameEl.textContent = analysis.name || hairName;
                if (matchEl) matchEl.textContent = `${analysis.matchScore || 95}% Phù Hợp`;
                if (prosEl) prosEl.innerHTML = (analysis.pros || []).map(p => `<li>${p}</li>`).join('');
                if (consEl) consEl.innerHTML = (analysis.cons || []).map(c => `<li>${c}</li>`).join('');
                if (tipEl) tipEl.textContent = `Mẹo chăm sóc: ${analysis.careTip || 'Gội sấy dưỡng tóc đều đặn.'}`;
            }

            showToast(`Đã đổi sang kiểu: ${hairName}`, 'fa-scissors');
        });
    });

    // 2D Real AI Hair Swap Button
    const btnRealAiSwap = document.getElementById('btnRealAiSwap');
    if (btnRealAiSwap) {
        btnRealAiSwap.addEventListener('click', async () => {
            showToast('🪄 AI đang xử lý ghép nếp tóc chân thực 4K...', 'fa-wand-magic-sparkles');
            if (!cvEngine || !cvEngine.userImage) {
                showToast('Vui lòng tải ảnh khuôn mặt trước khi ghép tóc AI.', 'fa-circle-exclamation');
                return;
            }

            const activeCard = document.querySelector('.ai-hair-card.active-hair');
            const hairKey = activeCard?.getAttribute('data-hair') || cvEngine.currentHairKey || 'layer_nu';
            const hairStyleName = activeCard?.getAttribute('data-name') || 'Mẫu tóc AI Studio';

            // Gửi kèm ảnh tóc tham chiếu (nếu đã nạp) để AI Cloud ghép theo dáng tóc thật
            let hairReferenceImage = null;
            if (cvEngine.baseHairImage) {
                const refCanvas = document.createElement('canvas');
                refCanvas.width = cvEngine.baseHairImage.naturalWidth || 600;
                refCanvas.height = cvEngine.baseHairImage.naturalHeight || 600;
                refCanvas.getContext('2d').drawImage(cvEngine.baseHairImage, 0, 0);
                hairReferenceImage = refCanvas.toDataURL('image/png');
            }

            try {
                const result = await apiRequest('/ai/try-on-real', {
                    method: 'POST',
                    body: JSON.stringify({
                        userImage: cvEngine.toDataURL('image/png'),
                        hairImage: hairReferenceImage,
                        hairKey,
                        hairStyleName
                    })
                });

                if (result.isRealAi && result.resultImage) {
                    await cvEngine.setUserImage(result.resultImage);
                    await cvEngine.setHairImage(hairKey);
                    showToast('✨ Ghép tóc AI chân thực thành công!', 'fa-circle-check');
                } else {
                    cvEngine.render();
                    showToast(result.message || 'Đã tạo bản xem trước ghép tóc AI.', 'fa-circle-check');
                }
            } catch (error) {
                console.error('Lỗi ghép tóc AI:', error);
                showToast(error.message || 'Không thể xử lý ghép tóc AI lúc này.', 'fa-circle-exclamation');
            }
        });
    }

    // 2D Book This Style Button
    const btnBookThisStyle = document.getElementById('btnBookThisStyle');
    if (btnBookThisStyle) {
        btnBookThisStyle.addEventListener('click', () => {
            const activeCard = document.querySelector('.ai-hair-card.active-hair');
            const styleName = activeCard ? activeCard.getAttribute('data-name') : 'Mẫu Tóc AI Studio';

            const bookingBtn = document.getElementById('openBookingModalBtn');
            if (bookingBtn) bookingBtn.click();

            const noteInput = document.getElementById('bookingNote');
            if (noteInput) {
                noteInput.value = `[AI Studio 2D] Khách chọn kiểu: ${styleName}`;
            }
            showToast(`Đã chọn mẫu "${styleName}". Vui lòng chọn ngày giờ & Stylist!`, 'fa-calendar-check');
        });
    }

    // --- 3D AR MIRROR CONTROLLER FUNCTIONS ---
    function stop3dCamera() {
        if (arTrackingLoopId) {
            cancelAnimationFrame(arTrackingLoopId);
            arTrackingLoopId = null;
        }
        if (arVideoTrackStream) {
            arVideoTrackStream.getTracks().forEach(t => t.stop());
            arVideoTrackStream = null;
        }
        if (ar3dVideo) ar3dVideo.srcObject = null;
        if (btnStart3dCamera) btnStart3dCamera.innerHTML = '<i class="fa-solid fa-video"></i> BẬT CAMERA 3D';
    }

    async function start3dCamera() {
        if (!ar3dVideo || !ar3dThreeContainer) return;

        try {
            if (!cvEngine && window.CVHairEngine) {
                cvEngine = new window.CVHairEngine({ canvas: canvas2dEngine });
            }

            if (ar3dMeshCanvas) {
                ar3dMeshCanvas.width = ar3dThreeContainer.clientWidth || 640;
                ar3dMeshCanvas.height = ar3dThreeContainer.clientHeight || 480;
            }

            if (cvEngine && cvEngine.init3DMirror) {
                // Nếu engine 3D đã init rồi thì không dựng lại scene (tránh rò rỉ WebGL)
                if (!(cvEngine.three && cvEngine.three.isInitialized)) {
                    cvEngine.init3DMirror(ar3dThreeContainer, ar3dVideo, ar3dMeshCanvas);
                }
            }

            arVideoTrackStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });

            ar3dVideo.srcObject = arVideoTrackStream;
            await ar3dVideo.play();

            if (ar3dMeshCanvas && ar3dVideo.videoWidth && ar3dVideo.videoHeight) {
                ar3dMeshCanvas.width = ar3dVideo.videoWidth;
                ar3dMeshCanvas.height = ar3dVideo.videoHeight;
            }

            if (btnStart3dCamera) btnStart3dCamera.innerHTML = '<i class="fa-solid fa-power-off"></i> TẮT CAMERA 3D';
            showToast('🪞 Gương soi 3D AR WebGL đã bật thành công!', 'fa-vr-cardboard');

            let lastTrackStatus = '';
            async function trackFrame() {
                if (ar3dVideo && ar3dVideo.readyState >= 2 && cvEngine) {
                    try {
                        const landmarks = cvEngine.detectFrame(ar3dVideo);
                        if (landmarks) {
                            cvEngine.update3DPose(landmarks, ar3dVideo.videoWidth, ar3dVideo.videoHeight);
                            update3dFaceConsultation(cvEngine.faceMetrics);
                            const statusText = `Live 3D Tracking (${cvEngine.faceMetrics.faceShape})`;
                            if (arTrackingStatus && statusText !== lastTrackStatus) {
                                arTrackingStatus.textContent = statusText;
                                lastTrackStatus = statusText;
                            }
                        }
                    } catch (e) {}
                }
                arTrackingLoopId = requestAnimationFrame(trackFrame);
            }
            trackFrame();
        } catch (err) {
            console.error('Lỗi camera 3D:', err);
            showToast('Không thể truy cập Camera. Vui lòng cấp quyền trình duyệt.', 'fa-camera');
        }
    }

    if (btnStart3dCamera) {
        btnStart3dCamera.addEventListener('click', () => {
            if (arVideoTrackStream) stop3dCamera();
            else start3dCamera();
        });
    }

    // 1. Chọn Kiểu Tóc 3D trên Gương Soi (.ar-preset-btn)
    const arPresetBtns = document.querySelectorAll('.ar-preset-btn');
    arPresetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            arPresetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const hair3d = btn.getAttribute('data-hair3d') || 'curly_nu_3d';
            
            if (cvEngine) {
                cvEngine.three.current3dStyle = hair3d;
                if (typeof cvEngine.update3DHairMesh === 'function') {
                    cvEngine.update3DHairMesh(hair3d);
                }
            }
            showToast(`Đã chọn kiểu 3D: ${btn.textContent.trim()}`, 'fa-scissors');
        });
    });

    // 2. Chọn Màu Nhuộm 3D Materials (.ar-color-chip)
    const arColorChips = document.querySelectorAll('.ar-color-chip');
    arColorChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.preventDefault();
            arColorChips.forEach(c => {
                c.classList.remove('active');
                c.style.borderColor = 'transparent';
            });
            chip.classList.add('active');
            chip.style.borderColor = '#dfa132';

            const hexColor = chip.getAttribute('data-color3d') || '#36241b';
            
            if (cvEngine) {
                if (typeof cvEngine.set3DHairColor === 'function') {
                    cvEngine.set3DHairColor(hexColor);
                }
                if (typeof cvEngine.set2DHairColor === 'function') {
                    cvEngine.set2DHairColor(hexColor);
                }
            }
            const colorTitle = chip.getAttribute('title') || 'Màu Nhuộm';
            showToast(`Đã chọn màu nhuộm 3D: ${colorTitle}`, 'fa-palette');
        });
    });

    // Tinh Chỉnh Vị Trí & Độ Phồng Tóc 3D Sliders
    const arTuneOffsetY = document.getElementById('arTuneOffsetY');
    const arTuneScale = document.getElementById('arTuneScale');

    if (arTuneOffsetY) {
        arTuneOffsetY.addEventListener('input', () => {
            if (cvEngine && cvEngine.set3DHairOffset) {
                cvEngine.set3DHairOffset(parseFloat(arTuneOffsetY.value), parseFloat(arTuneScale?.value || 1.0));
            }
        });
    }

    if (arTuneScale) {
        arTuneScale.addEventListener('input', () => {
            if (cvEngine && cvEngine.set3DHairOffset) {
                cvEngine.set3DHairOffset(parseFloat(arTuneOffsetY?.value || 0), parseFloat(arTuneScale.value));
            }
        });
    }

    // =========================================================================
    // 13. CHỤP ẢNH GƯƠNG 3D AR & STUDIO KẾT QUẢ VỚI TẢI ẢNH, ĐẶT LỊCH & THOÁT NHANH
    // =========================================================================
    let snapBaseFaceDataUrl = null;
    let snapCurrentHairKey = 'curly_nu_3d';
    let snapCurrentHairName = 'TÓC XOĂN DÀI';
    let snapCurrentColorName = 'Nâu Socola';

    const snapshotHairstyleData = {
        layer_nam_3d: {
            name: 'TÓC LAYER NGẮN VUỐT RỦ',
            match: '96% PHÙ HỢP',
            pros: 'Từng lớp tóc ngắn vuốt rủ tạo vẻ trẻ trung, gọn gàng và che trán hiệu quả.',
            cons: 'Cần sấy nâng chân tóc và dùng sáp nhẹ để giữ phom vuốt rủ.',
            advice: 'Hợp màu NÂU HẠT DẺ, NÂU SOCOLA hoặc ĐEN TỰ NHIÊN.'
        },
        middlepart_nam_3d: {
            name: 'TÓC NAM NGẮN RẼ NGÔI GIỮA',
            match: '96% PHÙ HỢP',
            pros: 'Đường rẽ ngôi giữa tạo vẻ gọn gàng, cân đối và hiện đại cho khuôn mặt nam.',
            cons: 'Cần sấy phồng chân tóc và giữ nếp nhẹ để đường ngôi không bị xẹp.',
            advice: 'Hợp màu NÂU TỰ NHIÊN, NÂU SOCOLA hoặc ĐEN TỰ NHIÊN.'
        },
        bob_nu_3d: {
            name: 'TÓC BOB NGẮN UỐN CỤP ĐUÔI',
            match: '94% PHÙ HỢP',
            pros: 'Phần đuôi cụp ôm nhẹ khuôn mặt, tạo vẻ gọn gàng, trẻ trung và thời thượng.',
            cons: 'Cần sấy hoặc cuốn nhẹ phần đuôi để giữ độ cụp ổn định.',
            advice: 'Hợp màu NÂU SOCOLA, NÂU CARAMEL hoặc BALAYAGE.'
        },
        curly_nu_3d: {
            name: 'TÓC XOĂN DÀI',
            match: '95% PHÙ HỢP',
            pros: 'Độ xoăn dài tạo độ phồng mềm mại, giúp khuôn mặt cân đối và nữ tính hơn.',
            cons: 'Cần dưỡng ẩm và sấy bằng loa khuếch tán để giữ lọn xoăn.',
            advice: 'Hợp màu NÂU MẬT ONG, NÂU CARAMEL hoặc NÂU RÊU.'
        },
        layer_nam_3d: {
            name: 'Layer Nam Textured Crop 3D',
            match: '96% Phù Hợp',
            pros: 'Mái layer tỉa xước nhẹ tạo độ trẻ trung, che khuyết điểm trán cao hoặc hẹp.',
            cons: 'Cần sấy nâng chân tóc để tránh bị bết xẹp.',
            advice: 'Kết hợp uốn texture nhẹ và màu Nâu Hạt Dẻ hoặc Xám Khói.'
        },
        hime_cut_nu_3d: {
            name: 'TÓC HIME',
            match: '95% PHÙ HỢP',
            pros: 'Hai tầng tóc đặc trưng ôm khuôn mặt, tạo vẻ cá tính và làm nổi bật đường nét gò má.',
            cons: 'Cần tỉa lại phần mai định kỳ để giữ đường cắt sắc nét.',
            advice: 'Hợp màu ĐEN TỰ NHIÊN, NÂU SOCOLA hoặc ĐỎ RƯỢU.'
        },
        straight_middlepart_nu_3d: {
            name: 'TÓC RẼ NGÔI GIỮA UỐN SÓNG',
            match: '93% PHÙ HỢP',
            pros: 'Ngôi giữa kết hợp sóng mềm tạo vẻ thanh lịch, bồng bềnh và cân bằng khuôn mặt.',
            cons: 'Nên dưỡng tóc và sấy định hình để sóng không bị duỗi nhanh.',
            advice: 'Hợp màu NÂU CARAMEL, NÂU HẠT DẺ hoặc XÁM KHÓI.'
        }
    };

    function closeSnapshotModal() {
        const modal = document.getElementById('aiTryOnModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    function renderSnapshotToCanvas(imgDataUrl) {
        const snapCanvas = document.getElementById('aiTryOnCanvasSnapEngine');
        if (!snapCanvas || !imgDataUrl) return;

        const ctx = snapCanvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            snapCanvas.width = img.naturalWidth || 1280;
            snapCanvas.height = img.naturalHeight || 720;
            ctx.clearRect(0, 0, snapCanvas.width, snapCanvas.height);
            ctx.drawImage(img, 0, 0, snapCanvas.width, snapCanvas.height);
        };
        img.src = imgDataUrl;
    }

    // Nút Chụp Ảnh Gương 3D (#btnArSnap)
    if (btnArSnap) {
        btnArSnap.addEventListener('click', () => {
            if (!ar3dVideo || !ar3dVideo.videoWidth) {
                showToast('Camera 3D chưa sẵn sàng!', 'fa-circle-exclamation');
                return;
            }

            // 1. Lấy thông tin kiểu tóc 3D và màu nhuộm đang chọn trên gương
            const active3dBtn = document.querySelector('.ar-preset-btn.active');
            if (active3dBtn) {
                snapCurrentHairKey = active3dBtn.getAttribute('data-hair3d') || 'layer_nam_3d';
                snapCurrentHairName = active3dBtn.textContent.trim();
            }

            const active3dColor = document.querySelector('.ar-color-chip.active');
            if (active3dColor) {
                snapCurrentColorName = active3dColor.getAttribute('title') || 'Nâu Tự Nhiên';
            }

            // 2. CHỤP CHÍNH XÁC KHUNG ẢNH GƯƠNG 3D (VIDEO + TÓC 3D + MÀU NHUỘM ĐANG SOI)
            let compositeDataUrl = null;
            if (cvEngine && typeof cvEngine.capture3DComposite === 'function') {
                compositeDataUrl = cvEngine.capture3DComposite(ar3dVideo);
            }

            // Fallback nếu Three.js chưa kịp render
            if (!compositeDataUrl) {
                const captureCanvas = document.createElement('canvas');
                captureCanvas.width = ar3dVideo.videoWidth;
                captureCanvas.height = ar3dVideo.videoHeight;
                const ctx = captureCanvas.getContext('2d');
                ctx.translate(captureCanvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(ar3dVideo, 0, 0, captureCanvas.width, captureCanvas.height);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                compositeDataUrl = captureCanvas.toDataURL('image/jpeg', 0.95);
            }

            snapBaseFaceDataUrl = compositeDataUrl;

            // 3. Cập nhật thông tin nhận xét & ưu nhược điểm lên bảng bên phải
            const info = snapshotHairstyleData[snapCurrentHairKey] || snapshotHairstyleData['layer_nam_3d'];
            const hairNameEl = document.getElementById('aiSnapHairName');
            const colorNameEl = document.getElementById('aiSnapColorName');
            const matchEl = document.getElementById('aiSnapMatchVal');
            const shapeEl = document.getElementById('aiSnapShape');
            const skinEl = document.getElementById('aiSnapSkin');
            const prosEl = document.getElementById('aiSnapPros');
            const consEl = document.getElementById('aiSnapCons');
            const adviceEl = document.getElementById('aiSnapAdvice');

            if (hairNameEl) hairNameEl.textContent = snapCurrentHairName || info.name;
            if (colorNameEl) colorNameEl.textContent = snapCurrentColorName;
            if (matchEl) matchEl.textContent = info.match;
            if (shapeEl) {
                const curShape = document.getElementById('arFaceShapeVal')?.textContent?.replace('Khuôn mặt: ', '') || 'Oval (Trái Xoan)';
                shapeEl.textContent = curShape;
            }
            if (skinEl) {
                const curSkin = document.getElementById('arSkinToneVal')?.textContent?.replace('Tone da: ', '') || 'Warm Beige';
                skinEl.textContent = curSkin;
            }
            if (prosEl) prosEl.textContent = info.pros;
            if (consEl) consEl.textContent = info.cons;
            if (adviceEl) adviceEl.textContent = info.advice;

            // 4. Mở modal & render ảnh chụp 3D lên canvas
            const aiTryOnModal = document.getElementById('aiTryOnModal');
            if (aiTryOnModal) {
                aiTryOnModal.classList.add('active');
                renderSnapshotToCanvas(snapBaseFaceDataUrl);
            }

            showToast('📸 Đã chụp ảnh gương 3D thành công! Bạn có thể lưu ảnh hoặc đặt lịch ngay.', 'fa-camera');
        });
    }

    // Nút Tải & Lưu Ảnh Xuống Máy (#btnDownloadAiSnap)
    const btnDownloadAiSnap = document.getElementById('btnDownloadAiSnap');
    if (btnDownloadAiSnap) {
        btnDownloadAiSnap.addEventListener('click', () => {
            if (!snapBaseFaceDataUrl) {
                showToast('Chưa có ảnh để tải về!', 'fa-circle-exclamation');
                return;
            }
            const link = document.createElement('a');
            link.download = `Hana_HairSalon_3D_Snapshot_${Date.now()}.jpg`;
            link.href = snapBaseFaceDataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('💾 Đã tải và lưu ảnh 3D thành công về máy!', 'fa-circle-check');
        });
    }

    // Sự kiện Đóng Modal (#closeAiTryOnModalBtn, #btnCloseAiFullscreen, Click ngoài & phím ESC)
    const closeAiTryOnModalBtn = document.getElementById('closeAiTryOnModalBtn');
    const btnCloseAiFullscreen = document.getElementById('btnCloseAiFullscreen');
    const aiTryOnModalOverlay = document.getElementById('aiTryOnModal');

    if (closeAiTryOnModalBtn) {
        closeAiTryOnModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeSnapshotModal();
        });
    }

    if (btnCloseAiFullscreen) {
        btnCloseAiFullscreen.addEventListener('click', (e) => {
            e.preventDefault();
            closeSnapshotModal();
        });
    }

    if (aiTryOnModalOverlay) {
        aiTryOnModalOverlay.addEventListener('click', (e) => {
            if (e.target === aiTryOnModalOverlay) {
                closeSnapshotModal();
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            closeSnapshotModal();
        }
    });

    // Đặt lịch từ Modal ảnh chụp (#btnBookFromFullscreen)
    const btnBookFromFullscreen = document.getElementById('btnBookFromFullscreen');
    if (btnBookFromFullscreen) {
        btnBookFromFullscreen.addEventListener('click', () => {
            closeSnapshotModal();

            const bookingBtn = document.getElementById('openBookingModalBtn');
            if (bookingBtn) bookingBtn.click();

            const noteInput = document.getElementById('bookingNote');
            if (noteInput) {
                noteInput.value = `[Gương Soi 3D AR] Khách hàng đặt làm kiểu: ${snapCurrentHairName} - Màu nhuộm: ${snapCurrentColorName}`;
            }
            showToast(`Đã chọn kiểu "${snapCurrentHairName}" (${snapCurrentColorName}). Vui lòng chọn ngày giờ & Stylist!`, 'fa-calendar-check');
        });
    }

    // Đặt Lịch Làm Tóc Theo Kiểu 3D Trực Tiếp Trên Màn Hình Gương (#btnBook3dStyle)
    if (btnBook3dStyle) {
        btnBook3dStyle.addEventListener('click', () => {
            const activePreset = document.querySelector('.ar-preset-btn.active');
            const styleName = activePreset ? activePreset.textContent.trim() : 'Mẫu Tóc Gương 3D AR';

            const bookingBtn = document.getElementById('openBookingModalBtn');
            if (bookingBtn) bookingBtn.click();

            const noteInput = document.getElementById('bookingNote');
            if (noteInput) {
                noteInput.value = `[Gương Soi 3D AR] Khách hàng đặt làm kiểu: ${styleName}`;
            }
            showToast(`Đã chọn mẫu 3D "${styleName}". Vui lòng chọn ngày giờ & Stylist!`, 'fa-calendar-check');
        });
    }

    // --- 14. FLOATING AI CHATBOT WIDGET INTEGRATION (Gemini API / Local RAG) ---
    const chatbotToggleBtn = document.getElementById('chatbotToggleBtn');
    const chatbotCloseBtn = document.getElementById('chatbotCloseBtn');
    const chatbotDrawer = document.getElementById('chatbotDrawer');
    const chatbotMessages = document.getElementById('chatbotMessages');
    const chatbotInput = document.getElementById('chatbotInput');
    const chatbotSendBtn = document.getElementById('chatbotSendBtn');
    const chatbotQuickReplies = document.getElementById('chatbotQuickReplies');

    let chatHistory = [];

    if (chatbotToggleBtn && chatbotDrawer) {
        chatbotToggleBtn.addEventListener('click', () => {
            chatbotDrawer.classList.toggle('active');
            if (chatbotDrawer.classList.contains('active') && chatbotInput) {
                chatbotInput.focus();
            }
        });
    }

    if (chatbotCloseBtn && chatbotDrawer) {
        chatbotCloseBtn.addEventListener('click', () => {
            chatbotDrawer.classList.remove('active');
        });
    }

    // Function to append a message bubble to the chat list
    function appendChatMessage(sender, text, actionInfo = null) {
        if (!chatbotMessages) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `chatbot-msg ${sender === 'user' ? 'user-msg' : 'bot-msg'}`;

        let formattedText = text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');

        if (sender === 'user') {
            msgDiv.innerHTML = `<div class="msg-bubble">${formattedText}</div>`;
        } else {
            let actionBtnHtml = '';
            if (actionInfo && actionInfo.action === 'OPEN_BOOKING') {
                actionBtnHtml = `
                    <div style="margin-top: 10px;">
                        <button class="btn btn-gold btn-sm chatbot-action-booking-btn" style="padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; border: none;">
                            <i class="fa-solid fa-calendar-check"></i> 📅 Đặt Lịch Ngay
                        </button>
                    </div>`;
            }

            msgDiv.innerHTML = `
                <div class="bot-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="msg-bubble">
                    ${formattedText}
                    ${actionBtnHtml}
                </div>`;
        }

        chatbotMessages.appendChild(msgDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

        // Bind event to booking action button if present
        if (actionInfo && actionInfo.action === 'OPEN_BOOKING') {
            const bookingActionBtn = msgDiv.querySelector('.chatbot-action-booking-btn');
            if (bookingActionBtn) {
                bookingActionBtn.addEventListener('click', () => {
                    const bookingBtn = document.getElementById('openBookingModalBtn');
                    if (bookingBtn) bookingBtn.click();
                    if (chatbotDrawer) chatbotDrawer.classList.remove('active');

                    if (actionInfo.serviceName) {
                        const noteInput = document.getElementById('bookingNote');
                        if (noteInput) {
                            noteInput.value = `[AI Tư vấn Chatbot] Đề xuất dịch vụ: ${actionInfo.serviceName}`;
                        }
                    }
                    showToast('Đã mở form đặt lịch làm tóc!', 'fa-calendar-check');
                });
            }
        }
    }

    // Show typing animation indicator
    function showTypingIndicator() {
        if (!chatbotMessages) return null;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chatbot-msg bot-msg typing-msg';
        typingDiv.id = 'chatbotTypingIndicator';
        typingDiv.innerHTML = `
            <div class="bot-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="msg-bubble" style="padding: 8px 14px; opacity: 0.8;">
                <i class="fa-solid fa-ellipsis fa-beat-fade"></i> Hana AI đang suy nghĩ...
            </div>`;
        chatbotMessages.appendChild(typingDiv);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
        return typingDiv;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('chatbotTypingIndicator');
        if (indicator) indicator.remove();
    }

    // Send user query to Backend POST /api/ai/chat
    async function sendChatbotMessage(userMessageText) {
        const query = userMessageText || (chatbotInput ? chatbotInput.value.trim() : '');
        if (!query) return;

        if (chatbotInput) chatbotInput.value = '';

        // Render user message bubble
        appendChatMessage('user', query);
        chatHistory.push({ role: 'user', text: query });

        // Show typing indicator
        showTypingIndicator();

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: query,
                    history: chatHistory
                })
            });

            const data = await response.json();
            removeTypingIndicator();

            if (data.success && data.reply) {
                appendChatMessage('bot', data.reply, {
                    action: data.action,
                    serviceName: data.serviceName,
                    branchName: data.branchName
                });
                chatHistory.push({ role: 'bot', text: data.reply });
            } else {
                appendChatMessage('bot', 'Dạ, hiện tại kết nối AI đang bận. Bạn có thể nhấn nút Đặt Lịch hoặc thử lại sau nhé! 🌸');
            }
        } catch (err) {
            console.error('Lỗi gửi tin nhắn Chatbot:', err);
            removeTypingIndicator();
            appendChatMessage('bot', 'Dạ, đã xảy ra lỗi kết nối với máy chủ AI. Vui lòng thử lại sau! 🌸');
        }
    }

    if (chatbotSendBtn) {
        chatbotSendBtn.addEventListener('click', () => sendChatbotMessage());
    }

    if (chatbotInput) {
        chatbotInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatbotMessage();
            }
        });
    }

    // Handle Quick Reply Chips (.quick-reply-chip)
    if (chatbotQuickReplies) {
        chatbotQuickReplies.querySelectorAll('.quick-reply-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const msg = chip.getAttribute('data-msg') || chip.textContent.trim();
                sendChatbotMessage(msg);
            });
        });
    }

    // Initial setup on app launch
    updateAuthUI();
    renderBookingTable();
    syncBookingsFromServer();

});
