import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useItems } from "../context/ItemsContext";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import ItemCard from "../components/ItemCard";
import { Search, Plus, AlertTriangle, Clock, Printer, Filter, X, Package, ArrowDownCircle, ArrowUpCircle, FileSpreadsheet, ChevronLeft, ChevronRight, Ban, TrendingUp, Text } from "lucide-react";
import { checkExpiringDate, formatExpiryDate } from "../utils/dateUtils";
import { exportStockToExcel } from "../utils/exportExcel";
import { usePagination } from "../hooks/usePagination";
import { ESTOQUE_BAIXO_LIMITE, VENCIMENTO_PROXIMO_DIAS } from "../config/constants";
import { fuzzySearch, sortByRelevance } from "../utils/fuzzySearch";
import { getErrorMessage } from "../utils/errorHandler";
import { normalizeAllItemNames } from "../utils/normalizeItemNames";

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
  const { isAdmin, currentUser } = useAuth();
  const { success, error: showError } = useToastContext();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [normalizingNames, setNormalizingNames] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Paginação
  const { currentItems, currentPage, totalPages, nextPage, prevPage, goToPage, hasNextPage, hasPrevPage, itemsPerPage, setItemsPerPage } = usePagination(filteredItems, 20);

  // Itens marcados como "SAI MUITO" (produtos mais pedidos)
  const itemsSaiMuito = useMemo(() => {
    return items.filter(item => !item.isExpanded && item.saiMuito === true);
  }, [items]);

  // Atualizar largura da janela
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const filterExpired = (itemsList) => {
    return itemsList.filter((item) => {
      const expiryInfo = checkExpiringDate(item.validade);
      return expiryInfo.isExpired === true;
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
      case "expired":
        updatedItems = filterExpired(items);
        break;
      case "saiMuito":
        updatedItems = items.filter(item => !item.isExpanded && item.saiMuito === true);
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
    expired: "Produtos vencidos",
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

  const handleNormalizeNames = async () => {
    if (!confirm("Deseja padronizar todos os nomes de itens para maiúsculas? Esta ação não pode ser desfeita.")) {
      return;
    }

    setNormalizingNames(true);
    try {
      const result = await normalizeAllItemNames(currentUser?.uid);
      if (result.success) {
        success(`Padronização concluída! ${result.updated} item(s) atualizado(s).`);
        refreshItems();
      } else {
        showError(result.error || "Erro ao padronizar nomes");
      }
    } catch (error) {
      showError(getErrorMessage(error) || "Erro ao padronizar nomes");
    } finally {
      setNormalizingNames(false);
    }
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
            <FilterButton
              type="expired"
              icon={Ban}
              label="Vencidos"
              activeColor="bg-gradient-to-r from-red-700 to-red-600 text-white"
              hoverColor="hover:bg-red-50 hover:border-red-300"
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
              {isAdmin && (
                <button
                  onClick={handleNormalizeNames}
                  disabled={normalizingNames}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-purple-200 bg-white text-purple-700 hover:bg-purple-50 hover:border-purple-300 hover:shadow-md transition-all duration-200 font-medium hover:scale-105 hover-lift focus-ring"
                  title="Padronizar nomes de todos os itens para maiúsculas"
                >
                  <Text className="w-4 h-4" />
                  <span className="hidden sm:inline">{normalizingNames ? "Padronizando..." : "Padronizar Nomes"}</span>
                </button>
              )}
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
                <FilterButton
                  type="expired"
                  icon={Ban}
                  label="Vencidos"
                  activeColor="bg-gradient-to-r from-red-700 to-red-600 text-white"
                  hoverColor="hover:bg-red-50 hover:border-red-300"
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

        {/* Seção Produtos mais pedidos */}
        {itemsSaiMuito.length > 0 && filterType === "all" && (
          <div className="mb-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl shadow-lg border-2 border-orange-200 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-orange-900">
                  Produtos mais pedidos
                </h2>
                <p className="text-sm text-orange-700">{itemsSaiMuito.length} produto(s) marcado(s)</p>
              </div>
            </div>
            <div className="space-y-2">
              {itemsSaiMuito.slice(0, windowWidth < 1024 ? 6 : 10).map((item) => (
                <div
                  key={item.id}
                  onClick={() => isAdmin && navigate(`/edit-item/${item.id}`)}
                  className={`bg-white rounded-lg p-3 shadow-sm border border-orange-200 hover:border-orange-400 transition-all ${
                    isAdmin ? "cursor-pointer hover:shadow-md" : "cursor-default"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">{item.nome}</div>
                    </div>
                    <div className="ml-4 text-sm font-semibold text-orange-700 whitespace-nowrap">
                      {item.quantidade || 0} {item.unidade || "UN"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {itemsSaiMuito.length > (windowWidth < 1024 ? 6 : 10) && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setFilterType("saiMuito")}
                  className="text-sm text-orange-600 hover:text-orange-700 font-medium underline"
                >
                  Ver todos os {itemsSaiMuito.length} produtos mais pedidos
                </button>
              </div>
            )}
          </div>
        )}

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
                  badgeColor = "bg-purple-600 text-white";
                } else if (lowStock) {
                  badge = "Baixo estoque";
                  badgeColor = "bg-orange-500 text-white";
                } else if (nearExpiry) {
                  badge = `Vence em ${diffDays} dias`;
                  badgeColor = "bg-red-600 text-white";
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
                <table className="w-full text-left text-sm table-auto">
                  <thead className="bg-gradient-to-r from-blue-50 to-gray-50 text-gray-700 uppercase">
                    <tr>
                      <th className="px-3 py-2 min-w-[180px] font-semibold text-xs">Nome</th>
                      <th className="px-3 py-2 min-w-[120px] font-semibold text-xs">Código</th>
                      <th className="px-3 py-2 min-w-[130px] font-semibold text-xs">Categoria</th>
                      <th className="px-3 py-2 min-w-[120px] font-semibold text-xs">Local</th>
                      <th className="px-3 py-2 min-w-[100px] font-semibold text-xs text-center">Quantidade</th>
                      <th className="px-3 py-2 min-w-[100px] font-semibold text-xs">Validade</th>
                      <th className="px-3 py-2 min-w-[140px] font-semibold text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentItems.map((item, index) => {
                      // 📊 AGRUPAMENTO VISUAL: Estilo diferente para cabeçalho de grupo e lotes
                      const isGroupHeader = item.isGroupHeader;
                      const isGroupChild = item.isGroupChild;
                      // Verificar se é o primeiro lote após o cabeçalho
                      const isFirstChild = isGroupChild && index > 0 && currentItems[index - 1]?.isGroupHeader;
                      // Verificar se é o último lote do grupo
                      const isLastChild = isGroupChild && (
                        index === currentItems.length - 1 || 
                        !currentItems[index + 1]?.isGroupChild
                      );
                      
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
                        statusColor = "bg-purple-600 text-white";
                      } else if (lowStock) {
                        statusBadge = "Baixo estoque";
                        statusColor = "bg-orange-500 text-white";
                      } else if (nearExpiry) {
                        statusBadge = `Vence em ${diffDays} dias`;
                        statusColor = "bg-red-600 text-white";
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
                              ? "bg-gradient-to-r from-blue-100 to-blue-50 border-l-4 border-r-4 border-t-4 border-b-0 border-green-600 font-semibold shadow-md rounded-t-lg"
                              : isGroupChild
                              ? `bg-gray-50/80 border-l-4 border-r-4 border-green-400 pl-8 relative ${isFirstChild ? 'border-t-0' : ''} ${isLastChild ? 'border-b-4 border-green-400 rounded-b-lg' : ''}`
                              : isAdmin 
                              ? "cursor-pointer hover:bg-blue-50 hover:shadow-sm" 
                              : "cursor-default hover:bg-gray-50"
                          }`}
                          onClick={() => !isGroupHeader && isAdmin && navigate(`/edit-item/${itemIdToEdit}`)}
                        >
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {isGroupHeader ? (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold flex-shrink-0">
                                  {item.lotesCount}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-blue-900 font-bold text-sm truncate">{item.nome}</span>
                                  <span className="text-xs text-blue-700 font-medium">
                                    {item.lotesCount} lote(s) • {item.quantidadeTotal} {item.unidade || "UN"}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center flex-shrink-0">
                                    <div className="w-4 h-4 flex items-center justify-center">
                                      <div className="w-0.5 h-full bg-blue-400"></div>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 -ml-1"></div>
                                  </div>
                                  <span className="text-gray-800 text-sm truncate">{item.nome}</span>
                                  <span className="ml-1 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                    Lote
                                  </span>
                                </div>
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-700 text-sm">{item.codigo || "-"}</td>
                          <td className="px-3 py-2 text-gray-600 text-sm">
                            {item.categoria || "-"}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-sm">{item.local || "-"}</td>
                          <td className="px-3 py-2 text-center">
                            {isGroupHeader ? (
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-blue-800 text-sm">
                                  {item.quantidadeTotal || item.quantidade || 0}
                                </span>
                                <span className="text-xs text-blue-600 font-medium">
                                  {item.unidade || "UN"}
                                </span>
                              </div>
                            ) : (
                              <span
                                className={`font-semibold text-sm ${
                                  lowStock ? "text-orange-600" : "text-green-600"
                                }`}
                              >
                                {item.quantidade || 0} {item.unidade || "UN"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isGroupHeader ? (
                              <div className="flex items-center gap-1">
                                <span className="text-blue-600 font-semibold text-xs">📦</span>
                                <span className="text-gray-600 italic text-xs">Varia</span>
                              </div>
                            ) : (
                              <span
                                className={`font-medium text-sm ${
                                  isExpired
                                    ? "text-red-600"
                                    : nearExpiry
                                    ? "text-red-600"
                                    : "text-gray-700"
                                }`}
                              >
                                {validade}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isGroupHeader ? (
                              <span className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-bold rounded-full bg-blue-600 text-white shadow-md whitespace-nowrap border-2 border-blue-700">
                                AGRUPADO
                              </span>
                            ) : (
                              <span
                                className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${statusColor}`}
                              >
                                {statusBadge}
                              </span>
                            )}
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