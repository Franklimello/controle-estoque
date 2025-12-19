import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { getItemById, updateItem } from "./items";
import { getBatchesByItem, addOrIncrementBatch, consumeFromBatches } from "./batches";
import { getErrorMessage, logError } from "../utils/errorHandler";

const ADJUSTMENTS_COLLECTION = "stockAdjustments";

/**
 * Registra um ajuste manual de estoque
 * @param {Object} adjustmentData - Dados do ajuste
 * @param {string} adjustmentData.itemId - ID do item
 * @param {number} adjustmentData.quantidadeAnterior - Quantidade antes do ajuste
 * @param {number} adjustmentData.quantidadeNova - Quantidade após o ajuste
 * @param {string} adjustmentData.motivo - Motivo do ajuste (obrigatório)
 * @param {string} adjustmentData.observacao - Observação adicional (opcional)
 * @param {string} userId - ID do usuário que está fazendo o ajuste
 * @returns {Promise<string>} ID do ajuste registrado
 */
export const addAdjustment = async (adjustmentData, userId) => {
  try {
    const { itemId, quantidadeAnterior, quantidadeNova, motivo, observacao } = adjustmentData;

    // Validações
    if (!itemId) {
      throw new Error("ID do item é obrigatório");
    }

    if (!motivo || motivo.trim().length === 0) {
      throw new Error("Motivo do ajuste é obrigatório");
    }

    if (typeof quantidadeAnterior !== "number" || typeof quantidadeNova !== "number") {
      throw new Error("Quantidades devem ser números válidos");
    }

    if (quantidadeNova < 0) {
      throw new Error("Quantidade não pode ser negativa");
    }

    // Buscar item
    const item = await getItemById(itemId);
    if (!item) {
      throw new Error("Item não encontrado");
    }

    // Verificar se a quantidade anterior corresponde à atual
    const quantidadeAtual = item.quantidade || 0;
    if (Math.abs(quantidadeAnterior - quantidadeAtual) > 0.01) {
      throw new Error(
        `Quantidade anterior informada (${quantidadeAnterior}) não corresponde à quantidade atual (${quantidadeAtual}). Por favor, atualize a página e tente novamente.`
      );
    }

    const diferenca = quantidadeNova - quantidadeAnterior;

    // Buscar lotes antes de atualizar
    const batches = await getBatchesByItem(itemId);
    const quantidadeTotalLotes = batches.reduce(
      (sum, batch) => sum + (batch.quantidade || 0),
      0
    );

    // Atualizar quantidade do item
    await updateItem(itemId, { quantidade: quantidadeNova }, userId);

    // Ajustar lotes se necessário
    if (diferenca !== 0) {

      if (diferenca > 0) {
        // Aumentando: adicionar diferença ao lote sem validade ou criar novo
        await addOrIncrementBatch(itemId, null, diferenca);
      } else {
        // Diminuindo: ajustar lotes proporcionalmente ou consumir
        const quantidadeParaReduzir = Math.abs(diferenca);
        
        if (quantidadeTotalLotes >= quantidadeParaReduzir) {
          // Consumir dos lotes (FIFO)
          await consumeFromBatches(itemId, quantidadeParaReduzir);
        } else {
          // Se não há lotes suficientes, ajustar todos os lotes
          // Primeiro, zerar todos os lotes
          for (const batch of batches) {
            const batchRef = doc(db, "itemBatches", batch.id);
            await updateDoc(batchRef, {
              quantidade: 0,
              updatedAt: serverTimestamp(),
            });
          }
          // Criar lote sem validade com a quantidade nova
          if (quantidadeNova > 0) {
            await addOrIncrementBatch(itemId, null, quantidadeNova);
          }
        }
      }
    } else if (batches.length === 0 && quantidadeNova > 0) {
      // Se não há lotes e quantidade é positiva, criar lote sem validade
      await addOrIncrementBatch(itemId, null, quantidadeNova);
    }

    // Registrar ajuste no histórico
    const adjustmentRef = await addDoc(collection(db, ADJUSTMENTS_COLLECTION), {
      itemId,
      itemNome: item.nome || "",
      itemCodigo: item.codigo || "",
      quantidadeAnterior,
      quantidadeNova,
      diferenca,
      motivo: motivo.trim(),
      observacao: observacao ? observacao.trim() : "",
      usuarioId: userId,
      createdAt: serverTimestamp(),
    });

    return adjustmentRef.id;
  } catch (error) {
    logError("addAdjustment", error, { adjustmentData });
    const friendlyError = new Error(getErrorMessage(error));
    friendlyError.originalError = error;
    throw friendlyError;
  }
};

/**
 * Busca todos os ajustes
 * @param {Object} filters - Filtros opcionais
 * @param {string} filters.itemId - Filtrar por item
 * @param {Date} filters.startDate - Data inicial
 * @param {Date} filters.endDate - Data final
 * @returns {Promise<Array>} Lista de ajustes
 */
export const getAdjustments = async (filters = {}) => {
  try {
    let q = query(
      collection(db, ADJUSTMENTS_COLLECTION),
      orderBy("createdAt", "desc")
    );

    if (filters.itemId) {
      q = query(q, where("itemId", "==", filters.itemId));
    }

    if (filters.startDate || filters.endDate) {
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        q = query(q, where("createdAt", ">=", Timestamp.fromDate(start)));
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        q = query(q, where("createdAt", "<=", Timestamp.fromDate(end)));
      }
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    logError("getAdjustments", error, { filters });
    throw error;
  }
};

/**
 * Busca ajustes de um item específico
 * @param {string} itemId - ID do item
 * @returns {Promise<Array>} Lista de ajustes do item
 */
export const getAdjustmentsByItem = async (itemId) => {
  return getAdjustments({ itemId });
};

/**
 * Busca ajustes recentes
 * @param {number} limit - Número máximo de ajustes (padrão: 10)
 * @returns {Promise<Array>} Lista de ajustes recentes
 */
export const getRecentAdjustments = async (limit = 10) => {
  try {
    const q = query(
      collection(db, ADJUSTMENTS_COLLECTION),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .slice(0, limit)
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  } catch (error) {
    logError("getRecentAdjustments", error);
    throw error;
  }
};

