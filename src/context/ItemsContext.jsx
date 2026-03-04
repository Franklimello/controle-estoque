import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  getItems,
} from "../services/items";
import {
  ESTOQUE_BAIXO_LIMITE,
} from "../config/constants";
import { getErrorMessage } from "../utils/errorHandler";
import { checkExpiringDate } from "../utils/dateUtils";

const ItemsContext = createContext(null);

export const useItems = () => {
  const context = useContext(ItemsContext);
  if (!context) {
    throw new Error("useItems deve ser usado dentro de ItemsProvider");
  }
  return context;
};

// Cache com TTL de 5 minutos (otimizado para reduzir queries)
const CACHE_TTL = 5 * 60 * 1000;

const parseLocalValidity = (validade) => {
  if (!validade || validade === "sem-validade") return null;
  if (validade?.toDate) return validade.toDate();
  if (validade instanceof Date) return validade;
  if (typeof validade === "string") {
    const parsed = new Date(`${validade}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const pickEarliestValidity = (current, incoming) => {
  const currentDate = parseLocalValidity(current);
  const incomingDate = parseLocalValidity(incoming);
  if (!incomingDate) return current || null;
  if (!currentDate) return incoming;
  return incomingDate < currentDate ? incoming : current;
};

const buildConsolidatedItems = (itemsData) => {
  const consolidatedMap = new Map();

  itemsData.forEach((item) => {
    const isExpanded = Boolean(item.isExpanded && item.originalItemId);
    const consolidatedId = isExpanded ? item.originalItemId : item.id;
    const existing = consolidatedMap.get(consolidatedId);
    const itemQty = Number(item.quantidade || 0);

    if (!existing) {
      consolidatedMap.set(consolidatedId, {
        ...item,
        id: consolidatedId,
        quantidade: itemQty,
        validade: item.validade || null,
      });
      return;
    }

    if (isExpanded) {
      existing.quantidade = Number(existing.quantidade || 0) + itemQty;
      existing.validade = pickEarliestValidity(existing.validade, item.validade);
    }
  });

  return Array.from(consolidatedMap.values());
};

export const ItemsProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [expiringItems, setExpiringItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef({ data: null, timestamp: null });

  const loadItems = async (forceRefresh = false) => {
    try {
      const now = Date.now();
      const cache = cacheRef.current;

      // Verificar cache se não for refresh forçado
      if (!forceRefresh && cache.data && cache.timestamp && (now - cache.timestamp) < CACHE_TTL) {
        setItems(cache.data.items);
        setLowStockItems(cache.data.lowStock);
        setExpiringItems(cache.data.expiring);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      const itemsData = await getItems();
      const consolidatedItems = buildConsolidatedItems(itemsData);
      const lowStock = consolidatedItems.filter(
        (item) =>
          Number(item.quantidade || 0) > 0 &&
          Number(item.quantidade || 0) < ESTOQUE_BAIXO_LIMITE
      );
      const expiring = consolidatedItems.filter((item) => {
        const expiryInfo = checkExpiringDate(item.validade);
        return expiryInfo.isExpiring;
      });

      // Atualizar cache
      cacheRef.current = {
        data: {
          items: itemsData,
          lowStock,
          expiring,
        },
        timestamp: now,
      };

      setItems(itemsData);
      setLowStockItems(lowStock);
      setExpiringItems(expiring);
      setError(null);
    } catch (error) {
      console.error("Erro ao carregar itens:", error);
      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    
    // 🔄 Listener para invalidar cache automaticamente após operações
    // Usa debounce para evitar múltiplas atualizações em sequência
    let invalidateTimeout = null;
    const handleInvalidateCache = () => {
      if (invalidateTimeout) {
        clearTimeout(invalidateTimeout);
      }
      // Debounce de 500ms - agrupa múltiplas invalidações
      invalidateTimeout = setTimeout(() => {
        loadItems(true);
      }, 500);
    };
    
    window.addEventListener('invalidateItemsCache', handleInvalidateCache);
    
    return () => {
      if (invalidateTimeout) {
        clearTimeout(invalidateTimeout);
      }
      window.removeEventListener('invalidateItemsCache', handleInvalidateCache);
    };
  }, []);

  const refreshItems = () => loadItems(true);

  return (
    <ItemsContext.Provider
      value={{
        items,
        lowStockItems,
        expiringItems,
        loading,
        error,
        refreshItems,
      }}
    >
      {children}
    </ItemsContext.Provider>
  );
};
