import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  getItems,
  getItemsLowStock,
  getItemsExpiring,
} from "../services/items";
import {
  ESTOQUE_BAIXO_LIMITE,
  VENCIMENTO_PROXIMO_DIAS,
} from "../config/constants";
import { getErrorMessage } from "../utils/errorHandler";

const ItemsContext = createContext(null);

export const useItems = () => {
  const context = useContext(ItemsContext);
  if (!context) {
    throw new Error("useItems deve ser usado dentro de ItemsProvider");
  }
  return context;
};

// Cache com TTL de 2 minutos
const CACHE_TTL = 2 * 60 * 1000;

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

      const [itemsData, lowStock, expiring] = await Promise.all([
        getItems(),
        getItemsLowStock(ESTOQUE_BAIXO_LIMITE),
        getItemsExpiring(VENCIMENTO_PROXIMO_DIAS),
      ]);

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
    const handleInvalidateCache = () => {
      loadItems(true);
    };
    
    window.addEventListener('invalidateItemsCache', handleInvalidateCache);
    
    return () => {
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
