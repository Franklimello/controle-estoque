import { useEffect, useRef } from "react";
import Modal from "./Modal";
import { AlertTriangle, X, Check } from "lucide-react";

/**
 * Modal de confirmação acessível
 * @param {Object} props
 * @param {boolean} props.isOpen - Se o modal está aberto
 * @param {Function} props.onClose - Função chamada ao fechar
 * @param {Function} props.onConfirm - Função chamada ao confirmar
 * @param {string} props.title - Título do modal
 * @param {string} props.message - Mensagem do modal
 * @param {string} [props.confirmText] - Texto do botão de confirmação (padrão: "Confirmar")
 * @param {string} [props.cancelText] - Texto do botão de cancelamento (padrão: "Cancelar")
 * @param {string} [props.variant] - Variante do modal ("warning" | "danger" | "info") (padrão: "warning")
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "warning",
}) => {
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      // Focar no botão de confirmação quando o modal abrir
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  const variantStyles = {
    warning: {
      icon: AlertTriangle,
      iconColor: "text-yellow-600",
      iconBg: "bg-yellow-100",
      button: "bg-yellow-600 hover:bg-yellow-700",
    },
    danger: {
      icon: AlertTriangle,
      iconColor: "text-red-600",
      iconBg: "bg-red-100",
      button: "bg-red-600 hover:bg-red-700",
    },
    info: {
      icon: AlertTriangle,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100",
      button: "bg-blue-600 hover:bg-blue-700",
    },
  };

  const styles = variantStyles[variant] || variantStyles.warning;
  const Icon = styles.icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${styles.iconColor}`} aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2
              id="confirm-title"
              className="text-xl font-bold text-gray-800 mb-2"
            >
              {title}
            </h2>
            <p
              id="confirm-message"
              className="text-gray-600 whitespace-pre-line"
            >
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.button} focus:ring-${variant === "warning" ? "yellow" : variant === "danger" ? "red" : "blue"}-500`}
          >
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              {confirmText}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;

