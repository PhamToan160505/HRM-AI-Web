import React, { useState, useEffect } from 'react';
import { UserSquare2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import Button from '../../components/common/Button';
import EmployeeProfileSummary from '../../components/employee/EmployeeProfileSummary';
import CccdScannerModal from '../../components/employee/CccdScannerModal';

export default function ProfilePage() {
    const { userId } = useAuth();
    const toast = useToast();
    
    const [myProfile, setMyProfile] = useState(null);
    const [myCccdImages, setMyCccdImages] = useState({ frontUrl: null, backUrl: null });
    const [isCccdModalOpen, setIsCccdModalOpen] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    const loadProfileData = async () => {
        setIsLoadingProfile(true);
        setMyProfile(null);
        setMyCccdImages({ frontUrl: null, backUrl: null });
        try {
            const [profileRes, cccdRes] = await Promise.all([
                api.get('/api/employees/me').catch(() => null),
                api.get(`/api/employees/${userId}/cccd-image-url`).catch(() => null)
            ]);
            
            if (profileRes?.data?.success) {
                setMyProfile(profileRes.data.data);
            }
            if (cccdRes?.data?.success) {
                setMyCccdImages({ frontUrl: cccdRes.data.data.frontUrl, backUrl: cccdRes.data.data.backUrl });
            }
        } catch (err) {
            console.error("Lỗi khi tải hồ sơ:", err);
            toast.show("Lỗi", "Không thể tải thông tin hồ sơ", "error");
        } finally {
            setIsLoadingProfile(false);
        }
    };

    useEffect(() => {
        if (userId) {
            loadProfileData();
        }
    }, [userId]);

    const handleUpdateProfileData = async (data) => {
        try {
            const res = await api.put('/api/employees/me', data);
            if(res.data.success) {
                setMyProfile(res.data.data);
                toast.show("Thành công", "Cập nhật thông tin thành công!", "success");
            }
        } catch (err) {
            toast.show("Lỗi", "Không thể cập nhật thông tin", "error");
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Hồ sơ cá nhân của tôi</h2>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                {isLoadingProfile ? (
                    <div className="py-8 text-center text-gray-500">Đang tải hồ sơ...</div>
                ) : myProfile ? (
                    <>
                        <div className="mb-4">
                            <EmployeeProfileSummary 
                                profile={myProfile} 
                                isEditable={true}
                                onUpdate={handleUpdateProfileData}
                            />
                        </div>

                        {!myProfile.cccdFrontPublicId && (
                            <div className="mt-8 flex justify-center pb-4">
                                <Button variant="primary" onClick={() => setIsCccdModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm text-white">
                                    <UserSquare2 size={18} /> Cập nhật hình ảnh CCCD bằng AI
                                </Button>
                            </div>
                        )}

                        {myProfile.cccdFrontPublicId && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col">
                                    <h3 className="font-semibold text-gray-700 mb-3 text-center border-b pb-2">Mặt trước CCCD</h3>
                                    <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg min-h-[200px] p-2">
                                        {myCccdImages.frontUrl ? (
                                            <img src={myCccdImages.frontUrl} alt="Mặt trước" className="max-w-full max-h-[250px] object-contain rounded-md shadow-sm" />
                                        ) : (
                                            <span className="text-gray-400 text-sm animate-pulse">Đang tải ảnh...</span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col">
                                    <h3 className="font-semibold text-gray-700 mb-3 text-center border-b pb-2">Mặt sau CCCD</h3>
                                    <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg min-h-[200px] p-2">
                                        {myCccdImages.backUrl ? (
                                            <img src={myCccdImages.backUrl} alt="Mặt sau" className="max-w-full max-h-[250px] object-contain rounded-md shadow-sm" />
                                        ) : (
                                            <span className="text-gray-400 text-sm animate-pulse">Đang tải ảnh...</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="py-8 text-center text-rose-500">Không tìm thấy thông tin hồ sơ.</div>
                )}
            </div>

            {/* CCCD Upload Modal */}
            <CccdScannerModal 
                isOpen={isCccdModalOpen}
                userId={userId} 
                onClose={() => setIsCccdModalOpen(false)} 
                onApply={async (result) => {
                    setIsCccdModalOpen(false);
                    const updateData = {};
                    if (result.cccd?.value) updateData.cccd = result.cccd.value;
                    if (result.dob?.value) updateData.ngaySinh = result.dob.value;
                    if (result.hometown?.value) updateData.queQuan = result.hometown.value;
                    if (result.address?.value) updateData.diaChi = result.address.value;
                    if (result.issueDate?.value) updateData.ngayCapCccd = result.issueDate.value;
                    if (result.issuePlace?.value) updateData.noiCapCccd = result.issuePlace.value;
                    if (result.frontPublicId) updateData.cccdFrontPublicId = result.frontPublicId;
                    if (result.backPublicId) updateData.cccdBackPublicId = result.backPublicId;
                    
                    if (Object.keys(updateData).length > 0) {
                        await handleUpdateProfileData(updateData);
                        loadProfileData(); // Reload profile info after successful update
                    }
                }} 
            />
        </div>
    );
}
