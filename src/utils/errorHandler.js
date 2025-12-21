/**
 * Utilitário para tratamento de erros com mensagens amigáveis
 */

/**
 * Traduz erros do Firebase para mensagens amigáveis em português
 * @param {Error} error - Objeto de erro
 * @returns {string} Mensagem de erro traduzida
 */
export const getErrorMessage = (error) => {
  if (!error) return "Ocorreu um erro desconhecido";

  const errorCode = error.code || error.message || "";
  const errorMessage = error.message || "";

  // Erros do Firebase Auth
  if (errorCode.includes("auth/")) {
    const authErrors = {
      "auth/user-not-found": "Usuário não encontrado",
      "auth/wrong-password": "Senha incorreta",
      "auth/email-already-in-use": "Este email já está em uso",
      "auth/weak-password": "A senha é muito fraca",
      "auth/invalid-email": "Email inválido",
      "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde",
      "auth/network-request-failed": "Erro de conexão. Verifique sua internet",
      "auth/user-disabled": "Esta conta foi desativada",
    };

    for (const [key, value] of Object.entries(authErrors)) {
      if (errorCode.includes(key) || errorMessage.includes(key)) {
        return value;
      }
    }
  }

  // Erros do Firestore
  if (errorCode.includes("permission-denied") || errorMessage.includes("permission")) {
    return "Você não tem permissão para realizar esta ação";
  }

  if (errorCode.includes("unavailable") || errorMessage.includes("unavailable")) {
    return "Serviço temporariamente indisponível. Tente novamente em alguns instantes";
  }

  if (errorCode.includes("deadline-exceeded") || errorMessage.includes("deadline")) {
    return "A operação demorou muito. Tente novamente";
  }

  if (errorCode.includes("not-found") || errorMessage.includes("not found")) {
    return "Item não encontrado";
  }

  if (errorCode.includes("already-exists") || errorMessage.includes("already exists")) {
    return "Este item já existe";
  }

  if (errorCode.includes("failed-precondition") || errorMessage.includes("precondition")) {
    return "Operação não pode ser realizada no momento. Verifique os dados e tente novamente";
  }

  if (errorCode.includes("index") || errorMessage.includes("index")) {
    return "Índice do banco de dados não encontrado. Entre em contato com o administrador";
  }

  // Erros genéricos
  if (errorMessage.includes("network") || errorMessage.includes("Network")) {
    return "Erro de conexão. Verifique sua internet e tente novamente";
  }

  if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
    return "A operação demorou muito. Tente novamente";
  }

  // Se não encontrou nenhum padrão, retorna mensagem genérica ou a mensagem original
  if (errorMessage && errorMessage.length < 200) {
    return errorMessage;
  }

  return "Ocorreu um erro. Por favor, tente novamente ou entre em contato com o suporte";
};

/**
 * Loga erros de forma estruturada
 * @param {string} context - Contexto onde o erro ocorreu
 * @param {Error} error - Objeto de erro
 * @param {Object} additionalData - Dados adicionais para log
 */
export const logError = (context, error, additionalData = {}) => {
  console.error(`[${context}]`, {
    error: error.message || error,
    code: error.code,
    stack: error.stack,
    ...additionalData,
  });
};










