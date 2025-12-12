import { VENCIMENTO_PROXIMO_DIAS } from "../config/constants";

/**
 * Verifica se uma data está próxima do vencimento
 * @param {string|Date|Timestamp} validade - Data de validade
 * @returns {Object} { isExpiring: boolean, daysUntilExpiry: number, isExpired: boolean }
 */
const parseLocalDate = (validade) => {
  if (!validade) return null;

  if (validade.toDate) {
    return validade.toDate();
  }

  if (typeof validade === "string") {
    // Evita conversão para UTC que desloca um dia em fuso -3
    return new Date(`${validade}T00:00:00`);
  }

  if (validade instanceof Date) {
    return validade;
  }

  return null;
};

export const checkExpiringDate = (validade) => {
  const expiryDate = parseLocalDate(validade);
  if (!expiryDate || Number.isNaN(expiryDate.getTime())) {
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
    daysUntilExpiry: diffDays,
  };
};

/**
 * Formata data de validade para exibição
 * @param {string|Date|Timestamp} validade - Data de validade
 * @returns {string} Data formatada
 */
export const formatExpiryDate = (validade) => {
  if (!validade) return "Sem validade";

  const dateObj = parseLocalDate(validade);
  if (!dateObj || Number.isNaN(dateObj.getTime())) return "Data inválida";

  return dateObj.toLocaleDateString("pt-BR");
};


