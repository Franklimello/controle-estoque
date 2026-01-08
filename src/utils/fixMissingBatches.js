import { getItems } from "../services/items";
import { getBatchesByItem, addOrIncrementBatch, getEarliestBatchValidity } from "../services/batches";
import { updateItem } from "../services/items";

export const fixMissingBatches = async (userId) => {
  try {
    const allItems = await getItems(); // Pega todos os itens, incluindo expandidos
    let fixedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Filtrar apenas itens "originais" (não lotes expandidos) para processar
    const uniqueItems = allItems.filter(item => !item.isExpanded);

    for (const item of uniqueItems) {
      try {
        const quantidade = parseInt(item.quantidade || 0, 10);
        if (quantidade <= 0) continue;

        const batches = await getBatchesByItem(item.id);

        if (batches.length === 0) {
          const validade = item.validade && item.validade !== "sem-validade" 
            ? item.validade 
            : null;

          await addOrIncrementBatch(item.id, validade, quantidade);

          const earliestValidity = await getEarliestBatchValidity(item.id);
          if (earliestValidity) {
            await updateItem(item.id, { validade: earliestValidity }, userId);
          }

          fixedCount++;
        }
      } catch (error) {
        errorCount++;
        errors.push({
          item: item.nome || "Desconhecido",
          error: error.message || "Erro desconhecido"
        });
      }
    }

    return {
      success: true,
      total: uniqueItems.length,
      fixed: fixedCount,
      errors: errorCount,
      errorList: errors
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Erro desconhecido"
    };
  }
};

