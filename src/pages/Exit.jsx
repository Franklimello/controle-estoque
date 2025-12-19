import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useItems } from "../context/ItemsContext";
import { useToastContext } from "../context/ToastContext";
import { addExit } from "../services/exits";
import { getItemByCodigo, getItemById } from "../services/items";
import { validateExit } from "../utils/validators";
import { ArrowUpCircle, Save, X, AlertTriangle, Search, Plus, Trash2, Edit2, Check, XCircle } from "lucide-react";
import { ESTOQUE_BAIXO_LIMITE, PERMISSIONS, TIPOS_SAIDA, TIPOS_SAIDA_LABELS } from "../config/constants";
import { fuzzySearch, sortByRelevance } from "../utils/fuzzySearch";
import { getErrorMessage } from "../utils/errorHandler";

const Exit = () => {
  const { currentUser, hasPermission } = useAuth();
  const { items, refreshItems } = useItems();
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [itemFound, setItemFound] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [exitItems, setExitItems] = useState([]); // Lista de itens para saída
  const [editingIndex, setEditingIndex] = useState(null); // Índice do item sendo editado
  const codigoTimeoutRef = useRef(null);
  const [formData, setFormData] = useState({
    codigo: "",
    itemId: "",
    quantidade: "",
    tipoSaida: TIPOS_SAIDA.NORMAL,
    setorDestino: "",
    retiradoPor: "",
    observacao: "",
  });

  useEffect(() => {
    return () => {
      if (codigoTimeoutRef.current) {
        clearTimeout(codigoTimeoutRef.current);
      }
    };
  }, []);

  const handleCodigoChange = async (e) => {
    const codigo = e.target.value;
    setFormData((prev) => ({ ...prev, codigo, itemId: "" }));
    setItemFound(null);
    setError("");

    if (codigoTimeoutRef.current) {
      clearTimeout(codigoTimeoutRef.current);
    }

    if (codigo.trim().length > 0) {
      codigoTimeoutRef.current = setTimeout(async () => {
        const item = await getItemByCodigo(codigo);
        if (item) {
          setItemFound(item);
        }
      }, 500);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Adicionar item à lista
  const handleAddToList = (e) => {
    e.preventDefault();
    setError("");

    const validation = validateExit({
      codigo: formData.codigo,
      itemId: formData.itemId,
      quantidade: parseFloat(formData.quantidade),
      setorDestino: formData.setorDestino,
    });

    if (!validation.isValid) {
      const errorMsg = validation.errors.join(", ");
      setError(errorMsg);
      return;
    }

    // Verificar se temos um item selecionado (pode ser via código ou busca)
    const hasItemId = formData.itemId && formData.itemId.trim().length > 0;
    if (!itemFound && !hasItemId) {
      setError("Selecione um item pelo código ou pela busca.");
      return;
    }

    // Verificar estoque suficiente
    const quantidadeSolicitada = parseFloat(formData.quantidade);
    
    // Validar quantidade
    if (!quantidadeSolicitada || quantidadeSolicitada <= 0 || isNaN(quantidadeSolicitada)) {
      setError("Quantidade deve ser maior que zero.");
      return;
    }
    
    // Usar originalItemId se o item foi expandido, senão usar o id normal
    const itemId = formData.itemId || (itemFound ? (itemFound.originalItemId || itemFound.id) : "");
    
    // Se não temos itemId, não podemos continuar
    if (!itemId || itemId.trim().length === 0) {
      setError("Item não identificado. Selecione um item pelo código ou pela busca.");
      return;
    }
    
    // ⚠️ VALIDAÇÃO EM TEMPO REAL: Verificar estoque considerando itens já na lista
    const existingItemInList = exitItems.find(item => item.itemId === itemId);
    const quantidadeJaNaLista = existingItemInList ? existingItemInList.quantidade : 0;
    const quantidadeTotalSolicitada = editingIndex !== null 
      ? quantidadeSolicitada // Se editando, usar apenas a nova quantidade
      : quantidadeJaNaLista + quantidadeSolicitada; // Se adicionando, somar com a existente
    
    // Buscar item atualizado (pode ter mudado desde que foi encontrado)
    // Se o item foi expandido (tem originalItemId), buscar pelo ID original para pegar a quantidade total
    const searchItemId = itemFound?.originalItemId || itemId;
    
    const currentItem = items.find(item => {
      const originalId = item.originalItemId || item.id;
      return originalId === searchItemId || item.id === searchItemId;
    });
    
    // Se não encontrou o item na lista atualizada, usar o itemFound
    if (!currentItem && !itemFound) {
      setError("Item não encontrado. Por favor, selecione o item novamente.");
      return;
    }
    
    // 🔧 CORREÇÃO: Se o item tem múltiplos lotes (isExpanded), usar quantidadeTotal, senão usar quantidade
    let estoqueAtual = 0;
    if (currentItem) {
      // Se é um item expandido, usar quantidadeTotal; senão usar quantidade
      estoqueAtual = currentItem.isExpanded && currentItem.quantidadeTotal 
        ? currentItem.quantidadeTotal 
        : (currentItem.quantidade || 0);
    } else if (itemFound) {
      // Se itemFound é expandido, usar quantidadeTotal; senão usar quantidade
      estoqueAtual = itemFound.isExpanded && itemFound.quantidadeTotal 
        ? itemFound.quantidadeTotal 
        : (itemFound.quantidade || 0);
    }

    // Permitir retirar todo o estoque (inclusive zerar) - quantidade pode ser igual ao estoque
    if (quantidadeTotalSolicitada > estoqueAtual) {
      setError(
        `Estoque insuficiente! Disponível: ${estoqueAtual}, Total solicitado: ${quantidadeTotalSolicitada}${quantidadeJaNaLista > 0 ? ` (${quantidadeJaNaLista} já na lista + ${quantidadeSolicitada} novo)` : ''}`
      );
      return;
    }

    // Verificar se o item já está na lista (para evitar duplicatas)
    const existingIndex = exitItems.findIndex(item => item.itemId === itemId);
    
    if (existingIndex >= 0 && editingIndex === null) {
      setError("Este item já está na lista. Edite a quantidade existente ou remova e adicione novamente.");
      return;
    }

    // Garantir que temos os dados do item (usar currentItem se disponível, senão itemFound)
    // Se o item foi expandido, buscar o item original (não expandido) para ter os dados completos
    let itemData = currentItem || itemFound;
    
    // Se o item é expandido, precisamos buscar o item original para ter quantidadeTotal correta
    if (itemData && itemData.isExpanded && itemData.originalItemId) {
      // Buscar item original na lista (não expandido)
      const originalItem = items.find(item => 
        (item.originalItemId || item.id) === itemData.originalItemId && !item.isExpanded
      );
      if (originalItem) {
        itemData = originalItem;
      } else {
        // Se não encontrou, usar o item expandido mas garantir quantidadeTotal
        itemData = {
          ...itemData,
          quantidade: itemData.quantidadeTotal || itemData.quantidade || 0,
        };
      }
    }
    
    if (!itemData) {
      setError("Dados do item não encontrados. Por favor, selecione o item novamente.");
      return;
    }
    
    const newExitItem = {
      id: editingIndex !== null ? exitItems[editingIndex].id : Date.now().toString(),
      itemId: itemId,
      codigo: formData.codigo || (itemData.codigo || ""),
      item: { ...itemData },
      quantidade: quantidadeSolicitada,
      tipoSaida: formData.tipoSaida || TIPOS_SAIDA.NORMAL,
      setorDestino: formData.setorDestino,
      retiradoPor: formData.retiradoPor,
      observacao: formData.observacao,
    };

    if (editingIndex !== null) {
      // Editar item existente
      const updatedItems = [...exitItems];
      updatedItems[editingIndex] = newExitItem;
      setExitItems(updatedItems);
      setEditingIndex(null);
    } else {
      // Adicionar novo item
      setExitItems([...exitItems, newExitItem]);
    }

    // Limpar formulário (manter tipoSaida)
    setFormData({
      codigo: "",
      itemId: "",
      quantidade: "",
      tipoSaida: formData.tipoSaida || TIPOS_SAIDA.NORMAL,
      setorDestino: "",
      retiradoPor: "",
      observacao: "",
    });
    setItemFound(null);
    setSearchTerm("");
    success(editingIndex !== null ? "Item atualizado na lista!" : "Item adicionado à lista!");
  };

  // Remover item da lista
  const handleRemoveFromList = (index) => {
    const updatedItems = exitItems.filter((_, i) => i !== index);
    setExitItems(updatedItems);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
    success("Item removido da lista!");
  };

  // Editar item da lista
  const handleEditItem = (index) => {
    const item = exitItems[index];
    setFormData({
      codigo: item.codigo || "",
      itemId: item.itemId,
      quantidade: item.quantidade.toString(),
      tipoSaida: item.tipoSaida || TIPOS_SAIDA.NORMAL,
      setorDestino: item.setorDestino,
      retiradoPor: item.retiradoPor,
      observacao: item.observacao,
    });
    setItemFound(item.item);
    setEditingIndex(index);
    setError("");
  };

  // Confirmar todas as saídas
  const handleConfirmAllExits = async () => {
    if (exitItems.length === 0) {
      setError("Adicione pelo menos um item à lista antes de confirmar.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Agrupar itens por itemId para verificar se a soma das quantidades não excede o estoque
      const itemsGrouped = {};
      exitItems.forEach(exitItem => {
        if (!itemsGrouped[exitItem.itemId]) {
          itemsGrouped[exitItem.itemId] = [];
        }
        itemsGrouped[exitItem.itemId].push(exitItem);
      });

      // Verificar estoque para cada grupo
      for (const itemId in itemsGrouped) {
        const group = itemsGrouped[itemId];
        
        // 🔧 CORREÇÃO: Buscar item original diretamente do banco para ter quantidade total correta
        // Isso garante que mesmo com múltiplos lotes, pegamos a quantidade total do item
        const originalItem = await getItemById(itemId);
        
        if (!originalItem) {
          throw new Error(`Item não encontrado: ${group[0].item.nome}`);
        }

        const totalQuantidade = group.reduce((sum, item) => sum + item.quantidade, 0);
        // O item original sempre tem a quantidade total correta (soma de todos os lotes)
        const estoqueAtual = originalItem.quantidade || 0;

        if (totalQuantidade > estoqueAtual) {
          throw new Error(
            `Estoque insuficiente para ${group[0].item.nome}. Disponível: ${estoqueAtual}, Total solicitado: ${totalQuantidade}`
          );
        }
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Processar cada item sequencialmente para evitar problemas de concorrência
      for (let i = 0; i < exitItems.length; i++) {
        const exitItem = exitItems[i];
        try {
          // Verificar estoque novamente antes de processar (pode ter mudado durante o processamento)
          // 🔧 CORREÇÃO: Buscar item original diretamente do banco para ter quantidade total correta
          const originalItem = await getItemById(exitItem.itemId);
          
          if (!originalItem) {
            throw new Error(`Item não encontrado: ${exitItem.item.nome}`);
          }
          
          // Usar o ID original do item para a saída
          const itemIdToUse = originalItem.id;

          // O item original sempre tem a quantidade total correta (soma de todos os lotes)
          const estoqueAtual = originalItem.quantidade || 0;
          // Permitir retirar todo o estoque (inclusive zerar)
          if (exitItem.quantidade > estoqueAtual) {
            throw new Error(
              `Estoque insuficiente para ${exitItem.item.nome}. Disponível: ${estoqueAtual}, Solicitado: ${exitItem.quantidade}`
            );
          }
          
          // Permitir quantidade zero (zerar estoque) - mas isso não faz sentido, então validamos > 0
          if (exitItem.quantidade <= 0) {
            throw new Error(`Quantidade deve ser maior que zero para ${exitItem.item.nome}`);
          }

          await addExit(
            {
              codigo: exitItem.codigo,
              itemId: itemIdToUse,
              quantidade: exitItem.quantidade,
              tipoSaida: exitItem.tipoSaida || TIPOS_SAIDA.NORMAL,
              setorDestino: exitItem.setorDestino,
              retiradoPor: exitItem.retiradoPor,
              observacao: exitItem.observacao,
            },
            currentUser.uid
          );
          successCount++;
          
          // 🔄 Invalidar cache automaticamente após saída bem-sucedida
          refreshItems();
        } catch (error) {
          errorCount++;
          errors.push(`${exitItem.item.nome}: ${getErrorMessage(error)}`);
        }
      }

      if (successCount > 0) {
        success(`${successCount} saída(s) registrada(s) com sucesso!`);
      }

      if (errorCount > 0) {
        showError(`${errorCount} erro(s) ao registrar saída(s):\n${errors.join("\n")}`);
      }

      // Limpar lista e formulário apenas se todas as saídas foram bem-sucedidas
      if (errorCount === 0) {
        setExitItems([]);
        setFormData({
          codigo: "",
          itemId: "",
          quantidade: "",
          tipoSaida: TIPOS_SAIDA.NORMAL,
          setorDestino: "",
          retiradoPor: "",
          observacao: "",
        });
        setItemFound(null);
        setSearchTerm("");
        setEditingIndex(null);
      }
    } catch (error) {
      showError("Erro ao registrar saídas: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // 🔧 CORREÇÃO: Calcular estoque considerando quantidadeTotal se item expandido
  const quantidadeAtualItem = useMemo(() => {
    if (!itemFound) return 0;
    return itemFound.isExpanded && itemFound.quantidadeTotal 
      ? itemFound.quantidadeTotal 
      : (itemFound.quantidade || 0);
  }, [itemFound]);

  const isLowStock = quantidadeAtualItem <= ESTOQUE_BAIXO_LIMITE;

  const estoqueAposSaida =
    itemFound && formData.quantidade
      ? quantidadeAtualItem - parseFloat(formData.quantidade)
      : null;

  const alertaEstoqueBaixo =
    estoqueAposSaida !== null && estoqueAposSaida <= ESTOQUE_BAIXO_LIMITE;

  // ✅ Busca fuzzy (tolerante a erros)
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return [];

    const filtered = items
      .filter((it) => fuzzySearch(it, searchTerm, ['nome', 'codigo'], 0.5))
      .slice(0, 8);
    return sortByRelevance(filtered, searchTerm, ['nome', 'codigo']);
  }, [items, searchTerm]);

  if (!hasPermission(PERMISSIONS.CREATE_EXIT)) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Acesso restrito</h1>
            <p className="text-gray-600">
              Você não tem permissão para registrar saídas.
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-4 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <ArrowUpCircle className="w-6 h-6 mr-2 text-red-600" />
              Registrar Saída
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
              <div className="relative z-10">
                <strong>Erro:</strong> {error}
                <button
                  onClick={() => setError("")}
                  className="ml-2 text-red-800 hover:text-red-900 underline text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}


          {itemFound && (
            <div
              className={`rounded-lg p-4 mb-4 ${
                isLowStock
                  ? "bg-red-50 border border-red-200"
                  : "bg-blue-50 border border-blue-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      isLowStock ? "text-red-800" : "text-blue-800"
                    }`}
                  >
                    <strong>Item:</strong> {itemFound.nome}
                  </p>
                  <p
                    className={`text-sm mt-1 ${
                      isLowStock ? "text-red-700" : "text-blue-700"
                    }`}
                  >
                    Estoque atual:{" "}
                    <strong>
                      {quantidadeAtualItem} {itemFound.unidade || "UN"}
                      {itemFound.isExpanded && itemFound.quantidadeTotal && (
                        <span className="text-xs text-gray-500 ml-1">
                          (total em múltiplos lotes)
                        </span>
                      )}
                    </strong>
                  </p>
                  {estoqueAposSaida !== null && (
                    <p
                      className={`text-sm mt-1 ${
                        alertaEstoqueBaixo
                          ? "text-red-700 font-bold"
                          : "text-gray-700"
                      }`}
                    >
                      Estoque após saída:{" "}
                      <strong>
                        {estoqueAposSaida} {itemFound.unidade || "UN"}
                      </strong>
                    </p>
                  )}
                </div>
                {isLowStock && (
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                )}
              </div>
            </div>
          )}

          {alertaEstoqueBaixo && (
            <div className="bg-yellow-50 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <span>
                Atenção: O estoque ficará abaixo do mínimo após esta saída!
              </span>
            </div>
          )}

          {!itemFound &&
            formData.codigo &&
            formData.codigo.trim().length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800">
                  <strong>Erro:</strong> Item não encontrado. Verifique o código
                  de barras.
                </p>
              </div>
            )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Informação:</strong> Use o código de barras ou busque o
              item pelo nome abaixo. Selecione o item para registrar a saída sem
              código.
            </p>
          </div>

          {/* Lista de Itens Adicionados */}
          {exitItems.length > 0 && (
            <div className="mb-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center">
                  <ArrowUpCircle className="w-5 h-5 mr-2 text-red-600" />
                  Itens para Saída ({exitItems.length})
                </h2>
                <button
                  onClick={handleConfirmAllExits}
                  disabled={loading}
                  className="action-button px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition relative overflow-hidden"
                >
                  <div className="action-button-ring">
                    <i></i>
                  </div>
                  <Check className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">{loading ? "Processando..." : "Confirmar Todas as Saídas"}</span>
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {exitItems.map((exitItem, index) => {
                  const isLowStockItem = (exitItem.item.quantidade || 0) <= ESTOQUE_BAIXO_LIMITE;
                  const estoqueAposSaida = (exitItem.item.quantidade || 0) - exitItem.quantidade;
                  const alertaEstoqueBaixo = estoqueAposSaida <= ESTOQUE_BAIXO_LIMITE;

                  return (
                    <div
                      key={exitItem.id}
                      className={`bg-white rounded-lg border-2 p-4 transition-all ${
                        editingIndex === index
                          ? "border-blue-500 shadow-lg"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-bold text-gray-800">{exitItem.item.nome}</h3>
                            {isLowStockItem && (
                              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                            )}
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Quantidade: </span>
                              <span className="font-semibold text-gray-800">
                                {exitItem.quantidade} {exitItem.item.unidade || "UN"}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Tipo: </span>
                              <span className={`font-semibold ${
                                exitItem.tipoSaida === TIPOS_SAIDA.AVARIA ? "text-red-600" :
                                exitItem.tipoSaida === TIPOS_SAIDA.CONSUMO_INTERNO ? "text-blue-600" :
                                "text-gray-800"
                              }`}>
                                {TIPOS_SAIDA_LABELS[exitItem.tipoSaida] || TIPOS_SAIDA_LABELS[TIPOS_SAIDA.NORMAL]}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Setor: </span>
                              <span className="font-semibold text-gray-800">{exitItem.setorDestino}</span>
                            </div>
                            {exitItem.retiradoPor && (
                              <div>
                                <span className="text-gray-600">Retirado por: </span>
                                <span className="font-semibold text-gray-800">{exitItem.retiradoPor}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-gray-600">Estoque atual: </span>
                              <span className={`font-semibold ${isLowStockItem ? "text-red-600" : "text-gray-800"}`}>
                                {exitItem.item.quantidade || 0} {exitItem.item.unidade || "UN"}
                              </span>
                            </div>
                          </div>
                          {alertaEstoqueBaixo && (
                            <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                              ⚠️ Estoque ficará abaixo do mínimo após esta saída
                            </div>
                          )}
                          {exitItem.observacao && (
                            <div className="mt-2 text-xs text-gray-600">
                              <span className="font-semibold">Obs:</span> {exitItem.observacao}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditItem(index)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar item"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveFromList(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Remover item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleAddToList} noValidate className="space-y-3 lg:space-y-4">
            <div className="lg:grid lg:grid-cols-2 lg:gap-6">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Código de Barras
                </label>
                <input
                  type="text"
                  name="codigo"
                  value={formData.codigo}
                  onChange={handleCodigoChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Digite ou escaneie o código (opcional)"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deixe em branco se o item não tiver código de barras.
                </p>
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Buscar Item (nome ou código)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Digite parte do nome ou código"
                  />
                </div>

                {searchTerm.trim().length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                    {filteredItems.map((it) => (
                      <button
                        type="button"
                        key={it.id}
                        onClick={() => {
                          setItemFound(it);
                          // Usar originalItemId se o item foi expandido, senão usar o id normal
                          const itemIdToUse = it.originalItemId || it.id;
                          setFormData((prev) => ({
                            ...prev,
                            itemId: itemIdToUse,
                            codigo: it.codigo || "",
                          }));
                          setError("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-red-50 focus:outline-none"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-gray-800">
                              {it.nome}
                            </p>
                            <p className="text-xs text-gray-500">
                              Código: {it.codigo || "Sem código"}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500">
                            Estoque: {it.quantidade || 0} {it.unidade || "UN"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:grid lg:grid-cols-3 lg:gap-6">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Quantidade *
                </label>
                <input
                  type="number"
                  name="quantidade"
                  value={formData.quantidade}
                  onChange={handleChange}
                  step="0.01"
                  min="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                {itemFound && (
                  <p className="text-xs text-gray-500 mt-1">
                    Disponível: {itemFound.quantidade || 0} {itemFound.unidade || "UN"} (pode retirar tudo, inclusive zerar)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Tipo de Saída *
                </label>
                <select
                  name="tipoSaida"
                  value={formData.tipoSaida}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value={TIPOS_SAIDA.NORMAL}>{TIPOS_SAIDA_LABELS[TIPOS_SAIDA.NORMAL]}</option>
                  <option value={TIPOS_SAIDA.CONSUMO_INTERNO}>{TIPOS_SAIDA_LABELS[TIPOS_SAIDA.CONSUMO_INTERNO]}</option>
                  <option value={TIPOS_SAIDA.AVARIA}>{TIPOS_SAIDA_LABELS[TIPOS_SAIDA.AVARIA]}</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Setor Destino *
                </label>
                <input
                  type="text"
                  name="setorDestino"
                  value={formData.setorDestino}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Ex: Administração, Manutenção, etc."
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Retirado Por
                </label>
                <input
                  type="text"
                  name="retiradoPor"
                  value={formData.retiradoPor}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Nome da pessoa que retirou"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Observação
              </label>
              <textarea
                name="observacao"
                value={formData.observacao}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Observações adicionais"
              />
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              {editingIndex !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingIndex(null);
                    setFormData({
                      codigo: "",
                      itemId: "",
                      quantidade: "",
                      setorDestino: "",
                      retiradoPor: "",
                      observacao: "",
                    });
                    setItemFound(null);
                    setSearchTerm("");
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition flex items-center space-x-2"
                >
                  <XCircle className="w-5 h-5" />
                  <span>Cancelar Edição</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/items")}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || (!itemFound && !formData.itemId)}
                className="action-button px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition relative overflow-hidden"
                title={!itemFound && !formData.itemId ? "Selecione um item primeiro" : ""}
              >
                <div className="action-button-ring">
                  <i></i>
                </div>
                <Plus className="w-5 h-5 relative z-10" />
                <span className="relative z-10">
                  {editingIndex !== null ? "Atualizar Item" : "Adicionar à Lista"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Exit;
