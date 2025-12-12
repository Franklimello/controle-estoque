import { useEffect } from "react";
import { X } from "lucide-react";

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  showConfirm = false,
  showCancel = true,
  confirmVariant = "primary", // primary, danger, success
  size = "md", // sm, md, lg, xl
  showCloseButton = true,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  const confirmButtonClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    success: "bg-green-600 hover:bg-green-700 text-white",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"></div>

      {/* Modal Ring Animation */}
      <div className="modal-ring text-blue-600 absolute">
        <i></i>
        <i></i>
        <i></i>
      </div>

      {/* Modal Content */}
      <div
        className={`relative bg-white rounded-xl shadow-2xl w-full ${sizeClasses[size]} transform transition-all`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {(showConfirm || showCancel) && (
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
              >
                {cancelText}
              </button>
            )}
            {showConfirm && (
              <button
                onClick={onConfirm}
                className={`action-button px-6 py-2 rounded-lg transition-all font-medium relative overflow-hidden ${confirmButtonClasses[confirmVariant]}`}
              >
                <div className="action-button-ring">
                  <i></i>
                </div>
                <span className="relative z-10">{confirmText}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;

