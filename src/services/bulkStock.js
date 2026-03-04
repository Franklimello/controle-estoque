import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { logAudit } from "./audit";

const ITEMS_COLLECTION = "items";
const BATCHES_COLLECTION = "itemBatches";
const MAX_BATCH_WRITES = 500;

/**
 * Zera a quantidade de todos os itens e de todos os lotes, e remove a data de validade.
 * Use para preparar uma contagem do zero (inventário inicial).
 * @param {string} userId - ID do usuário que está executando
 * @returns {Promise<{ itemsUpdated: number, batchesUpdated: number }>}
 */
export const zeroAllStock = async (userId) => {
  const itemsSnap = await getDocs(collection(db, ITEMS_COLLECTION));
  const batchesSnap = await getDocs(collection(db, BATCHES_COLLECTION));

  const updates = [];

  itemsSnap.docs.forEach((d) => {
    updates.push({
      type: "item",
      ref: doc(db, ITEMS_COLLECTION, d.id),
      data: {
        quantidade: 0,
        validade: "",
        updatedAt: serverTimestamp(),
      },
    });
  });

  batchesSnap.docs.forEach((d) => {
    updates.push({
      type: "batch",
      ref: doc(db, BATCHES_COLLECTION, d.id),
      data: {
        quantidade: 0,
        validade: "sem-validade",
        validadeDate: null,
        updatedAt: serverTimestamp(),
      },
    });
  });

  let committed = 0;
  for (let i = 0; i < updates.length; i += MAX_BATCH_WRITES) {
    const chunk = updates.slice(i, i + MAX_BATCH_WRITES);
    const batch = writeBatch(db);
    chunk.forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
    committed += chunk.length;
  }

  await logAudit("bulk/zero_all_stock", userId, {
    itemsUpdated: itemsSnap.size,
    batchesUpdated: batchesSnap.size,
  });

  return { itemsUpdated: itemsSnap.size, batchesUpdated: batchesSnap.size };
};
