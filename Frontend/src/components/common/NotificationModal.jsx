import React, { useContext } from 'react';
import { NotificationContext } from '../../context/NotificationContext';
import { AlertTriangle, X } from 'lucide-react';

const NotificationModal = () => {
  const { urgentNotification, closeUrgentModal } = useContext(NotificationContext);

  if (!urgentNotification) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div 
        className="fixed inset-0 bg-gray-900/75 backdrop-blur-sm transition-opacity" 
        onClick={closeUrgentModal}
      ></div>

      <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-red-100">
        <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
              <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg font-semibold leading-6 text-gray-900 pr-8">
                {urgentNotification.tieuDe}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {urgentNotification.noiDung}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 focus:outline-none"
            onClick={closeUrgentModal}
          >
            <span className="sr-only">Đóng</span>
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
          <button
            type="button"
            className="inline-flex w-full justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 sm:ml-3 sm:w-auto transition-colors"
            onClick={closeUrgentModal}
          >
            Đã hiểu
          </button>
          {urgentNotification.lienKet && (
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto transition-colors"
              onClick={() => {
                // Navigate to link logic here
                console.log('Navigate to:', urgentNotification.lienKet);
                closeUrgentModal();
              }}
            >
              Xem chi tiết
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
