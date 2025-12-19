/**
 * Utilitário para busca fuzzy (tolerante a erros de digitação)
 */

/**
 * Remove acentos e normaliza string para comparação
 * @param {string} str - String a ser normalizada
 * @returns {string} String normalizada
 */
const normalizeString = (str) => {
  if (!str) return "";
  
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\s]/g, "") // Remove caracteres especiais
    .trim();
};

/**
 * Calcula a similaridade entre duas strings usando Levenshtein
 * @param {string} str1 - Primeira string
 * @param {string} str2 - Segunda string
 * @returns {number} Similaridade (0-1, onde 1 é idêntico)
 */
const calculateSimilarity = (str1, str2) => {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Se uma string contém a outra, alta similaridade
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return minLen / maxLen;
  }
  
  // Distância de Levenshtein simplificada
  const matrix = [];
  const len1 = s1.length;
  const len2 = s2.length;
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Deletion
        matrix[i][j - 1] + 1,      // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
};

/**
 * Verifica se uma string corresponde ao termo de busca com tolerância a erros
 * @param {string} text - Texto a ser verificado
 * @param {string} searchTerm - Termo de busca
 * @param {number} minSimilarity - Similaridade mínima (0-1, padrão: 0.6)
 * @returns {boolean} true se corresponder
 */
export const fuzzyMatch = (text, searchTerm, minSimilarity = 0.6) => {
  if (!text || !searchTerm) return false;
  
  const normalizedText = normalizeString(text);
  const normalizedSearch = normalizeString(searchTerm);
  
  // Busca exata (case-insensitive, sem acentos)
  if (normalizedText.includes(normalizedSearch)) {
    return true;
  }
  
  // Busca por palavras individuais
  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 0);
  const textWords = normalizedText.split(/\s+/).filter(w => w.length > 0);
  
  // Se todas as palavras do termo de busca estão no texto
  if (searchWords.every(word => 
    textWords.some(textWord => textWord.includes(word) || word.includes(textWord))
  )) {
    return true;
  }
  
  // Calcula similaridade geral
  const similarity = calculateSimilarity(text, searchTerm);
  if (similarity >= minSimilarity) {
    return true;
  }
  
  // Busca por similaridade em palavras individuais
  for (const searchWord of searchWords) {
    for (const textWord of textWords) {
      if (calculateSimilarity(textWord, searchWord) >= minSimilarity) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Busca fuzzy em múltiplos campos
 * @param {Object} item - Item a ser verificado
 * @param {string} searchTerm - Termo de busca
 * @param {Array<string>} fields - Campos a serem verificados (padrão: ['nome', 'codigo', 'categoria'])
 * @param {number} minSimilarity - Similaridade mínima (padrão: 0.6)
 * @returns {boolean} true se algum campo corresponder
 */
export const fuzzySearch = (item, searchTerm, fields = ['nome', 'codigo', 'categoria'], minSimilarity = 0.6) => {
  if (!searchTerm || !item) return false;
  
  return fields.some(field => {
    const fieldValue = item[field];
    if (!fieldValue) return false;
    return fuzzyMatch(String(fieldValue), searchTerm, minSimilarity);
  });
};

/**
 * Ordena resultados por relevância (mais similares primeiro)
 * @param {Array} items - Array de itens
 * @param {string} searchTerm - Termo de busca
 * @param {Array<string>} fields - Campos a serem verificados
 * @returns {Array} Array ordenado por relevância
 */
export const sortByRelevance = (items, searchTerm, fields = ['nome', 'codigo', 'categoria']) => {
  if (!searchTerm) return items;
  
  const normalizedSearch = normalizeString(searchTerm);
  
  return items.map(item => {
    let maxSimilarity = 0;
    
    fields.forEach(field => {
      const fieldValue = item[field];
      if (fieldValue) {
        const similarity = calculateSimilarity(String(fieldValue), searchTerm);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    });
    
    return { item, similarity: maxSimilarity };
  })
  .sort((a, b) => b.similarity - a.similarity)
  .map(({ item }) => item);
};






