import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useItems } from "../context/ItemsContext";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import ItemCard from "../components/ItemCard";
import { Search, Plus, AlertTriangle, Clock, Printer, Filter, X, Package, ArrowDownCircle, ArrowUpCircle, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import { checkExpiringDate, formatExpiryDate } from "../utils/dateUtils";
import { exportStockToExcel } from "../utils/exportExcel";
import { usePagination } from "../hooks/usePagination";
import { ESTOQUE_BAIXO_LIMITE, VENCIMENTO_PROXIMO_DIAS } from "../config/constants";
import { fuzzySearch, sortByRelevance } from "../utils/fuzzySearch";
import { getErrorMessage } from "../utils/errorHandler";

// Componente FilterButton movido para fora para evitar re-renderizações
const FilterButton = ({ type, icon: Icon, label, activeColor, hoverColor, filterType, setFilterType }) => {
  const IconComponent = Icon;
  return (
    <button
      onClick={() => setFilterType(filterType === type ? "all" : type)}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium transition-all duration-200 whitespace-nowrap ${
        filterType === type
          ? `${activeColor} border-transparent shadow-lg scale-105`
          : `bg-white text-gray-700 border-gray-200 ${hoverColor} hover:shadow-md hover:scale-105`
      }`}
    >
      <IconComponent className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </button>
  );
};

const Items = () => {
  const { items, refreshItems } = useItems();
  const { isAdmin } = useAuth();
  const { success, error: showError } = useToastContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Paginação
  const { currentItems, currentPage, totalPages, nextPage, prevPage, goToPage, hasNextPage, hasPrevPage, itemsPerPage, setItemsPerPage } = usePagination(filteredItems, 20);

  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  const filterLowStock = (items) => {
    return items.filter((item) => Number(item.quantidade) < ESTOQUE_BAIXO_LIMITE);
  };

  const filterNearExpiry = (itemsList) => {
    return itemsList.filter((item) => {
      const expiryInfo = checkExpiringDate(item.validade);
      if (expiryInfo.daysUntilExpiry === null) return false;
      return expiryInfo.daysUntilExpiry >= 0 && expiryInfo.daysUntilExpiry <= VENCIMENTO_PROXIMO_DIAS;
    });
  };

  const filterLowStockAndNearExpiry = (itemsList) => {
    return itemsList.filter((item) => {
      const lowStock = Number(item.quantidade) < ESTOQUE_BAIXO_LIMITE;
      const expiryInfo = checkExpiringDate(item.validade);
      const nearExpiry =
        expiryInfo.daysUntilExpiry !== null &&
        expiryInfo.daysUntilExpiry >= 0 &&
        expiryInfo.daysUntilExpiry <= VENCIMENTO_PROXIMO_DIAS;

      return lowStock && nearExpiry;
    });
  };

  useEffect(() => {
    let updatedItems = [...items];

    // Aplicar filtros primeiro - todos usam a lista completa de items
    switch (filterType) {
      case "lowStock":
        updatedItems = filterLowStock(items);
        break;
      case "nearExpiry":
        // filterNearExpiry já verifica a validade internamente, usa lista completa
        updatedItems = filterNearExpiry(items);
        break;
      case "lowStockAndNearExpiry":
        // filterLowStockAndNearExpiry já verifica tudo internamente, usa lista completa
        updatedItems = filterLowStockAndNearExpiry(items);
        break;
      default:
        // "all" - não filtra, usa todos os items
        updatedItems = [...items];
        break;
    }

    // Depois aplicar busca fuzzy (tolerante a erros)
    if (searchTerm.trim() !== "") {
      updatedItems = updatedItems.filter((item) =>
        fuzzySearch(item, searchTerm, ['nome', 'codigo', 'categoria'], 0.5)
      );
      // Ordenar por relevância (mais similares primeiro)
      updatedItems = sortByRelevance(updatedItems, searchTerm, ['nome', 'codigo', 'categoria']);
    } else {
      // Se não há busca, ordenar alfabeticamente
      updatedItems.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    // 📊 AGRUPAMENTO VISUAL: Agrupar itens expandidos (lotes) do mesmo item
    const groupedItems = [];
    const processedOriginalIds = new Set();
    const itemsToSkip = new Set(); // IDs de itens que já foram processados
    
    updatedItems.forEach((item) => {
      // Pular itens já processados
      if (itemsToSkip.has(item.id)) {
        return;
      }
      
      if (item.isExpanded && item.originalItemId) {
        // Se é um lote expandido e ainda não processamos o item original
        if (!processedOriginalIds.has(item.originalItemId)) {
          processedOriginalIds.add(item.originalItemId);
          
          // Encontrar todos os lotes deste item
          const itemLotes = updatedItems.filter(
            (i) => i.originalItemId === item.originalItemId && i.isExpanded
          );
          
          // Marcar todos os lotes para não processar novamente
          itemLotes.forEach((lote) => {
            itemsToSkip.add(lote.id);
          });
          
          // Adicionar item "agrupador" primeiro (usar dados do primeiro lote como base)
          const firstLote = itemLotes[0];
          groupedItems.push({
            ...firstLote,
            id: `group_${item.originalItemId}`,
            isGroupHeader: true,
            lotesCount: itemLotes.length,
            quantidadeTotal: firstLote.quantidadeTotal || firstLote.quantidade || 0,
            quantidade: firstLote.quantidadeTotal || firstLote.quantidade || 0, // Mostrar total no cabeçalho
          });
          
          // Adicionar os lotes como filhos
          itemLotes.forEach((lote) => {
            groupedItems.push({
              ...lote,
              isGroupChild: true,
            });
          });
        }
      } else if (!item.isExpanded || !item.originalItemId) {
        // Item normal ou não expandido
        groupedItems.push(item);
      }
    });

    setFilteredItems(groupedItems);
  }, [searchTerm, items, filterType]);

  const filterLabels = {
    all: "Todos os itens",
    lowStock: "Somente estoque baixo",
    nearExpiry: "Somente perto do vencimento",
    lowStockAndNearExpiry: "Estoque baixo e perto do vencimento",
  };

  const handleExportExcel = () => {
    try {
      exportStockToExcel(items, success, showError);
    } catch (error) {
      console.error("Erro ao exportar para Excel:", error);
      showError(getErrorMessage(error) || "Erro ao exportar planilha. Tente novamente.");
    }
  };

  const handlePrint = () => {
    const itemsToPrint = filteredItems;

    if (!itemsToPrint || itemsToPrint.length === 0) {
      showError("Nenhum item para imprimir com o filtro selecionado.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=650");
    const title = `Relatório de Itens - ${filterLabels[filterType] || "Itens"}`;

    const rows = itemsToPrint
      .map((item) => {
        const expiryInfo = checkExpiringDate(item.validade);
        const validade = item.validade ? formatExpiryDate(item.validade) : "N/A";
        const statusVencimento =
          expiryInfo.daysUntilExpiry === null
            ? "Sem info"
            : expiryInfo.daysUntilExpiry < 0
            ? "Vencido"
            : `Vence em ${expiryInfo.daysUntilExpiry} dias`;

        return `
          <tr>
            <td>${item.nome || ""}</td>
            <td>${item.codigo || ""}</td>
            <td>${item.categoria || ""}</td>
            <td>${item.local || ""}</td>
            <td>${item.fornecedor || ""}</td>
            <td>${item.quantidade || 0} ${item.unidade || "UN"}</td>
            <td>${validade}</td>
            <td>${statusVencimento}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
            h1 { margin-bottom: 8px; }
            p { margin-top: 0; color: #444; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>Gerado em ${new Date().toLocaleString("pt-BR")}</p>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Código</th>
                <th>Categoria</th>
                <th>Local</th>
                <th>Fornecedor</th>
                <th>Quantidade</th>
                <th>Validade</th>
                <th>Status Vencimento</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <button onclick="window.print()">Imprimir / Salvar PDF</button>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="mb-6">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Itens do Estoque
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span className="font-medium">{filteredItems.length}</span> itens {filterType !== "all" && "no filtro selecionado"}
              </p>
            </div>
          </div>

        {/* Search and Filters Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 mb-6">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors duration-200" />
            <input
              type="text"
              placeholder="Buscar por nome, código ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-400 bg-white hover:border-gray-300 focus-ring"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Desktop Filters */}
          <div className="hidden lg:flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Filter className="w-4 h-4" />
              Filtros:
            </div>
            <FilterButton
              type="lowStock"
              icon={AlertTriangle}
              label="Estoque Baixo"
              activeColor="bg-gradient-to-r from-red-600 to-red-500 text-white"
              hoverColor="hover:bg-red-50 hover:border-red-300"
              filterType={filterType}
              setFilterType={setFilterType}
            />
            <FilterButton
              type="nearExpiry"
              icon={Clock}
              label="Perto do Vencimento"
              activeColor="bg-gradient-to-r from-yellow-500 to-yellow-400 text-white"
              hoverColor="hover:bg-yellow-50 hover:border-yellow-300"
              filterType={filterType}
              setFilterType={setFilterType}
            />
            <FilterButton
              type="lowStockAndNearExpiry"
              icon={AlertTriangle}
              label="Estoque & Vencimento"
              activeColor="bg-gradient-to-r from-orange-500 to-orange-400 text-white"
              hoverColor="hover:bg-orange-50 hover:border-orange-300"
              filterType={filterType}
              setFilterType={setFilterType}
            />
            <button
              onClick={() => setFilterType("all")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium transition-all duration-200 ${
                filterType === "all"
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white border-transparent shadow-lg scale-105"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md hover:scale-105"
              }`}
            >
              Todos
            </button>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-green-200 bg-white text-green-700 hover:bg-green-50 hover:border-green-300 hover:shadow-md transition-all duration-200 font-medium hover:scale-105 hover-lift focus-ring"
                title="Exportar planilha Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar Planilha</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-200 font-medium hover:scale-105 hover-lift focus-ring"
                title="Imprimir relatório"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
            </div>
          </div>

          {/* Mobile Filters */}
          <div className="lg:hidden">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-all duration-200 font-medium"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                <span>{filterLabels[filterType]}</span>
              </div>
              <span className="text-gray-400">{showMobileFilters ? "▲" : "▼"}</span>
            </button>
            
            {showMobileFilters && (
              <div className="mt-3 space-y-2 animate-fadeIn">
                <FilterButton
                  type="lowStock"
                  icon={AlertTriangle}
                  label="Estoque Baixo"
                  activeColor="bg-gradient-to-r from-red-600 to-red-500 text-white"
                  hoverColor="hover:bg-red-50 hover:border-red-300"
                  filterType={filterType}
                  setFilterType={setFilterType}
                />
                <FilterButton
                  type="nearExpiry"
                  icon={Clock}
                  label="Perto do Vencimento"
                  activeColor="bg-gradient-to-r from-yellow-500 to-yellow-400 text-white"
                  hoverColor="hover:bg-yellow-50 hover:border-yellow-300"
                  filterType={filterType}
                  setFilterType={setFilterType}
                />
                <FilterButton
                  type="lowStockAndNearExpiry"
                  icon={AlertTriangle}
                  label="Estoque & Vencimento"
                  activeColor="bg-gradient-to-r from-orange-500 to-orange-400 text-white"
                  hoverColor="hover:bg-orange-50 hover:border-orange-300"
                  filterType={filterType}
                  setFilterType={setFilterType}
                />
                <button
                  onClick={() => setFilterType("all")}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 font-medium transition-all duration-200 ${
                    filterType === "all"
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white border-transparent shadow-lg"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                  }`}
                >
                  Todos os Itens
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-green-200 bg-white text-green-700 hover:bg-green-50 transition-all duration-200 font-medium"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar Planilha
                </button>
                <button
                  onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 📱 MOBILE (CARDS) */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center animate-fade-in-up">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Package className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm ? "Nenhum item encontrado" : "Nenhum item cadastrado"}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm
                  ? "Tente ajustar sua busca ou filtros"
                  : "Comece adicionando itens ao estoque"}
              </p>
              {!searchTerm && isAdmin && (
                <button
                  onClick={() => navigate("/new-item")}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg hover-lift"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Primeiro Item
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {currentItems.map((item) => {
                const expiryInfo = checkExpiringDate(item.validade);
                const diffDays =
                  expiryInfo.daysUntilExpiry !== null
                    ? expiryInfo.daysUntilExpiry
                    : null;

                let badge = null;
                let badgeColor = "";

                const lowStock = Number(item.quantidade) < ESTOQUE_BAIXO_LIMITE;
                const nearExpiry =
                  diffDays !== null && diffDays <= VENCIMENTO_PROXIMO_DIAS && diffDays >= 0;

                if (lowStock && nearExpiry) {
                  badge = `Baixo estoque | Vence em ${diffDays} dias`;
                  badgeColor = "bg-orange-500 text-white";
                } else if (lowStock) {
                  badge = "Baixo estoque";
                  badgeColor = "bg-red-600 text-white";
                } else if (nearExpiry) {
                  badge = `Vence em ${diffDays} dias`;
                  badgeColor = "bg-yellow-500 text-white";
                }

                // Usar originalItemId se o item foi expandido, senão usar o id normal
                const itemIdToEdit = item.originalItemId || item.id;
                
                // 📊 AGRUPAMENTO VISUAL: Não renderizar cabeçalho de grupo nos cards mobile
                if (item.isGroupHeader) {
                  return null; // Cabeçalhos de grupo só aparecem na tabela desktop
                }
                
                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onClick={() => isAdmin && navigate(`/edit-item/${itemIdToEdit}`)}
                    clickable={isAdmin}
                    badge={badge}
                    badgeColor={badgeColor}
                  />
                );
              })}
            </div>

            {/* 🖥️ DESKTOP (TABELA) */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gradient-to-r from-blue-50 to-gray-50 text-gray-700 uppercase">
                    <tr>
                      <th className="px-6 py-4 min-w-[200px] font-semibold">Nome</th>
                      <th className="px-6 py-4 min-w-[150px] font-semibold">Código</th>
                      <th className="px-6 py-4 min-w-[150px] font-semibold">Categoria</th>
                      <th className="px-6 py-4 min-w-[150px] font-semibold">Local</th>
                      <th className="px-6 py-4 min-w-[150px] font-semibold">Fornecedor</th>
                      <th className="px-6 py-4 min-w-[120px] font-semibold text-center">Quantidade</th>
                      <th className="px-6 py-4 min-w-[120px] font-semibold">Validade</th>
                      <th className="px-6 py-4 min-w-[150px] font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentItems.map((item) => {
                      // 📊 AGRUPAMENTO VISUAL: Estilo diferente para cabeçalho de grupo e lotes
                      const isGroupHeader = item.isGroupHeader;
                      const isGroupChild = item.isGroupChild;
                      
                      // Para cabeçalhos de grupo, não calcular informações de validade
                      const expiryInfo = isGroupHeader ? { isExpired: false, daysUntilExpiry: null } : checkExpiringDate(item.validade);
                      const diffDays =
                        expiryInfo.daysUntilExpiry !== null
                          ? expiryInfo.daysUntilExpiry
                          : null;

                      const lowStock = Number(item.quantidade) < ESTOQUE_BAIXO_LIMITE;
                      const nearExpiry =
                        diffDays !== null && diffDays <= VENCIMENTO_PROXIMO_DIAS && diffDays >= 0;
                      const isExpired = expiryInfo.isExpired;

                      let statusBadge = "";
                      let statusColor = "";

                      if (isGroupHeader) {
                        statusBadge = "Agrupado";
                        statusColor = "bg-blue-500 text-white";
                      } else if (lowStock && nearExpiry) {
                        statusBadge = `Baixo estoque | Vence em ${diffDays} dias`;
                        statusColor = "bg-orange-500 text-white";
                      } else if (lowStock) {
                        statusBadge = "Baixo estoque";
                        statusColor = "bg-red-600 text-white";
                      } else if (nearExpiry) {
                        statusBadge = `Vence em ${diffDays} dias`;
                        statusColor = "bg-yellow-500 text-white";
                      } else if (isExpired) {
                        statusBadge = "Vencido";
                        statusColor = "bg-red-700 text-white";
                      } else {
                        statusBadge = "OK";
                        statusColor = "bg-green-500 text-white";
                      }

                      // Formatar validade - pode ser string, Date ou Timestamp do Firestore
                      let validade = "-";
                      // Verificar se validade existe e não é vazia (não mostrar para cabeçalhos)
                      if (!isGroupHeader && item.validade) {
                        // Se for Timestamp do Firestore, converter para Date
                        let validadeToFormat = item.validade;
                        if (item.validade?.toDate) {
                          validadeToFormat = item.validade.toDate();
                        }
                        
                        try {
                          const formatted = formatExpiryDate(validadeToFormat);
                          // Se formatExpiryDate retornar uma data válida, usar; senão mostrar "-"
                          if (formatted && formatted !== "Sem validade" && formatted !== "Data inválida") {
                            validade = formatted;
                          }
                        } catch (error) {
                          console.error("Erro ao formatar validade:", error, item.validade);
                          validade = "-";
                        }
                      }

                      // Usar originalItemId se o item foi expandido, senão usar o id normal
                      const itemIdToEdit = item.originalItemId || item.id;
                      
                      return (
                        <tr
                          key={item.id}
                          className={`transition-all duration-200 ${
                            isGroupHeader
                              ? "bg-blue-50 border-l-4 border-blue-500 font-semibold"
                              : isGroupChild
                              ? "bg-gray-50 border-l-4 border-gray-300 pl-8"
                              : isAdmin 
                              ? "cursor-pointer hover:bg-blue-50 hover:shadow-sm" 
                              : "cursor-default hover:bg-gray-50"
                          }`}
                          onClick={() => !isGroupHeader && isAdmin && navigate(`/edit-item/${itemIdToEdit}`)}
                        >
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {isGroupHeader ? (
                              <div className="flex items-center gap-2">
                                <span className="text-blue-700">{item.nome}</span>
                                <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
                                  {item.lotesCount} lote(s) - Total: {item.quantidadeTotal} {item.unidade || "UN"}
                                </span>
                              </div>
                            ) : (
                              <>
                                {isGroupChild && <span className="text-gray-400 mr-2">└─</span>}
                                {item.nome}
                                {item.isExpanded && !isGroupHeader && (
                                  <span className="ml-2 text-xs text-gray-500 italic">
                                    (Lote)
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-700">{item.codigo || "-"}</td>
                          <td className="px-6 py-4 text-gray-600">
                            {item.categoria || "-"}
                          </td>
                          <td className="px-6 py-4 text-gray-600">{item.local || "-"}</td>
                          <td className="px-6 py-4 text-gray-600">
                            {item.fornecedor || "-"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isGroupHeader ? (
                              <span className="font-semibold text-blue-700">
                                {item.quantidadeTotal || item.quantidade || 0} {item.unidade || "UN"}
                              </span>
                            ) : (
                              <span
                                className={`font-semibold ${
                                  lowStock ? "text-red-600" : "text-green-600"
                                }`}
                              >
                                {item.quantidade || 0} {item.unidade || "UN"}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isGroupHeader ? (
                              <span className="text-gray-500 italic text-sm">Varia por lote</span>
                            ) : (
                              <span
                                className={`font-medium ${
                                  isExpired
                                    ? "text-red-600"
                                    : nearExpiry
                                    ? "text-orange-600"
                                    : "text-gray-700"
                                }`}
                              >
                                {validade}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${statusColor}`}
                            >
                              {statusBadge}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t bg-gradient-to-r from-gray-50 to-blue-50 text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span>Total de itens: <span className="text-blue-600">{filteredItems.length}</span></span>
                {filterType !== "all" && (
                  <button
                    onClick={() => setFilterType("all")}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          </>
        )}
        
        {!isAdmin && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Acesso somente leitura.</span> Cadastros, edições e exclusões estão restritos a administradores.
            </p>
          </div>
        )}

        {/* Paginação */}
        {filteredItems.length > 0 && totalPages > 1 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 mt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Mostrando</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>itens por página</span>
                <span className="text-gray-400">•</span>
                <span>
                  Página {currentPage} de {totalPages} ({filteredItems.length} itens)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={prevPage}
                  disabled={!hasPrevPage}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`w-10 h-10 rounded-lg border transition ${
                          currentPage === pageNum
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={nextPage}
                  disabled={!hasNextPage}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Items;