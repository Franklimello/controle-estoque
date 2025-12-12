import { createContext, useContext, useState, useEffect } from "react";
import {
  getItems,
  getItemsLowStock,
  getItemsExpiring,
} from "../services/items";
import {
  ESTOQUE_BAIXO_LIMITE,
  VENCIMENTO_PROXIMO_DIAS,
} from "../config/constants";

const ItemsContext = createContext(null);

export const useItems = () => {
  const context = useContext(ItemsContext);
  if (!context) {
    throw new Error("useItems deve ser usado dentro de ItemsProvider");
  }
  return context;
};

export const ItemsProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [expiringItems, setExpiringItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadItems = async () => {
    try {
      setLoading(true);

      const itemsData = await getItems();
      setItems(itemsData);

      const lowStock = await getItemsLowStock(ESTOQUE_BAIXO_LIMITE);
      setLowStockItems(lowStock);

      const expiring = await getItemsExpiring(VENCIMENTO_PROXIMO_DIAS);
      setExpiringItems(expiring);
    } catch (error) {
      console.error("Erro ao carregar itens:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const refreshItems = () => loadItems();

  return (
    <ItemsContext.Provider
      value={{
        items,
        lowStockItems,
        expiringItems,
        loading,
        refreshItems,
      }}
    >
      {children}
    </ItemsContext.Provider>
  );
};
