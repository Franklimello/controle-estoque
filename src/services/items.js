import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { logAudit } from "./audit";
import { ESTOQUE_BAIXO_LIMITE } from "../config/constants";
import { getExpiringBatches, getBatchesByItem } from "./batches";

/**
 * Valida a consistência entre a quantidade total do item e a soma dos lotes
 * @param {string} itemId - ID do item
 * @returns {Promise<Object>} { isValid: boolean, itemQuantity: number, batchesSum: number, difference: number, message: string }
 */
export const validateStockConsistency = async (itemId) => {
  try {
    const item = await getItemById(itemId);
    if (!item) {
      return {
        isValid: false,
        itemQuantity: 0,
        batchesSum: 0,
        difference: 0,
        message: "Item não encontrado",
      };
    }

    const batches = await getBatchesByItem(itemId);
    const batchesSum = batches.reduce((sum, batch) => sum + (parseInt(batch.quantidade || 0, 10)), 0);
    const itemQuantity = parseInt(item.quantidade || 0, 10);
    const difference = itemQuantity - batchesSum;

    const isValid = Math.abs(difference) <= 0.01; // Tolerância para erros de arredondamento

    return {
      isValid,
      itemQuantity,
      batchesSum,
      difference,
      message: isValid
        ? "Estoque consistente"
        : `Inconsistência detectada: Item tem ${itemQuantity}, mas lotes somam ${batchesSum} (diferença: ${difference})`,
    };
  } catch (error) {
    console.error("Erro ao validar consistência de estoque:", error);
    return {
      isValid: false,
      itemQuantity: 0,
      batchesSum: 0,
      difference: 0,
      message: `Erro ao validar: ${error.message}`,
    };
  }
};

/**
 * Sincroniza a quantidade total do item com a soma dos lotes
 * @param {string} itemId - ID do item
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} { success: boolean, oldQuantity: number, newQuantity: number, message: string }
 */
export const syncItemQuantityFromBatches = async (itemId, userId) => {
  try {
    const batches = await getBatchesByItem(itemId);
    const batchesSum = batches.reduce((sum, batch) => sum + (parseInt(batch.quantidade || 0, 10)), 0);
    
    const item = await getItemById(itemId);
    if (!item) {
      throw new Error("Item não encontrado");
    }

    const oldQuantity = parseInt(item.quantidade || 0, 10);
    
    if (oldQuantity !== batchesSum) {
      await updateItem(itemId, { quantidade: batchesSum }, userId);
      return {
        success: true,
        oldQuantity,
        newQuantity: batchesSum,
        message: `Quantidade sincronizada: ${oldQuantity} → ${batchesSum}`,
      };
    }

    return {
      success: true,
      oldQuantity,
      newQuantity: batchesSum,
      message: "Quantidade já estava sincronizada",
    };
  } catch (error) {
    console.error("Erro ao sincronizar quantidade:", error);
    throw error;
  }
};

const ITEMS_COLLECTION = "items";

/**
 * Adiciona um novo item ao Firestore
 * @param {Object} itemData - Dados do item
 * @returns {Promise<string>} ID do documento criado
 */
export const addItem = async (itemData, userId) => {
  try {
    const docRef = await addDoc(collection(db, ITEMS_COLLECTION), {
      ...itemData,
      quantidade: itemData.quantidade || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAudit("item/create", userId, { itemId: docRef.id, ...itemData });
    return docRef.id;
  } catch (error) {
    console.error("Erro ao adicionar item:", error);
    throw error;
  }
};

/**
 * Busca todos os itens
 * Expande itens com múltiplos lotes (vencimentos diferentes) em linhas separadas
 * @returns {Promise<Array>} Lista de itens (expandida por lote quando necessário)
 */
export const getItems = async () => {
  try {
    const q = query(
      collection(db, ITEMS_COLLECTION),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Expandir itens que têm múltiplos lotes com vencimentos diferentes
    // ⚡ OTIMIZAÇÃO: Buscar lotes em paralelo para melhor performance
    const itemsWithBatches = await Promise.all(
      items.map(async (item) => {
        const batches = await getBatchesByItem(item.id);
        return { item, batches };
      })
    );

    const expandedItems = [];
    
    for (const { item, batches } of itemsWithBatches) {
      if (batches.length === 0) {
        // Se não há lotes, adicionar o item como está
        expandedItems.push({
          ...item,
          batchId: null,
          isExpanded: false,
        });
      } else if (batches.length === 1) {
        // Se há apenas um lote, usar a validade desse lote
        expandedItems.push({
          ...item,
          quantidade: batches[0].quantidade || item.quantidade || 0,
          validade: batches[0].validade === "sem-validade" ? null : (batches[0].validade || item.validade || null),
          batchId: batches[0].id,
          isExpanded: false,
        });
      } else {
        // Se há múltiplos lotes, criar uma linha para cada lote
        batches.forEach((batch) => {
          expandedItems.push({
            ...item,
            id: `${item.id}_${batch.id}`, // ID único para cada linha
            originalItemId: item.id, // Guardar ID original do item
            quantidade: batch.quantidade || 0,
            validade: batch.validade === "sem-validade" ? null : (batch.validade || null),
            batchId: batch.id,
            isExpanded: true,
            quantidadeTotal: item.quantidade || 0, // Quantidade total do item
          });
        });
      }
    }

    return expandedItems;
  } catch (error) {
    console.error("Erro ao buscar itens:", error);
    throw error;
  }
};

/**
 * Busca um item pelo código de barras
 * @param {string} codigo - Código de barras
 * @returns {Promise<Object|null>} Item encontrado ou null
 */
export const getItemByCodigo = async (codigo) => {
  try {
    // Validar se código não está vazio
    if (!codigo || codigo.trim().length === 0) {
      return null;
    }

    const q = query(
      collection(db, ITEMS_COLLECTION),
      where("codigo", "==", codigo)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    };
  } catch (error) {
    console.error("Erro ao buscar item por código:", error);
    throw error;
  }
};

/**
 * Busca um item pelo ID
 * @param {string} itemId - ID do item
 * @returns {Promise<Object|null>} Item encontrado ou null
 */
export const getItemById = async (itemId) => {
  try {
    const docRef = doc(db, ITEMS_COLLECTION, itemId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    };
  } catch (error) {
    console.error("Erro ao buscar item por ID:", error);
    throw error;
  }
};

/**
 * Atualiza um item
 * @param {string} itemId - ID do item
 * @param {Object} itemData - Dados atualizados
 */
export const updateItem = async (itemId, itemData, userId) => {
  try {
    const docRef = doc(db, ITEMS_COLLECTION, itemId);
    await updateDoc(docRef, {
      ...itemData,
      updatedAt: serverTimestamp(),
    });
    await logAudit("item/update", userId, { itemId, ...itemData });
  } catch (error) {
    console.error("Erro ao atualizar item:", error);
    throw error;
  }
};

/**
 * Deleta um item
 * @param {string} itemId - ID do item
 */
export const deleteItem = async (itemId, userId) => {
  try {
    const docRef = doc(db, ITEMS_COLLECTION, itemId);
    await deleteDoc(docRef);
    await logAudit("item/delete", userId, { itemId });
  } catch (error) {
    console.error("Erro ao deletar item:", error);
    throw error;
  }
};

/**
 * Incrementa o estoque de um item usando transaction
 * @param {string} itemId - ID do item
 * @param {number} quantidade - Quantidade a adicionar
 * @returns {Promise<number>} Nova quantidade
 */
export const incrementStock = async (itemId, quantidade) => {
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, itemId);

    return await runTransaction(db, async (transaction) => {
      const itemDoc = await transaction.get(itemRef);

      if (!itemDoc.exists()) {
        throw new Error("Item não encontrado");
      }

      const currentQuantity = itemDoc.data().quantidade || 0;
      const newQuantity = currentQuantity + quantidade;

      if (newQuantity < 0) {
        throw new Error("Estoque não pode ser negativo");
      }

      transaction.update(itemRef, {
        quantidade: newQuantity,
        updatedAt: serverTimestamp(),
      });

      return newQuantity;
    });
  } catch (error) {
    console.error("Erro ao incrementar estoque:", error);
    throw error;
  }
};

/**
 * Decrementa o estoque de um item usando transaction
 * @param {string} itemId - ID do item
 * @param {number} quantidade - Quantidade a subtrair
 * @returns {Promise<number>} Nova quantidade
 */
export const decrementStock = async (itemId, quantidade) => {
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, itemId);

    return await runTransaction(db, async (transaction) => {
      const itemDoc = await transaction.get(itemRef);

      if (!itemDoc.exists()) {
        throw new Error("Item não encontrado");
      }

      const currentQuantity = itemDoc.data().quantidade || 0;
      const newQuantity = currentQuantity - quantidade;

      if (newQuantity < 0) {
        throw new Error("Estoque insuficiente");
      }

      transaction.update(itemRef, {
        quantidade: newQuantity,
        updatedAt: serverTimestamp(),
      });

      return newQuantity;
    });
  } catch (error) {
    console.error("Erro ao decrementar estoque:", error);
    throw error;
  }
};

/**
 * Busca itens com estoque baixo
 * @param {number} limiteMinimo - Limite mínimo de estoque
 * @returns {Promise<Array>} Lista de itens com estoque baixo
 */
export const getItemsLowStock = async (limiteMinimo = ESTOQUE_BAIXO_LIMITE) => {
  try {
    const items = await getItems();

    // Filtrar itens com quantidade total baixa
    const lowStockItems = items.filter((item) => {
      const quantidade = item.quantidade || 0;
      return quantidade > 0 && quantidade <= limiteMinimo;
    });

    // Para cada item, buscar lotes para enriquecer informação
    const itemsWithBatches = await Promise.all(
      lowStockItems.map(async (item) => {
        const batches = await getBatchesByItem(item.id);
        const earliestBatch = batches.length > 0 ? batches[0] : null;

        return {
          ...item,
          validade: earliestBatch?.validade || null,
          lotes: batches,
        };
      })
    );

    // Ordenar por quantidade (menor primeiro)
    return itemsWithBatches.sort(
      (a, b) => (a.quantidade || 0) - (b.quantidade || 0)
    );
  } catch (error) {
    console.error("Erro ao buscar itens com estoque baixo:", error);
    throw error;
  }
};

/**
 * Busca itens próximos do vencimento (USANDO LOTES)
 * @param {number} diasAntecedencia - Dias antes do vencimento para alertar
 * @returns {Promise<Array>} Lista de itens próximos do vencimento
 */
export const getItemsExpiring = async (diasAntecedencia = 30) => {
  try {
    // Buscar lotes que estão vencendo
    const expiringBatchesData = await getExpiringBatches(diasAntecedencia);

    if (expiringBatchesData.length === 0) {
      return [];
    }

    // Para cada lote vencendo, buscar informações do item
    const itemsMap = new Map();

    await Promise.all(
      expiringBatchesData.map(async (batchData) => {
        const item = await getItemById(batchData.itemId);

        if (item) {
          // Se já existe no map, adicionar quantidade
          if (itemsMap.has(item.id)) {
            const existing = itemsMap.get(item.id);
            existing.quantidadeVencendo += batchData.totalExpiring;

            // Atualizar validade se for mais próxima
            if (batchData.earliestValidity < existing.validade) {
              existing.validade = batchData.earliestValidity;
            }
          } else {
            // Adicionar novo item
            itemsMap.set(item.id, {
              ...item,
              validade: batchData.earliestValidity,
              quantidadeVencendo: batchData.totalExpiring,
              lotes: [],
            });
          }
        }
      })
    );

    // Buscar lotes detalhados para cada item
    const itemsWithBatches = await Promise.all(
      Array.from(itemsMap.values()).map(async (item) => {
        const batches = await getBatchesByItem(item.id);
        return {
          ...item,
          // IMPORTANTE: quantidade deve ser a que está vencendo, não o total do item
          quantidade: item.quantidadeVencendo,
          quantidadeTotal: item.quantidade, // guardar o total separado se necessário
          lotes: batches,
        };
      })
    );

    // Ordenar por data de validade (mais próximo primeiro)
    return itemsWithBatches.sort((a, b) => {
      if (!a.validade) return 1;
      if (!b.validade) return -1;
      return a.validade.localeCompare(b.validade);
    });
  } catch (error) {
    console.error("Erro ao buscar itens próximos do vencimento:", error);
    throw error;
  }
};
