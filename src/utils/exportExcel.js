import * as XLSX from "xlsx";
import { formatExpiryDate, checkExpiringDate } from "./dateUtils";

/**
 * Formata data para formato brasileiro (dd/mm/yyyy)
 * @param {Date|string|Timestamp} date - Data a ser formatada
 * @returns {string} Data formatada em dd/mm/yyyy
 */
const formatDateBR = (date) => {
  if (!date) return "";
  
  let dateObj;
  if (date.toDate) {
    dateObj = date.toDate();
  } else if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === "string") {
    dateObj = new Date(date);
  } else {
    return "";
  }
  
  if (Number.isNaN(dateObj.getTime())) return "";
  
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Determina o status do item baseado em estoque e validade
 * @param {Object} item - Item do estoque
 * @returns {string} Status do item
 */
const getItemStatus = (item) => {
  const lowStock = Number(item.quantidade || 0) < 11;
  const expiryInfo = checkExpiringDate(item.validade);
  const nearExpiry =
    expiryInfo.daysUntilExpiry !== null &&
    expiryInfo.daysUntilExpiry >= 0 &&
    expiryInfo.daysUntilExpiry <= 7;
  const isExpired = expiryInfo.isExpired;

  if (lowStock && nearExpiry) {
    return "Estoque baixo e perto do vencimento";
  } else if (lowStock) {
    return "Estoque baixo";
  } else if (isExpired) {
    return "Vencido";
  } else if (nearExpiry) {
    return "Perto do vencimento";
  } else {
    return "OK";
  }
};

/**
 * Exporta o estoque para Excel (.xlsx) com formatação profissional
 * @param {Array} items - Lista de itens do estoque
 */
export const exportStockToExcel = (items) => {
  if (!items || items.length === 0) {
    alert("Nenhum item para exportar");
    return;
  }

  // Data e hora da exportação
  const now = new Date();
  const exportDate = formatDateBR(now);
  const exportTime = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Calcular estatísticas
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
  const lowStockCount = items.filter((item) => Number(item.quantidade || 0) < 11).length;
  const expiringCount = items.filter((item) => {
    const expiryInfo = checkExpiringDate(item.validade);
    return expiryInfo.isExpiring && !expiryInfo.isExpired;
  }).length;
  const expiredCount = items.filter((item) => {
    const expiryInfo = checkExpiringDate(item.validade);
    return expiryInfo.isExpired;
  }).length;

  // Preparar dados para a planilha
  const excelData = [];

  // Cabeçalho informativo
  excelData.push(["CONTROLE DE ESTOQUE - RELATÓRIO GERENCIAL"]);
  excelData.push([]);
  excelData.push(["Data da Exportação:", exportDate]);
  excelData.push(["Hora da Exportação:", exportTime]);
  excelData.push(["Total de Itens:", totalItems]);
  excelData.push(["Quantidade Total em Estoque:", totalQuantity]);
  excelData.push([]);
  excelData.push(["RESUMO ESTATÍSTICO"]);
  excelData.push(["Itens com Estoque Baixo:", lowStockCount]);
  excelData.push(["Itens Próximos do Vencimento:", expiringCount]);
  excelData.push(["Itens Vencidos:", expiredCount]);
  excelData.push([]);
  excelData.push([]);

  // Cabeçalho da tabela
  excelData.push([
    "CÓDIGO",
    "NOME DO ITEM",
    "CATEGORIA",
    "LOCAL",
    "FORNECEDOR",
    "QUANTIDADE",
    "UNIDADE",
    "DATA DE VALIDADE",
    "STATUS",
    "OBSERVAÇÕES"
  ]);

  // Dados dos itens
  items.forEach((item) => {
    // Formatar validade
    let validade = "-";
    if (item.validade) {
      try {
        const formatted = formatExpiryDate(item.validade);
        if (formatted && formatted !== "Sem validade" && formatted !== "Data inválida") {
          validade = formatted;
        }
      } catch (error) {
        console.error("Erro ao formatar validade:", error);
        validade = "-";
      }
    }

    // Obter status
    const status = getItemStatus(item);

    excelData.push([
      item.codigo || "-",
      item.nome || "-",
      item.categoria || "-",
      item.local || "-",
      item.fornecedor || "-",
      item.quantidade || 0,
      item.unidade || "UN",
      validade,
      status,
      item.observacao || "-"
    ]);
  });

  // Linha de totais
  excelData.push([]);
  excelData.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    totalQuantity,
    "",
    "",
    "",
    ""
  ]);

  // Criar workbook
  const wb = XLSX.utils.book_new();
  
  // Criar worksheet a partir dos dados
  const ws = XLSX.utils.aoa_to_sheet(excelData);

  // Ajustar largura das colunas
  const colWidths = [
    { wch: 15 }, // Código
    { wch: 35 }, // Nome do item
    { wch: 20 }, // Categoria
    { wch: 20 }, // Local
    { wch: 25 }, // Fornecedor
    { wch: 12 }, // Quantidade
    { wch: 10 }, // Unidade
    { wch: 18 }, // Data de validade
    { wch: 30 }, // Status
    { wch: 30 }, // Observações
  ];
  ws["!cols"] = colWidths;

  // Mesclar células do título
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }); // Título principal
  ws["!merges"].push({ s: { r: 7, c: 0 }, e: { r: 7, c: 9 } }); // "RESUMO ESTATÍSTICO"

  // Adicionar worksheet ao workbook
  XLSX.utils.book_append_sheet(wb, ws, "Controle de Estoque");

  // Gerar arquivo Excel com data e hora no nome
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
  const filename = `controle-estoque-${dateStr}_${timeStr}.xlsx`;
  
  XLSX.writeFile(wb, filename);
};

