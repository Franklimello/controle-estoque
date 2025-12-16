import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  Timestamp,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const BATCHES_COLLECTION = "itemBatches";

/** Gera ID único por item + validade (consistente) */
const buildBatchId = (itemId, validade) => {
  const key = validade ? String(validade) : "sem-validade";
  return `${itemId}_${key}`;
};

/** Converte validade (string 'YYYY-MM-DD' ou Date) para Timestamp do Firestore */
const toTimestamp = (validade) => {
  if (!validade) return null;

  // Aceita string YYYY-MM-DD ou objeto Date
  let date;
  if (typeof validade === "string") {
    // garante interpretar como início do dia local
    date = new Date(String(validade) + "T00:00:00");
  } else if (validade instanceof Date) {
    date = validade;
  } else if (validade?.toDate) {
    // possivelmente um Firestore Timestamp
    return validade;
  } else {
    return null;
  }

  if (Number.isNaN(date.getTime())) return null;
  return Timestamp.fromDate(date);
};

/** Converte validade para string ISO (YYYY-MM-DD) para armazenar no documento */
const toISODateString = (validade) => {
  if (!validade) return null;
  let date;
  if (typeof validade === "string") {
    date = new Date(String(validade) + "T00:00:00");
  } else if (validade instanceof Date) {
    date = validade;
  } else if (validade?.toDate) {
    date = validade.toDate();
  } else {
    return null;
  }
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
};

/**
 * Adiciona ou incrementa um lote
 * - itemId: string
 * - validade: string 'YYYY-MM-DD' (recomendado) ou Date
 * - quantidade: number (inteiro)
 */
export const addOrIncrementBatch = async (itemId, validade, quantidade) => {
  const qtd = parseInt(quantidade, 10);
  if (!qtd || qtd <= 0) throw new Error("Quantidade deve ser maior que zero");
  if (!itemId) throw new Error("itemId obrigatório");
  if (!validade)
    throw new Error("Validade é obrigatória para controle de lote");

  const validadeIso = toISODateString(validade);
  if (!validadeIso) throw new Error("Validade inválida");

  const batchId = buildBatchId(itemId, validadeIso);
  const batchRef = doc(db, BATCHES_COLLECTION, batchId);
  const validadeTimestamp = toTimestamp(validadeIso);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(batchRef);
    const now = serverTimestamp();

    if (!snap.exists()) {
      transaction.set(batchRef, {
        itemId,
        validade: validadeIso,
        validadeDate: validadeTimestamp,
        quantidade: qtd,
        createdAt: now,
        updatedAt: now,
      });
      return qtd;
    }

    const current = parseInt(snap.data().quantidade || 0, 10);
    const newQty = current + qtd;
    if (newQty < 0)
      throw new Error("Quantidade do lote não pode ficar negativa");

    transaction.update(batchRef, {
      quantidade: newQty,
      validade: validadeIso, // mantemos campo legível
      validadeDate: validadeTimestamp,
      updatedAt: now,
    });

    return newQty;
  });
};

/**
 * Pega todos lotes de um item (ordenados por validade asc)
 * Retorna array de { id, ...data }
 */
export const getBatchesByItem = async (itemId) => {
  if (!itemId) return [];
  const q = query(
    collection(db, BATCHES_COLLECTION),
    where("itemId", "==", itemId),
    where("quantidade", ">", 0),
    orderBy("validadeDate", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
};

/**
 * Consome estoque dos lotes na ordem FIFO por validade (mais próxima primeiro)
 * - retorna { usedBatches: [{ batchId, validity, consumed, remaining }], earliestValidity }
 */
export const consumeFromBatches = async (itemId, quantidade) => {
  const qtd = parseInt(quantidade, 10);
  if (!qtd || qtd <= 0) throw new Error("Quantidade deve ser maior que zero");
  if (!itemId) throw new Error("itemId obrigatório");

  // Busca lotes ordenados
  const q = query(
    collection(db, BATCHES_COLLECTION),
    where("itemId", "==", itemId),
    where("quantidade", ">", 0),
    orderBy("validadeDate", "asc")
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error("Nenhum lote encontrado para este item");
  }

  let remaining = qtd;
  const updates = [];

  // Usamos uma transaction para atualizar múltiplos documentos
  await runTransaction(db, async (transaction) => {
    for (const docSnap of snap.docs) {
      if (remaining <= 0) break;

      const data = docSnap.data();
      const available = parseInt(data.quantidade || 0, 10);
      if (available <= 0) continue;

      const toConsume = Math.min(available, remaining);
      const newQty = available - toConsume;

      // garantir que o doc ainda existe e tem a quantidade esperada (transaction.get seria ideal, mas já temos documento)
      const docRef = docSnap.ref;
      transaction.update(docRef, {
        quantidade: newQty,
        updatedAt: serverTimestamp(),
      });

      updates.push({
        batchId: docSnap.id,
        validity: data.validade || null,
        consumed: toConsume,
        remaining: newQty,
      });

      remaining -= toConsume;
    }

    if (remaining > 0) {
      throw new Error("Estoque insuficiente nos lotes");
    }
  });

  // recalcula menor validade restante
  const earliest = await getEarliestBatchValidity(itemId);

  return {
    usedBatches: updates,
    earliestValidity: earliest,
  };
};

/**
 * Retorna a menor validade ativa (string 'YYYY-MM-DD') ou null
 */
export const getEarliestBatchValidity = async (itemId) => {
  if (!itemId) return null;

  const q = query(
    collection(db, BATCHES_COLLECTION),
    where("itemId", "==", itemId),
    where("quantidade", ">", 0),
    orderBy("validadeDate", "asc")
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const first = snap.docs[0].data();
  return first.validade || null;
};

/**
 * Busca lotes que vencem até 'days' dias a partir de hoje (inclusivo).
 * Retorna array de objetos resumidos por item:
 *  [
 *    { itemId, totalExpiring, earliestValidity, batchKeys: [batchId1, batchId2, ...] },
 *    ...
 *  ]
 */
export const getExpiringBatches = async (days = 7) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const limitDate = new Date(now);
  limitDate.setDate(now.getDate() + days);
  // Firestore queries com comparação de Timestamp: usamos limiteDate como Timestamp
  const limitTimestamp = Timestamp.fromDate(limitDate);

  const q = query(
    collection(db, BATCHES_COLLECTION),
    where("validadeDate", "<=", limitTimestamp),
    where("quantidade", ">", 0),
    orderBy("validadeDate", "asc")
  );

  const snap = await getDocs(q);
  if (snap.empty) return [];

  const map = {};

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const itemId = data.itemId;
    const qty = parseInt(data.quantidade || 0, 10) || 0;
    const validade = data.validade || null;

    if (!map[itemId]) {
      map[itemId] = {
        itemId,
        totalExpiring: 0,
        earliestValidity: validade,
        batchKeys: [],
      };
    }

    map[itemId].totalExpiring += qty;

    // atualizar earliestValidity (string compare 'YYYY-MM-DD' funciona)
    if (
      !map[itemId].earliestValidity ||
      (validade && validade < map[itemId].earliestValidity)
    ) {
      map[itemId].earliestValidity = validade;
    }

    map[itemId].batchKeys.push(docSnap.id);
  });

  return Object.values(map);
};

/**
 * Decrementa um lote específico (útil se precisar reduzir manualmente)
 * - batchId: id do documento do lote
 * - quantidade: número inteiro (positivo para reduzir)
 */
export const decrementBatch = async (batchId, quantidade) => {
  const qtd = parseInt(quantidade, 10);
  if (!qtd || qtd <= 0) throw new Error("Quantidade deve ser maior que zero");
  if (!batchId) throw new Error("batchId obrigatório");

  const batchRef = doc(db, BATCHES_COLLECTION, batchId);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(batchRef);
    if (!snap.exists()) throw new Error("Lote não encontrado");

    const current = parseInt(snap.data().quantidade || 0, 10);
    const newQty = current - qtd;
    if (newQty < 0) throw new Error("Quantidade do lote ficaria negativa");

    transaction.update(batchRef, {
      quantidade: newQty,
      updatedAt: serverTimestamp(),
    });

    return newQty;
  });
};

/**
 * Busca todos os lotes do sistema
 * Retorna array de { id, ...data }
 */
export const getAllBatches = async () => {
  try {
    const q = query(
      collection(db, BATCHES_COLLECTION),
      orderBy("validadeDate", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar todos os lotes:", error);
    throw error;
  }
};

export default {
  addOrIncrementBatch,
  consumeFromBatches,
  getEarliestBatchValidity,
  getBatchesByItem,
  getExpiringBatches,
  decrementBatch,
  getAllBatches,
};

