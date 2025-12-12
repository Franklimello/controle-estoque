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
import { addItem, getItemByCodigo, incrementStock } from "./items";
import { addOrIncrementBatch } from "./batches";

const ENTRIES_COLLECTION = "entries";

// -------------------------------------------------------
//  ADD ENTRY (CORRIGIDO - NÃO ATUALIZA VALIDADE DO ITEM)
// -------------------------------------------------------
export const addEntry = async (entryData, userId) => {
  try {
    // Garantir que quantidade é um inteiro
    const quantidadeInt = parseInt(entryData.quantidade, 10);

    if (!quantidadeInt || quantidadeInt <= 0) {
      throw new Error("Quantidade deve ser maior que zero");
    }

    // Validar nome se não houver código
    if (
      (!entryData.codigo || entryData.codigo.trim().length === 0) &&
      (!entryData.nome || entryData.nome.trim().length === 0)
    ) {
      throw new Error(
        "Nome do item é obrigatório quando não há código de barras"
      );
    }

    let item = null;

    // Se houver código, buscar por código
    if (entryData.codigo && entryData.codigo.trim().length > 0) {
      item = await getItemByCodigo(entryData.codigo);
    }

    // Criar item automaticamente se não existir
    if (!item) {
      if (!entryData.nome || entryData.nome.trim().length === 0) {
        throw new Error("Nome do item é obrigatório para criar novo item");
      }

      const newItemData = {
        nome: entryData.nome,
        codigo:
          entryData.codigo && entryData.codigo.trim().length > 0
            ? entryData.codigo
            : "",
        categoria: entryData.categoria || "",
        unidade: entryData.unidade || "UN",
        local: entryData.local || "",
        fornecedor: entryData.fornecedor || "",
        // NÃO definir validade no item principal
        quantidade: 0,
      };

      const itemId = await addItem(newItemData);

      // Buscar o item recém criado
      if (entryData.codigo && entryData.codigo.trim().length > 0) {
        item = await getItemByCodigo(entryData.codigo);
      } else {
        const { getItemById } = await import("./items");
        item = await getItemById(itemId);
      }

      if (!item) {
        throw new Error("Erro ao criar item. Tente novamente.");
      }
    }

    // Atualizar estoque total do item
    await incrementStock(item.id, quantidadeInt);

    // Incrementar lote por validade
    if (!entryData.validade) {
      throw new Error("Validade é obrigatória para registrar o lote");
    }

    // Adiciona ou incrementa o lote com a validade específica desta entrada
    await addOrIncrementBatch(item.id, entryData.validade, quantidadeInt);

    // ❌ REMOVIDO: NÃO atualizar validade no item principal
    // Cada lote mantém sua própria validade
    // O sistema de lotes (batches) já gerencia isso corretamente

    // Registrar entrada no histórico
    const entryRef = await addDoc(collection(db, ENTRIES_COLLECTION), {
      itemId: item.id,
      codigo:
        entryData.codigo && entryData.codigo.trim().length > 0
          ? entryData.codigo
          : "",
      quantidade: quantidadeInt,
      validade: entryData.validade, // Guardar validade desta entrada específica
      fornecedor: entryData.fornecedor || "",
      observacao: entryData.observacao || "",
      data: entryData.data || serverTimestamp(),
      usuarioQueRegistrou: userId,
      createdAt: serverTimestamp(),
    });

    return entryRef.id;
  } catch (error) {
    console.error("Erro ao adicionar entrada:", error);
    throw error;
  }
};

// -------------------------------------------------------
//  BUSCAR ENTRADAS
// -------------------------------------------------------
export const getEntries = async () => {
  try {
    const q = query(
      collection(db, ENTRIES_COLLECTION),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar entradas:", error);
    throw error;
  }
};

// -------------------------------------------------------
//  BUSCAR POR CÓDIGO
// -------------------------------------------------------
export const getEntriesByCodigo = async (codigo) => {
  try {
    const q = query(
      collection(db, ENTRIES_COLLECTION),
      where("codigo", "==", codigo),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar entradas por código:", error);
    throw error;
  }
};

// -------------------------------------------------------
//  ENTRADAS POR DIA
// -------------------------------------------------------
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
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar entradas por data:", error);
    throw error;
  }
};

// -------------------------------------------------------
//  ÚLTIMAS N ENTRADAS
// -------------------------------------------------------
export const getRecentEntries = async (limit = 5) => {
  try {
    const entries = await getEntries();
    return entries.slice(0, limit);
  } catch (error) {
    console.error("Erro ao buscar entradas recentes:", error);
    throw error;
  }
};
