/**
 * Cache simples para buscas de itens individuais
 * Reduz queries ao banco de dados
 */

// Cache com TTL de 1 minuto para buscas individuais
const ITEM_CACHE_TTL = 60 * 1000;
const itemCache = new Map();

/**
 * Limpa o cache de um item específico ou de todos
 * @param {string} itemId - ID do item (opcional, se não fornecido limpa tudo)
 */
export const clearItemCache = (itemId = null) => {
  if (itemId) {
    itemCache.delete(itemId);
  } else {
    itemCache.clear();
  }
};

/**
 * Obtém item do cache se ainda válido
 * @param {string} key - Chave do cache (itemId ou codigo)
 * @returns {Object|null} Item do cache ou null
 */
const getCachedItem = (key) => {
  const cached = itemCache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > ITEM_CACHE_TTL) {
    itemCache.delete(key);
    return null;
  }
  
  return cached.data;
};

/**
 * Armazena item no cache
 * @param {string} key - Chave do cache
 * @param {Object} data - Dados do item
 */
const setCachedItem = (key, data) => {
  itemCache.set(key, {
    data,
    timestamp: Date.now(),
  });
};

/**
 * Wrapper para getItemByCodigo com cache
 */
export const getItemByCodigoCached = async (codigo, getItemByCodigoFn) => {
  if (!codigo || codigo.trim().length === 0) {
    return null;
  }

  const cacheKey = `codigo_${codigo}`;
  const cached = getCachedItem(cacheKey);
  if (cached) {
    return cached;
  }

  const item = await getItemByCodigoFn(codigo);
  if (item) {
    setCachedItem(cacheKey, item);
    // Também cachear por ID
    setCachedItem(item.id, item);
  }
  return item;
};

/**
 * Wrapper para getItemById com cache
 */
export const getItemByIdCached = async (itemId, getItemByIdFn) => {
  if (!itemId) {
    return null;
  }

  const cached = getCachedItem(itemId);
  if (cached) {
    return cached;
  }

  const item = await getItemByIdFn(itemId);
  if (item) {
    setCachedItem(itemId, item);
    // Também cachear por código se tiver
    if (item.codigo) {
      setCachedItem(`codigo_${item.codigo}`, item);
    }
  }
  return item;
};

/**
 * Limpa cache quando itens são atualizados
 */
export const invalidateItemCache = (itemId = null) => {
  clearItemCache(itemId);
};

