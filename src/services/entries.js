import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { addItem, getItemByCodigo, incrementStock, updateItem } from "./items";
import {
  addOrIncrementBatch,
  getEarliestBatchValidity,
} from "./batches";

const ENTRIES_COLLECTION = "entries";

/**
 * Adiciona uma entrada e atualiza o estoque usando transaction
 * @param {Object} entryData - Dados da entrada
 * @param {string} userId - ID do usuário que registrou
 * @returns {Promise<string>} ID da entrada criada
 */
export const addEntry = async (entryData, userId) => {
  try {
    // Validar quantidade
    if (!entryData.quantidade || entryData.quantidade <= 0) {
      throw new Error("Quantidade deve ser maior que zero");
    }
    
    // Validar nome se não houver código
    if ((!entryData.codigo || entryData.codigo.trim().length === 0) && 
        (!entryData.nome || entryData.nome.trim().length === 0)) {
      throw new Error("Nome do item é obrigatório quando não há código de barras");
    }
    
    let item = null;
    
    // Se houver código, buscar por código
    if (entryData.codigo && entryData.codigo.trim().length > 0) {
      item = await getItemByCodigo(entryData.codigo);
    }
    
    // Se item não existir, criar automaticamente
    if (!item) {
      if (!entryData.nome || entryData.nome.trim().length === 0) {
        throw new Error("Nome do item é obrigatório para criar novo item");
      }
      
      const newItemData = {
        nome: entryData.nome,
        codigo: entryData.codigo && entryData.codigo.trim().length > 0 ? entryData.codigo : "",
        categoria: entryData.categoria || "",
        unidade: entryData.unidade || "UN",
        local: entryData.local || "",
        fornecedor: entryData.fornecedor || "",
        validade: entryData.validade || null,
        quantidade: 0
      };
      
      const itemId = await addItem(newItemData);
      
      // Buscar o item criado
      if (entryData.codigo && entryData.codigo.trim().length > 0) {
        item = await getItemByCodigo(entryData.codigo);
      } else {
        // Se não tem código, buscar pelo ID
        const { getItemById } = await import("./items");
        item = await getItemById(itemId);
      }
      
      if (!item) {
        throw new Error("Erro ao criar item. Tente novamente.");
      }
    }
    
    // Incrementar estoque total do item
    await incrementStock(item.id, entryData.quantidade);
    
    // Incrementar lote por validade
    if (!entryData.validade) {
      throw new Error("Validade é obrigatória para registrar o lote");
    }
    await addOrIncrementBatch(item.id, entryData.validade, entryData.quantidade);
    
    // Atualizar validade do item para a menor validade dos lotes
    const earliestValidity = await getEarliestBatchValidity(item.id);
    await updateItem(item.id, { validade: earliestValidity });
    
    // Registrar entrada
    const entryRef = await addDoc(collection(db, ENTRIES_COLLECTION), {
      itemId: item.id,
      codigo: entryData.codigo && entryData.codigo.trim().length > 0 ? entryData.codigo : "",
      quantidade: entryData.quantidade,
      fornecedor: entryData.fornecedor || "",
      observacao: entryData.observacao || "",
      data: entryData.data || serverTimestamp(),
      usuarioQueRegistrou: userId,
      createdAt: serverTimestamp()
    });
    
    return entryRef.id;
  } catch (error) {
    console.error("Erro ao adicionar entrada:", error);
    throw error;
  }
};

/**
 * Busca todas as entradas
 * @returns {Promise<Array>} Lista de entradas
 */
export const getEntries = async () => {
  try {
    const q = query(
      collection(db, ENTRIES_COLLECTION),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Erro ao buscar entradas:", error);
    throw error;
  }
};

/**
 * Busca entradas por código
 * @param {string} codigo - Código de barras
 * @returns {Promise<Array>} Lista de entradas
 */
export const getEntriesByCodigo = async (codigo) => {
  try {
    const q = query(
      collection(db, ENTRIES_COLLECTION),
      where("codigo", "==", codigo),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Erro ao buscar entradas por código:", error);
    throw error;
  }
};

/**
 * Busca entradas do dia
 * @param {Date} date - Data (opcional, padrão: hoje)
 * @returns {Promise<Array>} Lista de entradas do dia
 */
export const getEntriesByDate = async (date = new Date()) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const q = query(
      collection(db, ENTRIES_COLLECTION),
      where("data", ">=", Timestamp.fromDate(startOfDay)),
      where("data", "<=", Timestamp.fromDate(endOfDay)),
      orderBy("data", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Erro ao buscar entradas por data:", error);
    throw error;
  }
};

/**
 * Busca últimas N entradas
 * @param {number} limit - Número de entradas
 * @returns {Promise<Array>} Lista de entradas
 */
export const getRecentEntries = async (limit = 5) => {
  try {
    const entries = await getEntries();
    return entries.slice(0, limit);
  } catch (error) {
    console.error("Erro ao buscar entradas recentes:", error);
    throw error;
  }
};

