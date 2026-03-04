import process from "node:process";
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const parseArgs = () => {
  const args = new Set(process.argv.slice(2));
  return {
    apply: args.has("--apply"),
  };
};

const getAdminCredential = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      return cert(serviceAccount);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON invalido (JSON malformado).");
    }
  }
  return applicationDefault();
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return 0;
};

const isMissingCode = (value) => value === null || value === undefined || String(value).trim() === "";

const parseNumericCode = (value) => {
  if (value === null || value === undefined) return NaN;
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) return NaN;
  return Number.parseInt(trimmed, 10);
};

const sortForBackfill = (a, b) => {
  const byCreatedAt = toMillis(a.createdAt) - toMillis(b.createdAt);
  if (byCreatedAt !== 0) return byCreatedAt;
  return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
};

const run = async () => {
  const { apply } = parseArgs();
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error("Defina VITE_FIREBASE_PROJECT_ID ou GCLOUD_PROJECT no ambiente.");
  }

  initializeApp({
    credential: getAdminCredential(),
    projectId,
  });

  const db = getFirestore();
  const itemsSnapshot = await db.collection("items").get();
  const items = itemsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const missing = items.filter((item) => isMissingCode(item.codigo)).sort(sortForBackfill);
  const maxExistingCode = items.reduce((max, item) => {
    const numeric = parseNumericCode(item.codigo);
    return Number.isFinite(numeric) && numeric > max ? numeric : max;
  }, 0);

  if (missing.length === 0) {
    console.log("Nenhum item sem codigo. Nada para atualizar.");
    return;
  }

  let nextCode = maxExistingCode;
  const assignments = missing.map((item) => {
    nextCode += 1;
    return { id: item.id, nome: item.nome || "", codigo: String(nextCode) };
  });

  console.log(`Itens totais: ${items.length}`);
  console.log(`Itens sem codigo: ${missing.length}`);
  console.log(`Maior codigo numerico atual: ${maxExistingCode}`);
  console.log(`Ultimo codigo apos backfill: ${nextCode}`);
  console.log("Primeiras atribuicoes:");
  assignments.slice(0, 10).forEach((entry) => {
    console.log(`- ${entry.id} | ${entry.nome} => ${entry.codigo}`);
  });

  if (!apply) {
    console.log("\nModo dry-run. Nenhuma alteracao aplicada.");
    console.log("Para aplicar, execute: node scripts/backfill-item-codes.mjs --apply");
    return;
  }

  const BATCH_LIMIT = 450;
  for (let i = 0; i < assignments.length; i += BATCH_LIMIT) {
    const slice = assignments.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    slice.forEach((entry) => {
      const ref = db.collection("items").doc(entry.id);
      batch.update(ref, { codigo: entry.codigo });
    });
    await batch.commit();
    console.log(`Lote aplicado: ${i + 1}-${i + slice.length}`);
  }

  await db.collection("systemCounters").doc("itemsCode").set(
    {
      current: nextCode,
      updatedAt: new Date(),
    },
    { merge: true }
  );

  console.log("\nBackfill concluido com sucesso.");
};

run().catch((error) => {
  console.error("Erro no backfill:", error.message);
  process.exitCode = 1;
});

