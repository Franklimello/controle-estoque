import { getItems } from "../services/items";
import { updateItem } from "../services/items";

export const normalizeAllItemNames = async (userId) => {
  try {
    const allItems = await getItems();
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const item of allItems) {
      // Apenas itens "originais" (não lotes expandidos)
      if (item.isExpanded) continue;

      const currentName = item.nome || "";
      const normalizedName = currentName.toUpperCase().trim();

      if (currentName !== normalizedName) {
        try {
          await updateItem(item.id, { nome: normalizedName }, userId);
          updatedCount++;
        } catch (error) {
          errorCount++;
          errors.push({
            item: currentName,
            error: error.message || "Erro desconhecido"
          });
        }
      }
    }

    return {
      success: true,
      total: allItems.length,
      updated: updatedCount,
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

