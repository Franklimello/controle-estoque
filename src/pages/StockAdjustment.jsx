import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import { useItems } from "../context/ItemsContext";
import { addAdjustment, getAdjustments } from "../services/adjustments";
import { getItemByCodigo, getItemById, updateItem } from "../services/items";
import { zeroAllStock } from "../services/bulkStock";
import { Settings, Save, X, Search, AlertTriangle, Package, TrendingUp, Eraser } from "lucide-react";
import { fuzzySearch, sortByRelevance } from "../utils/fuzzySearch";
import ConfirmModal from "../components/ConfirmModal";
import { CATEGORIAS_ALMOXARIFADO } from "../config/constants";

const StockAdjustment = () => {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  const { items } = useItems();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [itemFound, setItemFound] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAdjustment, setPendingAdjustment] = useState(null);
  const codigoTimeoutRef = useRef(null);
  const [formData, setFormData] = useState({
    codigoBusca: "",
    nome: "",
    codigoItem: "",
    categoria: "",
    unidade: "UN",
    local: "",
    fornecedor: "",
    validade: "",
    quantidadeAnterior: "",
    quantidadeNova: "",
    quantidadeAdicionar: "",
    motivo: "",
    observacao: "",
  });
  const [recentAdjustments, setRecentAdjustments] = useState([]);
  const [showZeroModal, setShowZeroModal] = useState(false);
  const [zeroConfirmText, setZeroConfirmText] = useState("");
  const [zeroLoading, setZeroLoading] = useState(false);

  // Buscar ajustes recentes
  const loadRecentAdjustments = async () => {
    try {
      const adjustments = await getAdjustments();
      setRecentAdjustments(adjustments.slice(0, 5));
    } catch (error) {
      // Log do erro mas não mostrar para o usuário (não é crítico)
      console.error("Erro ao carregar ajustes recentes:", error);
    }
  };

  useEffect(() => {
    loadRecentAdjustments();
  }, []);

  useEffect(() => {
    return () => {
      if (codigoTimeoutRef.current) {
        clearTimeout(codigoTimeoutRef.current);
      }
    };
  }, []);

  // Lista de itens para busca: 1 entrada por item (itens com vários lotes vêm como 1 só, com id = originalItemId)
  const itemsParaBusca = useMemo(() => {
    const semExpandir = items.filter((it) => !it.isExpanded);
    const expandidos = items.filter((it) => it.isExpanded && it.originalItemId);
    const porItemId = new Map();
    semExpandir.forEach((it) => porItemId.set(it.id, { ...it }));
    expandidos.forEach((it) => {
      if (!porItemId.has(it.originalItemId)) {
        porItemId.set(it.originalItemId, {
          ...it,
          id: it.originalItemId,
          quantidade: it.quantidadeTotal ?? it.quantidade ?? 0,
        });
      }
    });
    return Array.from(porItemId.values());
  }, [items]);

  // Busca fuzzy de itens - melhorada com priorização de matches exatos
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    // Primeiro, buscar matches exatos ou que contenham o termo (case-insensitive)
    const exactMatches = itemsParaBusca.filter((it) => {
      const nome = (it.nome || "").toLowerCase();
      const codigo = (it.codigo || "").toLowerCase();
      const categoria = (it.categoria || "").toLowerCase();
      
      return nome.includes(searchLower) || 
             codigo.includes(searchLower) || 
             categoria.includes(searchLower);
    });
    
    // Se encontrou matches exatos, retornar apenas eles (ordenados por relevância)
    if (exactMatches.length > 0) {
      const sorted = sortByRelevance(exactMatches, searchTerm, ['nome', 'codigo', 'categoria']);
      return sorted.slice(0, 30);
    }
    
    // Se não encontrou matches exatos, usar busca fuzzy com similaridade mais alta
    const fuzzyResults = itemsParaBusca
      .filter((it) => fuzzySearch(it, searchTerm, ['nome', 'codigo', 'categoria'], 0.5))
      .slice(0, 30);
    
    // Ordenar por relevância
    return sortByRelevance(fuzzyResults, searchTerm, ['nome', 'codigo', 'categoria']);
  }, [itemsParaBusca, searchTerm]);

  const INTEGER_UNITS = ["UN", "PC", "CX"];
  const normalizeQuantityByUnit = (rawValue, unidade) => {
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return NaN;
    const unitNormalized = (unidade || "").toUpperCase();
    if (INTEGER_UNITS.includes(unitNormalized)) {
      return Math.round(numericValue);
    }
    return Math.round(numericValue * 100) / 100;
  };

  const normalizeDateInput = (value) => {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value?.toDate) {
      const date = value.toDate();
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return "";
  };

  const fillFormFromItem = (item) => {
    const quantidadeNormalizada = normalizeQuantityByUnit(
      item.quantidade || 0,
      item.unidade || "UN"
    );
    setItemFound(item);
    setFormData((prev) => ({
      ...prev,
      codigoBusca: item.codigo || "",
      nome: item.nome || "",
      codigoItem: item.codigo || "",
      categoria: item.categoria || "",
      unidade: item.unidade || "UN",
      local: item.local || "",
      fornecedor: item.fornecedor || "",
      validade: normalizeDateInput(item.validade),
      quantidadeAnterior: quantidadeNormalizada,
      quantidadeNova: quantidadeNormalizada,
    }));
  };

  const handleCodigoChange = async (e) => {
    const codigo = e.target.value;
    setFormData((prev) => ({ ...prev, codigoBusca: codigo }));
    setItemFound(null);
    setError("");

    if (codigoTimeoutRef.current) {
      clearTimeout(codigoTimeoutRef.current);
    }

    if (codigo.trim().length > 0) {
      codigoTimeoutRef.current = setTimeout(async () => {
        const item = await getItemByCodigo(codigo);
        if (item) {
          fillFormFromItem(item);
        } else {
          setItemFound(null);
        }
      }, 500);
    }
  };

  const handleItemSelect = async (item) => {
    const realItemId = item.originalItemId || item.id;
    const fullItem = await getItemById(realItemId);
    if (!fullItem) {
      setError("Item não encontrado");
      return;
    }
    fillFormFromItem(fullItem);
    setSearchTerm("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddQuantidade = () => {
    const quantidadeAtualNova = Number(formData.quantidadeNova) || 0;
    const quantidadeParaAdicionar = Number(formData.quantidadeAdicionar);

    if (Number.isNaN(quantidadeParaAdicionar) || quantidadeParaAdicionar <= 0) {
      setError("Informe uma quantidade válida para adicionar");
      return;
    }

    const novoTotalBruto = quantidadeAtualNova + quantidadeParaAdicionar;
    const novoTotal = normalizeQuantityByUnit(
      novoTotalBruto,
      formData.unidade || itemFound?.unidade
    );
    setFormData((prev) => ({
      ...prev,
      quantidadeNova: novoTotal,
      quantidadeAdicionar: "",
    }));
    setError("");
  };

  const handleToggleSaiMuito = async () => {
    if (!itemFound) {
      setError("Selecione um item primeiro");
      return;
    }
    
    setLoading(true);
    try {
      const newSaiMuito = !itemFound.saiMuito;
      await updateItem(itemFound.id, { saiMuito: newSaiMuito }, currentUser?.uid);
      success(newSaiMuito ? "Item marcado como 'SAI MUITO'" : "Marca 'SAI MUITO' removida do item");
      
      // Atualizar item localmente
      setItemFound({ ...itemFound, saiMuito: newSaiMuito });
      // 🔄 Invalidar cache via evento (otimizado)
      window.dispatchEvent(new Event('invalidateItemsCache'));
    } catch (error) {
      showError("Erro ao atualizar item: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validações
    if (!itemFound) {
      setError("Selecione um item para ajustar");
      return;
    }

    // Motivo é opcional agora

    const quantidadeAnterior = normalizeQuantityByUnit(
      formData.quantidadeAnterior,
      formData.unidade || itemFound?.unidade
    );
    const quantidadeNova = normalizeQuantityByUnit(
      formData.quantidadeNova,
      formData.unidade || itemFound?.unidade
    );
    const hasStockChange = Math.abs(quantidadeAnterior - quantidadeNova) > 0.0001;

    const itemUpdateData = {};
    if ((itemFound.nome || "") !== formData.nome.trim()) itemUpdateData.nome = formData.nome.trim();
    if ((itemFound.codigo || "") !== formData.codigoItem.trim()) itemUpdateData.codigo = formData.codigoItem.trim();
    if ((itemFound.categoria || "") !== formData.categoria) itemUpdateData.categoria = formData.categoria;
    if ((itemFound.unidade || "UN") !== formData.unidade) itemUpdateData.unidade = formData.unidade;
    if ((itemFound.local || "") !== formData.local.trim()) itemUpdateData.local = formData.local.trim();
    if ((itemFound.fornecedor || "") !== formData.fornecedor.trim()) itemUpdateData.fornecedor = formData.fornecedor.trim();
    if (normalizeDateInput(itemFound.validade) !== (formData.validade || "")) {
      itemUpdateData.validade = formData.validade || null;
    }

    if (isNaN(quantidadeAnterior) || isNaN(quantidadeNova)) {
      setError("Quantidades devem ser números válidos");
      return;
    }

    if (quantidadeNova < 0) {
      setError("Quantidade não pode ser negativa");
      return;
    }

    if (!hasStockChange && Object.keys(itemUpdateData).length === 0) {
      setError("Nenhuma alteração foi detectada");
      return;
    }

    // Armazenar dados do ajuste para processar após confirmação
    const diferenca = quantidadeNova - quantidadeAnterior;
    setPendingAdjustment({
      itemId: itemFound.id,
      quantidadeAnterior,
      quantidadeNova,
      motivo: formData.motivo,
      observacao: formData.observacao,
      itemNome: itemFound.nome,
      diferenca,
      itemUpdateData,
      hasStockChange,
    });
    setShowConfirmModal(true);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Acesso restrito</h1>
            <p className="text-gray-600">
              Apenas o administrador pode fazer ajustes de estoque.
            </p>
            <button
              onClick={() => navigate("/items")}
              className="mt-4 px-4 py-2 rounded bg-blue-600 text-white"
            >
              Voltar para itens
            </button>
          </div>
        </div>
      </div>
    );
  }

  const diferenca = itemFound && formData.quantidadeAnterior && formData.quantidadeNova
    ? parseFloat(formData.quantidadeNova) - parseFloat(formData.quantidadeAnterior)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-4 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <Settings className="w-6 h-6 mr-2 text-purple-600" />
              Editar Item e Ajustar Estoque
            </h1>
            <button
              onClick={() => navigate("/items")}
              className="text-gray-600 hover:text-gray-800"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="alert-ring bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
              <i></i>
              <span className="relative z-10">{error}</span>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800 mb-1">
                  ⚠️ Editar item e ajustar estoque
                </p>
                <p className="text-xs text-yellow-700">
                  Use esta tela para ajustar quantidade e também atualizar os dados cadastrais do item (nome, código, categoria, unidade, local, fornecedor e validade).
                  Ajustes de estoque continuam sendo registrados no histórico.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Busca de Item */}
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Buscar Item por Código ou Nome
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Digite o nome ou código do item..."
                />
              </div>

              {/* Lista de resultados da busca */}
              {searchTerm && (
                <>
                  {filteredItems.length > 0 ? (
                    <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-lg max-h-80 overflow-y-auto">
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600 font-semibold">
                        {filteredItems.length} resultado(s) encontrado(s)
                      </div>
                      {filteredItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleItemSelect(item)}
                          className="w-full px-4 py-3 text-left hover:bg-purple-50 border-b border-gray-100 last:border-b-0 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800">{item.nome}</p>
                              <div className="flex gap-3 mt-1">
                                {item.codigo && (
                                  <p className="text-xs text-gray-500">Código: {item.codigo}</p>
                                )}
                                {item.categoria && (
                                  <p className="text-xs text-gray-500">Categoria: {item.categoria}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-bold text-gray-700">
                                {item.quantidade || 0} {item.unidade || "UN"}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 border border-gray-200 rounded-lg bg-yellow-50 p-3">
                      <p className="text-sm text-yellow-800">
                        Nenhum item encontrado com "{searchTerm}". Tente buscar por parte do nome ou código.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Código de Barras (alternativa) */}
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Ou escaneie o código de barras
              </label>
              <input
                type="text"
                    name="codigoBusca"
                    value={formData.codigoBusca}
                onChange={handleCodigoChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Digite ou escaneie o código"
              />
            </div>

            {/* Item Selecionado */}
            {itemFound && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-blue-800">{itemFound.nome}</p>
                    {itemFound.codigo && (
                      <p className="text-sm text-blue-600">Código: {itemFound.codigo}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-600">Estoque atual</p>
                    <p className="text-xl font-bold text-blue-800">
                      {itemFound.quantidade || 0} {itemFound.unidade || "UN"}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Validade: {normalizeDateInput(itemFound.validade) || "Sem validade"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Dados do item */}
            {itemFound && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-gray-800">Dados do item</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-gray-700 text-sm font-bold mb-2">Nome do Item *</label>
                    <input
                      type="text"
                      name="nome"
                      value={formData.nome}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">Código de Barras</label>
                    <input
                      type="text"
                      name="codigoItem"
                      value={formData.codigoItem}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">Categoria</label>
                    <select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Selecione uma categoria</option>
                      {CATEGORIAS_ALMOXARIFADO.map((categoria) => (
                        <option key={categoria} value={categoria}>
                          {categoria}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">Unidade</label>
                    <select
                      name="unidade"
                      value={formData.unidade}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="UN">UN (Unidade)</option>
                      <option value="KG">KG (Quilograma)</option>
                      <option value="LT">LT (Litro)</option>
                      <option value="MT">MT (Metro)</option>
                      <option value="CX">CX (Caixa)</option>
                      <option value="PC">PC (Peça)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">Local</label>
                    <input
                      type="text"
                      name="local"
                      value={formData.local}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">Fornecedor</label>
                    <input
                      type="text"
                      name="fornecedor"
                      value={formData.fornecedor}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">Validade</label>
                    <input
                      type="date"
                      name="validade"
                      value={formData.validade}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quantidades */}
            {itemFound && (
              <div className="lg:grid lg:grid-cols-2 lg:gap-6">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Quantidade Anterior *
                  </label>
                  <input
                    type="number"
                    name="quantidadeAnterior"
                    value={formData.quantidadeAnterior}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantidade atual do sistema
                  </p>
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Quantidade Nova *
                  </label>
                  <input
                    type="number"
                    name="quantidadeNova"
                    value={formData.quantidadeNova}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Quantidade após o ajuste
                  </p>
                </div>
              </div>
            )}

            {/* Soma incremental para contagem por salas/setores */}
            {itemFound && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-indigo-800 mb-2">
                  Somar contagem (ex.: por sala/setor)
                </p>
                <p className="text-xs text-indigo-700 mb-3">
                  Digite a quantidade contada e clique em "Adicionar". O valor será somado na quantidade nova.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="number"
                    name="quantidadeAdicionar"
                    value={formData.quantidadeAdicionar}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder="Quantidade para somar"
                    className="w-full sm:flex-1 px-4 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddQuantidade}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        quantidadeAdicionar: "",
                      }))
                    }
                    className="px-4 py-2 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-100 transition font-medium"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}

            {/* Botão Marcar como SAI MUITO */}
            {itemFound && (
              <button
                type="button"
                onClick={handleToggleSaiMuito}
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg ${
                  itemFound.saiMuito
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>{itemFound.saiMuito ? "Desmarcar como SAI MUITO" : "Marcar como SAI MUITO"}</span>
              </button>
            )}

            {/* Diferença */}
            {itemFound && formData.quantidadeAnterior && formData.quantidadeNova && diferenca !== 0 && (
              <div className={`p-4 rounded-lg border-2 ${
                diferenca > 0 
                  ? "bg-green-50 border-green-200" 
                  : "bg-red-50 border-red-200"
              }`}>
                <p className="text-sm font-semibold">
                  Diferença: <span className={diferenca > 0 ? "text-green-700" : "text-red-700"}>
                    {diferenca > 0 ? '+' : ''}{diferenca} {itemFound.unidade || "UN"}
                  </span>
                </p>
              </div>
            )}

            {/* Motivo */}
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Motivo do Ajuste
              </label>
              <select
                name="motivo"
                value={formData.motivo}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Selecione o motivo (opcional)</option>
                <option value="Inventário físico">Inventário físico</option>
                <option value="Correção de divergência">Correção de divergência</option>
                <option value="Ajuste de contagem">Ajuste de contagem</option>
                <option value="Perda/Quebra">Perda/Quebra</option>
                <option value="Achado">Achado</option>
                <option value="Transferência">Transferência</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {/* Observação */}
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Observação (opcional)
              </label>
              <textarea
                name="observacao"
                value={formData.observacao}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Detalhes adicionais sobre o ajuste..."
              />
            </div>

            {/* Botões */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate("/items")}
                className="w-full sm:w-auto px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !itemFound}
                className="action-button w-full sm:w-auto px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center space-x-2 disabled:opacity-50 transition relative overflow-hidden"
              >
                <div className="action-button-ring">
                  <i></i>
                </div>
                <Save className="w-5 h-5 relative z-10" />
                <span className="relative z-10">
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </span>
              </button>
            </div>
          </form>

          {/* Ajustes Recentes */}
          {recentAdjustments.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Ajustes Recentes</h2>
              <div className="space-y-2">
                {recentAdjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-gray-800">
                          {adj.itemNome}
                        </p>
                        <p className="text-xs text-gray-600">
                          {adj.quantidadeAnterior} → {adj.quantidadeNova} 
                          ({adj.diferenca > 0 ? '+' : ''}{adj.diferenca})
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{adj.motivo}</p>
                        {adj.createdAt && (
                          <p className="text-xs text-gray-400">
                            {new Date(adj.createdAt.toDate ? adj.createdAt.toDate() : adj.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zerar todo o estoque (apenas admin) */}
          {isAdmin && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-2">Sistema limpo</h2>
              <p className="text-sm text-gray-600 mb-4">
                Para fazer uma contagem do zero e zerar o estoque de todos os itens e lotes.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowZeroModal(true);
                  setZeroConfirmText("");
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 text-red-800 hover:bg-red-200 font-medium transition"
              >
                <Eraser className="w-5 h-5" />
                Zerar todo o estoque
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação */}
      {showConfirmModal && pendingAdjustment && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => {
            setShowConfirmModal(false);
            setPendingAdjustment(null);
          }}
          onConfirm={async () => {
            if (!pendingAdjustment) return;
            
            setLoading(true);
            try {
              if (Object.keys(pendingAdjustment.itemUpdateData || {}).length > 0) {
                await updateItem(
                  pendingAdjustment.itemId,
                  pendingAdjustment.itemUpdateData,
                  currentUser.uid
                );
              }

              if (pendingAdjustment.hasStockChange) {
                await addAdjustment(
                  {
                    itemId: pendingAdjustment.itemId,
                    quantidadeAnterior: pendingAdjustment.quantidadeAnterior,
                    quantidadeNova: pendingAdjustment.quantidadeNova,
                    motivo: pendingAdjustment.motivo,
                    observacao: pendingAdjustment.observacao,
                  },
                  currentUser.uid
                );
              }

              success("Alterações do item salvas com sucesso!");
              // 🔄 Invalidar cache via evento (otimizado)
              window.dispatchEvent(new Event('invalidateItemsCache'));

              // Limpar formulário
              setFormData({
                codigoBusca: "",
                nome: "",
                codigoItem: "",
                categoria: "",
                unidade: "UN",
                local: "",
                fornecedor: "",
                validade: "",
                quantidadeAnterior: "",
                quantidadeNova: "",
                quantidadeAdicionar: "",
                motivo: "",
                observacao: "",
              });
              setItemFound(null);
              setSearchTerm("");
              setPendingAdjustment(null);
              setShowConfirmModal(false);
              loadRecentAdjustments();
            } catch (error) {
              showError("Erro ao registrar ajuste: " + error.message);
              setError(error.message);
            } finally {
              setLoading(false);
            }
          }}
          title="Confirmar alterações do item"
          message={`Item: ${pendingAdjustment.itemNome}\n` +
            (pendingAdjustment.hasStockChange
              ? `Quantidade anterior: ${pendingAdjustment.quantidadeAnterior}\n` +
                `Quantidade nova: ${pendingAdjustment.quantidadeNova}\n` +
                `Diferença: ${pendingAdjustment.diferenca > 0 ? '+' : ''}${pendingAdjustment.diferenca}\n\n`
              : "Sem ajuste de quantidade\n\n") +
            `Campos cadastrais alterados: ${Object.keys(pendingAdjustment.itemUpdateData || {}).length}\n` +
            `Motivo: ${pendingAdjustment.motivo || "-"}`}
          confirmText="Confirmar"
          cancelText="Cancelar"
          variant="info"
        />
      )}

      {/* Modal Zerar todo o estoque */}
      {showZeroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Zerar todo o estoque</h3>
            <p className="text-sm text-gray-600 mb-4">
              Isso vai colocar a quantidade de <strong>todos os itens</strong> e de <strong>todos os lotes</strong> em zero e remover as <strong>datas de validade</strong> cadastradas. Use apenas para começar uma contagem do zero. Esta ação não pode ser desfeita automaticamente.
            </p>
            <p className="text-sm font-semibold text-red-700 mb-2">
              Digite <strong>ZERAR</strong> para confirmar (maiúsculas ou minúsculas):
            </p>
            <input
              type="text"
              value={zeroConfirmText}
              onChange={(e) => setZeroConfirmText(e.target.value)}
              placeholder="Digite ZERAR aqui"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowZeroModal(false);
                  setZeroConfirmText("");
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={zeroConfirmText.trim().toUpperCase() !== "ZERAR" || zeroLoading}
                onClick={async () => {
                  if (zeroConfirmText.trim().toUpperCase() !== "ZERAR") return;
                  setZeroLoading(true);
                  try {
                    const { itemsUpdated, batchesUpdated } = await zeroAllStock(currentUser.uid);
                    success(`Estoque zerado: ${itemsUpdated} itens e ${batchesUpdated} lotes atualizados.`);
                    window.dispatchEvent(new Event("invalidateItemsCache"));
                    setShowZeroModal(false);
                    setZeroConfirmText("");
                    loadRecentAdjustments();
                  } catch (err) {
                    showError("Erro ao zerar estoque: " + err.message);
                  } finally {
                    setZeroLoading(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {zeroLoading ? "Zerando..." : "Zerar todo o estoque"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockAdjustment;

