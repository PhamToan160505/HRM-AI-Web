import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import Button from './Button';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Xác nhận", cancelText = "Hủy", type = "warning" }) {
    if (!isOpen) return null;

    const Icon = type === 'warning' ? AlertCircle : AlertCircle;
    const iconColor = type === 'warning' ? 'text-amber-500' : 'text-blue-500';
    const confirmButtonClass = type === 'warning' 
        ? "bg-amber-500 hover:bg-amber-600 text-white" 
        : "bg-blue-600 hover:bg-blue-700 text-white";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-start gap-4 p-6">
                    <div className={`p-2 bg-${type === 'warning' ? 'amber' : 'blue'}-50 rounded-full shrink-0`}>
                        <Icon size={24} className={iconColor} />
                    </div>
                    <div className="flex-1 pt-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                        <p className="text-gray-600">{message}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50/50 border-t border-gray-100">
                    <Button variant="ghost" onClick={onClose} className="text-gray-600 hover:bg-gray-200 hover:text-gray-900">
                        {cancelText}
                    </Button>
                    <Button variant="primary" className={confirmButtonClass} onClick={() => { onConfirm(); onClose(); }}>
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
