import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  setDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

const BATCHES_COLLECTION = "itemBatches";

const buildBatchId = (itemId, validade) => {
  const key = validade ? validade : "sem-validade";
  return `${itemId}_${key}`;
};

const toTimestamp = (validade) => {
  if (!validade) return null;
  const date = new Date(validade);
  if (Number.isNaN(date.getTime())) return null;
  return Timestamp.fromDate(date);
};

/**
 * Adiciona ou incrementa um lote (batch) para um item
 * Usa transaction para evitar condições de corrida
 */
export const addOrIncrementBatch = async (itemId, validade, quantidade) => {
  if (!validade) {
    throw new Error("Validade é obrigatória para controle de lote");
  }

  const batchId = buildBatchId(itemId, validade);
  const batchRef = doc(db, BATCHES_COLLECTION, batchId);
  const validadeTimestamp = toTimestamp(validade);

  return runTransaction(db, async (transaction) => {
    const batchSnap = await transaction.get(batchRef);
    const now = serverTimestamp();

    if (!batchSnap.exists()) {
      transaction.set(batchRef, {
        itemId,
        validade,
        validadeDate: validadeTimestamp,
        quantidade,
        createdAt: now,
        updatedAt: now,
      });
      return quantidade;
    }

    const currentQty = batchSnap.data().quantidade || 0;
    const newQty = currentQty + quantidade;
    if (newQty < 0) {
      throw new Error("Quantidade do lote não pode ficar negativa");
    }

    transaction.update(batchRef, {
      quantidade: newQty,
      validade,
      validadeDate: validadeTimestamp,
      updatedAt: now,
    });

    return newQty;
  });
};

/**
 * Consome estoque dos lotes na ordem de validade (mais próximo vence primeiro)
 * Retorna detalhes do consumo e a nova menor validade
 */
export const consumeFromBatches = async (itemId, quantidade) => {
  if (!quantidade || quantidade <= 0) {
    throw new Error("Quantidade deve ser maior que zero");
  }

  // Buscar lotes ordenados pela validade (mais próximo primeiro)
  const q = query(
    collection(db, BATCHES_COLLECTION),
    where("itemId", "==", itemId),
    orderBy("validadeDate", "asc")
  );
  const batchesSnap = await getDocs(q);

  if (batchesSnap.empty) {
    throw new Error("Nenhum lote encontrado para este item");
  }

  let remaining = quantidade;
  const updates = [];

  // Fazer transação para atualizar os lotes
  await runTransaction(db, async (transaction) => {
    for (const docSnap of batchesSnap.docs) {
      if (remaining <= 0) break;
      const data = docSnap.data();
      const available = data.quantidade || 0;
      if (available <= 0) continue;

      const toConsume = Math.min(available, remaining);
      const newQty = available - toConsume;
      transaction.update(docSnap.ref, {
        quantidade: newQty,
        updatedAt: serverTimestamp(),
      });
      updates.push({
        batchId: docSnap.id,
        validity: data.validade,
        consumed: toConsume,
        remaining: newQty,
      });
      remaining -= toConsume;
    }

    if (remaining > 0) {
      throw new Error("Estoque em lotes insuficiente para esta saída");
    }
  });

  // Recalcular menor validade após consumo
  const earliest = await getEarliestBatchValidity(itemId);

  return {
    usedBatches: updates,
    earliestValidity: earliest,
  };
};

/**
 * Obtém a menor validade existente para o item (ou null se não houver lotes)
 */
export const getEarliestBatchValidity = async (itemId) => {
  const q = query(
    collection(db, BATCHES_COLLECTION),
    where("itemId", "==", itemId),
    orderBy("validadeDate", "asc")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const first = snap.docs[0].data();
  return first.validade || null;
};




