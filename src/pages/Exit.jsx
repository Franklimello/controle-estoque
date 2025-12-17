import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useItems } from "../context/ItemsContext";
import { useToastContext } from "../context/ToastContext";
import { addExit } from "../services/exits";
import { getItemByCodigo } from "../services/items";
import { validateExit } from "../utils/validators";
import { ArrowUpCircle, Save, X, AlertTriangle, Search, Plus, Trash2, Edit2, Check, XCircle } from "lucide-react";
import { ESTOQUE_BAIXO_LIMITE, PERMISSIONS } from "../config/constants";
import { fuzzySearch, sortByRelevance } from "../utils/fuzzySearch";
import { getErrorMessage } from "../utils/errorHandler";

const Exit = () => {
  const { currentUser, hasPermission } = useAuth();
  const { items } = useItems();
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [itemFound, setItemFound] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [exitItems, setExitItems] = useState([]); // Lista de itens para saída
  const [editingIndex, setEditingIndex] = useState(null); // Índice do item sendo editado
  const [formData, setFormData] = useState({
    codigo: "",
    itemId: "",
    quantidade: "",
    setorDestino: "",
    retiradoPor: "",
    observacao: "",
  });

  const handleCodigoChange = async (e) => {
    const codigo = e.target.value;
    setFormData((prev) => ({ ...prev, codigo, itemId: "" }));
    setItemFound(null);
    setError("");

    if (codigo.trim().length > 0) {
      setTimeout(async () => {
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
      setError(validation.errors.join(", "));
      return;
    }

    if (
      !itemFound &&
      (!formData.itemId || formData.itemId.trim().length === 0)
    ) {
      setError("Selecione um item pelo código ou pela busca.");
      return;
    }

    // Verificar estoque suficiente
    const quantidadeSolicitada = parseFloat(formData.quantidade);
    const estoqueAtual = itemFound.quantidade || 0;

    if (quantidadeSolicitada > estoqueAtual) {
      setError(
        `Estoque insuficiente! Disponível: ${estoqueAtual}, Solicitado: ${quantidadeSolicitada}`
      );
      return;
    }

    // Verificar se o item já está na lista (para evitar duplicatas)
    const itemId = formData.itemId || (itemFound ? itemFound.id : "");
    const existingIndex = exitItems.findIndex(item => item.itemId === itemId);
    
    if (existingIndex >= 0 && editingIndex === null) {
      setError("Este item já está na lista. Edite a quantidade existente ou remova e adicione novamente.");
      return;
    }

    const newExitItem = {
      id: editingIndex !== null ? exitItems[editingIndex].id : Date.now().toString(),
      itemId: itemId,
      codigo: formData.codigo || (itemFound ? itemFound.codigo : ""),
      item: { ...itemFound },
      quantidade: quantidadeSolicitada,
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

    // Limpar formulário
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
        const currentItem = items.find(item => item.id === itemId);
        
        if (!currentItem) {
          throw new Error(`Item não encontrado: ${group[0].item.nome}`);
        }

        const totalQuantidade = group.reduce((sum, item) => sum + item.quantidade, 0);
        const estoqueAtual = currentItem.quantidade || 0;

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
          const currentItem = items.find(item => item.id === exitItem.itemId);
          if (!currentItem) {
            throw new Error(`Item não encontrado: ${exitItem.item.nome}`);
          }

          const estoqueAtual = currentItem.quantidade || 0;
          if (exitItem.quantidade > estoqueAtual) {
            throw new Error(
              `Estoque insuficiente para ${exitItem.item.nome}. Disponível: ${estoqueAtual}, Solicitado: ${exitItem.quantidade}`
            );
          }

          await addExit(
            {
              codigo: exitItem.codigo,
              itemId: exitItem.itemId,
              quantidade: exitItem.quantidade,
              setorDestino: exitItem.setorDestino,
              retiradoPor: exitItem.retiradoPor,
              observacao: exitItem.observacao,
            },
            currentUser.uid
          );
          successCount++;
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

  const isLowStock =
    itemFound && (itemFound.quantidade || 0) <= ESTOQUE_BAIXO_LIMITE;

  const estoqueAposSaida =
    itemFound && formData.quantidade
      ? (itemFound.quantidade || 0) - parseFloat(formData.quantidade)
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
              <span className="relative z-10">{error}</span>
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
                      {itemFound.quantidade || 0} {itemFound.unidade || "UN"}
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
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Quantidade: </span>
                              <span className="font-semibold text-gray-800">
                                {exitItem.quantidade} {exitItem.item.unidade || "UN"}
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
                          setFormData((prev) => ({
                            ...prev,
                            itemId: it.id,
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
                  max={itemFound ? itemFound.quantidade : undefined}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                {itemFound && (
                  <p className="text-xs text-gray-500 mt-1">
                    Máximo: {itemFound.quantidade || 0} {itemFound.unidade || "UN"}
                  </p>
                )}
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
                disabled={loading || !itemFound}
                className="action-button px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition relative overflow-hidden"
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
