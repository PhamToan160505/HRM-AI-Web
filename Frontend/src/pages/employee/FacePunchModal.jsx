import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, CheckCircle, AlertCircle, Loader2, MapPin, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { getAttendanceWindowState } from '../../utils/attendanceTime';

let faceModelsPromise = null;

const loadFaceModels = () => {
    if (!faceModelsPromise) {
        faceModelsPromise = Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
            faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]).catch((error) => {
            faceModelsPromise = null;
            throw error;
        });
    }
    return faceModelsPromise;
};

const getLocationErrorMessage = (error) => {
    if (error?.code === 1) return 'Chưa được cấp quyền vị trí. Hãy cho phép Location trong trình duyệt.';
    if (error?.code === 2) return 'Thiết bị chưa xác định được vị trí hiện tại.';
    if (error?.code === 3) return 'Lấy vị trí quá thời gian. Bạn có thể thử lại.';
    return 'Không thể lấy vị trí hiện tại.';
};

const resolveCurrentLocation = async () => {
    if (!navigator.geolocation) {
        return {
            locationName: 'Không thể lấy vị trí',
            status: 'error',
            message: 'Trình duyệt này không hỗ trợ định vị.'
        };
    }

    let position;
    try {
        position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 60000
            });
        });
    } catch (error) {
        return {
            locationName: 'Không thể lấy vị trí',
            status: 'error',
            message: getLocationErrorMessage(error)
        };
    }

    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const coordinates = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=vi`,
            { signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Reverse geocoding failed: ${response.status}`);

        const data = await response.json();
        return {
            locationName: data.display_name || coordinates,
            status: 'success',
            message: 'Đã lấy được vị trí.'
        };
    } catch {
        return {
            locationName: coordinates,
            status: 'warning',
            message: 'Đã lấy tọa độ; không thể tải tên địa chỉ.'
        };
    } finally {
        clearTimeout(timeoutId);
    }
};

const FacePunchModal = ({ onSuccess, onCancel }) => {
    const videoRef = useRef(null);
    const [isModelsLoaded, setIsModelsLoaded] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const [locationState, setLocationState] = useState({
        status: 'loading',
        message: 'Đang lấy vị trí...'
    });
    const isPunching = useRef(false);
    const locationPromiseRef = useRef(null);

    const startLocationLookup = useCallback(() => {
        setLocationState({ status: 'loading', message: 'Đang lấy vị trí...' });
        const locationPromise = resolveCurrentLocation();
        locationPromiseRef.current = locationPromise;
        locationPromise.then(({ status, message }) => {
            setLocationState({ status, message });
        });
        return locationPromise;
    }, []);

    // 1. Load models
    useEffect(() => {
        const loadModels = async () => {
            try {
                await loadFaceModels();
                setIsModelsLoaded(true);
            } catch (err) {
                console.error("Lỗi tải AI models:", err);
                setError("Không thể khởi tạo mô hình AI nhận diện khuôn mặt.");
            }
        };
        loadModels();
    }, []);

    // Lấy vị trí ngay khi mở modal để không phải chờ sau khi nhận diện khuôn mặt.
    useEffect(() => {
        startLocationLookup();
    }, [startLocationLookup]);

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

        const attendanceWindow = getAttendanceWindowState();
        if (!attendanceWindow.allowed) {
            setError(attendanceWindow.message);
            return;
        }
        
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

            // GPS đã được khởi chạy song song ngay khi mở modal. Nếu dịch vụ đổi
            // tọa độ thành địa chỉ lỗi, locationName vẫn giữ tọa độ gốc.
            const locationResult = await (locationPromiseRef.current || startLocationLookup());
            const locationName = locationResult.locationName;

            const response = await api.post('/api/attendance/punch', {
                embeddingVector: vectorJson,
                location: locationName
            });

            if (response.data.success) {
                setSuccessMessage(
                    locationResult.status === 'error'
                        ? 'Chấm công thành công! Chưa ghi nhận được vị trí.'
                        : 'Chấm công thành công! Đã ghi nhận vị trí.'
                );
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

                <div className={`w-full p-2.5 text-xs rounded-lg mb-3 flex items-center gap-2 border text-left ${
                    locationState.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        : locationState.status === 'warning'
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : locationState.status === 'error'
                                ? 'bg-red-50 text-red-600 border-red-100'
                                : 'bg-blue-50 text-blue-700 border-blue-100'
                }`}>
                    {locationState.status === 'loading' ? (
                        <Loader2 size={14} className="shrink-0 animate-spin" />
                    ) : (
                        <MapPin size={14} className="shrink-0" />
                    )}
                    <span className="flex-1">{locationState.message}</span>
                    {locationState.status === 'error' && (
                        <button
                            type="button"
                            onClick={startLocationLookup}
                            className="shrink-0 inline-flex items-center gap-1 font-semibold hover:text-red-800"
                        >
                            <RefreshCw size={12} /> Thử lại
                        </button>
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
