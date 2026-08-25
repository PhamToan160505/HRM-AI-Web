import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../services/api';
import Button from '../../components/common/Button';

const FacePunchModal = ({ onSuccess, onCancel }) => {
    const videoRef = useRef(null);
    const [isModelsLoaded, setIsModelsLoaded] = useState(false);
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const isPunching = useRef(false);

    // 1. Load models
    useEffect(() => {
        const loadModels = async () => {
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
                    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
                    faceapi.nets.faceExpressionNet.loadFromUri('/models')
                ]);
                setIsModelsLoaded(true);
            } catch (err) {
                console.error("Lỗi tải AI models:", err);
                setError("Không thể khởi tạo mô hình AI nhận diện khuôn mặt.");
            }
        };
        loadModels();
    }, []);

    // 2. Start webcam when models are loaded
    useEffect(() => {
        if (!isModelsLoaded) return;
        let activeStream = null;

        const startVideo = async () => {
            try {
                activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = activeStream;
                }
                setStream(activeStream);
            } catch (err) {
                console.error("Camera error:", err);
                setError("Không thể truy cập Camera. Vui lòng cấp quyền.");
            }
        };
        startVideo();

        return () => {
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isModelsLoaded]);

    const captureAndPunch = async () => {
        if (!videoRef.current || !isModelsLoaded || isPunching.current) return;
        
        isPunching.current = true;
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        // Nhường luồng 50ms để React render UI Loading
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.95 });
            const detection = await faceapi.detectSingleFace(videoRef.current, options)
                .withFaceLandmarks()
                .withFaceExpressions()
                .withFaceDescriptor();

            if (!detection) {
                setError("Không tìm thấy khuôn mặt rõ ràng. Vui lòng bỏ khẩu trang, nhìn thẳng và đưa mặt gần camera.");
                setLoading(false);
                return;
            }

            // Anti-spoofing cơ bản: Khuôn mặt phải đủ lớn (không phải ảnh nhỏ xa) và điểm tin cậy cực cao
            if (detection.detection.score < 0.995 || detection.detection.box.width < 120) {
                setError("Ảnh không đạt chuẩn. Vui lòng bỏ hết kính, khẩu trang, không dùng tay che mặt và để khuôn mặt thật rõ ràng!");
                setLoading(false);
                return;
            }

            // Chống che mặt (Occlusion detection) bằng cách kiểm tra biểu cảm
            const expressions = detection.expressions;
            const maxExpression = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
            if (expressions[maxExpression] < 0.8) {
                setError("Vui lòng không che mặt hoặc đeo khẩu trang. Yêu cầu lộ rõ ngũ quan!");
                setLoading(false);
                return;
            }

            const descriptorArray = Array.from(detection.descriptor);
            const vectorJson = JSON.stringify(descriptorArray);

            // Fetch location
            let locationName = "Không thể lấy vị trí";
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                });
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                // Simple reverse geocoding via Nominatim
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
                if (res.ok) {
                    const data = await res.json();
                    locationName = data.display_name || `${lat}, ${lon}`;
                } else {
                    locationName = `${lat}, ${lon}`;
                }
            } catch (err) {
                console.warn("Geolocation failed:", err);
            }

            const response = await api.post('/api/attendance/punch', {
                embeddingVector: vectorJson,
                location: locationName
            });

            if (response.data.success) {
                setSuccessMessage(`Chấm công thành công! Vị trí: ${locationName.split(',')[0]}`);
                setCountdown(3);
                
                let timeLeft = 3;
                const timer = setInterval(() => {
                    timeLeft -= 1;
                    setCountdown(timeLeft);
                    if (timeLeft <= 0) {
                        clearInterval(timer);
                        if (onSuccess) {
                            onSuccess();
                        }
                    }
                }, 1000);
            } else {
                setError(response.data.message || "Lỗi chấm công");
            }

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Khuôn mặt không khớp hoặc có lỗi xảy ra.");
        } finally {
            setLoading(false);
            isPunching.current = false;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
            <div
                className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-[360px] flex flex-col items-center p-5 text-center animate-fade-in border border-slate-100"
                onClick={e => e.stopPropagation()}
            >
                {loading && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-2xl" style={{ transform: 'translateZ(0)' }}>
                        <div className="w-10 h-10 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin mb-3 shadow-sm" style={{ willChange: 'transform' }}></div>
                        <h3 className="text-base font-bold text-gray-800">AI đang xác thực...</h3>
                        <p className="text-xs text-gray-500 mt-1">Vui lòng giữ nguyên khuôn mặt</p>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between w-full mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <Camera size={16} strokeWidth={2} />
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-bold text-gray-800">Chấm công AI</p>
                            <p className="text-xs text-gray-400">Nhìn thẳng vào camera</p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-slate-100 hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Camera feed */}
                <div className="relative w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden shadow-md border-2 border-slate-100 mb-4">
                    {!isModelsLoaded ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
                            <span className="text-xs font-medium">Đang khởi tạo AI...</span>
                        </div>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-cover scale-x-[-1]"
                            />
                            {/* Corner brackets overlay */}
                            <div className="absolute inset-0 pointer-events-none p-4">
                                <div className="w-full h-full relative">
                                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-md" />
                                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-md" />
                                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-md" />
                                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-md" />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {error && (
                    <div className="w-full p-2.5 bg-red-50 text-red-600 text-xs rounded-lg mb-3 flex items-start gap-2 border border-red-100 text-left">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
                    </div>
                )}

                {successMessage && (
                    <div className="w-full p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-lg mb-3 flex flex-col items-center gap-1 border border-emerald-100">
                        <div className="flex items-center gap-1.5 font-bold">
                            <CheckCircle size={14} /> {successMessage}
                        </div>
                        {countdown !== null && (
                            <div className="text-emerald-600">Tự động thoát trong {countdown}s...</div>
                        )}
                    </div>
                )}

                <button
                    onClick={captureAndPunch}
                    disabled={!isModelsLoaded || !!successMessage || loading}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-200 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                    <Camera size={15} />
                    {loading ? 'Đang xử lý...' : successMessage ? 'Hoàn thành ✓' : 'Xác thực khuôn mặt'}
                </button>
            </div>
        </div>
    );
};

export default FacePunchModal;
