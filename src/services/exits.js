import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { db } from "./firebase";
import { getItemByCodigo, decrementStock, updateItem } from "./items";
import { consumeFromBatches, getEarliestBatchValidity } from "./batches";

const EXITS_COLLECTION = "exits";

/**
 * Adiciona uma saída
 * @param {Object} exitData
 * @param {string} userId
 */
export const addExit = async (exitData, userId) => {
  try {
    // --- GARANTIR QUANTIDADE INTEIRA ---
    const quantidadeInt = parseInt(exitData.quantidade, 10);

    if (!quantidadeInt || quantidadeInt <= 0) {
      throw new Error("Quantidade deve ser maior que zero");
    }

    // --- VALIDAR CÓDIGO OU ITEM ---
    if (
      (!exitData.codigo || exitData.codigo.trim().length === 0) &&
      !exitData.itemId
    ) {
      throw new Error(
        "Código de barras ou ID do item é obrigatório para registrar saída"
      );
    }

    let item = null;

    // Buscar item pelo código
    if (exitData.codigo && exitData.codigo.trim().length > 0) {
      item = await getItemByCodigo(exitData.codigo);
    }
    // Buscar por ID
    else if (exitData.itemId) {
      const { getItemById } = await import("./items");
      item = await getItemById(exitData.itemId);
    }

    if (!item) {
      throw new Error("Item não encontrado.");
    }

    // --- VERIFICAR ESTOQUE DISPONÍVEL ---
    const currentStock = item.quantidade || 0;

    if (currentStock < quantidadeInt) {
      throw new Error(
        `Estoque insuficiente. Disponível: ${currentStock}, solicitado: ${quantidadeInt}`
      );
    }

    // --- DECREMENTAR ESTOQUE TOTAL ---
    await decrementStock(item.id, quantidadeInt);

    // --- CONSUMIR LOTES (FIFO pela validade) ---
    const batchResult = await consumeFromBatches(item.id, quantidadeInt);

    // --- ATUALIZAR VALIDADE GLOBAL DO ITEM ---
    const earliestValidity = await getEarliestBatchValidity(item.id);

    if (earliestValidity) {
      await updateItem(item.id, { validade: earliestValidity });
    } else {
      await updateItem(item.id, { validade: "" });
    }

    // --- REGISTRAR SAÍDA ---
    const exitRef = await addDoc(collection(db, EXITS_COLLECTION), {
      itemId: item.id,
      codigo:
        exitData.codigo && exitData.codigo.trim().length > 0
          ? exitData.codigo
          : "",
      quantidade: quantidadeInt,
      setorDestino: exitData.setorDestino || "",
      retiradoPor: exitData.retiradoPor || "",
      observacao: exitData.observacao || "",
      data: exitData.data || serverTimestamp(),
      usuarioQueRegistrou: userId,
      createdAt: serverTimestamp(),
      batchesConsumed: batchResult.usedBatches || [],
    });

    return exitRef.id;
  } catch (error) {
    console.error("Erro ao adicionar saída:", error);
    throw error;
  }
};

/**
 * Busca todas as saídas
 */
export const getExits = async () => {
  try {
    const q = query(
      collection(db, EXITS_COLLECTION),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar saídas:", error);
    throw error;
  }
};

/**
 * Busca saídas por código
 */
export const getExitsByCodigo = async (codigo) => {
  try {
    const q = query(
      collection(db, EXITS_COLLECTION),
      where("codigo", "==", codigo),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar saídas por código:", error);
    throw error;
  }
};

/**
 * Busca saídas por setor
 */
export const getExitsBySetor = async (setor) => {
  try {
    const q = query(
      collection(db, EXITS_COLLECTION),
      where("setorDestino", "==", setor),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar saídas por setor:", error);
    throw error;
  }
};

/**
 * Busca saídas por dia
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
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar saídas por data:", error);
    throw error;
  }
};

/**
 * Busca saídas por intervalo de datas
 */
export const getExitsByDateRange = async (startDate, endDate) => {
  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, EXITS_COLLECTION),
      where("data", ">=", Timestamp.fromDate(start)),
      where("data", "<=", Timestamp.fromDate(end)),
      orderBy("data", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar saídas por intervalo de datas:", error);
    throw error;
  }
};

/**
 * Últimas N saídas
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
