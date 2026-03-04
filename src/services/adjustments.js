import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  doc,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { getItemById } from "./items";
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

    // Motivo é opcional agora

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

    const integerUnits = ["UN", "PC", "CX"];
    const isIntegerUnit = integerUnits.includes((item.unidade || "").toUpperCase());
    const normalizeQty = (value) => {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) return NaN;
      if (isIntegerUnit) return Math.round(numericValue);
      return Math.round(numericValue * 100) / 100;
    };
    const quantidadeAnteriorNormalizada = normalizeQty(quantidadeAnterior);
    const quantidadeNovaNormalizada = normalizeQty(quantidadeNova);

    if (!Number.isFinite(quantidadeAnteriorNormalizada) || !Number.isFinite(quantidadeNovaNormalizada)) {
      throw new Error("Quantidades devem ser números válidos");
    }

    // Verificar se a quantidade anterior corresponde à atual (comparação normalizada)
    const quantidadeAtual = Number(item.quantidade || 0);
    const quantidadeAtualNormalizada = normalizeQty(quantidadeAtual);
    const compareTolerance = isIntegerUnit ? 0 : 0.01;
    if (Math.abs(quantidadeAnteriorNormalizada - quantidadeAtualNormalizada) > compareTolerance) {
      throw new Error(
        `Quantidade anterior informada (${quantidadeAnteriorNormalizada}) não corresponde à quantidade atual (${quantidadeAtualNormalizada}). Por favor, atualize a página e tente novamente.`
      );
    }

    const diferenca = quantidadeNovaNormalizada - quantidadeAnteriorNormalizada;
    const itemRef = doc(db, "items", itemId);
    const adjustmentRef = doc(collection(db, ADJUSTMENTS_COLLECTION));
    const batchesQuery = query(collection(db, "itemBatches"), where("itemId", "==", itemId));
    const generatedBatchId = `${itemId}_sem-validade`;
    const generatedBatchRef = doc(db, "itemBatches", generatedBatchId);
    const initialBatchesSnapshot = await getDocs(batchesQuery);
    const batchRefs = initialBatchesSnapshot.docs.map((snapshot) => snapshot.ref);

    await runTransaction(db, async (transaction) => {
      const itemSnapshot = await transaction.get(itemRef);
      if (!itemSnapshot.exists()) {
        throw new Error("Item não encontrado");
      }

      const itemData = itemSnapshot.data();
      const currentQty = Number(itemData.quantidade || 0);
      const currentQtyNormalizada = normalizeQty(currentQty);
      if (Math.abs(currentQtyNormalizada - quantidadeAnteriorNormalizada) > compareTolerance) {
        throw new Error(
          `Quantidade anterior informada (${quantidadeAnteriorNormalizada}) não corresponde à quantidade atual (${currentQtyNormalizada}). Por favor, atualize a página e tente novamente.`
        );
      }

      const batches = [];
      for (const batchRef of batchRefs) {
        const batchSnapshot = await transaction.get(batchRef);
        if (batchSnapshot.exists()) {
          batches.push({
            id: batchSnapshot.id,
            ref: batchSnapshot.ref,
            ...batchSnapshot.data(),
          });
        }
      }
      const existingGeneratedBatch = await transaction.get(generatedBatchRef);
      const batchesAtivos = batches.filter((batch) => Number(batch.quantidade || 0) > 0);
      const totalBatches = batchesAtivos.reduce((sum, batch) => sum + Number(batch.quantidade || 0), 0);

      transaction.update(itemRef, {
        quantidade: quantidadeNovaNormalizada,
        updatedAt: serverTimestamp(),
      });

      if (batchesAtivos.length > 0) {
        if (totalBatches > 0 && quantidadeNovaNormalizada >= 0) {
          const fator = quantidadeNovaNormalizada / totalBatches;
          const novasQuantidades = batchesAtivos.map((batch) =>
            Math.max(
              0,
              isIntegerUnit
                ? Math.round(Number(batch.quantidade || 0) * fator)
                : Math.round(Number(batch.quantidade || 0) * fator * 100) / 100
            )
          );
          const somaAjustada = novasQuantidades.reduce((sum, qty) => sum + qty, 0);
          let diferencaArredondamento = quantidadeNovaNormalizada - somaAjustada;
          if (!isIntegerUnit) {
            diferencaArredondamento = Math.round(diferencaArredondamento * 100) / 100;
          }

          for (let i = novasQuantidades.length - 1; i >= 0 && diferencaArredondamento !== 0; i--) {
            const valorAtual = novasQuantidades[i];
            const novoValor = valorAtual + diferencaArredondamento;
            if (novoValor >= 0) {
              novasQuantidades[i] = isIntegerUnit
                ? Math.round(novoValor)
                : Math.round(novoValor * 100) / 100;
              diferencaArredondamento = 0;
            }
          }

          for (let i = 0; i < batchesAtivos.length; i++) {
            const qtyRaw = Math.max(0, Number(novasQuantidades[i] || 0));
            const qty = isIntegerUnit
              ? Math.round(qtyRaw)
              : Math.round(qtyRaw * 100) / 100;
            transaction.update(batchesAtivos[i].ref, {
              quantidade: qty,
              updatedAt: serverTimestamp(),
            });
          }
        } else if (quantidadeNovaNormalizada === 0) {
          for (const batch of batchesAtivos) {
            transaction.update(batch.ref, {
              quantidade: 0,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } else if (quantidadeNovaNormalizada > 0) {
        if (existingGeneratedBatch.exists()) {
          transaction.update(generatedBatchRef, {
            quantidade: quantidadeNovaNormalizada,
            validade: "sem-validade",
            validadeDate: null,
            updatedAt: serverTimestamp(),
          });
        } else {
          transaction.set(generatedBatchRef, {
            itemId,
            validade: "sem-validade",
            validadeDate: null,
            quantidade: quantidadeNovaNormalizada,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      transaction.set(adjustmentRef, {
        itemId,
        itemNome: item.nome || "",
        itemCodigo: item.codigo || "",
        quantidadeAnterior: quantidadeAnteriorNormalizada,
        quantidadeNova: quantidadeNovaNormalizada,
        diferenca,
        motivo: (motivo || "").trim(),
        observacao: observacao ? observacao.trim() : "",
        usuarioId: userId,
        createdAt: serverTimestamp(),
      });
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

