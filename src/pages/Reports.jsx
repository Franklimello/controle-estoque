import { useState, useEffect } from "react";
import { useItems } from "../context/ItemsContext";
import { useAuth } from "../context/AuthContext";
import { getEntries, getEntriesByDateRange } from "../services/entries";
import { getExits, getExitsByDateRange } from "../services/exits";
import { getOrdersByDateRange } from "../services/orders";
import { generateFullBackup } from "../services/backup";
import { FileText, BarChart3, AlertTriangle, Package, FileSpreadsheet, Printer, ArrowDownCircle, ArrowUpCircle, Download, Database, ShoppingCart } from "lucide-react";
import { formatDate } from "../utils/validators";
import { formatExpiryDate, checkExpiringDate } from "../utils/dateUtils";
import { useToastContext } from "../context/ToastContext";
import * as XLSX from "xlsx";

const Reports = () => {
  const { items, lowStockItems, expiringItems, loading: itemsLoading } = useItems();
  const { currentUser, isAdmin } = useAuth();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [reportType, setReportType] = useState("stock");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [entries, setEntries] = useState([]);
  const [exits, setExits] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all"); // all, pendente, aprovado, rejeitado, finalizado
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    loadReportData();
  }, [reportType, dateRange, items, orderStatusFilter]);

  const loadReportData = async () => {
    // Não mostrar loading ao mudar apenas o tipo de relatório (stock, expiry não precisam de dados externos)
    if (reportType === "stock" || reportType === "expiry") {
      return;
    }
    setLoading(true);
    try {
      if (reportType === "movements" || reportType === "entries" || reportType === "exits") {
        if (reportType === "entries") {
          // Buscar apenas entradas no intervalo
          const entriesData = await getEntriesByDateRange(dateRange.start, dateRange.end);
          // Adicionar nome do item às entradas
          const entriesWithNames = entriesData.map(entry => {
            const item = items.find(it => it.id === entry.itemId);
            return {
              ...entry,
              nome: item?.nome || "-"
            };
          });
          setEntries(entriesWithNames);
          setExits([]);
          setOrders([]);
        } else if (reportType === "exits") {
          // Buscar apenas saídas no intervalo
          const exitsData = await getExitsByDateRange(dateRange.start, dateRange.end);
          setExits(exitsData);
          setEntries([]);
          setOrders([]);
        } else {
          // Buscar entradas e saídas no intervalo (movimentações)
          const [entriesData, exitsData] = await Promise.all([
            getEntriesByDateRange(dateRange.start, dateRange.end),
            getExitsByDateRange(dateRange.start, dateRange.end),
          ]);
          // Adicionar nome do item às entradas
          const entriesWithNames = entriesData.map(entry => {
            const item = items.find(it => it.id === entry.itemId);
            return {
              ...entry,
              nome: item?.nome || "-"
            };
          });
          setEntries(entriesWithNames);
          setExits(exitsData);
          setOrders([]);
        }
      } else if (reportType === "orders") {
        // Buscar pedidos no intervalo
        const status = orderStatusFilter !== "all" ? orderStatusFilter : null;
        const ordersData = await getOrdersByDateRange(dateRange.start, dateRange.end, status);
        setOrders(ordersData);
        setEntries([]);
        setExits([]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados do relatório:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = () => {
    const stats = {
      totalItems: items.length,
      totalQuantity: items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0),
      lowStockCount: lowStockItems.length,
      expiringCount: expiringItems.length,
      expiredCount: items.filter((item) => {
        const expiryInfo = checkExpiringDate(item.validade);
        return expiryInfo.isExpired;
      }).length,
      totalEntries: entries.reduce((sum, e) => sum + (e.quantidade || 0), 0),
      totalExits: exits.reduce((sum, e) => sum + (e.quantidade || 0), 0),
      totalOrders: orders.length,
      ordersByStatus: {
        pendente: orders.filter(o => o.status === "pendente").length,
        aprovado: orders.filter(o => o.status === "aprovado").length,
        rejeitado: orders.filter(o => o.status === "rejeitado").length,
        finalizado: orders.filter(o => o.status === "finalizado").length,
      },
      itemsByCategory: {},
      itemsBySupplier: {},
      topItems: [],
    };

    // Agrupar por categoria
    items.forEach((item) => {
      const cat = item.categoria || "Sem categoria";
      stats.itemsByCategory[cat] = (stats.itemsByCategory[cat] || 0) + 1;
    });

    // Agrupar por fornecedor
    items.forEach((item) => {
      const sup = item.fornecedor || "Sem fornecedor";
      stats.itemsBySupplier[sup] = (stats.itemsBySupplier[sup] || 0) + 1;
    });

    // Top 10 itens por quantidade
    stats.topItems = [...items]
      .sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0))
      .slice(0, 10);

    return stats;
  };

  const exportReportToExcel = () => {
    const stats = calculateStatistics();
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).replace(/\//g, "-");

    let excelData = [];
    let filename = "";

    if (reportType === "stock") {
      excelData = [
        ["RELATÓRIO COMPLETO DE ESTOQUE"],
        [],
        ["Data do Relatório:", now.toLocaleDateString("pt-BR")],
        ["Hora do Relatório:", now.toLocaleTimeString("pt-BR")],
        [],
        ["RESUMO ESTATÍSTICO"],
        ["Total de Itens:", stats.totalItems],
        ["Quantidade Total em Estoque:", stats.totalQuantity],
        ["Itens com Estoque Baixo:", stats.lowStockCount],
        ["Itens Próximos do Vencimento:", stats.expiringCount],
        ["Itens Vencidos:", stats.expiredCount],
        [],
        ["ITENS POR CATEGORIA"],
        ["Categoria", "Quantidade de Itens"],
        ...Object.entries(stats.itemsByCategory).map(([cat, count]) => [cat, count]),
        [],
        ["ITENS POR FORNECEDOR"],
        ["Fornecedor", "Quantidade de Itens"],
        ...Object.entries(stats.itemsBySupplier).map(([sup, count]) => [sup, count]),
        [],
        ["TOP 10 ITENS POR QUANTIDADE"],
        ["Nome", "Código", "Categoria", "Quantidade", "Unidade", "Validade", "Status"],
        ...stats.topItems.map((item) => {
          const expiryInfo = checkExpiringDate(item.validade);
          const status = expiryInfo.isExpired
            ? "Vencido"
            : expiryInfo.isExpiring
            ? "Perto do vencimento"
            : Number(item.quantidade) < 11
            ? "Estoque baixo"
            : "OK";
          return [
            item.nome || "-",
            item.codigo || "-",
            item.categoria || "-",
            item.quantidade || 0,
            item.unidade || "UN",
            item.validade ? formatExpiryDate(item.validade) : "-",
            status,
          ];
        }),
        [],
        ["TODOS OS ITENS"],
        ["Código", "Nome", "Categoria", "Local", "Fornecedor", "Quantidade", "Unidade", "Validade", "Status"],
        ...items.map((item) => {
          const expiryInfo = checkExpiringDate(item.validade);
          const lowStock = Number(item.quantidade) < 11;
          const status = expiryInfo.isExpired
            ? "Vencido"
            : expiryInfo.isExpiring
            ? "Perto do vencimento"
            : lowStock
            ? "Estoque baixo"
            : "OK";
          return [
            item.codigo || "-",
            item.nome || "-",
            item.categoria || "-",
            item.local || "-",
            item.fornecedor || "-",
            item.quantidade || 0,
            item.unidade || "UN",
            item.validade ? formatExpiryDate(item.validade) : "-",
            status,
          ];
        }),
      ];
      filename = `relatorio-estoque-${dateStr}.xlsx`;
    } else if (reportType === "movements") {
      excelData = [
        ["RELATÓRIO DE MOVIMENTAÇÕES"],
        [],
        ["Período:", `${dateRange.start} a ${dateRange.end}`],
        ["Data do Relatório:", now.toLocaleDateString("pt-BR")],
        [],
        ["RESUMO"],
        ["Total de Entradas:", stats.totalEntries],
        ["Total de Saídas:", stats.totalExits],
        ["Saldo (Entradas - Saídas):", stats.totalEntries - stats.totalExits],
        [],
        ["ENTRADAS"],
        ["Data", "Código", "Nome", "Quantidade", "Fornecedor", "Observação"],
        ...entries.map((entry) => [
          formatDate(entry.data || entry.createdAt),
          entry.codigo || "-",
          entry.nome || "-",
          entry.quantidade || 0,
          entry.fornecedor || "-",
          entry.observacao || "-",
        ]),
        [],
        ["SAÍDAS"],
        ["Data", "Código", "Quantidade", "Setor Destino", "Retirado Por", "Observação"],
        ...exits.map((exit) => [
          formatDate(exit.data || exit.createdAt),
          exit.codigo || "-",
          exit.quantidade || 0,
          exit.setorDestino || "-",
          exit.retiradoPor || "-",
          exit.observacao || "-",
        ]),
      ];
      filename = `relatorio-movimentacoes-${dateStr}.xlsx`;
    } else if (reportType === "entries") {
      excelData = [
        ["RELATÓRIO DE ENTRADAS"],
        [],
        ["Período:", `${dateRange.start} a ${dateRange.end}`],
        ["Data do Relatório:", now.toLocaleDateString("pt-BR")],
        [],
        ["RESUMO"],
        ["Total de Entradas:", entries.length],
        ["Quantidade Total:", stats.totalEntries],
        [],
        ["ENTRADAS"],
        ["Data", "Código", "Nome", "Quantidade", "Fornecedor", "Validade", "Observação"],
        ...entries.map((entry) => [
          formatDate(entry.data || entry.createdAt),
          entry.codigo || "-",
          entry.nome || "-",
          entry.quantidade || 0,
          entry.fornecedor || "-",
          entry.validade ? formatExpiryDate(entry.validade) : "-",
          entry.observacao || "-",
        ]),
      ];
      filename = `relatorio-entradas-${dateStr}.xlsx`;
    } else if (reportType === "exits") {
      excelData = [
        ["RELATÓRIO DE SAÍDAS"],
        [],
        ["Período:", `${dateRange.start} a ${dateRange.end}`],
        ["Data do Relatório:", now.toLocaleDateString("pt-BR")],
        [],
        ["RESUMO"],
        ["Total de Saídas:", exits.length],
        ["Quantidade Total:", stats.totalExits],
        [],
        ["SAÍDAS"],
        ["Data", "Código", "Quantidade", "Setor Destino", "Retirado Por", "Observação"],
        ...exits.map((exit) => [
          formatDate(exit.data || exit.createdAt),
          exit.codigo || "-",
          exit.quantidade || 0,
          exit.setorDestino || "-",
          exit.retiradoPor || "-",
          exit.observacao || "-",
        ]),
      ];
      filename = `relatorio-saidas-${dateStr}.xlsx`;
    } else if (reportType === "orders") {
      excelData = [
        ["RELATÓRIO DE PEDIDOS"],
        [],
        ["Período:", `${dateRange.start} a ${dateRange.end}`],
        ["Filtro de Status:", orderStatusFilter === "all" ? "Todos" : orderStatusFilter],
        ["Data do Relatório:", now.toLocaleDateString("pt-BR")],
        [],
        ["RESUMO"],
        ["Total de Pedidos:", orders.length],
        ["Pendentes:", stats.ordersByStatus.pendente],
        ["Aprovados:", stats.ordersByStatus.aprovado],
        ["Rejeitados:", stats.ordersByStatus.rejeitado],
        ["Finalizados:", stats.ordersByStatus.finalizado],
        [],
        ["PEDIDOS"],
        ["ID", "Data", "Solicitado Por", "Setor Destino", "Status", "Total de Itens", "Observação", "Observação Admin"],
        ...orders.map((order) => {
          const totalItens = order.itens ? order.itens.length : 0;
          return [
            order.id.substring(0, 8) || "-",
            formatDate(order.createdAt),
            order.solicitadoPorNome || "-",
            order.setorDestino || "-",
            order.status || "-",
            totalItens,
            order.observacao || "-",
            order.observacaoAdmin || "-",
          ];
        }),
        [],
        ["DETALHAMENTO DE ITENS DOS PEDIDOS"],
        ["ID Pedido", "Item", "Código", "Quantidade", "Unidade", "Produto Customizado"],
        ...orders.flatMap((order) => {
          if (!order.itens || order.itens.length === 0) return [];
          return order.itens.map((item) => [
            order.id.substring(0, 8) || "-",
            item.nome || item.nomeProduto || "-",
            item.codigo || "-",
            item.quantidade || 0,
            item.unidade || "UN",
            item.isCustom ? "Sim" : "Não",
          ]);
        }),
      ];
      filename = `relatorio-pedidos-${dateStr}.xlsx`;
    } else if (reportType === "expiry") {
      const expiredItems = items.filter((item) => {
        const expiryInfo = checkExpiringDate(item.validade);
        return expiryInfo.isExpired;
      });
      const expiringItemsList = items.filter((item) => {
        const expiryInfo = checkExpiringDate(item.validade);
        return expiryInfo.isExpiring && !expiryInfo.isExpired;
      });

      excelData = [
        ["RELATÓRIO DE VENCIMENTOS"],
        [],
        ["Data do Relatório:", now.toLocaleDateString("pt-BR")],
        [],
        ["RESUMO"],
        ["Itens Vencidos:", expiredItems.length],
        ["Itens Próximos do Vencimento:", expiringItemsList.length],
        [],
        ["ITENS VENCIDOS"],
        ["Código", "Nome", "Categoria", "Quantidade", "Unidade", "Data de Validade"],
        ...expiredItems.map((item) => [
          item.codigo || "-",
          item.nome || "-",
          item.categoria || "-",
          item.quantidade || 0,
          item.unidade || "UN",
          item.validade ? formatExpiryDate(item.validade) : "-",
        ]),
        [],
        ["ITENS PRÓXIMOS DO VENCIMENTO"],
        ["Código", "Nome", "Categoria", "Quantidade", "Unidade", "Data de Validade", "Dias Restantes"],
        ...expiringItemsList.map((item) => {
          const expiryInfo = checkExpiringDate(item.validade);
          return [
            item.codigo || "-",
            item.nome || "-",
            item.categoria || "-",
            item.quantidade || 0,
            item.unidade || "UN",
            item.validade ? formatExpiryDate(item.validade) : "-",
            expiryInfo.daysUntilExpiry || 0,
          ];
        }),
      ];
      filename = `relatorio-vencimentos-${dateStr}.xlsx`;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    
    // Ajustar larguras
    ws["!cols"] = Array(10).fill(null).map(() => ({ wch: 20 }));
    
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, filename);
  };

  const handleFullBackup = async () => {
    if (!isAdmin) {
      showError("Apenas administradores podem gerar backups completos.");
      return;
    }

    setBackupLoading(true);
    try {
      const zipBlob = await generateFullBackup();
      
      // Criar link de download
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      
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
      
      link.download = `backup-completo-${dateStr}_${timeStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      success("Backup completo gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar backup:", error);
      showError("Erro ao gerar backup: " + error.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const printReport = () => {
    const stats = calculateStatistics();
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    
    let html = "";

    if (reportType === "stock") {
      html = `
        <html>
          <head>
            <title>Relatório de Estoque</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
              h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
              h2 { color: #374151; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background: #f3f4f6; font-weight: bold; }
              .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
              .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
              .stat-label { font-size: 12px; color: #6b7280; }
              .stat-value { font-size: 24px; font-weight: bold; color: #111; margin-top: 5px; }
              @media print { button { display: none; } }
            </style>
          </head>
          <body>
            <h1>Relatório Completo de Estoque</h1>
            <p><strong>Data:</strong> ${new Date().toLocaleString("pt-BR")}</p>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total de Itens</div>
                <div class="stat-value">${stats.totalItems}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Quantidade Total</div>
                <div class="stat-value">${stats.totalQuantity}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Estoque Baixo</div>
                <div class="stat-value">${stats.lowStockCount}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Próximos do Vencimento</div>
                <div class="stat-value">${stats.expiringCount}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Vencidos</div>
                <div class="stat-value">${stats.expiredCount}</div>
              </div>
            </div>

            <h2>Itens por Categoria</h2>
            <table>
              <thead>
                <tr><th>Categoria</th><th>Quantidade</th></tr>
              </thead>
              <tbody>
                ${Object.entries(stats.itemsByCategory).map(([cat, count]) => `
                  <tr><td>${cat}</td><td>${count}</td></tr>
                `).join("")}
              </tbody>
            </table>

            <h2>Top 10 Itens por Quantidade</h2>
            <table>
              <thead>
                <tr><th>Nome</th><th>Código</th><th>Categoria</th><th>Quantidade</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${stats.topItems.map((item) => {
                  const expiryInfo = checkExpiringDate(item.validade);
                  const status = expiryInfo.isExpired
                    ? "Vencido"
                    : expiryInfo.isExpiring
                    ? "Perto do vencimento"
                    : Number(item.quantidade) < 11
                    ? "Estoque baixo"
                    : "OK";
                  return `
                    <tr>
                      <td>${item.nome || "-"}</td>
                      <td>${item.codigo || "-"}</td>
                      <td>${item.categoria || "-"}</td>
                      <td>${item.quantidade || 0} ${item.unidade || "UN"}</td>
                      <td>${status}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>

            <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #1e40af; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Imprimir / Salvar PDF
            </button>
          </body>
        </html>
      `;
    } else if (reportType === "movements") {
      html = `
        <html>
          <head>
            <title>Relatório de Movimentações</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
              h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
              h2 { color: #374151; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background: #f3f4f6; font-weight: bold; }
              @media print { button { display: none; } }
            </style>
          </head>
          <body>
            <h1>Relatório de Movimentações</h1>
            <p><strong>Período:</strong> ${dateRange.start} a ${dateRange.end}</p>
            <p><strong>Data do Relatório:</strong> ${new Date().toLocaleString("pt-BR")}</p>
            
            <h2>Resumo</h2>
            <p><strong>Total de Entradas:</strong> ${stats.totalEntries}</p>
            <p><strong>Total de Saídas:</strong> ${stats.totalExits}</p>
            <p><strong>Saldo:</strong> ${stats.totalEntries - stats.totalExits}</p>

            <h2>Entradas</h2>
            <table>
              <thead>
                <tr><th>Data</th><th>Código</th><th>Quantidade</th><th>Fornecedor</th></tr>
              </thead>
              <tbody>
                ${entries.map((entry) => `
                  <tr>
                    <td>${formatDate(entry.data || entry.createdAt)}</td>
                    <td>${entry.codigo || "-"}</td>
                    <td>${entry.quantidade || 0}</td>
                    <td>${entry.fornecedor || "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <h2>Saídas</h2>
            <table>
              <thead>
                <tr><th>Data</th><th>Código</th><th>Quantidade</th><th>Setor</th></tr>
              </thead>
              <tbody>
                ${exits.map((exit) => `
                  <tr>
                    <td>${formatDate(exit.data || exit.createdAt)}</td>
                    <td>${exit.codigo || "-"}</td>
                    <td>${exit.quantidade || 0}</td>
                    <td>${exit.setorDestino || "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #1e40af; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Imprimir / Salvar PDF
            </button>
          </body>
        </html>
      `;
    } else if (reportType === "entries") {
      html = `
        <html>
          <head>
            <title>Relatório de Entradas</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
              h1 { color: #059669; border-bottom: 3px solid #059669; padding-bottom: 10px; }
              h2 { color: #374151; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background: #f3f4f6; font-weight: bold; }
              @media print { button { display: none; } }
            </style>
          </head>
          <body>
            <h1>Relatório de Entradas</h1>
            <p><strong>Período:</strong> ${dateRange.start} a ${dateRange.end}</p>
            <p><strong>Data do Relatório:</strong> ${new Date().toLocaleString("pt-BR")}</p>
            
            <h2>Resumo</h2>
            <p><strong>Total de Entradas:</strong> ${entries.length}</p>
            <p><strong>Quantidade Total:</strong> ${stats.totalEntries}</p>

            <h2>Entradas</h2>
            <table>
              <thead>
                <tr><th>Data</th><th>Código</th><th>Nome</th><th>Quantidade</th><th>Fornecedor</th><th>Validade</th><th>Observação</th></tr>
              </thead>
              <tbody>
                ${entries.length === 0 ? '<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhuma entrada encontrada no período selecionado</td></tr>' : entries.map((entry) => `
                  <tr>
                    <td>${formatDate(entry.data || entry.createdAt)}</td>
                    <td>${entry.codigo || "-"}</td>
                    <td>${entry.nome || "-"}</td>
                    <td>${entry.quantidade || 0}</td>
                    <td>${entry.fornecedor || "-"}</td>
                    <td>${entry.validade ? formatExpiryDate(entry.validade) : "-"}</td>
                    <td>${entry.observacao || "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #059669; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Imprimir / Salvar PDF
            </button>
          </body>
        </html>
      `;
    } else if (reportType === "exits") {
      html = `
        <html>
          <head>
            <title>Relatório de Saídas</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
              h1 { color: #e11d48; border-bottom: 3px solid #e11d48; padding-bottom: 10px; }
              h2 { color: #374151; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background: #f3f4f6; font-weight: bold; }
              @media print { button { display: none; } }
            </style>
          </head>
          <body>
            <h1>Relatório de Saídas</h1>
            <p><strong>Período:</strong> ${dateRange.start} a ${dateRange.end}</p>
            <p><strong>Data do Relatório:</strong> ${new Date().toLocaleString("pt-BR")}</p>
            
            <h2>Resumo</h2>
            <p><strong>Total de Saídas:</strong> ${exits.length}</p>
            <p><strong>Quantidade Total:</strong> ${stats.totalExits}</p>

            <h2>Saídas</h2>
            <table>
              <thead>
                <tr><th>Data</th><th>Código</th><th>Quantidade</th><th>Setor Destino</th><th>Retirado Por</th><th>Observação</th></tr>
              </thead>
              <tbody>
                ${exits.length === 0 ? '<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhuma saída encontrada no período selecionado</td></tr>' : exits.map((exit) => `
                  <tr>
                    <td>${formatDate(exit.data || exit.createdAt)}</td>
                    <td>${exit.codigo || "-"}</td>
                    <td>${exit.quantidade || 0}</td>
                    <td>${exit.setorDestino || "-"}</td>
                    <td>${exit.retiradoPor || "-"}</td>
                    <td>${exit.observacao || "-"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #e11d48; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Imprimir / Salvar PDF
            </button>
          </body>
        </html>
      `;
    } else if (reportType === "orders") {
      html = `
        <html>
          <head>
            <title>Relatório de Pedidos</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
              h1 { color: #6366f1; border-bottom: 3px solid #6366f1; padding-bottom: 10px; }
              h2 { color: #374151; margin-top: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background: #f3f4f6; font-weight: bold; }
              .status-pendente { color: #f59e0b; font-weight: bold; }
              .status-aprovado { color: #3b82f6; font-weight: bold; }
              .status-rejeitado { color: #ef4444; font-weight: bold; }
              .status-finalizado { color: #10b981; font-weight: bold; }
              @media print { button { display: none; } }
            </style>
          </head>
          <body>
            <h1>Relatório de Pedidos</h1>
            <p><strong>Período:</strong> ${dateRange.start} a ${dateRange.end}</p>
            <p><strong>Filtro de Status:</strong> ${orderStatusFilter === "all" ? "Todos" : orderStatusFilter}</p>
            <p><strong>Data do Relatório:</strong> ${new Date().toLocaleString("pt-BR")}</p>
            
            <h2>Resumo</h2>
            <p><strong>Total de Pedidos:</strong> ${orders.length}</p>
            <p><strong>Pendentes:</strong> ${stats.ordersByStatus.pendente}</p>
            <p><strong>Aprovados:</strong> ${stats.ordersByStatus.aprovado}</p>
            <p><strong>Rejeitados:</strong> ${stats.ordersByStatus.rejeitado}</p>
            <p><strong>Finalizados:</strong> ${stats.ordersByStatus.finalizado}</p>

            <h2>Pedidos</h2>
            <table>
              <thead>
                <tr><th>ID</th><th>Data</th><th>Solicitado Por</th><th>Setor</th><th>Status</th><th>Total Itens</th><th>Observação</th></tr>
              </thead>
              <tbody>
                ${orders.length === 0 ? '<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhum pedido encontrado no período selecionado</td></tr>' : orders.map((order) => {
                  const statusClass = order.status === "pendente" ? "status-pendente" : 
                                     order.status === "aprovado" ? "status-aprovado" :
                                     order.status === "rejeitado" ? "status-rejeitado" :
                                     "status-finalizado";
                  return `
                    <tr>
                      <td>${order.id.substring(0, 8) || "-"}</td>
                      <td>${formatDate(order.createdAt)}</td>
                      <td>${order.solicitadoPorNome || "-"}</td>
                      <td>${order.setorDestino || "-"}</td>
                      <td class="${statusClass}">${order.status || "-"}</td>
                      <td>${order.itens ? order.itens.length : 0}</td>
                      <td>${order.observacao || "-"}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>

            <h2>Detalhamento de Itens</h2>
            <table>
              <thead>
                <tr><th>ID Pedido</th><th>Item</th><th>Código</th><th>Quantidade</th><th>Unidade</th><th>Customizado</th></tr>
              </thead>
              <tbody>
                ${orders.length === 0 ? '<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhum item encontrado</td></tr>' : orders.flatMap((order) => {
                  if (!order.itens || order.itens.length === 0) return [];
                  return order.itens.map((item) => `
                    <tr>
                      <td>${order.id.substring(0, 8) || "-"}</td>
                      <td>${item.nome || item.nomeProduto || "-"}</td>
                      <td>${item.codigo || "-"}</td>
                      <td>${item.quantidade || 0}</td>
                      <td>${item.unidade || "UN"}</td>
                      <td>${item.isCustom ? "Sim" : "Não"}</td>
                    </tr>
                  `);
                }).join("")}
              </tbody>
            </table>

            <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Imprimir / Salvar PDF
            </button>
          </body>
        </html>
      `;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const stats = calculateStatistics();

  // Só mostrar loading na primeira carga, não ao mudar entre relatórios
  if (itemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <div className="loading-ring">
            <i></i>
            <i></i>
          </div>
          <p className="text-gray-700 font-medium">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-2 sm:px-4 lg:px-6 py-4 lg:py-6 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 lg:mb-6 gap-4">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center">
            <FileText className="w-6 h-6 lg:w-8 lg:h-8 mr-2 lg:mr-3 text-blue-600" />
            Relatórios
          </h1>
          <div className="flex flex-wrap gap-2 lg:gap-3">
            {isAdmin && (
              <button
                onClick={handleFullBackup}
                disabled={backupLoading}
                className="flex items-center gap-2 px-3 py-2 lg:px-4 text-sm lg:text-base bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Gerar backup completo de todos os dados do sistema"
              >
                <Database className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden sm:inline">{backupLoading ? "Gerando Backup..." : "Backup Completo"}</span>
                <span className="sm:hidden">{backupLoading ? "..." : "Backup"}</span>
              </button>
            )}
            <button
              onClick={exportReportToExcel}
              className="flex items-center gap-2 px-3 py-2 lg:px-4 text-sm lg:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <FileSpreadsheet className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">Exportar Excel</span>
              <span className="sm:hidden">Excel</span>
            </button>
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-3 py-2 lg:px-4 text-sm lg:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Printer className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">Imprimir</span>
              <span className="sm:hidden">Print</span>
            </button>
          </div>
        </div>

        {/* Tipo de Relatório */}
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6 w-full max-w-[95vw] sm:max-w-full mx-auto overflow-hidden">
          <h2 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Tipo de Relatório</h2>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 lg:gap-4 items-start">
            <button
              onClick={() => setReportType("stock")}
              className={`p-2 lg:p-3 rounded-lg border-2 transition flex items-center gap-2 w-fit ${
                reportType === "stock"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Package className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600 flex-shrink-0" />
              <p className="font-semibold text-xs lg:text-sm whitespace-nowrap">Estoque</p>
            </button>
            <button
              onClick={() => setReportType("movements")}
              className={`p-2 lg:p-3 rounded-lg border-2 transition flex items-center gap-2 w-fit ${
                reportType === "movements"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <BarChart3 className="w-4 h-4 lg:w-5 lg:h-5 text-green-600 flex-shrink-0" />
              <p className="font-semibold text-xs lg:text-sm whitespace-nowrap">Movimentações</p>
            </button>
            <button
              onClick={() => setReportType("entries")}
              className={`p-2 lg:p-3 rounded-lg border-2 transition flex items-center gap-2 w-fit ${
                reportType === "entries"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <ArrowDownCircle className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-600 flex-shrink-0" />
              <p className="font-semibold text-xs lg:text-sm whitespace-nowrap">Entradas</p>
            </button>
            <button
              onClick={() => setReportType("exits")}
              className={`p-2 lg:p-3 rounded-lg border-2 transition flex items-center gap-2 w-fit ${
                reportType === "exits"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <ArrowUpCircle className="w-4 h-4 lg:w-5 lg:h-5 text-rose-600 flex-shrink-0" />
              <p className="font-semibold text-xs lg:text-sm whitespace-nowrap">Saídas</p>
            </button>
            <button
              onClick={() => setReportType("expiry")}
              className={`p-2 lg:p-3 rounded-lg border-2 transition flex items-center gap-2 w-fit ${
                reportType === "expiry"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <AlertTriangle className="w-4 h-4 lg:w-5 lg:h-5 text-red-600 flex-shrink-0" />
              <p className="font-semibold text-xs lg:text-sm whitespace-nowrap">Vencimentos</p>
            </button>
            <button
              onClick={() => setReportType("orders")}
              className={`p-2 lg:p-3 rounded-lg border-2 transition flex items-center gap-2 w-fit ${
                reportType === "orders"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <ShoppingCart className="w-4 h-4 lg:w-5 lg:h-5 text-indigo-600 flex-shrink-0" />
              <p className="font-semibold text-xs lg:text-sm whitespace-nowrap">Pedidos</p>
            </button>
          </div>
        </div>

        {/* Filtros de Período */}
        <div className={`bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6 w-full max-w-[95vw] sm:max-w-full mx-auto overflow-hidden transition-all duration-300 ease-in-out ${
          (reportType === "movements" || reportType === "entries" || reportType === "exits" || reportType === "orders")
            ? "opacity-100 max-h-[500px]"
            : "opacity-0 max-h-0 p-0 mb-0 overflow-hidden"
        }`}>
          {(reportType === "movements" || reportType === "entries" || reportType === "exits" || reportType === "orders") && (
            <>
            <h2 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Filtros</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full px-3 lg:px-4 py-2 text-sm lg:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                  Data Final
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full px-3 lg:px-4 py-2 text-sm lg:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {reportType === "orders" && (
              <div className="mt-3 lg:mt-4">
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                  Status do Pedido
                </label>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="w-full px-3 lg:px-4 py-2 text-sm lg:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="rejeitado">Rejeitado</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </div>
            )}
            </>
          )}
        </div>

        {/* Conteúdo do Relatório */}
        <div
          key={reportType}
          className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6 w-full max-w-[95vw] sm:max-w-full mx-auto overflow-hidden transition-all duration-300 ease-in-out"
        >
          {reportType === "stock" && (
            <div className="space-y-4 lg:space-y-6">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-800">Relatório de Estoque</h2>
              
              {/* Estatísticas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2 lg:gap-4">
                <div className="bg-blue-50 p-3 lg:p-4 rounded-lg border border-blue-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Total de Itens</p>
                  <p className="text-xl lg:text-2xl font-bold text-blue-600 mt-1">{stats.totalItems}</p>
                </div>
                <div className="bg-green-50 p-3 lg:p-4 rounded-lg border border-green-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Quantidade Total</p>
                  <p className="text-xl lg:text-2xl font-bold text-green-600 mt-1">{stats.totalQuantity}</p>
                </div>
                <div className="bg-orange-50 p-3 lg:p-4 rounded-lg border border-orange-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Estoque Baixo</p>
                  <p className="text-xl lg:text-2xl font-bold text-orange-600 mt-1">{stats.lowStockCount}</p>
                </div>
                <div className="bg-yellow-50 p-3 lg:p-4 rounded-lg border border-yellow-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Próximos Vencimento</p>
                  <p className="text-xl lg:text-2xl font-bold text-yellow-600 mt-1">{stats.expiringCount}</p>
                </div>
                <div className="bg-red-50 p-3 lg:p-4 rounded-lg border border-red-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Vencidos</p>
                  <p className="text-xl lg:text-2xl font-bold text-red-600 mt-1">{stats.expiredCount}</p>
                </div>
              </div>

              {/* Itens por Categoria */}
              <div>
                <h3 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Itens por Categoria</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 lg:gap-4">
                  {Object.entries(stats.itemsByCategory).map(([cat, count]) => (
                    <div key={cat} className="bg-gray-50 p-3 rounded-lg border">
                      <p className="font-semibold text-xs lg:text-sm">{cat}</p>
                      <p className="text-xl lg:text-2xl font-bold text-gray-800">{count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 10 Itens */}
              <div>
                <h3 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Top 10 Itens por Quantidade</h3>
                <div className="space-y-3">
                  {stats.topItems.map((item) => {
                    const expiryInfo = checkExpiringDate(item.validade);
                    const status = expiryInfo.isExpired
                      ? "Vencido"
                      : expiryInfo.isExpiring
                      ? "Perto do vencimento"
                      : Number(item.quantidade) < 11
                      ? "Estoque baixo"
                      : "OK";
                    return (
                      <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 lg:p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Nome:</span>
                          <span className="text-xs lg:text-sm text-right max-w-[60%] break-words">{item.nome || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Código:</span>
                          <span className="text-xs lg:text-sm">{item.codigo || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Categoria:</span>
                          <span className="text-xs lg:text-sm">{item.categoria || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Quantidade:</span>
                          <span className="text-xs lg:text-sm">{item.quantidade || 0} {item.unidade || "UN"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Status:</span>
                          <span className="text-xs lg:text-sm">{status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {reportType === "entries" && (
            <div className="space-y-4 lg:space-y-6 transition-opacity duration-300">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-800">Relatório de Entradas</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-4">
                <div className="bg-emerald-50 p-3 lg:p-4 rounded-lg border border-emerald-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Total de Entradas</p>
                  <p className="text-xl lg:text-2xl font-bold text-emerald-600 mt-1">{entries.length}</p>
                </div>
                <div className="bg-green-50 p-3 lg:p-4 rounded-lg border border-green-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Quantidade Total</p>
                  <p className="text-xl lg:text-2xl font-bold text-green-600 mt-1">{stats.totalEntries}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Lista de Entradas</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {entries.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs lg:text-sm">
                      Nenhuma entrada encontrada no período selecionado
                    </div>
                  ) : (
                    entries.map((entry) => (
                      <div key={entry.id} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 lg:p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Data:</span>
                          <span className="text-xs lg:text-sm">{formatDate(entry.data || entry.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Código:</span>
                          <span className="text-xs lg:text-sm">{entry.codigo || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Nome:</span>
                          <span className="text-xs lg:text-sm text-right max-w-[60%] break-words">{entry.nome || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Quantidade:</span>
                          <span className="text-xs lg:text-sm text-emerald-600 font-semibold">+{entry.quantidade || 0}</span>
                        </div>
                        {entry.fornecedor && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Fornecedor:</span>
                            <span className="text-xs lg:text-sm text-right max-w-[60%] break-words">{entry.fornecedor}</span>
                          </div>
                        )}
                        {entry.validade && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Validade:</span>
                            <span className="text-xs lg:text-sm">{formatExpiryDate(entry.validade)}</span>
                          </div>
                        )}
                        {entry.observacao && (
                          <div className="flex items-start justify-between pt-2 border-t border-emerald-200">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Observação:</span>
                            <span className="text-xs lg:text-sm text-right max-w-[60%] break-words">{entry.observacao}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {reportType === "exits" && (
            <div className="space-y-4 lg:space-y-6 transition-opacity duration-300">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-800">Relatório de Saídas</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-4">
                <div className="bg-rose-50 p-3 lg:p-4 rounded-lg border border-rose-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Total de Saídas</p>
                  <p className="text-xl lg:text-2xl font-bold text-rose-600 mt-1">{exits.length}</p>
                </div>
                <div className="bg-red-50 p-3 lg:p-4 rounded-lg border border-red-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Quantidade Total</p>
                  <p className="text-xl lg:text-2xl font-bold text-red-600 mt-1">{stats.totalExits}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Lista de Saídas</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {exits.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs lg:text-sm">
                      Nenhuma saída encontrada no período selecionado
                    </div>
                  ) : (
                    exits.map((exit) => (
                      <div key={exit.id} className="bg-rose-50 border border-rose-200 rounded-lg p-3 lg:p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Data:</span>
                          <span className="text-xs lg:text-sm">{formatDate(exit.data || exit.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Código:</span>
                          <span className="text-xs lg:text-sm">{exit.codigo || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Quantidade:</span>
                          <span className="text-xs lg:text-sm text-rose-600 font-semibold">-{exit.quantidade || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Setor Destino:</span>
                          <span className="text-xs lg:text-sm text-right max-w-[60%] break-words">{exit.setorDestino || "-"}</span>
                        </div>
                        {exit.retiradoPor && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Retirado Por:</span>
                            <span className="text-xs lg:text-sm text-right max-w-[60%] break-words">{exit.retiradoPor}</span>
                          </div>
                        )}
                        {exit.observacao && (
                          <div className="flex items-start justify-between pt-2 border-t border-rose-200">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Observação:</span>
                            <span className="text-xs lg:text-sm text-right max-w-[60%] break-words">{exit.observacao}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {reportType === "movements" && (
            <div className="space-y-4 lg:space-y-6 transition-opacity duration-300">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-800">Relatório de Movimentações</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-4">
                <div className="bg-green-50 p-3 lg:p-4 rounded-lg border border-green-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Total Entradas</p>
                  <p className="text-xl lg:text-2xl font-bold text-green-600 mt-1">{stats.totalEntries}</p>
                </div>
                <div className="bg-red-50 p-3 lg:p-4 rounded-lg border border-red-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Total Saídas</p>
                  <p className="text-xl lg:text-2xl font-bold text-red-600 mt-1">{stats.totalExits}</p>
                </div>
                <div className="bg-blue-50 p-3 lg:p-4 rounded-lg border border-blue-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Saldo</p>
                  <p className="text-xl lg:text-2xl font-bold text-blue-600 mt-1">
                    {stats.totalEntries - stats.totalExits}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <h3 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Entradas</h3>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-xs lg:text-sm min-w-[300px]">
                      <thead className="bg-green-100 sticky top-0">
                        <tr>
                          <th className="px-2 lg:px-4 py-2 text-left">Data</th>
                          <th className="px-2 lg:px-4 py-2 text-left">Código</th>
                          <th className="px-2 lg:px-4 py-2 text-right">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id} className="border-b">
                            <td className="px-2 lg:px-4 py-2 whitespace-nowrap">{formatDate(entry.data || entry.createdAt)}</td>
                            <td className="px-2 lg:px-4 py-2">{entry.codigo || "-"}</td>
                            <td className="px-2 lg:px-4 py-2 text-right text-green-600 font-semibold whitespace-nowrap">
                              +{entry.quantidade || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Saídas</h3>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-xs lg:text-sm min-w-[300px]">
                      <thead className="bg-red-100 sticky top-0">
                        <tr>
                          <th className="px-2 lg:px-4 py-2 text-left">Data</th>
                          <th className="px-2 lg:px-4 py-2 text-left">Código</th>
                          <th className="px-2 lg:px-4 py-2 text-right">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exits.map((exit) => (
                          <tr key={exit.id} className="border-b">
                            <td className="px-2 lg:px-4 py-2 whitespace-nowrap">{formatDate(exit.data || exit.createdAt)}</td>
                            <td className="px-2 lg:px-4 py-2">{exit.codigo || "-"}</td>
                            <td className="px-2 lg:px-4 py-2 text-right text-red-600 font-semibold whitespace-nowrap">
                              -{exit.quantidade || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportType === "expiry" && (
            <div className="space-y-4 lg:space-y-6 transition-opacity duration-300">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-800">Relatório de Vencimentos</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-4">
                <div className="bg-red-50 p-3 lg:p-4 rounded-lg border border-red-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Itens Vencidos</p>
                  <p className="text-xl lg:text-2xl font-bold text-red-600 mt-1">{stats.expiredCount}</p>
                </div>
                <div className="bg-yellow-50 p-3 lg:p-4 rounded-lg border border-yellow-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Próximos do Vencimento</p>
                  <p className="text-xl lg:text-2xl font-bold text-yellow-600 mt-1">{stats.expiringCount}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Itens Vencidos</h3>
                <div className="space-y-3">
                  {items
                    .filter((item) => {
                      const expiryInfo = checkExpiringDate(item.validade);
                      return expiryInfo.isExpired;
                    })
                    .map((item) => (
                      <div key={item.id} className="bg-red-50 border border-red-200 rounded-lg p-3 lg:p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Código:</span>
                          <span className="text-xs lg:text-sm">{item.codigo || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Nome:</span>
                          <span className="text-xs lg:text-sm text-right max-w-[60%] break-words">{item.nome || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Categoria:</span>
                          <span className="text-xs lg:text-sm">{item.categoria || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Quantidade:</span>
                          <span className="text-xs lg:text-sm">{item.quantidade || 0} {item.unidade || "UN"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Validade:</span>
                          <span className="text-xs lg:text-sm text-red-600 font-semibold">
                            {item.validade ? formatExpiryDate(item.validade) : "-"}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Itens Próximos do Vencimento</h3>
                <div className="space-y-3">
                  {expiringItems.map((item) => {
                    const expiryInfo = checkExpiringDate(item.validade);
                    return (
                      <div key={item.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 lg:p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Código:</span>
                          <span className="text-xs lg:text-sm">{item.codigo || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Nome:</span>
                          <span className="text-xs lg:text-sm text-right max-w-[60%] break-words">{item.nome || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Categoria:</span>
                          <span className="text-xs lg:text-sm">{item.categoria || "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Quantidade:</span>
                          <span className="text-xs lg:text-sm">{item.quantidade || 0} {item.unidade || "UN"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Validade:</span>
                          <span className="text-xs lg:text-sm">{item.validade ? formatExpiryDate(item.validade) : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs lg:text-sm font-semibold text-gray-600">Dias Restantes:</span>
                          <span className="text-xs lg:text-sm text-yellow-600 font-semibold">
                            {expiryInfo.daysUntilExpiry || 0} dias
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {reportType === "orders" && (
            <div className="space-y-4 lg:space-y-6 transition-opacity duration-300">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-800">Relatório de Pedidos</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-4">
                <div className="bg-indigo-50 p-3 lg:p-4 rounded-lg border border-indigo-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Total de Pedidos</p>
                  <p className="text-xl lg:text-2xl font-bold text-indigo-600 mt-1">{orders.length}</p>
                </div>
                <div className="bg-yellow-50 p-3 lg:p-4 rounded-lg border border-yellow-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Pendentes</p>
                  <p className="text-xl lg:text-2xl font-bold text-yellow-600 mt-1">{stats.ordersByStatus.pendente}</p>
                </div>
                <div className="bg-blue-50 p-3 lg:p-4 rounded-lg border border-blue-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Aprovados</p>
                  <p className="text-xl lg:text-2xl font-bold text-blue-600 mt-1">{stats.ordersByStatus.aprovado}</p>
                </div>
                <div className="bg-red-50 p-3 lg:p-4 rounded-lg border border-red-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Rejeitados</p>
                  <p className="text-xl lg:text-2xl font-bold text-red-600 mt-1">{stats.ordersByStatus.rejeitado}</p>
                </div>
                <div className="bg-green-50 p-3 lg:p-4 rounded-lg border border-green-200 w-full">
                  <p className="text-xs lg:text-sm text-gray-600">Finalizados</p>
                  <p className="text-xl lg:text-2xl font-bold text-green-600 mt-1">{stats.ordersByStatus.finalizado}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Lista de Pedidos</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {orders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs lg:text-sm">
                      Nenhum pedido encontrado no período selecionado
                    </div>
                  ) : (
                    orders.map((order) => {
                      const getStatusColor = (status) => {
                        switch (status) {
                          case "pendente": return "text-yellow-700 bg-yellow-100";
                          case "aprovado": return "text-blue-700 bg-blue-100";
                          case "rejeitado": return "text-red-700 bg-red-100";
                          case "finalizado": return "text-green-700 bg-green-100";
                          default: return "text-gray-700 bg-gray-100";
                        }
                      };
                      return (
                        <div key={order.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 lg:p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">ID:</span>
                            <span className="text-xs lg:text-sm font-mono">{order.id.substring(0, 8)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Data:</span>
                            <span className="text-xs lg:text-sm">{formatDate(order.createdAt)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Solicitado Por:</span>
                            <span className="text-xs lg:text-sm truncate max-w-[60%]">{order.solicitadoPorNome || "-"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Setor:</span>
                            <span className="text-xs lg:text-sm">{order.setorDestino || "-"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Status:</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                              {order.status || "-"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Total Itens:</span>
                            <span className="text-xs lg:text-sm">{order.itens ? order.itens.length : 0}</span>
                          </div>
                          {order.observacao && (
                            <div className="flex items-start justify-between pt-2 border-t border-gray-200">
                              <span className="text-xs lg:text-sm font-semibold text-gray-600">Observação:</span>
                              <span className="text-xs lg:text-sm text-right max-w-[60%]">{order.observacao}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg lg:text-xl font-bold text-gray-800 mb-3 lg:mb-4">Detalhamento de Itens</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {orders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs lg:text-sm">
                      Nenhum item encontrado
                    </div>
                  ) : (
                    orders.flatMap((order) => {
                      if (!order.itens || order.itens.length === 0) return [];
                      return order.itens.map((item, index) => (
                        <div key={`${order.id}-${index}`} className="bg-gray-50 border border-gray-200 rounded-lg p-3 lg:p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">ID Pedido:</span>
                            <span className="text-xs lg:text-sm font-mono">{order.id.substring(0, 8)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Código:</span>
                            <span className="text-xs lg:text-sm">{item.codigo || "-"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Nome:</span>
                            <span className="text-xs lg:text-sm text-right max-w-[60%] break-words">{item.nome || item.nomeProduto || "-"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Quantidade:</span>
                            <span className="text-xs lg:text-sm">{item.quantidade || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Unidade:</span>
                            <span className="text-xs lg:text-sm">{item.unidade || "UN"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs lg:text-sm font-semibold text-gray-600">Tipo:</span>
                            {item.isCustom ? (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                                Customizado
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                                Cadastrado
                              </span>
                            )}
                          </div>
                        </div>
                      ));
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;

