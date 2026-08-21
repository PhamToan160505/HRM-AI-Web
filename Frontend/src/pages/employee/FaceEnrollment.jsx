import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../services/api';
import Button from '../../components/common/Button';

const FaceEnrollment = ({ onSuccess, onCancel }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isModelsLoaded, setIsModelsLoaded] = useState(false);
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);

    // 1. Load models
    useEffect(() => {
        const loadModels = async () => {
            try {
                // Models should be placed in public/models
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

    const captureAndEnroll = async () => {
        if (!videoRef.current || !isModelsLoaded) return;
        
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Detect single face with landmarks and descriptor
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
            // Nếu bị tay che (khẩu trang, tay), AI sẽ không thể xác định rõ biểu cảm (không có biểu cảm nào > 80% chắc chắn)
            const expressions = detection.expressions;
            const maxExpression = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
            if (expressions[maxExpression] < 0.8) {
                setError("Vui lòng không che mặt hoặc đeo khẩu trang. Yêu cầu lộ rõ ngũ quan!");
                setLoading(false);
                return;
            }

            // Convert Float32Array to standard JS Array then to JSON String
            const descriptorArray = Array.from(detection.descriptor);
            const vectorJson = JSON.stringify(descriptorArray);

            // Send vector to backend (No image sent!)
            const response = await api.post('/api/employees/me/face-enroll', {
                embeddingVector: vectorJson
            });

            if (response.data.success) {
                setSuccessMessage("Đăng ký khuôn mặt thành công!");
                if (onSuccess) {
                    setTimeout(onSuccess, 1500); // Wait 1.5s then trigger callback
                }
            } else {
                setError(response.data.message || "Lỗi đăng ký khuôn mặt");
            }

        } catch (err) {
            console.error(err);
            setError("Có lỗi xảy ra khi xử lý khuôn mặt.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 max-w-lg mx-auto flex flex-col items-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-4 shadow-inner">
                <Camera size={28} strokeWidth={2} />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Đăng ký khuôn mặt AI</h2>
            <p className="text-sm text-gray-500 mb-6 px-4">
                Hệ thống chỉ trích xuất tọa độ sinh trắc học để chấm công, <strong className="text-gray-700">TUYỆT ĐỐI KHÔNG LƯU ẢNH</strong> theo Nghị định 13/2023/NĐ-CP.
            </p>

            <div className="relative w-full aspect-square max-w-[320px] bg-slate-900 rounded-3xl overflow-hidden shadow-lg border-4 border-slate-100 mb-6">
                {!isModelsLoaded ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-400 mb-4" />
                        <span className="text-sm font-medium">Đang khởi tạo AI...</span>
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
                        {/* Overlay frame guide */}
                        <div className="absolute inset-0 border-[6px] border-transparent border-dashed rounded-full pointer-events-none scale-[0.8] opacity-60 mix-blend-overlay"></div>
                    </>
                )}
            </div>

            {error && (
                <div className="w-full p-3 bg-red-50 text-red-600 text-sm rounded-lg mb-4 flex items-center justify-center gap-2 border border-red-100">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {successMessage && (
                <div className="w-full p-3 bg-emerald-50 text-emerald-600 text-sm rounded-lg mb-4 flex items-center justify-center gap-2 border border-emerald-100">
                    <CheckCircle size={16} /> {successMessage}
                </div>
            )}

            <div className="flex gap-3 w-full max-w-[320px]">
                <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={onCancel}
                >
                    Hủy
                </Button>
                <Button 
                    variant="primary" 
                    className="flex-1"
                    onClick={captureAndEnroll}
                    isLoading={loading}
                    disabled={!isModelsLoaded || successMessage}
                >
                    Đăng ký ngay
                </Button>
            </div>
        </div>
    );
};

export default FaceEnrollment;
