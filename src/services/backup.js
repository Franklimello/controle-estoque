import JSZip from "jszip";
import * as XLSX from "xlsx";
import { getItems } from "./items";
import { getEntries } from "./entries";
import { getExits } from "./exits";
import { getAllBatches } from "./batches";
import { formatDate } from "../utils/validators";
import { formatExpiryDate } from "../utils/dateUtils";

/**
 * Gera backup completo do sistema em formato ZIP com múltiplos arquivos Excel
 * @returns {Promise<Blob>} Arquivo ZIP com todos os dados
 */
export const generateFullBackup = async () => {
  try {
    // Buscar todos os dados
    const [items, entries, exits, batches] = await Promise.all([
      getItems(),
      getEntries(),
      getExits(),
      getAllBatches(),
    ]);

    const zip = new JSZip();
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).replace(/\//g, "-");
    const timeStr = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).replace(/:/g, "-");

    // ========== ARQUIVO 1: ITENS ==========
    const itemsData = [
      ["BACKUP COMPLETO - ITENS DO ESTOQUE"],
      [],
      ["Data do Backup:", now.toLocaleString("pt-BR")],
      ["Total de Itens:", items.length],
      [],
      ["Código", "Nome", "Categoria", "Local", "Fornecedor", "Quantidade", "Unidade", "Validade", "Observações"],
      ...items.map((item) => [
        item.codigo || "-",
        item.nome || "-",
        item.categoria || "-",
        item.local || "-",
        item.fornecedor || "-",
        item.quantidade || 0,
        item.unidade || "UN",
        item.validade ? formatExpiryDate(item.validade) : "-",
        item.observacoes || "-",
      ]),
    ];

    const itemsWs = XLSX.utils.aoa_to_sheet(itemsData);
    itemsWs["!cols"] = Array(9).fill(null).map(() => ({ wch: 20 }));
    const itemsWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(itemsWb, itemsWs, "Itens");
    const itemsBuffer = XLSX.write(itemsWb, { type: "array", bookType: "xlsx" });
    zip.file("01-Itens.xlsx", itemsBuffer);

    // ========== ARQUIVO 2: ENTRADAS ==========
    const entriesData = [
      ["BACKUP COMPLETO - HISTÓRICO DE ENTRADAS"],
      [],
      ["Data do Backup:", now.toLocaleString("pt-BR")],
      ["Total de Entradas:", entries.length],
      [],
      ["ID", "Data", "Item ID", "Código", "Quantidade", "Validade", "Fornecedor", "Observação", "Usuário", "Criado em"],
      ...entries.map((entry) => [
        entry.id || "-",
        formatDate(entry.data || entry.createdAt),
        entry.itemId || "-",
        entry.codigo || "-",
        entry.quantidade || 0,
        entry.validade ? formatExpiryDate(entry.validade) : "-",
        entry.fornecedor || "-",
        entry.observacao || "-",
        entry.usuarioQueRegistrou || "-",
        formatDate(entry.createdAt),
      ]),
    ];

    const entriesWs = XLSX.utils.aoa_to_sheet(entriesData);
    entriesWs["!cols"] = Array(10).fill(null).map(() => ({ wch: 20 }));
    const entriesWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(entriesWb, entriesWs, "Entradas");
    const entriesBuffer = XLSX.write(entriesWb, { type: "array", bookType: "xlsx" });
    zip.file("02-Entradas.xlsx", entriesBuffer);

    // ========== ARQUIVO 3: SAÍDAS ==========
    const exitsData = [
      ["BACKUP COMPLETO - HISTÓRICO DE SAÍDAS"],
      [],
      ["Data do Backup:", now.toLocaleString("pt-BR")],
      ["Total de Saídas:", exits.length],
      [],
      ["ID", "Data", "Item ID", "Código", "Quantidade", "Setor Destino", "Retirado Por", "Observação", "Usuário", "Criado em"],
      ...exits.map((exit) => [
        exit.id || "-",
        formatDate(exit.data || exit.createdAt),
        exit.itemId || "-",
        exit.codigo || "-",
        exit.quantidade || 0,
        exit.setorDestino || "-",
        exit.retiradoPor || "-",
        exit.observacao || "-",
        exit.usuarioQueRegistrou || "-",
        formatDate(exit.createdAt),
      ]),
    ];

    const exitsWs = XLSX.utils.aoa_to_sheet(exitsData);
    exitsWs["!cols"] = Array(10).fill(null).map(() => ({ wch: 20 }));
    const exitsWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(exitsWb, exitsWs, "Saídas");
    const exitsBuffer = XLSX.write(exitsWb, { type: "array", bookType: "xlsx" });
    zip.file("03-Saidas.xlsx", exitsBuffer);

    // ========== ARQUIVO 4: LOTES ==========
    const batchesData = [
      ["BACKUP COMPLETO - LOTES DE ESTOQUE"],
      [],
      ["Data do Backup:", now.toLocaleString("pt-BR")],
      ["Total de Lotes:", batches.length],
      [],
      ["ID", "Item ID", "Validade", "Quantidade", "Criado em", "Atualizado em"],
      ...batches.map((batch) => [
        batch.id || "-",
        batch.itemId || "-",
        batch.validade ? formatExpiryDate(batch.validade) : "-",
        batch.quantidade || 0,
        formatDate(batch.createdAt),
        formatDate(batch.updatedAt),
      ]),
    ];

    const batchesWs = XLSX.utils.aoa_to_sheet(batchesData);
    batchesWs["!cols"] = Array(6).fill(null).map(() => ({ wch: 20 }));
    const batchesWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(batchesWb, batchesWs, "Lotes");
    const batchesBuffer = XLSX.write(batchesWb, { type: "array", bookType: "xlsx" });
    zip.file("04-Lotes.xlsx", batchesBuffer);

    // ========== ARQUIVO 5: RESUMO ==========
    const summaryData = [
      ["BACKUP COMPLETO - RESUMO DO SISTEMA"],
      [],
      ["Data do Backup:", now.toLocaleString("pt-BR")],
      [],
      ["ESTATÍSTICAS GERAIS"],
      ["Total de Itens:", items.length],
      ["Total de Entradas:", entries.length],
      ["Total de Saídas:", exits.length],
      ["Total de Lotes:", batches.length],
      [],
      ["QUANTIDADES"],
      ["Quantidade Total em Estoque:", items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0)],
      ["Quantidade Total de Entradas:", entries.reduce((sum, e) => sum + (e.quantidade || 0), 0)],
      ["Quantidade Total de Saídas:", exits.reduce((sum, e) => sum + (e.quantidade || 0), 0)],
      ["Quantidade Total em Lotes:", batches.reduce((sum, b) => sum + (b.quantidade || 0), 0)],
      [],
      ["ITENS POR CATEGORIA"],
      ["Categoria", "Quantidade"],
      ...Object.entries(
        items.reduce((acc, item) => {
          const cat = item.categoria || "Sem categoria";
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {})
      ).map(([cat, count]) => [cat, count]),
      [],
      ["ITENS POR FORNECEDOR"],
      ["Fornecedor", "Quantidade"],
      ...Object.entries(
        items.reduce((acc, item) => {
          const sup = item.fornecedor || "Sem fornecedor";
          acc[sup] = (acc[sup] || 0) + 1;
          return acc;
        }, {})
      ).map(([sup, count]) => [sup, count]),
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs["!cols"] = Array(2).fill(null).map(() => ({ wch: 30 }));
    const summaryWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(summaryWb, summaryWs, "Resumo");
    const summaryBuffer = XLSX.write(summaryWb, { type: "array", bookType: "xlsx" });
    zip.file("00-Resumo.xlsx", summaryBuffer);

    // ========== ARQUIVO README ==========
    const readmeContent = `BACKUP COMPLETO DO SISTEMA DE CONTROLE DE ESTOQUE

Data do Backup: ${now.toLocaleString("pt-BR")}

ESTRUTURA DO BACKUP:
===================

00-Resumo.xlsx
  - Estatísticas gerais do sistema
  - Resumo de itens, entradas, saídas e lotes
  - Distribuição por categoria e fornecedor

01-Itens.xlsx
  - Lista completa de todos os itens cadastrados
  - Inclui: código, nome, categoria, local, fornecedor, quantidade, unidade, validade

02-Entradas.xlsx
  - Histórico completo de todas as entradas registradas
  - Inclui: data, item, quantidade, validade, fornecedor, observações

03-Saidas.xlsx
  - Histórico completo de todas as saídas registradas
  - Inclui: data, item, quantidade, setor destino, retirado por, observações

04-Lotes.xlsx
  - Lista completa de todos os lotes de estoque
  - Inclui: item, validade, quantidade

INSTRUÇÕES:
==========

1. Este backup contém todos os dados do sistema na data indicada acima.
2. Guarde este arquivo em local seguro e faça backups regulares.
3. Para restaurar dados, use as planilhas Excel como referência.
4. Em caso de dúvidas, consulte o administrador do sistema.

IMPORTANTE:
==========

- Este backup é uma cópia de segurança dos dados.
- Não modifique os arquivos se planeja restaurar o sistema.
- Mantenha múltiplas cópias em locais diferentes para maior segurança.
`;

    zip.file("README.txt", readmeContent);

    // Gerar o arquivo ZIP
    const zipBlob = await zip.generateAsync({ type: "blob" });
    
    return zipBlob;
  } catch (error) {
    console.error("Erro ao gerar backup:", error);
    throw error;
  }
};

