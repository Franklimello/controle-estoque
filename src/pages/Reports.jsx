import { useState, useEffect } from "react";
import { useItems } from "../context/ItemsContext";
import { useAuth } from "../context/AuthContext";
import { getEntries } from "../services/entries";
import { getExits } from "../services/exits";
import { FileText, BarChart3, AlertTriangle, Package, FileSpreadsheet, Printer } from "lucide-react";
import { formatDate } from "../utils/validators";
import { formatExpiryDate, checkExpiringDate } from "../utils/dateUtils";
import * as XLSX from "xlsx";

const Reports = () => {
  const { items, lowStockItems, expiringItems, loading: itemsLoading } = useItems();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState("stock");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [entries, setEntries] = useState([]);
  const [exits, setExits] = useState([]);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    loadReportData();
  }, [reportType, dateRange]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      if (reportType === "movements") {
        const [allEntries, allExits] = await Promise.all([
          getEntries(),
          getExits(),
        ]);
        
        // Filtrar por período completo
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);

        const filteredEntries = allEntries.filter((entry) => {
          const entryDate = entry.data?.toDate ? entry.data.toDate() : new Date(entry.createdAt?.toDate?.() || entry.createdAt);
          return entryDate >= startDate && entryDate <= endDate;
        });

        const filteredExits = allExits.filter((exit) => {
          const exitDate = exit.data?.toDate ? exit.data.toDate() : new Date(exit.createdAt?.toDate?.() || exit.createdAt);
          return exitDate >= startDate && exitDate <= endDate;
        });

        setEntries(filteredEntries);
        setExits(filteredExits);
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
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const stats = calculateStatistics();

  if (itemsLoading || loading) {
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <FileText className="w-8 h-8 mr-3 text-blue-600" />
            Relatórios
          </h1>
          <div className="flex gap-3">
            <button
              onClick={exportReportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Exportar Excel
            </button>
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Printer className="w-5 h-5" />
              Imprimir
            </button>
          </div>
        </div>

        {/* Tipo de Relatório */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Tipo de Relatório</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setReportType("stock")}
              className={`p-4 rounded-lg border-2 transition ${
                reportType === "stock"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Package className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <p className="font-semibold">Estoque</p>
            </button>
            <button
              onClick={() => setReportType("movements")}
              className={`p-4 rounded-lg border-2 transition ${
                reportType === "movements"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <BarChart3 className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <p className="font-semibold">Movimentações</p>
            </button>
            <button
              onClick={() => setReportType("expiry")}
              className={`p-4 rounded-lg border-2 transition ${
                reportType === "expiry"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-600" />
              <p className="font-semibold">Vencimentos</p>
            </button>
          </div>
        </div>

        {/* Filtros de Período */}
        {reportType === "movements" && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Período</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Final
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo do Relatório */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {reportType === "stock" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">Relatório de Estoque</h2>
              
              {/* Estatísticas */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">Total de Itens</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.totalItems}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Quantidade Total</p>
                  <p className="text-2xl font-bold text-green-600">{stats.totalQuantity}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-sm text-gray-600">Estoque Baixo</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.lowStockCount}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-600">Próximos Vencimento</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.expiringCount}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-gray-600">Vencidos</p>
                  <p className="text-2xl font-bold text-red-600">{stats.expiredCount}</p>
                </div>
              </div>

              {/* Itens por Categoria */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Itens por Categoria</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(stats.itemsByCategory).map(([cat, count]) => (
                    <div key={cat} className="bg-gray-50 p-3 rounded-lg border">
                      <p className="font-semibold">{cat}</p>
                      <p className="text-2xl font-bold text-gray-800">{count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 10 Itens */}
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Top 10 Itens por Quantidade</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Nome</th>
                        <th className="px-4 py-2 text-left">Código</th>
                        <th className="px-4 py-2 text-left">Categoria</th>
                        <th className="px-4 py-2 text-right">Quantidade</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
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
                          <tr key={item.id} className="border-b">
                            <td className="px-4 py-2">{item.nome || "-"}</td>
                            <td className="px-4 py-2">{item.codigo || "-"}</td>
                            <td className="px-4 py-2">{item.categoria || "-"}</td>
                            <td className="px-4 py-2 text-right">
                              {item.quantidade || 0} {item.unidade || "UN"}
                            </td>
                            <td className="px-4 py-2">{status}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportType === "movements" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">Relatório de Movimentações</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Total Entradas</p>
                  <p className="text-2xl font-bold text-green-600">{stats.totalEntries}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-gray-600">Total Saídas</p>
                  <p className="text-2xl font-bold text-red-600">{stats.totalExits}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">Saldo</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.totalEntries - stats.totalExits}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Entradas</h3>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-green-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">Data</th>
                          <th className="px-4 py-2 text-left">Código</th>
                          <th className="px-4 py-2 text-right">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id} className="border-b">
                            <td className="px-4 py-2">{formatDate(entry.data || entry.createdAt)}</td>
                            <td className="px-4 py-2">{entry.codigo || "-"}</td>
                            <td className="px-4 py-2 text-right text-green-600 font-semibold">
                              +{entry.quantidade || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Saídas</h3>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-red-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">Data</th>
                          <th className="px-4 py-2 text-left">Código</th>
                          <th className="px-4 py-2 text-right">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exits.map((exit) => (
                          <tr key={exit.id} className="border-b">
                            <td className="px-4 py-2">{formatDate(exit.data || exit.createdAt)}</td>
                            <td className="px-4 py-2">{exit.codigo || "-"}</td>
                            <td className="px-4 py-2 text-right text-red-600 font-semibold">
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
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">Relatório de Vencimentos</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-gray-600">Itens Vencidos</p>
                  <p className="text-2xl font-bold text-red-600">{stats.expiredCount}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-600">Próximos do Vencimento</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.expiringCount}</p>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Itens Vencidos</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-red-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Código</th>
                        <th className="px-4 py-2 text-left">Nome</th>
                        <th className="px-4 py-2 text-left">Categoria</th>
                        <th className="px-4 py-2 text-right">Quantidade</th>
                        <th className="px-4 py-2 text-left">Validade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .filter((item) => {
                          const expiryInfo = checkExpiringDate(item.validade);
                          return expiryInfo.isExpired;
                        })
                        .map((item) => (
                          <tr key={item.id} className="border-b">
                            <td className="px-4 py-2">{item.codigo || "-"}</td>
                            <td className="px-4 py-2">{item.nome || "-"}</td>
                            <td className="px-4 py-2">{item.categoria || "-"}</td>
                            <td className="px-4 py-2 text-right">
                              {item.quantidade || 0} {item.unidade || "UN"}
                            </td>
                            <td className="px-4 py-2 text-red-600 font-semibold">
                              {item.validade ? formatExpiryDate(item.validade) : "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-4">Itens Próximos do Vencimento</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-yellow-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Código</th>
                        <th className="px-4 py-2 text-left">Nome</th>
                        <th className="px-4 py-2 text-left">Categoria</th>
                        <th className="px-4 py-2 text-right">Quantidade</th>
                        <th className="px-4 py-2 text-left">Validade</th>
                        <th className="px-4 py-2 text-left">Dias Restantes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiringItems.map((item) => {
                        const expiryInfo = checkExpiringDate(item.validade);
                        return (
                          <tr key={item.id} className="border-b">
                            <td className="px-4 py-2">{item.codigo || "-"}</td>
                            <td className="px-4 py-2">{item.nome || "-"}</td>
                            <td className="px-4 py-2">{item.categoria || "-"}</td>
                            <td className="px-4 py-2 text-right">
                              {item.quantidade || 0} {item.unidade || "UN"}
                            </td>
                            <td className="px-4 py-2">
                              {item.validade ? formatExpiryDate(item.validade) : "-"}
                            </td>
                            <td className="px-4 py-2 text-yellow-600 font-semibold">
                              {expiryInfo.daysUntilExpiry || 0} dias
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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

