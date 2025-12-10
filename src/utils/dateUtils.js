import { VENCIMENTO_PROXIMO_DIAS } from "../config/constants";

/**
 * Verifica se uma data está próxima do vencimento
 * @param {string|Date|Timestamp} validade - Data de validade
 * @returns {Object} { isExpiring: boolean, daysUntilExpiry: number, isExpired: boolean }
 */
export const checkExpiringDate = (validade) => {
  if (!validade) {
    return { isExpiring: false, daysUntilExpiry: null, isExpired: false };
  }

  let expiryDate;
  
  // Converter para Date se for Timestamp do Firestore
  if (validade.toDate) {
    expiryDate = validade.toDate();
  } else if (typeof validade === 'string') {
    expiryDate = new Date(validade);
  } else if (validade instanceof Date) {
    expiryDate = validade;
  } else {
    return { isExpiring: false, daysUntilExpiry: null, isExpired: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);

  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isExpired = diffDays < 0;
  const isExpiring = !isExpired && diffDays <= VENCIMENTO_PROXIMO_DIAS;

  return {
    isExpiring,
    isExpired,
    daysUntilExpiry: diffDays
  };
};

/**
 * Formata data de validade para exibição
 * @param {string|Date|Timestamp} validade - Data de validade
 * @returns {string} Data formatada
 */
export const formatExpiryDate = (validade) => {
  if (!validade) return "Sem validade";

  let dateObj;
  if (validade.toDate) {
    dateObj = validade.toDate();
  } else if (typeof validade === 'string') {
    dateObj = new Date(validade);
  } else if (validade instanceof Date) {
    dateObj = validade;
  } else {
    return "Data inválida";
  }

  return dateObj.toLocaleDateString("pt-BR");
};


