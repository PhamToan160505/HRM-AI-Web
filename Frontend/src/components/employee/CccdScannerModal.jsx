import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, UploadCloud, CheckCircle, AlertCircle, X, ShieldCheck, Loader2 } from 'lucide-react';
import api from '../../services/api';
import Button from '../common/Button';

const CccdScannerModal = ({ isOpen, onClose, onApply }) => {
    const [frontImage, setFrontImage] = useState(null);
    const [backImage, setBackImage] = useState(null);
    const [isAgreed, setIsAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const isProcessing = useRef(false);

    const handleFileChange = (e, side) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (side === 'front') setFrontImage(reader.result);
                else setBackImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleScan = async () => {
        if (!frontImage || !backImage) {
            setError("Vui lòng tải lên đầy đủ 2 mặt CCCD");
            return;
        }
        if (!isAgreed) {
            setError("Vui lòng đồng ý với điều khoản bảo mật");
            return;
        }
        
        if (isProcessing.current) return;
        isProcessing.current = true;
        
        setError(null);
        setLoading(true);
        
        // Nhường luồng để React có thể render spinner trước khi stringify base64 lớn làm đơ UI
        await new Promise(resolve => setTimeout(resolve, 50));
        
        try {
            const response = await api.post('/api/employees/me/extract-cccd', {
                frontBase64: frontImage,
                backBase64: backImage
            });
            
            if (response.data.success) {
                // Parse the inner JSON string if it comes back as a string, else use as object
                let data = response.data.data;
                if (typeof data === 'string') {
                    data = JSON.parse(data);
                }
                setResult(data);
            } else {
                setError(response.data.message || "Bóc tách thất bại");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Lỗi kết nối đến máy chủ AI");
        } finally {
            setLoading(false);
            isProcessing.current = false;
        }
    };

    const handleApply = () => {
        if (result) {
            onApply(result);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                <ShieldCheck size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">Quét Căn Cước Công Dân bằng AI</h2>
                                <p className="text-sm text-gray-500">Hệ thống sẽ bóc tách dữ liệu tự động thay vì nhập tay</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto custom-scrollbar relative min-h-[300px]">
                        {loading && (
                            <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
                                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Hệ thống AI đang phân tích dữ liệu...</h3>
                                <p className="text-sm text-gray-500 text-center max-w-sm">
                                    Quá trình bóc tách chữ từ hình ảnh CCCD có thể mất tới <span className="font-semibold text-blue-600">10-15 giây</span> do ảnh dung lượng lớn.<br/>Vui lòng đợi và không đóng cửa sổ này.
                                </p>
                            </div>
                        )}
                        <div className="mb-6 bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <div className="mt-1">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        checked={isAgreed}
                                        onChange={(e) => setIsAgreed(e.target.checked)}
                                    />
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    Tôi xác nhận đã được sự đồng ý của chủ thể dữ liệu về việc cung cấp thông tin Căn cước công dân. Hệ thống cam kết không lưu trữ hình ảnh CCCD vĩnh viễn trên máy chủ, tuân thủ Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân.
                                </p>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            {/* Mặt trước */}
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-700 mb-2">Ảnh mặt trước CCCD <span className="text-red-500">*</span></span>
                                <label className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-all overflow-hidden group">
                                    {frontImage ? (
                                        <img src={frontImage} alt="Mặt trước" className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <UploadCloud className="w-10 h-10 mb-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                            <p className="mb-2 text-sm text-gray-500"><span className="font-semibold text-blue-600">Bấm để chọn</span> hoặc kéo thả</p>
                                            <p className="text-xs text-gray-400">PNG, JPG, JPEG (Tối đa 5MB)</p>
                                        </div>
                                    )}
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'front')} />
                                </label>
                            </div>

                            {/* Mặt sau */}
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-700 mb-2">Ảnh mặt sau CCCD <span className="text-red-500">*</span></span>
                                <label className="relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-all overflow-hidden group">
                                    {backImage ? (
                                        <img src={backImage} alt="Mặt sau" className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <UploadCloud className="w-10 h-10 mb-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
                                            <p className="mb-2 text-sm text-gray-500"><span className="font-semibold text-blue-600">Bấm để chọn</span> hoặc kéo thả</p>
                                            <p className="text-xs text-gray-400">PNG, JPG, JPEG (Tối đa 5MB)</p>
                                        </div>
                                    )}
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'back')} />
                                </label>
                            </div>
                        </div>

                        {error && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{error}</p>
                            </motion.div>
                        )}

                        {result && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
                                <div className="flex items-center gap-2 mb-4 text-emerald-700">
                                    <CheckCircle className="w-5 h-5" />
                                    <h3 className="font-semibold">AI đã bóc tách xong 9 trường thông tin</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                                    <ResultRow label="Số CCCD" value={result.cccd?.value} confidence={result.cccd?.confidenceScore} />
                                    <ResultRow label="Họ và tên" value={result.fullName?.value} confidence={result.fullName?.confidenceScore} />
                                    <ResultRow label="Giới tính" value={result.gender?.value} confidence={result.gender?.confidenceScore} />
                                    <ResultRow label="Ngày sinh" value={result.dob?.value} confidence={result.dob?.confidenceScore} />
                                    <ResultRow label="Ngày cấp" value={result.issueDate?.value} confidence={result.issueDate?.confidenceScore} />
                                    <ResultRow label="Ngày hết hạn" value={result.expiryDate?.value} confidence={result.expiryDate?.confidenceScore} />
                                    <ResultRow label="Nơi cấp" value={result.issuePlace?.value} confidence={result.issuePlace?.confidenceScore} />
                                    <ResultRow label="Quê quán" value={result.hometown?.value} confidence={result.hometown?.confidenceScore} />
                                    <ResultRow label="Địa chỉ" value={result.address?.value} confidence={result.address?.confidenceScore} />
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                        <Button variant="outline" onClick={onClose}>Hủy bỏ</Button>
                        
                        {!result ? (
                            <Button 
                                variant="primary" 
                                onClick={handleScan}
                                isLoading={loading}
                                disabled={!frontImage || !backImage || !isAgreed}
                                className="min-w-[140px]"
                            >
                                <span className="flex items-center gap-2">
                                    <Camera size={18} />
                                    Bắt đầu quét
                                </span>
                            </Button>
                        ) : (
                            <Button variant="primary" onClick={handleApply}>
                                Áp dụng dữ liệu vào Form
                            </Button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

const ResultRow = ({ label, value, confidence }) => {
    if (!value) return null;
    return (
        <div className="flex flex-col">
            <span className="text-xs text-emerald-600/70 mb-1">{label}</span>
            <div className="flex items-center justify-between bg-white/60 px-3 py-2 rounded-lg border border-emerald-100/50">
                <span className="text-sm font-medium text-emerald-900 truncate" title={value}>{value}</span>
                {confidence && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidence >= 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {confidence}%
                    </span>
                )}
            </div>
        </div>
    );
};

export default CccdScannerModal;
