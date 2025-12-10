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
import { getItemByCodigo, decrementStock, updateItem } from "./items";
import {
  consumeFromBatches,
  getEarliestBatchValidity,
} from "./batches";

const EXITS_COLLECTION = "exits";

/**
 * Adiciona uma saída e atualiza o estoque usando transaction
 * @param {Object} exitData - Dados da saída
 * @param {string} userId - ID do usuário que registrou
 * @returns {Promise<string>} ID da saída criada
 */
export const addExit = async (exitData, userId) => {
  try {
    // Validar quantidade
    if (!exitData.quantidade || exitData.quantidade <= 0) {
      throw new Error("Quantidade deve ser maior que zero");
    }
    
    // Validar que há código ou itemId
    if ((!exitData.codigo || exitData.codigo.trim().length === 0) && !exitData.itemId) {
      throw new Error("Código de barras ou ID do item é obrigatório para registrar saída");
    }
    
    let item = null;
    
    // Buscar item pelo código se fornecido
    if (exitData.codigo && exitData.codigo.trim().length > 0) {
      item = await getItemByCodigo(exitData.codigo);
    } else if (exitData.itemId) {
      // Buscar por ID se fornecido
      const { getItemById } = await import("./items");
      item = await getItemById(exitData.itemId);
    }
    
    if (!item) {
      throw new Error("Item não encontrado. Verifique o código de barras ou selecione o item na lista.");
    }
    
    // A validação de estoque será feita dentro da transaction
    // Mas verificamos aqui para dar feedback mais rápido ao usuário
    const currentStock = item.quantidade || 0;
    if (currentStock < exitData.quantidade) {
      throw new Error(`Estoque insuficiente. Disponível: ${currentStock}, Solicitado: ${exitData.quantidade}`);
    }
    
    // Decrementar estoque total do item
    await decrementStock(item.id, exitData.quantidade);
    
    // Consumir dos lotes (FIFO por validade)
    const batchResult = await consumeFromBatches(item.id, exitData.quantidade);
    
    // Atualizar validade do item para a menor validade restante
    const earliestValidity = await getEarliestBatchValidity(item.id);
    await updateItem(item.id, { validade: earliestValidity });
    
    // Registrar saída
    const exitRef = await addDoc(collection(db, EXITS_COLLECTION), {
      itemId: item.id,
      codigo: exitData.codigo && exitData.codigo.trim().length > 0 ? exitData.codigo : "",
      quantidade: exitData.quantidade,
      setorDestino: exitData.setorDestino || "",
      retiradoPor: exitData.retiradoPor || "",
      observacao: exitData.observacao || "",
      data: exitData.data || serverTimestamp(),
      usuarioQueRegistrou: userId,
      createdAt: serverTimestamp(),
      batchesConsumed: batchResult.usedBatches || []
    });
    
    return exitRef.id;
  } catch (error) {
    console.error("Erro ao adicionar saída:", error);
    throw error;
  }
};

/**
 * Busca todas as saídas
 * @returns {Promise<Array>} Lista de saídas
 */
export const getExits = async () => {
  try {
    const q = query(
      collection(db, EXITS_COLLECTION),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Erro ao buscar saídas:", error);
    throw error;
  }
};

/**
 * Busca saídas por código
 * @param {string} codigo - Código de barras
 * @returns {Promise<Array>} Lista de saídas
 */
export const getExitsByCodigo = async (codigo) => {
  try {
    const q = query(
      collection(db, EXITS_COLLECTION),
      where("codigo", "==", codigo),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Erro ao buscar saídas por código:", error);
    throw error;
  }
};

/**
 * Busca saídas por setor
 * @param {string} setor - Setor destino
 * @returns {Promise<Array>} Lista de saídas
 */
export const getExitsBySetor = async (setor) => {
  try {
    const q = query(
      collection(db, EXITS_COLLECTION),
      where("setorDestino", "==", setor),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Erro ao buscar saídas por setor:", error);
    throw error;
  }
};

/**
 * Busca saídas do dia
 * @param {Date} date - Data (opcional, padrão: hoje)
 * @returns {Promise<Array>} Lista de saídas do dia
 */
export const getExitsByDate = async (date = new Date()) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const q = query(
      collection(db, EXITS_COLLECTION),
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
    console.error("Erro ao buscar saídas por data:", error);
    throw error;
  }
};

/**
 * Busca últimas N saídas
 * @param {number} limit - Número de saídas
 * @returns {Promise<Array>} Lista de saídas
 */
export const getRecentExits = async (limit = 5) => {
  try {
    const exits = await getExits();
    return exits.slice(0, limit);
  } catch (error) {
    console.error("Erro ao buscar saídas recentes:", error);
    throw error;
  }
};

