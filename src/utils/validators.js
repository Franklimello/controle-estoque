/**
 * Valida se um código de barras é válido (não vazio)
 * @param {string} codigo - Código de barras
 * @returns {boolean}
 */
export const isValidCodigo = (codigo) => {
  return codigo && codigo.trim().length > 0;
};

/**
 * Valida se uma quantidade é válida (número positivo)
 * @param {number} quantidade - Quantidade
 * @returns {boolean}
 */
export const isValidQuantidade = (quantidade) => {
  if (typeof quantidade !== 'number') return false;
  if (isNaN(quantidade) || !isFinite(quantidade)) return false;
  return quantidade > 0;
};

/**
 * Valida se um email é válido
 * @param {string} email - Email
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida se uma senha é válida (mínimo 6 caracteres)
 * @param {string} password - Senha
 * @returns {boolean}
 */
export const isValidPassword = (password) => {
  return password && password.length >= 6;
};

/**
 * Valida dados de um item
 * @param {Object} itemData - Dados do item
 * @returns {Object} { isValid: boolean, errors: Array }
 */
export const validateItem = (itemData) => {
  const errors = [];
  
  if (!itemData.nome || itemData.nome.trim().length === 0) {
    errors.push("Nome é obrigatório");
  }
  
  // Código de barras é opcional
  
  if (itemData.quantidade !== undefined && itemData.quantidade < 0) {
    errors.push("Quantidade não pode ser negativa");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Valida dados de uma entrada
 * @param {Object} entryData - Dados da entrada
 * @returns {Object} { isValid: boolean, errors: Array }
 */
export const validateEntry = (entryData) => {
  const errors = [];
  
  // Código é opcional, mas se não houver código, deve haver nome
  if ((!entryData.codigo || entryData.codigo.trim().length === 0) && 
      (!entryData.nome || entryData.nome.trim().length === 0)) {
    errors.push("Código de barras ou nome do item é obrigatório");
  }
  
  if (!isValidQuantidade(entryData.quantidade)) {
    errors.push("Quantidade deve ser um número positivo");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Valida dados de uma saída
 * @param {Object} exitData - Dados da saída
 * @returns {Object} { isValid: boolean, errors: Array }
 */
export const validateExit = (exitData) => {
  const errors = [];
  
  // Aceita código OU itemId
  if ((!exitData.codigo || exitData.codigo.trim().length === 0) && !exitData.itemId) {
    errors.push("Informe um código de barras ou selecione o item");
  }
  
  if (!isValidQuantidade(exitData.quantidade)) {
    errors.push("Quantidade deve ser um número positivo");
  }
  
  if (!exitData.setorDestino || exitData.setorDestino.trim().length === 0) {
    errors.push("Setor destino é obrigatório");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Formata data para exibição
 * @param {Timestamp|Date} date - Data
 * @returns {string} Data formatada
 */
export const formatDate = (date) => {
  if (!date) return "";
  
  let dateObj;
  if (date.toDate) {
    dateObj = date.toDate();
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return "";
  }
  
  return dateObj.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

/**
 * Exporta dados para CSV
 * @param {Array} data - Dados para exportar
 * @param {string} filename - Nome do arquivo
 * @param {Function} errorCallback - Callback de erro (opcional)
 */
export const exportToCSV = (data, filename = "export.csv", errorCallback) => {
  if (!data || data.length === 0) {
    if (errorCallback) {
      errorCallback("Nenhum dado para exportar");
    } else {
      alert("Nenhum dado para exportar");
    }
    return;
  }
  
  // Obter cabeçalhos
  const headers = Object.keys(data[0]);
  
  // Criar CSV
  let csv = headers.join(",") + "\n";
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return "";
      if (typeof value === 'object' && value.toDate) {
        return formatDate(value);
      }
      return String(value).replace(/"/g, '""');
    });
    csv += values.map(v => `"${v}"`).join(",") + "\n";
  });
  
  // Criar blob e download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

