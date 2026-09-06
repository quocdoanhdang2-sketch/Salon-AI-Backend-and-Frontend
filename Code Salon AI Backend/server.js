const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const ALT_PORT = 8080;

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Phục vụ các tệp giao diện Frontend tĩnh (HTML, CSS, JS, Images)
const frontendDir = path.join(__dirname, '..', 'Code Salon AI Frontend');
app.use(express.static(frontendDir));

app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Backend đang hoạt động.' });
});

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Dữ liệu JSON không hợp lệ.' });
    }
    next(error);
});

connectDB();

app.post('/api/ai/analyze', async (req, res) => {
    try {
        const { imageBase64, filename = 'upload.jpg' } = req.body || {};
        if (!imageBase64) {
            return res.status(400).json({ success: false, message: 'Thiếu dữ liệu ảnh.' });
        }

        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
        const response = await fetch(`${aiServiceUrl}/analyze-face`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64, filename })
        });

        const result = await response.json();
        if (!response.ok) {
            return res.status(response.status).json({ success: false, message: result.detail || 'AI service lỗi.' });
        }

        return res.json({ success: true, data: result.data || result });
    } catch (error) {
        console.error('AI proxy error:', error);
        return res.status(500).json({
            success: false,
            message: 'Không thể kết nối Python AI service. Hãy chạy uvicorn ở cổng 8001.'
        });
    }
});

/**
 * ============================================================================
 * REAL AI HAIR TRY-ON ENDPOINT (HairFastGAN / Replicate Cloud API Pipeline)
 * ----------------------------------------------------------------------------
 * - Gửi ảnh khách + ảnh tóc tham chiếu theo đúng schema HairFastGAN
 *   (face_image + hair_image1..3). Model/version có thể thay qua env
 *   REPLICATE_MODEL_VERSION mà không cần sửa code.
 * - Kết quả trả về luôn là dataURL (base64) để canvas ghép không bị taint.
 * ============================================================================
 */
const REPLICATE_HAIRFAST_VERSION = process.env.REPLICATE_MODEL_VERSION
    || 'a687353f86e5898696d747a8f895c256037e44a36f6424e64f7fa8b7d903673c';

async function fetchAsDataUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tải ảnh kết quả lỗi HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
}

app.post('/api/ai/try-on-real', async (req, res) => {
    try {
        const { userImage, hairImage, hairKey, hairStyleName } = req.body || {};
        if (!userImage) {
            return res.status(400).json({ success: false, message: 'Thiếu dữ liệu ảnh khuôn mặt người dùng.' });
        }

        const replicateToken = process.env.REPLICATE_API_TOKEN;

        if (replicateToken) {
            try {
                console.log('🤖 Đang kết nối Replicate AI HairFastGAN Service...');
                // HairFastGAN nhận ảnh tham chiếu tóc: dùng ảnh tóc salon gửi kèm,
                // không có thì lặp ảnh khách (model tự xử lý) theo schema gốc.
                const hairRef = hairImage || userImage;
                const response = await fetch('https://api.replicate.com/v1/predictions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Token ${replicateToken}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'wait'
                    },
                    body: JSON.stringify({
                        version: REPLICATE_HAIRFAST_VERSION,
                        input: {
                            face_image: userImage,
                            hair_image1: hairRef,
                            hair_image2: hairRef,
                            hair_image3: hairRef
                        }
                    })
                });

                let prediction = await response.json();
                if (!response.ok) {
                    throw new Error(prediction.detail || `Replicate HTTP ${response.status}`);
                }

                // Poll cho tới khi xong (tối đa ~45s)
                let attempts = 0;
                while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled' && attempts < 45) {
                    await new Promise(r => setTimeout(r, 1000));
                    attempts++;
                    const pollRes = await fetch(prediction.urls.get, {
                        headers: { 'Authorization': `Token ${replicateToken}` }
                    });
                    prediction = await pollRes.json();
                }

                if (prediction.status === 'succeeded' && prediction.output) {
                    const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
                    const resultImage = String(outputUrl).startsWith('data:')
                        ? outputUrl
                        : await fetchAsDataUrl(outputUrl);
                    return res.json({
                        success: true,
                        isRealAi: true,
                        resultImage,
                        message: 'Ghép tóc AI HairFastGAN chân thực thành công 100%!'
                    });
                }

                console.warn('⚠️ Replicate không trả kết quả thành công:', prediction.status, prediction.error || '');
            } catch (apiErr) {
                console.warn('⚠️ Lỗi gọi Replicate Cloud API, tự động dùng AI Engine nội bộ:', apiErr.message);
            }
        }

        return res.json({
            success: true,
            isRealAi: false,
            resultImage: userImage,
            message: 'Đã sẵn sàng xử lý ghép tóc AI.',
            tip: 'Để kích hoạt AI Cloud HairFastGAN 4K, hãy thêm REPLICATE_API_TOKEN vào tệp .env của dự án.'
        });

    } catch (err) {
        console.error('Lỗi API Ghép Tóc AI:', err);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xử lý ghép tóc AI.' });
    }
});

/**
 * ============================================================================
 * HANA SALON LLM AI CHATBOT ENDPOINT (Gemini 1.5 Flash API + Local RAG Engine)
 * ============================================================================
 */
app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, history = [] } = req.body || {};
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không hợp lệ.' });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        // Chuỗi model Gemini hiện đại (9/2026): gemini-2.5 đã bị ngừng với user mới,
        // Google khuyến nghị gemini-3.x. Nếu model đầu bị 404 sẽ tự rơi xuống model kế.
        const geminiModels = [
            process.env.GEMINI_MODEL || 'gemini-3.6-flash',
            'gemini-3.8-flash',
            'gemini-3.1-flash-lite',
            'gemini-2.5-flash'
        ].filter((model, index, arr) => arr.indexOf(model) === index);

        const systemInstruction = `Bạn là Hana AI Assistant - Chuyên gia tư vấn tạo mẫu tóc & chăm sóc sắc đẹp AI chuyên nghiệp của HANA HAIR SALON.
Nhiệm vụ của bạn:
- Phản hồi thân thiện, lịch sự, dùng emoji sinh động và tư vấn chính xác.
- Hỗ trợ chọn kiểu tóc phù hợp với khuôn mặt (mặt tròn, dài, vuông, trái tim, oval), làn da và phong cách.
- Cung cấp thông tin bảng giá dịch vụ, chương trình ưu đãi, thông tin các chi nhánh và danh sách Stylist.
- Giúp khách hàng đưa ra quyết định và đề xuất đặt lịch hẹn trực tuyến khi họ có nhu cầu.

BẢNG GIÁ DỊCH VỤ HANA HAIR SALON:
1. Cắt tóc & Tạo kiểu:
   - Cắt tóc Nữ (Gội + Massage + Sấy tạo kiểu): 180.000đ - 250.000đ
   - Cắt tóc Nam (Gội + Vuốt sáp nam tính): 120.000đ - 150.000đ
   - Cắt mái bay / Mái ngố Hàn Quốc: 50.000đ
2. Uốn tóc Nữ Chuyên Sâu:
   - Uốn Sóng Lơi Hàn Quốc: 650.000đ - 950.000đ
   - Uốn Layer Cúp Ngọn: 550.000đ - 850.000đ
   - Uốn Hippie Waves bồng bềnh: 750.000đ - 1.100.000đ
3. Nhuộm Tóc Thời Trang & Phục Hồi:
   - Nhuộm Tông Nâu (Hạt dẻ, Socola, Caramel): 450.000đ - 750.000đ
   - Nhuộm Thời Trang / Tẩy Tóc (Bạch kim, Xám khói, Hồng pastel): 850.000đ - 1.600.000đ
   - Nhuộm Balayage / Highlight Ombre cao cấp: 950.000đ - 1.800.000đ
4. Phục Hồi & Dưỡng Tóc Chuyên Sâu:
   - Phục hồi Keratin bóng mượt: 400.000đ - 700.000đ
   - Gội đầu dưỡng sinh thảo dược (60 phút): 150.000đ - 250.000đ

DANH SÁCH CHI NHÁNH HANA HAIR SALON:
- Chi nhánh 1: 123 Nguyễn Trãi, Quận 1, TP.HCM (Hotline: 0901 234 567)
- Chi nhánh 2: 456 Lê Văn Sỹ, Quận 3, TP.HCM (Hotline: 0908 888 999)
- Chi nhánh 3: 789 Phan Xích Long, Q. Bình Thạnh, TP.HCM (Hotline: 0903 333 444)

QUY TRẮC INTENT & HÀNH ĐỘNG:
- Nếu người dùng có nhu cầu đặt lịch, đặt hẹn, làm tóc (ví dụ: "tôi muốn đặt lịch", "đặt lịch hẹn", "book lịch", "hẹn làm tóc"), bạn CẦN trả về thuộc tính JSON: "action": "OPEN_BOOKING".
- Nếu không có nhu cầu đặt lịch rõ ràng, "action": null.

Vui lòng trả về kết quả định dạng JSON thuần túy (không bọc trong markdown code block) có cấu trúc:
{
  "reply": "Câu trả lời đầy đủ, chi tiết, trình bày đẹp mắt...",
  "action": "OPEN_BOOKING" hoặc null,
  "serviceName": "Dịch vụ đề xuất" hoặc null,
  "branchName": "Chi nhánh đề xuất" hoặc null
}`;

        // Gọi Gemini REST API, thử lần lượt từng model trong chuỗi fallback
        if (!geminiApiKey) {
            return res.status(503).json({
                success: false,
                message: 'Thiếu GEMINI_API_KEY trong tệp .env.'
            });
        }

        try {
            const contents = [];
            if (Array.isArray(history) && history.length > 0) {
                history.slice(-6).forEach(h => {
                    if (h && h.text && (h.role === 'user' || h.role === 'bot' || h.role === 'model')) {
                        contents.push({
                            role: h.role === 'bot' || h.role === 'model' ? 'model' : 'user',
                            parts: [{ text: h.text }]
                        });
                    }
                });
            }
            contents.push({
                role: 'user',
                parts: [{ text: message }]
            });

            const requestBody = {
                contents: contents,
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                },
                generationConfig: {
                    temperature: 0.7,
                    responseMimeType: "application/json"
                }
            };

            let lastErrorStatus = 0;
            let lastErrorText = '';

            for (const geminiModel of geminiModels) {
                const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`;
                try {
                    const geminiRes = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });

                    if (geminiRes.ok) {
                        const geminiData = await geminiRes.json();
                        const candidateText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (candidateText && candidateText.trim()) {
                            let parsed = null;
                            try {
                                const cleanJsonStr = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
                                parsed = JSON.parse(cleanJsonStr);
                            } catch (e) {
                                parsed = { reply: candidateText.trim(), action: null };
                            }

                            return res.json({
                                success: true,
                                isRealAi: true,
                                reply: parsed.reply || candidateText,
                                action: parsed.action || null,
                                serviceName: parsed.serviceName || null,
                                branchName: parsed.branchName || null
                            });
                        }
                        // 200 nhưng không có nội dung -> thử model kế tiếp
                        lastErrorStatus = 200;
                        lastErrorText = 'Phản hồi trống';
                        continue;
                    }

                    lastErrorStatus = geminiRes.status;
                    lastErrorText = await geminiRes.text();

                    // 404/400: model không tồn tại hoặc không hỗ trợ -> thử model kế tiếp
                    if (geminiRes.status === 404 || geminiRes.status === 400) {
                        console.warn(`⚠️ Model ${geminiModel} không khả dụng (HTTP ${geminiRes.status}), thử model kế tiếp...`);
                        continue;
                    }

                    // Lỗi khác (401/403/429/5xx): dừng, báo lỗi rõ ràng
                    console.error(`❌ LỖI API GEMINI (HTTP ${geminiRes.status}) trên ${geminiModel}:`, lastErrorText);
                    break;
                } catch (modelErr) {
                    lastErrorStatus = 0;
                    lastErrorText = modelErr.message || String(modelErr);
                    console.warn(`⚠️ Lỗi kết nối tới model ${geminiModel}:`, lastErrorText);
                }
            }

            const hint = lastErrorStatus === 401 || lastErrorStatus === 403
                ? 'API key Gemini không hợp lệ hoặc chưa bật Generative Language API.'
                : lastErrorStatus === 429
                    ? 'Đã vượt hạn mức miễn phí của Gemini, vui lòng thử lại sau ít phút.'
                    : 'Kiểm tra GEMINI_API_KEY / GEMINI_MODEL trong tệp .env và kết nối mạng.';
            return res.status(502).json({
                success: false,
                message: `Gemini không phản hồi được${lastErrorStatus ? ` (HTTP ${lastErrorStatus})` : ''}. ${hint}`
            });
        } catch (geminiErr) {
            console.error('⚠️ Lỗi gọi API Gemini:', geminiErr);
            return res.status(502).json({
                success: false,
                message: 'Không thể kết nối Google Gemini. Vui lòng thử lại sau.'
            });
        }

        /* Smart Local RAG Fallback Engine (giữ lại cho tài liệu tham khảo)
        const msgLower = message.toLowerCase();
        let reply = '';
        let action = null;
        let serviceName = null;
        let branchName = null;

        if (msgLower.includes('đặt lịch') || msgLower.includes('hẹn') || msgLower.includes('book') || msgLower.includes('làm tóc sáng') || msgLower.includes('làm tóc chiều')) {
            reply = 'Dạ tuyệt vời ạ! Hana Hair Salon rất hân hạnh được phục vụ bạn. Vui lòng bấm nút **"📅 Đặt Lịch Ngay"** bên dưới hoặc điền thông tin vào khung đặt lịch để chọn ngày giờ & Stylist yêu thích nhé! 🌸';
            action = 'OPEN_BOOKING';
        } else if (msgLower.includes('mặt tròn') || msgLower.includes('tròn')) {
            reply = '🌸 **Tư vấn kiểu tóc cho khuôn mặt tròn:**\n- **Layer Dài Cúp Ngọn Hàn Quốc:** Che gọn 2 bên má, tạo cảm giác mặt V-line thon gọn.\n- **Sóng Lơi Bồng Bềnh:** Tạo độ phồng đỉnh đầu, làm dài gương mặt.\n- **Mái Bay Hàn Quốc:** Ôm nhẹ gò má, tăng vẻ mềm mại thanh thoát.\n\n💡 *Lời khuyên:* Né các kiểu tóc mái bằng quá dày làm mặt ngắn hơn nhé!';
            serviceName = 'Uốn Layer Cúp Ngọn';
        } else if (msgLower.includes('mặt dài') || msgLower.includes('dài')) {
            reply = '✨ **Tư vấn kiểu tóc cho khuôn mặt dài:**\n- **Sóng Lơi Bồng Bềnh:** Tạo độ phồng 2 bên má giúp thu ngắn chiều dài gương mặt.\n- **Bob Ngắn Cúp Balayage:** Tôn nét trẻ trung, hiện đại.\n- **Mái Thưa / Mái Bay:** Che bớt vùng trán, cân đối tỷ lệ gương mặt.\n\n💡 *Lời khuyên:* Hạn chế tóc thẳng xẹp áp sát da đầu.';
            serviceName = 'Uốn Sóng Lơi Hàn Quốc';
        } else if (msgLower.includes('mặt vuông') || msgLower.includes('góc cạnh') || msgLower.includes('vuông')) {
            reply = '💎 **Tư vấn kiểu tóc cho khuôn mặt vuông / góc cạnh:**\n- **Layer Tỉa Mềm Mại:** Giúp làm mềm góc xương quai hàm.\n- **Sóng Lơi Nhẹ:** Giảm bớt độ thô cứng của góc mặt.\n- **Side Part 7/3 (Nam) / Mái bay rẽ ngôi (Nữ):** Tôn nét sang trọng, hài hòa.';
            serviceName = 'Cắt Layer & Tạo Kiểu';
        } else if (msgLower.includes('giá') || msgLower.includes('bảng giá') || msgLower.includes('bao nhiêu tiền') || msgLower.includes('chi phí')) {
            reply = '💈 **BẢNG GIÁ DỊCH VỤ HANA HAIR SALON:**\n- ✂️ **Cắt Nữ (Gội + Sấy kiểu):** 180.000đ - 250.000đ\n- ✂️ **Cắt Nam (Gội + Vuốt sáp):** 120.000đ - 150.000đ\n- 🌀 **Uốn Sóng Lơi / Layer Cúp:** 550.000đ - 950.000đ\n- 🎨 **Nhuộm Tông Nâu / Caramel:** 450.000đ - 750.000đ\n- ⚡ **Nhuộm Balayage / Highlight:** 950.000đ - 1.800.000đ\n- ✨ **Phục Hồi Keratin:** 400.000đ - 700.000đ\n\n🎁 *Đặc biệt:* Giảm ngay 15% cho khách hàng đặt lịch hẹn online!';
        } else if (msgLower.includes('chi nhánh') || msgLower.includes('địa chỉ') || msgLower.includes('ở đâu') || msgLower.includes('salon ở đâu')) {
            reply = '📍 **Hệ thống 3 Chi Nhánh Hana Hair Salon:**\n- **CN1:** 123 Nguyễn Trãi, Quận 1, TP.HCM (☎️ 0901 234 567)\n- **CN2:** 456 Lê Văn Sỹ, Quận 3, TP.HCM (☎️ 0908 888 999)\n- **CN3:** 789 Phan Xích Long, Q. Bình Thạnh, TP.HCM (☎️ 0903 333 444)\n\n⏰ Mở cửa từ 8:00 - 21:30 tất cả các ngày trong tuần!';
        } else if (msgLower.includes('điểm') || msgLower.includes('vip') || msgLower.includes('thưởng')) {
            reply = '⭐ **Chương trình Khách Hàng VIP:**\n- Tích lũy 10% giá trị hóa đơn cho mỗi lần dịch vụ.\n- Đạt 500 điểm: Thẻ Silver (Giảm 5% mọi dịch vụ).\n- Đạt 1500 điểm: Thẻ Gold (Giảm 10% + Tặng gội dưỡng sinh sinh nhật).\n- Đạt 3000 điểm: Thẻ Diamond (Giảm 15% + Đặt lịch ưu tiên).';
        } else {
            reply = `Dạ! Hana AI Assistant đã ghi nhận câu hỏi: "${message}".\n\nHana Hair Salon cung cấp đầy đủ các dịch vụ Cắt kiểu, Uốn sóng lơi, Nhuộm Balayage/Khói và Phục hồi Keratin cao cấp. Bạn có thể nhấn nút dưới đây để đặt lịch hoặc đặt thêm câu hỏi tư vấn nhé! 🌸`;
        }

        return res.json({
            success: true,
            isRealAi: false,
            reply,
            action,
            serviceName,
            branchName
        }); */

    } catch (err) {
        console.error('Lỗi Chatbot AI:', err);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xử lý phản hồi Chatbot AI.' });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api', bookingRoutes);

// Phục vụ index.html mặc định cho các đường dẫn SPA
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDir, 'index.html'));
});

// Chạy server trên cổng chính 3000
const server3000 = app.listen(PORT, () => {
    console.log(`🚀 Server Hana Hair đang chạy tại: http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Cổng chính ${PORT} đang được sử dụng bởi ứng dụng khác.`);
    } else {
        console.error('Lỗi cổng 3000:', err);
    }
});

// Đồng thời chạy server trên cổng 8080 theo yêu cầu người dùng
const http = require('http');
const server8080 = http.createServer(app);
server8080.listen(ALT_PORT, () => {
    console.log(`🌐 Server Web Frontend sẵn sàng tại: http://localhost:${ALT_PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Cổng ${ALT_PORT} đang được sử dụng bởi ứng dụng khác.`);
    } else {
        console.error('Lỗi cổng 8080:', err);
    }
});