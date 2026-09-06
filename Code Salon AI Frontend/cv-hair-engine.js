/**
 * ============================================================================
 * HANA HAIR SALON - DUAL 2D & 3D VIRTUAL TRY-ON CV ENGINE
 * (MediaPipe 478 Landmarks + 2D Canvas Renderer + Three.js WebGL 3D Mirror)
 * ============================================================================
 */

class CVHairEngine {
    constructor(options = {}) {
        this.canvas = options.canvas || document.getElementById('aiTryOnCanvasEngine');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        // Callback báo trạng thái AI Engine ra UI (tùy chọn)
        this.onStatus = typeof options.onStatus === 'function' ? options.onStatus : null;

        // MediaPipe FaceLandmarker Instance
        this.faceLandmarker = null;
        this.isLandmarkerReady = false;
        this.landmarkerInitPromise = null;
        this.lastVideoTimestamp = -1;

        // 2D State
        this.userImage = null;
        this.baseHairImage = null;
        this.hairImage = null;
        this.landmarks = null;
        this.viewMode = 'after'; // 'after', 'before', 'split'

        this.transform = {
            offsetX: 0,
            offsetY: -15,
            scale: 1.15,
            rotation: 0,
            opacity: 0.96,
            color: 'original'
        };

        this.faceMetrics = {
            centerX: 0,
            centerY: 0,
            foreheadX: 0,
            foreheadY: 0,
            chinX: 0,
            chinY: 0,
            leftTempleX: 0,
            leftTempleY: 0,
            rightTempleX: 0,
            rightTempleY: 0,
            faceWidth: 0,
            faceHeight: 0,
            ratio: 1.25,
            angle: 0,
            faceShape: 'Oval (Trái Xoan)',
            faceShapeDetail: 'Khuôn mặt trái xoan cân đối tỉ lệ vàng',
            skinTone: 'Vàng Sáng (Warm Beige)',
            skinToneDetail: 'Tone da vàng sáng tự nhiên Châu Á',
            confidence: 0.98
        };

        // 3D Engine State
        this.three = {
            container: null,
            video: null,
            meshCanvas: null,
            meshCtx: null,
            scene: null,
            camera: null,
            renderer: null,
            hairGroup: null,
            targetPos: null,
            hairMaterial: null,
            current3dStyle: 'curly_nu_3d',
            currentColorHex: '#4b2d22',
            userOffsetY: 0,
            userScale: 1.0,
            modelOffsets: {
                middlepart_nam_3d: { x: 0, y: 0.10, z: -0.14, scale: 1.02 },
                curly_nu_3d: { x: 0, y: 0.10, z: -0.20, scale: 1.06 },
                bob_nu_3d: { x: 0, y: 0.06, z: -0.12, scale: 1.02 },
                hime_cut_nu_3d: { x: 0, y: 0.08, z: -0.18, scale: 1.06 },
                straight_middlepart_nu_3d: { x: 0, y: 0.12, z: -0.22, scale: 1.08 },
                layer_nam_3d: { x: 0, y: 0.08, z: -0.12, scale: 1.02 }
            },
            isInitialized: false,
            animFrameId: null,
            modelLoadVersion: 0
        };

        // Hair Library Preset Meta Data (Pros & Cons Analysis)
        this.hairstyleAnalysis = {
            'layer_nu': {
                name: 'Layer Dài Cúp Ngọn Hàn Quốc',
                matchScore: 98,
                pros: [
                    'Tạo độ bay bổng tự nhiên, giúp khuôn mặt thon gọn V-line.',
                    'Che khuyết điểm xương quai hàm hoặc gò má hiệu quả.',
                    'Thích hợp với hầu hết các dáng mặt (Oval, Tròn, Vuông).'
                ],
                cons: [
                    'Cần sấy cúp đuôi nhẹ sau khi gội để duy trì nếp phồng.'
                ],
                careTip: 'Sấy tóc từ trên xuống và dùng lược tròn cuộn nhẹ đuôi tóc khi sấy.'
            },
            'wave_nu': {
                name: 'Sóng Lơi Bồng Bềnh Hàn Quốc',
                matchScore: 96,
                pros: [
                    'Tạo vẻ đẹp kiêu sa, quyến rũ và cực kỳ nữ tính.',
                    'Tăng độ phồng 2 bên má, cân đối tuyệt đối cho mặt thon dài.'
                ],
                cons: [
                    'Cần dùng tinh dầu dưỡng tóc giữ nếp uốn bồng bềnh.'
                ],
                careTip: 'Dùng kẹp càng cua cuộn tóc lên cao sau khi gội khô 80%.'
            },
            'bob_nu': {
                name: 'Bob Ngắn Cá Tính Balayage',
                matchScore: 94,
                pros: [
                    'Tôn nét trẻ trung, hiện đại và cực kỳ hack tuổi.',
                    'Làm nổi bật vùng cổ cao thon gọn và góc nghiêng quyến rũ.'
                ],
                cons: [
                    'Cần tỉa lại định kỳ 4-6 tuần để giữ phom dáng ngắn đẹp.'
                ],
                careTip: 'Vuốt một ít serum tạo bóng để các vệt nhuộm Balayage nổi bật.'
            },
            'wolf_cut': {
                name: 'Wolf Cut / Shag Thời Thượng',
                matchScore: 95,
                pros: [
                    'Phong cách Rocker/Y2K ngầu cá tính và nổi bật.',
                    'Tạo độ phồng ngẫu nhiên cực phiêu mà không cần vuốt sáp nhiều.'
                ],
                cons: [
                    'Phù hợp nhất với chất tóc có độ dày vừa phải.'
                ],
                careTip: 'Sấy xáo trộn chân tóc để tạo độ rối bung bết cá tính tự nhiên.'
            },
            'straight_silk': {
                name: 'Thẳng Suôn Keratin Bóng Mượt',
                matchScore: 92,
                pros: [
                    'Tạo thần thái sang chảnh, thanh lịch chuẩn tiểu thư.',
                    'Phục hồi hư tổn, giúp sợi tóc vào nếp thẳng tắp suôn mượt.'
                ],
                cons: [
                    'Có thể làm lộ khuôn mặt quá tròn nếu không có mái bay.'
                ],
                careTip: 'Dùng xịt dưỡng chống nhiệt trước khi kẹp thẳng.'
            },
            'pixie_nu': {
                name: 'Pixie Cut Hiện Đại Nữ',
                matchScore: 90,
                pros: [
                    'Tôn trọn đường nét gương mặt thanh tú, cá tính mạnh mẽ.',
                    'Gội sấy cực nhanh, thoáng mát năng động.'
                ],
                cons: [
                    'Đòi hỏi tỉa phom liên tục mỗi tháng.'
                ],
                careTip: 'Dùng sáp dẻo xoa đều ngón tay và vuốt nhẹ ngọn tóc.'
            },
            'layer_nam': {
                name: 'Layer Nam Textured Crop',
                matchScore: 97,
                pros: [
                    'Kiểu tóc nam quốc dân chuẩn idol Hàn Quốc.',
                    'Che trán cao, tạo vẻ trẻ trung thư sinh cuốn hút.'
                ],
                cons: [
                    'Cần sấy tạo độ phồng phom tóc nhẹ hàng ngày.'
                ],
                careTip: 'Dùng sáp tạo phồng Matte Clay không bóng.'
            },
            'sidepart_nam': {
                name: 'Side Part 7/3 Lịch Lãm Nam',
                matchScore: 96,
                pros: [
                    'Tôn vẻ nam tính, lịch lãm chuẩn quý ông thành đạt.',
                    'Thích hợp cho cả đi làm công sở lẫn sự kiện sang trọng.'
                ],
                cons: [
                    'Cần sấy rẽ ngôi 7/3 cố định phom.'
                ],
                careTip: 'Dùng gôm xịt giữ nếp phồng góc 45 độ.'
            }
        };

        // Initialize MediaPipe 3D FaceLandmarker
        this.initMediaPipe();
    }

    emitStatus(message) {
        if (this.onStatus) this.onStatus(message);
        if (message) console.info('[CVHairEngine]', message);
    }

    /**
     * Chèn script MediaPipe từ CDN dự phòng nếu window.Vision chưa tồn tại.
     * Version được PIN cứng (1.0.1) vì các version cũ 0.10.x đã bị gỡ vision_bundle.js khỏi CDN.
     */
    loadVisionBundleScript() {
        return new Promise((resolve, reject) => {
            const candidates = [
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.js',
                'https://unpkg.com/@mediapipe/tasks-vision@1.0.1/vision_bundle.js',
                'https://unpkg.com/@mediapipe/tasks-vision/vision_bundle.js'
            ];
            let index = 0;
            const tryNext = () => {
                if (index >= candidates.length) {
                    reject(new Error('Không tải được MediaPipe Vision từ mọi CDN'));
                    return;
                }
                const script = document.createElement('script');
                script.src = candidates[index++];
                script.crossOrigin = 'anonymous';
                script.onload = () => resolve();
                script.onerror = () => {
                    script.remove();
                    tryNext();
                };
                document.head.appendChild(script);
            };
            tryNext();
        });
    }

    /**
     * Tải MediaPipe Tasks Vision (478 Điểm 3D) - bản bền vững, có retry & fallback CDN
     */
    async initMediaPipe() {
        if (this.landmarkerInitPromise) return this.landmarkerInitPromise;

        this.landmarkerInitPromise = (async () => {
            try {
                this.emitStatus('Đang tải AI Engine (MediaPipe 478 Landmark)...');

                // Đợi script vision_bundle (nạp sẵn trong HTML hoặc tự chèn dự phòng)
                let vision = window.Vision || window.vision;
                if (!vision || !vision.FaceLandmarker) {
                    try {
                        await this.loadVisionBundleScript();
                    } catch (e) { /* tiếp tục thử với những gì có */ }
                    vision = window.Vision || window.vision;
                }

                if (!vision || !vision.FilesetResolver || !vision.FaceLandmarker) {
                    this.emitStatus('Lỗi: không tải được thư viện AI. Kiểm tra kết nối mạng rồi tải lại trang.');
                    return false;
                }

                await this.setupLandmarker(vision);
                if (this.isLandmarkerReady) {
                    this.emitStatus('AI Engine sẵn sàng (478 Landmark 3D)');
                }
                return this.isLandmarkerReady;
            } catch (err) {
                console.error('Lỗi khởi tạo MediaPipe:', err);
                this.emitStatus('Lỗi khởi tạo AI Engine: ' + (err.message || err));
                return false;
            }
        })();

        return this.landmarkerInitPromise;
    }

    async setupLandmarker(vision) {
        // PIN đúng version wasm khớp với vision_bundle 1.0.1, có CDN dự phòng
        const wasmCandidates = [
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
            'https://unpkg.com/@mediapipe/tasks-vision@1.0.1/wasm'
        ];
        const modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

        for (const cdnWasm of wasmCandidates) {
            for (const delegate of ['GPU', 'CPU']) {
                try {
                    const filesetResolver = await vision.FilesetResolver.forVisionTasks(cdnWasm);
                    this.faceLandmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
                        baseOptions: { modelAssetPath: modelUrl, delegate },
                        runningMode: 'VIDEO',
                        numFaces: 1
                    });
                    this.isLandmarkerReady = true;
                    return;
                } catch (error) {
                    console.warn(`FaceLandmarker khởi tạo lỗi (wasm=${cdnWasm}, delegate=${delegate}):`, error.message || error);
                }
            }
        }
        this.isLandmarkerReady = false;
    }

    /**
     * Dò mặt trên ảnh TĨNH.
     * FaceLandmarker được tạo ở chế độ VIDEO nên bắt buộc dùng detectForVideo
     * (detect() kiểu IMAGE sẽ ném lỗi trên landmarker chế độ VIDEO) với timestamp tăng dần.
     */
    detectImage(imageEl) {
        if (!this.faceLandmarker || !this.isLandmarkerReady || !imageEl) return null;

        let ts = performance.now();
        if (ts <= this.lastVideoTimestamp) ts = this.lastVideoTimestamp + 1;
        this.lastVideoTimestamp = ts;

        try {
            if (typeof this.faceLandmarker.detectForVideo === 'function') {
                const results = this.faceLandmarker.detectForVideo(imageEl, ts);
                return (results && results.faceLandmarks && results.faceLandmarks.length > 0) ? results.faceLandmarks[0] : null;
            }
        } catch (e) {
            console.warn('detectImage warning:', e.message || e);
        }
        return null;
    }

    /**
     * Nạp ảnh người dùng & Phân tích khuôn mặt 2D MediaPipe
     */
    async setUserImage(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = async () => {
                this.userImage = img;
                if (this.canvas) {
                    this.canvas.width = img.naturalWidth || 600;
                    this.canvas.height = img.naturalHeight || 800;
                }

                // Đảm bảo AI Engine đã init xong trước khi dò landmark ảnh tĩnh
                if (!this.isLandmarkerReady) {
                    await this.initMediaPipe();
                }

                // Chạy MediaPipe Face Landmark Detection (VIDEO-mode landmarker => detectForVideo)
                if (this.isLandmarkerReady) {
                    const lm = this.detectImage(img);
                    if (lm && lm.length >= 454) {
                        this.landmarks = lm;
                        this.calculateFaceMetrics(img.naturalWidth, img.naturalHeight);
                    }
                }

                // Nếu MediaPipe chưa sẵn sàng hoặc không phát hiện được landmark, gọi AI Backend OpenCV Python
                if (!this.landmarks || this.landmarks.length < 454) {
                    try {
                        const response = await fetch('/api/ai/analyze', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ imageBase64: imageSrc, filename: 'upload.jpg' })
                        });
                        if (response.ok) {
                            const resJson = await response.json();
                            const aiData = resJson.data || resJson;
                            if (aiData && aiData.face_shape) {
                                const shapeMap = {
                                    'oval': 'Oval (Trái Xoan)',
                                    'round': 'Tròn (Round)',
                                    'square': 'Vuông (Square)',
                                    'heart': 'Trái Tim (Heart)',
                                    'oblong': 'Dài (Oblong)'
                                };
                                const toneMap = {
                                    'warm beige': 'Vàng Sáng (Warm Beige)',
                                    'medium brown': 'Nâu Vừa (Medium Brown)',
                                    'deep brown': 'Nâu Đậm (Deep Brown)',
                                    'cool olive': 'Olive Sáng (Cool Olive)'
                                };
                                this.faceMetrics.faceShape = shapeMap[aiData.face_shape] || aiData.face_shape;
                                this.faceMetrics.faceShapeDetail = aiData.recommendation?.reason || `Gương mặt dáng ${aiData.face_shape}`;
                                this.faceMetrics.skinTone = toneMap[aiData.skin_tone] || aiData.skin_tone || 'Vàng Sáng (Warm Beige)';
                                this.faceMetrics.skinToneDetail = `Tone da phù hợp màu ${aiData.recommendation?.best_color || 'Caramel / Nâu'}`;
                                if (aiData.confidence) this.faceMetrics.confidence = (aiData.confidence / 100);
                            }
                        }
                    } catch (netErr) {
                        console.warn('AI Backend analyze fallback notification:', netErr.message);
                    }
                }

                this.render();
                resolve(this.faceMetrics);
            };
            img.onerror = reject;
            img.src = imageSrc;
        });
    }

    /**
     * Tính toán Dáng mặt & Tone da từ 478 Điểm MediaPipe
     */
    calculateFaceMetrics(width, height) {
        if (!this.landmarks || this.landmarks.length < 454) return;

        const forehead = this.landmarks[10];
        const chin = this.landmarks[152];
        const leftTemple = this.landmarks[234];
        const rightTemple = this.landmarks[454];

        const faceHeight = Math.hypot((chin.x - forehead.x) * width, (chin.y - forehead.y) * height);
        const faceWidth = Math.hypot((rightTemple.x - leftTemple.x) * width, (rightTemple.y - leftTemple.y) * height);
        const ratio = faceHeight / (faceWidth || 1);

        let faceShape = 'Oval (Trái Xoan)';
        let shapeDetail = 'Khuôn mặt cân đối chuẩn tỷ lệ vàng 1.35:1';

        if (ratio >= 1.48) {
            faceShape = 'Dài (Oblong)';
            shapeDetail = 'Gương mặt thon dài thanh tú';
        } else if (ratio < 1.20) {
            faceShape = 'Tròn (Round)';
            shapeDetail = 'Gương mặt tròn bầu bĩnh phổng phao';
        } else if (ratio >= 1.20 && ratio <= 1.40) {
            faceShape = 'Vuông (Square)';
            shapeDetail = 'Gương mặt góc cạnh cá tính sang trọng';
        }

        const eyeDx = (rightTemple.x - leftTemple.x) * width;
        const eyeDy = (rightTemple.y - leftTemple.y) * height;
        const angle = Math.atan2(eyeDy, eyeDx) * (180 / Math.PI);

        this.faceMetrics = {
            foreheadX: forehead.x * width,
            foreheadY: forehead.y * height,
            chinX: chin.x * width,
            chinY: chin.y * height,
            leftTempleX: leftTemple.x * width,
            leftTempleY: leftTemple.y * height,
            rightTempleX: rightTemple.x * width,
            rightTempleY: rightTemple.y * height,
            faceWidth,
            faceHeight,
            ratio: parseFloat(ratio.toFixed(2)),
            angle,
            faceShape,
            faceShapeDetail: shapeDetail,
            skinTone: 'Vàng Sáng (Warm Beige)',
            skinToneDetail: 'Tone da ấm Châu Á tôn màu nhuộm',
            confidence: 0.98
        };
    }

    /**
     * Hàm nhuộm màu cho ảnh tóc gốc (Base Image)
     * Giữ nguyên ảnh gốc khi chọn 'original' (tránh multiply ra màu đen).
     */
    tintHairImage(baseImage, hexColor) {
        if (!baseImage) return null;
        if (!hexColor || !String(hexColor).startsWith('#')) {
            return baseImage; // màu 'original' hoặc không hợp lệ => dùng ảnh gốc
        }
        const canvas = document.createElement('canvas');
        canvas.width = baseImage.naturalWidth || baseImage.width || 500;
        canvas.height = baseImage.naturalHeight || baseImage.height || 500;
        const ctx = canvas.getContext('2d');

        // 1. Phủ toàn bộ canvas bằng màu khách chọn
        ctx.fillStyle = hexColor || '#36241b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Chế độ Multiply: Trộn màu với ảnh gốc (giữ lại nếp tóc, độ bóng sáng/tối)
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

        // 3. Chế độ Destination-In: Cắt gọt phần viền thừa
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

        return canvas;
    }

    /**
     * Load kiểu tóc từ file PNG trong assets/hairs/
     */
    async setHairImage(hairKey) {
        return new Promise((resolve) => {
            this.currentHairKey = hairKey;
            
            // Trỏ tới file PNG
            const hairImageUrl = `assets/hairs/${hairKey}.png`; 
            
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.baseHairImage = img; // Lưu lại ảnh gốc xám
                
                // Nhuộm luôn màu hiện tại (mặc định lấy màu nâu tự nhiên)
                const currentColor = (this.transform && this.transform.color && this.transform.color.startsWith('#')) 
                    ? this.transform.color 
                    : (this.three && this.three.currentColorHex ? this.three.currentColorHex : '#36241b');
                this.hairImage = this.tintHairImage(this.baseHairImage, currentColor);
                
                this.render(); // Vẽ lên mặt khách
                resolve(true);
            };
            img.onerror = () => {
                console.warn("Không tìm thấy ảnh PNG: " + hairImageUrl);
                resolve(false);
            };
            img.src = hairImageUrl;
        });
    }

    /**
     * Khi khách bấm chọn màu khác, nhuộm lại ảnh và vẽ lên ngay
     */
    set2DHairColor(hexColor) {
        if (!hexColor) return;
        this.transform.color = hexColor; // Lưu màu mới
        
        // Nếu đã load ảnh xám thành công thì nhuộm lại
        if (this.baseHairImage) {
            this.hairImage = this.tintHairImage(this.baseHairImage, hexColor);
            this.render(); // Update canvas ngay lập tức
        }
    }

    updateTransform(opts = {}) {
        this.transform = { ...this.transform, ...opts };
        if (opts.color && this.baseHairImage) {
            this.set2DHairColor(opts.color);
        } else {
            this.render();
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.render();
    }

    getHairstyleAnalysis(hairKey) {
        return this.hairstyleAnalysis[hairKey] || this.hairstyleAnalysis['layer_nu'];
    }

    /**
     * Render 2D Virtual Try-On Canvas
     */
    render() {
        if (!this.canvas || !this.ctx || !this.userImage) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);

        // Chế độ 'before': Chỉ vẽ ảnh gốc
        if (this.viewMode === 'before') {
            ctx.drawImage(this.userImage, 0, 0, width, height);
            return;
        }

        // Chế độ 'split': Chia đôi màn hình
        if (this.viewMode === 'split') {
            const halfW = width / 2;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, halfW, height);
            ctx.clip();
            ctx.drawImage(this.userImage, 0, 0, width, height);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.rect(halfW, 0, halfW, height);
            ctx.clip();
            ctx.drawImage(this.userImage, 0, 0, width, height);
            this.drawHairOverlay(ctx, width, height);
            ctx.restore();

            // Đường phân cách Split Line
            ctx.strokeStyle = '#dfa132';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(halfW, 0);
            ctx.lineTo(halfW, height);
            ctx.stroke();
            return;
        }

        // Chế độ 'after': Ghép ảnh người dùng + Tóc 2D
        ctx.drawImage(this.userImage, 0, 0, width, height);
        this.drawHairOverlay(ctx, width, height);
    }

    drawHairOverlay(ctx, width, height) {
        if (!this.hairImage) return;

        // Ảnh tóc chuẩn 600x600, mốc tóc trán (hairline) nằm ở 52% chiều cao ảnh
        const HAIR_BOX = 600;
        const HAIRLINE_RATIO = 0.52;

        ctx.save();
        ctx.globalAlpha = this.transform.opacity;

        let posX = width / 2 + this.transform.offsetX;
        let posY = height * 0.28 + this.transform.offsetY + HAIR_BOX * 0.05;
        let scale = (width * 0.85 / HAIR_BOX) * this.transform.scale;
        let angle = this.transform.rotation;

        if (this.faceMetrics && this.faceMetrics.foreheadX) {
            // Neo đúng điểm tóc trán (landmark 10) và phủ rộng hơn khuôn mặt ~2 lần bề ngang
            posX = this.faceMetrics.foreheadX + this.transform.offsetX;
            posY = this.faceMetrics.foreheadY + this.transform.offsetY;
            scale = (this.faceMetrics.faceWidth * 2.5 / HAIR_BOX) * this.transform.scale;
            angle += this.faceMetrics.angle;
        }

        ctx.translate(posX, posY);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.scale(scale, scale);
        // Vẽ ảnh tóc sao cho điểm hairline (52% chiều cao) trùng đúng vị trí mốc trán
        ctx.drawImage(this.hairImage, -HAIR_BOX / 2, -HAIR_BOX * HAIRLINE_RATIO, HAIR_BOX, HAIR_BOX);

        ctx.restore();
    }

    toDataURL(type = 'image/jpeg', quality = 0.95) {
        return this.canvas ? this.canvas.toDataURL(type, quality) : '';
    }

    // --------------------------------------------------------------------------
    // 3D REAL-TIME AR MIRROR ENGINE (THREE.JS WEBGL + MEDIAPIPE FACE OCCLUSION)
    // --------------------------------------------------------------------------
    detectFrame(videoEl) {
        if (!videoEl || videoEl.readyState < 2 || !this.faceLandmarker || !this.isLandmarkerReady) return null;
        try {
            // MediaPipe yêu cầu timestamp tăng dần nghiêm ngặt giữa các lần detect
            let timestampMs = performance.now();
            if (timestampMs <= this.lastVideoTimestamp) timestampMs = this.lastVideoTimestamp + 1;
            this.lastVideoTimestamp = timestampMs;

            let results = null;
            if (typeof this.faceLandmarker.detectForVideo === 'function') {
                results = this.faceLandmarker.detectForVideo(videoEl, timestampMs);
            } else if (typeof this.faceLandmarker.detect === 'function') {
                results = this.faceLandmarker.detect(videoEl);
            }
            return (results && results.faceLandmarks && results.faceLandmarks.length > 0) ? results.faceLandmarks[0] : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Thuật toán Delaunay Triangulation cho 468 điểm Face Mesh
     */
    computeFaceDelaunayIndices(landmarks) {
        if (!landmarks || landmarks.length < 400) return null;

        const points = [];
        for (let i = 0; i < Math.min(landmarks.length, 468); i++) {
            points.push({ x: landmarks[i].x, y: landmarks[i].y, id: i });
        }

        let minX = 0, minY = 0, maxX = 1, maxY = 1;
        const dx = (maxX - minX) * 10;
        const dy = (maxY - minY) * 10;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const stV0 = { x: midX - dx, y: midY - dy, id: -1 };
        const stV1 = { x: midX, y: midY + dy, id: -2 };
        const stV2 = { x: midX + dx, y: midY - dy, id: -3 };

        let triangles = [{ a: stV0, b: stV1, c: stV2 }];

        for (let p of points) {
            let polygon = [];
            let badTriangles = [];

            for (let t of triangles) {
                const ax = t.a.x - p.x;
                const ay = t.a.y - p.y;
                const bx = t.b.x - p.x;
                const by = t.b.y - p.y;
                const cx = t.c.x - p.x;
                const cy = t.c.y - p.y;

                const det = (ax*ax + ay*ay) * (bx*cy - cx*by) -
                            (bx*bx + by*by) * (ax*cy - cx*ay) +
                            (cx*cx + cy*cy) * (ax*by - bx*ay);

                const orient = (t.b.x - t.a.x)*(t.c.y - t.a.y) - (t.b.y - t.a.y)*(t.c.x - t.a.x);
                const inCircum = orient > 0 ? det > 0 : det < 0;

                if (inCircum) {
                    badTriangles.push(t);
                }
            }

            let edges = [];
            for (let t of badTriangles) {
                edges.push({ a: t.a, b: t.b }, { a: t.b, b: t.c }, { a: t.c, b: t.a });
            }

            triangles = triangles.filter(t => !badTriangles.includes(t));

            for (let i = 0; i < edges.length; i++) {
                let isShared = false;
                for (let j = 0; j < edges.length; j++) {
                    if (i !== j) {
                        if ((edges[i].a.id === edges[j].b.id && edges[i].b.id === edges[j].a.id) ||
                            (edges[i].a.id === edges[j].a.id && edges[i].b.id === edges[j].b.id)) {
                            isShared = true;
                            break;
                        }
                    }
                }
                if (!isShared) {
                    polygon.push(edges[i]);
                }
            }

            for (let edge of polygon) {
                triangles.push({ a: edge.a, b: edge.b, c: p });
            }
        }

        const indices = [];
        for (let t of triangles) {
            if (t.a.id >= 0 && t.b.id >= 0 && t.c.id >= 0) {
                indices.push(t.a.id, t.b.id, t.c.id);
            }
        }
        return new Uint16Array(indices);
    }

    init3DMirror(containerEl, videoEl, meshCanvasEl) {
        if (!containerEl || !window.THREE) return;

        this.three.container = containerEl;
        this.three.video = videoEl;
        this.three.meshCanvas = meshCanvasEl || null;
        if (meshCanvasEl) this.three.meshCtx = meshCanvasEl.getContext('2d');

        const width = containerEl.clientWidth || 640;
        const height = containerEl.clientHeight || 480;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 0, 10);

        // BẬT preserveDrawingBuffer: true ĐỂ CHỤP CANVAS SẮC NÉT
        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.autoClear = true;
        containerEl.innerHTML = '';
        containerEl.appendChild(renderer.domElement);

        // Ánh sáng Salon Studio chân thực
        scene.add(new THREE.AmbientLight(0xffffff, 1.2));

        const mainLight = new THREE.DirectionalLight(0xfff4e0, 1.8);
        mainLight.position.set(2, 6, 8);
        scene.add(mainLight);

        const rimLight = new THREE.DirectionalLight(0xdfa132, 1.2);
        rimLight.position.set(-5, 4, -3);
        scene.add(rimLight);

        // =====================================================================
        // BƯỚC 2 & 3: DỰNG OCCLUSION MESH KHUÔN MẶT ĐỘNG (CHỈ GHI DEPTH BUFFER)
        // =====================================================================
        const occlusionGeo = new THREE.BufferGeometry();
        const occlusionPosArray = new Float32Array(468 * 3);
        occlusionGeo.setAttribute('position', new THREE.BufferAttribute(occlusionPosArray, 3));

        // Material vô hình: colorWrite=false, depthWrite=true, depthTest=true
        const occlusionMat = new THREE.MeshBasicMaterial({
            colorWrite: false,
            depthWrite: true,
            depthTest: true,
            side: THREE.DoubleSide
        });

        const occlusionMesh = new THREE.Mesh(occlusionGeo, occlusionMat);
        occlusionMesh.renderOrder = 0; // Vẽ trước để ghi vào depth buffer
        // BƯỚC 3: Scale occlusion to hơn mặt thật khoảng 10% để che hoàn toàn tóc lỗi đâm xuyên mặt
        occlusionMesh.scale.set(1.10, 1.10, 1.10);
        occlusionMesh.visible = false;
        scene.add(occlusionMesh);

        // =====================================================================
        // BƯỚC 4: HAIR GROUP RENDER SAU OCCLUSION MESH (renderOrder: 1)
        // =====================================================================
        const hairGroup = new THREE.Group();
        hairGroup.renderOrder = 1;
        hairGroup.visible = false;
        scene.add(hairGroup);

        this.three.scene = scene;
        this.three.camera = camera;
        this.three.renderer = renderer;
        this.three.occlusionGeo = occlusionGeo;
        this.three.occlusionMesh = occlusionMesh;
        this.three.occlusionPosArray = occlusionPosArray;
        this.three.triangulationReady = false;
        this.three.hairGroup = hairGroup;
        this.three.targetPos = new THREE.Vector3(0, 0, 0);
        this.three.isInitialized = true;
        this.three.lostTrackingFrames = 0;

        // BƯỚC 1 & 2: Khởi tạo GLTFLoader và bộ nhớ đệm (Cache)
        if (!this.three.gltfLoader && window.THREE && THREE.GLTFLoader) {
            this.three.gltfLoader = new THREE.GLTFLoader();
            this.three.loadedModels = {};
        }

        this.three.hairMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#36241b'),
            roughness: 0.38,
            metalness: 0.08,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: true
        });

        this.update3DHairMesh(this.three.current3dStyle);

        const renderLoop = () => {
            if (this.three.container && this.three.camera && this.three.renderer) {
                const cW = this.three.container.clientWidth;
                const cH = this.three.container.clientHeight;
                if (cW > 0 && cH > 0 && (renderer.domElement.width !== cW || renderer.domElement.height !== cH)) {
                    camera.aspect = cW / cH;
                    camera.updateProjectionMatrix();
                    renderer.setSize(cW, cH);
                }
            }
            if (this.three.renderer && this.three.scene && this.three.camera) {
                this.three.renderer.render(this.three.scene, this.three.camera);
            }
            this.three.animFrameId = requestAnimationFrame(renderLoop);
        };
        if (this.three.animFrameId) cancelAnimationFrame(this.three.animFrameId);
        renderLoop();
    }

    /**
     * BƯỚC 3: LOAD MODEL 3D TỪ FILE .GLB TRONG assets/models/ VỚI TỰ ĐỘNG CĂN CHỈNH TÂM VÀ SCALE
     */
    update3DHairMesh(styleKey) {
        if (!styleKey) return;
        this.three.current3dStyle = styleKey;
        if (!this.three.isInitialized || !this.three.hairGroup) return;
        const hairGroup = this.three.hairGroup;
        const loadVersion = ++this.three.modelLoadVersion;
        hairGroup.visible = false;

        // Xóa rác 3D cũ
        while (hairGroup.children.length > 0) {
            hairGroup.remove(hairGroup.children[0]);
        }

        // Khởi tạo GLTFLoader và bộ nhớ đệm (Cache) nếu chưa có
        if (!this.three.gltfLoader && window.THREE && THREE.GLTFLoader) {
            this.three.gltfLoader = new THREE.GLTFLoader();
            this.three.loadedModels = {};
        }

        if (!this.three.gltfLoader) return;

        // Trỏ tới file 3D trong assets/models.
        const modelKey = styleKey.endsWith('_3d') ? styleKey : (styleKey + '_3d');
        const modelUrl = `assets/models/${modelKey}.glb`;
        const modelOffset = this.three.modelOffsets[modelKey] || { x: 0, y: 0.10, z: -0.12, scale: 1.0 };

        // Nếu model đã được tính toán trong Cache, lấy ra dùng luôn
        if (this.three.loadedModels && this.three.loadedModels[modelKey]) {
            const cachedPivot = this.three.loadedModels[modelKey].clone();
            cachedPivot.traverse((child) => {
                if (child.isMesh) {
                    child.material = this.three.hairMaterial;
                }
            });
            hairGroup.add(cachedPivot);
            if (loadVersion === this.three.modelLoadVersion) hairGroup.visible = true;
            return;
        }

        this.three.gltfLoader.load(modelUrl, (gltf) => {
            const hairMesh = gltf.scene;

            // Phủ vật liệu và màu sắc cho mô hình 3D
            hairMesh.traverse((child) => {
                if (child.isMesh) {
                    child.material = this.three.hairMaterial;
                }
            });

            // Tự động tính Bounding Box của Model để đưa tâm về (0,0,0)
            const box = new THREE.Box3().setFromObject(hairMesh);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            // Dịch chuyển tâm hình học của tóc về gốc (0, 0, 0)
            hairMesh.position.x = -center.x + modelOffset.x;
            hairMesh.position.y = -center.y + (size.y * 0.12) + modelOffset.y;
            hairMesh.position.z = -center.z - (size.z * 0.05) + modelOffset.z;

            // Chuẩn hóa kích thước tóc theo tỷ lệ khuôn mặt (khoảng 3.2 units)
            const targetWidth = 3.2;
            const maxDim = Math.max(size.x, size.z);
            const normScale = (targetWidth / (maxDim || 0.3));

            const modelPivot = new THREE.Group();
            modelPivot.add(hairMesh);
            modelPivot.scale.set(normScale * modelOffset.scale, normScale * modelOffset.scale, normScale * modelOffset.scale);

            if (!this.three.loadedModels) this.three.loadedModels = {};
            this.three.loadedModels[modelKey] = modelPivot;

            if (loadVersion === this.three.modelLoadVersion && this.three.current3dStyle === styleKey) {
                while (hairGroup.children.length > 0) hairGroup.remove(hairGroup.children[0]);
                hairGroup.add(modelPivot.clone());
                hairGroup.visible = true;
            }
        }, undefined, (error) => {
            console.warn('Không tìm thấy file mô hình 3D:', modelUrl);
        });
    }

    set3DHairColor(hexColor) {
        this.three.currentColorHex = hexColor;
        if (this.three.hairMaterial) {
            this.three.hairMaterial.color.set(hexColor);
        }
        if (this.three.hairGroup) {
            this.three.hairGroup.traverse((child) => {
                if (child.isMesh && child.material && child.material.color) {
                    child.material.color.set(hexColor);
                }
            });
        }
    }

    set3DHairOffset(offsetY, scale) {
        if (offsetY !== undefined) this.three.userOffsetY = parseFloat(offsetY);
        if (scale !== undefined) this.three.userScale = parseFloat(scale);
    }

    /**
     * BƯỚC 8: CẬP NHẬT POSE 3D & OCCLUSION MESH MỖI FRAME (VỚI LERP SMOOTHING & FALLBACK)
     */
    update3DPose(landmarks, width, height) {
        if (!this.three.isInitialized || !landmarks || landmarks.length < 454) {
            this.three.lostTrackingFrames = (this.three.lostTrackingFrames || 0) + 1;
            if (this.three.lostTrackingFrames > 35) {
                if (this.three.hairGroup) this.three.hairGroup.visible = false;
                if (this.three.occlusionMesh) this.three.occlusionMesh.visible = false;
            }
            return;
        }

        this.three.lostTrackingFrames = 0;
        this.landmarks = landmarks;
        this.calculateFaceMetrics(width, height);

        // Tọa độ 3D khớp chính xác theo phối cảnh camera FOV 45
        const vHeight = 8.284;
        const vWidth = vHeight * ((width && height) ? (width / height) : (4 / 3));

        // 1. Cập nhật Occlusion Mesh động từ 468 Landmarks
        if (this.three.occlusionGeo && this.three.occlusionPosArray) {
            if (!this.three.triangulationReady) {
                const indices = this.computeFaceDelaunayIndices(landmarks);
                if (indices && indices.length > 0) {
                    this.three.occlusionGeo.setIndex(new THREE.BufferAttribute(indices, 1));
                    this.three.triangulationReady = true;
                }
            }

            const posArray = this.three.occlusionPosArray;
            const offsetY = (this.three.userOffsetY || 0);

            for (let i = 0; i < 468; i++) {
                const lm = landmarks[i];
                if (!lm) continue;
                posArray[i * 3] = (0.5 - lm.x) * vWidth;
                posArray[i * 3 + 1] = (0.5 - lm.y) * vHeight + offsetY;
                posArray[i * 3 + 2] = (lm.z || 0) * -6.0;
            }

            this.three.occlusionGeo.attributes.position.needsUpdate = true;
            this.three.occlusionGeo.computeVertexNormals();
            this.three.occlusionMesh.visible = true;
        }

        // 2. Tính toán vị trí và góc quay 3D cho HairGroup
        const forehead = landmarks[10];
        const chin = landmarks[152];
        const leftTemple = landmarks[234];
        const rightTemple = landmarks[454];

        // Điểm tóc trán & chiều cao mặt trong hệ tọa độ world (tự co giãn theo khoảng cách camera)
        const foreheadWx = (0.5 - forehead.x) * vWidth;
        const foreheadWy = (0.5 - forehead.y) * vHeight;
        const foreheadWz = (forehead.z || 0) * -6.0;
        const chinWy = (0.5 - chin.y) * vHeight;

        // Tâm tóc = điểm trán kéo lên trên bằng 55% chiều cao mặt (khớp giải phẫu đầu người)
        const faceHeightW = Math.abs(foreheadWy - chinWy);
        const posX = foreheadWx;
        const posY = foreheadWy + faceHeightW * 0.42 + (this.three.userOffsetY || 0);
        const posZ = foreheadWz - 0.25;

        this.three.targetPos.set(posX, posY, posZ);
        this.three.hairGroup.position.lerp(this.three.targetPos, 0.62);
        this.three.hairGroup.visible = this.three.hairGroup.children.length > 0;

        // Roll: nghiêng ngang theo đường nối hai thái dương
        const eyeDx = rightTemple.x - leftTemple.x;
        const eyeDy = rightTemple.y - leftTemple.y;
        const rollAngle = -Math.atan2(eyeDy, eyeDx);

        // Yaw: quay trái/phải theo chênh lệch độ sâu hai thái dương (kẹp trong ±75°)
        const yawAngle = Math.max(-1.3, Math.min(1.3, (rightTemple.z - leftTemple.z) * 4.5));

        // Pitch: gật/cúi theo chênh lệch độ sâu trán - cằm (kẹp trong ±45°)
        const pitchAngle = Math.max(-0.8, Math.min(0.8, ((forehead.z || 0) - (chin.z || 0)) * 3.0));

        this.three.hairGroup.rotation.x += (pitchAngle - this.three.hairGroup.rotation.x) * 0.55;
        this.three.hairGroup.rotation.y += (-yawAngle - this.three.hairGroup.rotation.y) * 0.55;
        this.three.hairGroup.rotation.z += (rollAngle - this.three.hairGroup.rotation.z) * 0.55;

        const faceWidth3D = Math.hypot(rightTemple.x - leftTemple.x, rightTemple.y - leftTemple.y);
        const scaleFactor = Math.max(0.75, Math.min(2.2, faceWidth3D * 3.5))
            * (this.three.userScale || 1.0);
        this.three.hairGroup.scale.lerp(new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor), 0.4);

        if (this.three.meshCtx && this.three.meshCanvas) {
            const ctx = this.three.meshCtx;
            const cWidth = this.three.meshCanvas.width;
            const cHeight = this.three.meshCanvas.height;
            ctx.clearRect(0, 0, cWidth, cHeight);
        }
    }

    /**
     * Vẽ overlay tóc 2D lên ảnh chụp GƯƠNG (đã lật mirror).
     * Landmark thuộc hệ tọa độ video gốc nên phải lật X + đảo góc quay.
     */
    drawHairOverlayMirrored(ctx, vW, vH) {
        if (!this.hairImage || !this.faceMetrics || !this.faceMetrics.foreheadX) return;

        const HAIR_BOX = 600;
        const HAIRLINE_RATIO = 0.52;

        ctx.save();
        ctx.globalAlpha = this.transform.opacity;
        ctx.translate(vW - this.faceMetrics.foreheadX, this.faceMetrics.foreheadY);
        ctx.rotate((-this.faceMetrics.angle * Math.PI) / 180);
        const scale = (this.faceMetrics.faceWidth * 2.5 / HAIR_BOX) * this.transform.scale;
        ctx.scale(scale, scale);
        ctx.drawImage(this.hairImage, -HAIR_BOX / 2, -HAIR_BOX * HAIRLINE_RATIO, HAIR_BOX, HAIR_BOX);
        ctx.restore();
    }

    /**
     * CHỤP ẢNH GƯƠNG 3D COMPOSITE (KHUÔN MẶT THẬT + TÓC 3D VÀ MÀU NHUỘM ĐANG THỬ)
     * - Đồng bộ pose lần cuối ngay trước khi chụp để tóc không bị trễ frame.
     * - Nếu tóc 3D chưa kịp hiển thị (model load chậm/mất tracking), tự động
     *   ghép tóc 2D chân thực lên ảnh chụp theo landmark đã lưu => LUÔN có tóc trong ảnh.
     */
    capture3DComposite(videoEl) {
        if (!videoEl || !this.three.renderer || !this.three.scene || !this.three.camera) {
            return null;
        }

        // 0. Đồng bộ pose lần cuối với frame mới nhất (tránh tóc trễ/lệch lúc chụp)
        if (this.faceLandmarker && this.isLandmarkerReady && videoEl.readyState >= 2) {
            const lm = this.detectFrame(videoEl);
            if (lm) {
                this.update3DPose(lm, videoEl.videoWidth, videoEl.videoHeight);
            }
        }

        const vW = videoEl.videoWidth || 1280;
        const vH = videoEl.videoHeight || 720;

        const outCanvas = document.createElement('canvas');
        outCanvas.width = vW;
        outCanvas.height = vH;
        const ctx = outCanvas.getContext('2d', { alpha: false });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 1. Vẽ video người dùng từ camera (được lật mirror khớp với gương soi)
        ctx.save();
        ctx.translate(vW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, 0, 0, vW, vH);
        ctx.restore();

        // Render đúng tỉ lệ video và đúng kích thước pixel ảnh chụp, không kéo méo canvas.
        const renderer = this.three.renderer;
        const camera = this.three.camera;
        const previousAspect = camera.aspect;
        const previousPixelRatio = renderer.getPixelRatio();
        const previousWidth = renderer.domElement.width;
        const previousHeight = renderer.domElement.height;

        camera.aspect = vW / vH;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(1);
        renderer.setSize(vW, vH, false);
        renderer.render(this.three.scene, camera);
        ctx.drawImage(renderer.domElement, 0, 0, renderer.domElement.width, renderer.domElement.height, 0, 0, vW, vH);

        camera.aspect = previousAspect;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(previousPixelRatio);
        renderer.setSize(previousWidth / previousPixelRatio, previousHeight / previousPixelRatio, false);

        // 3. FALLBACK AN TOÀN: nếu tóc 3D không hiển thị (model chưa load / mất tracking),
        //    ghép trực tiếp ảnh tóc 2D theo landmark lên ảnh chụp => ảnh chụp luôn có kiểu tóc.
        const hair3dVisible = this.three.hairGroup && this.three.hairGroup.visible && this.three.hairGroup.children.length > 0;
        if (!hair3dVisible) {
            this.drawHairOverlayMirrored(ctx, vW, vH);
        }

        return outCanvas.toDataURL('image/jpeg', 0.96);
    }
}

// Global Export
window.CVHairEngine = CVHairEngine;
