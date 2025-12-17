import { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useItems } from "../context/ItemsContext";
import { useToastContext } from "../context/ToastContext";
import { createOrder } from "../services/orders";
import { ShoppingCart, Plus, Trash2, Search, Send, Package, X, Check } from "lucide-react";

const Orders = () => {
  const { currentUser } = useAuth();
  const { items } = useItems();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderItems, setOrderItems] = useState([]);
  const [setorDestino, setSetorDestino] = useState("");
  const [observacao, setObservacao] = useState("");
  const [whatsappSolicitante, setWhatsappSolicitante] = useState("");
  const [customProductName, setCustomProductName] = useState("");
  const [showCustomProduct, setShowCustomProduct] = useState(false);
  
  // Estado para itens selecionados (com quantidade)
  const [selectedItems, setSelectedItems] = useState({});

  // Filtrar itens para exibição
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    return items.filter(
      (it) =>
        (it.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (it.codigo || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  // Toggle seleção de item
  const handleToggleItem = (itemId) => {
    setSelectedItems((prev) => {
      const newState = { ...prev };
      if (newState[itemId]) {
        delete newState[itemId];
      } else {
        newState[itemId] = { quantidade: 1 };
      }
      return newState;
    });
  };

  // Atualizar quantidade de item selecionado
  const handleUpdateSelectedQuantity = (itemId, quantidade) => {
    if (quantidade <= 0) {
      handleToggleItem(itemId); // Remove se quantidade for 0
      return;
    }
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantidade },
    }));
  };

  // Confirmar seleção e adicionar à lista do pedido
  const handleConfirmSelection = () => {
    const itemsToAdd = Object.entries(selectedItems)
      .map(([itemId, data]) => {
        const item = items.find((it) => it.id === itemId);
        if (!item) return null;
        return {
          itemId: item.id,
          codigo: item.codigo || "",
          nome: item.nome,
          quantidade: data.quantidade,
          unidade: item.unidade || "UN",
          estoqueAtual: item.quantidade || 0,
        };
      })
      .filter(Boolean);

    if (itemsToAdd.length === 0) {
      showError("Selecione pelo menos um item");
      return;
    }

    // Adicionar itens ao pedido (evitar duplicatas)
    const updatedOrderItems = [...orderItems];
    itemsToAdd.forEach((newItem) => {
      const existingIndex = updatedOrderItems.findIndex(
        (oi) => oi.itemId === newItem.itemId
      );
      if (existingIndex >= 0) {
        updatedOrderItems[existingIndex].quantidade += newItem.quantidade;
      } else {
        updatedOrderItems.push(newItem);
      }
    });

    setOrderItems(updatedOrderItems);
    setSelectedItems({});
    success(`${itemsToAdd.length} item(ns) adicionado(s) ao pedido!`);
  };

  // Adicionar produto customizado
  const handleAddCustomProduct = () => {
    if (!customProductName.trim()) {
      showError("Digite o nome do produto");
      return;
    }

    setOrderItems([
      ...orderItems,
      {
        itemId: null,
        codigo: "",
        nome: customProductName.trim(),
        nomeProduto: customProductName.trim(), // Para produtos não cadastrados
        quantidade: 1,
        unidade: "UN",
        estoqueAtual: 0,
        isCustom: true,
      },
    ]);
    setCustomProductName("");
    setShowCustomProduct(false);
    success("Produto customizado adicionado ao pedido!");
  };

  // Remover item do pedido
  const handleRemoveItem = (index) => {
    const updated = orderItems.filter((_, i) => i !== index);
    setOrderItems(updated);
  };

  // Atualizar quantidade
  const handleUpdateQuantity = (index, quantidade) => {
    if (quantidade <= 0) {
      handleRemoveItem(index);
      return;
    }
    const updated = [...orderItems];
    updated[index].quantidade = quantidade;
    setOrderItems(updated);
  };

  // Enviar pedido
  const handleSubmitOrder = async () => {
    if (orderItems.length === 0) {
      showError("Adicione pelo menos um item ao pedido");
      return;
    }

    if (!setorDestino.trim()) {
      showError("Informe o setor de destino");
      return;
    }

    setLoading(true);
    try {
      await createOrder(
        {
          itens: orderItems,
          setorDestino: setorDestino.trim(),
          observacao: observacao.trim(),
          whatsappSolicitante: whatsappSolicitante.trim(),
          solicitadoPorNome: currentUser.email,
        },
        currentUser.uid
      );

      success("Pedido criado com sucesso! Aguarde aprovação do administrador.");
      
      // Limpar formulário
      setOrderItems([]);
      setSetorDestino("");
      setObservacao("");
      setWhatsappSolicitante("");
      setSearchTerm("");
    } catch (error) {
      showError("Erro ao criar pedido: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 lg:px-6 py-4 lg:py-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-4 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 lg:mb-6 gap-4">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-800 flex items-center">
              <ShoppingCart className="w-5 h-5 lg:w-6 lg:h-6 mr-2 text-blue-600" />
              Novo Pedido
            </h1>
          </div>

          {/* Busca e Lista de Produtos */}
          <div className="mb-4 lg:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 lg:mb-4 gap-3">
              <label className="block text-gray-700 text-sm lg:text-base font-bold">
                Selecionar Produtos
              </label>
              {Object.keys(selectedItems).length > 0 && (
                <button
                  onClick={handleConfirmSelection}
                  className="px-3 py-2 lg:px-4 text-sm lg:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Check className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="hidden sm:inline">Confirmar Seleção</span>
                  <span className="sm:hidden">Confirmar ({Object.keys(selectedItems).length})</span>
                </button>
              )}
            </div>

            {/* Campo de busca */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Buscar por nome ou código..."
              />
            </div>

            {/* Lista de todos os produtos com checkboxes */}
            <div className="border border-gray-200 rounded-lg bg-white max-h-96 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="p-6 lg:p-8 text-center text-gray-500">
                  <p className="text-sm lg:text-base">Nenhum produto encontrado</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredItems.map((item) => {
                    const isSelected = selectedItems[item.id];
                    const estoqueAtual = item.quantidade || 0;
                    const quantidadeSolicitada = isSelected?.quantidade || 0;
                    const estoqueInsuficiente = quantidadeSolicitada > estoqueAtual;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 lg:p-4 hover:bg-gray-50 transition ${
                          isSelected ? "bg-blue-50 border-l-4 border-blue-500" : ""
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={!!isSelected}
                              onChange={() => handleToggleItem(item.id)}
                              className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm lg:text-base text-gray-800 truncate">{item.nome}</p>
                              <div className="flex flex-wrap gap-2 lg:gap-3 text-xs lg:text-sm text-gray-500 mt-1">
                                {item.codigo && (
                                  <span>Código: {item.codigo}</span>
                                )}
                                <span>
                                  Estoque: {estoqueAtual} {item.unidade || "UN"}
                                </span>
                                {item.categoria && (
                                  <span>Categoria: {item.categoria}</span>
                                )}
                              </div>
                              {estoqueInsuficiente && isSelected && (
                                <p className="text-xs text-red-600 mt-1 font-semibold">
                                  ⚠️ Estoque insuficiente!
                                </p>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-2 sm:ml-auto">
                              <label className="text-xs lg:text-sm text-gray-700 whitespace-nowrap">Qtd:</label>
                              <input
                                type="number"
                                min="1"
                                value={quantidadeSolicitada}
                                onChange={(e) =>
                                  handleUpdateSelectedQuantity(
                                    item.id,
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                className="w-16 lg:w-20 px-2 py-1 text-xs lg:text-sm border border-gray-300 rounded text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs lg:text-sm text-gray-600 whitespace-nowrap">{item.unidade || "UN"}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Opção de produto customizado */}
            <div className="mt-4">
              {!showCustomProduct ? (
                <button
                  type="button"
                  onClick={() => setShowCustomProduct(true)}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar produto não cadastrado
                </button>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-gray-700 text-sm font-bold">
                      Nome do Produto
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomProduct(false);
                        setCustomProductName("");
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customProductName}
                      onChange={(e) => setCustomProductName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleAddCustomProduct();
                        }
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Digite o nome do produto"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomProduct}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Itens do Pedido */}
          {orderItems.length > 0 && (
            <div className="mb-4 lg:mb-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4 lg:p-6">
              <h2 className="text-base lg:text-lg font-bold text-gray-800 mb-3 lg:mb-4 flex items-center">
                <Package className="w-4 h-4 lg:w-5 lg:h-5 mr-2 text-blue-600" />
                Itens do Pedido ({orderItems.length})
              </h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {orderItems.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg border-2 border-slate-200 p-3 lg:p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-bold text-sm lg:text-base text-gray-800 break-words">{item.nome || item.nomeProduto}</h3>
                          {item.isCustom && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded whitespace-nowrap">
                              Não cadastrado
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs lg:text-sm">
                          {item.codigo && (
                            <div>
                              <span className="text-gray-600">Código: </span>
                              <span className="font-semibold text-gray-800 break-words">{item.codigo}</span>
                            </div>
                          )}
                          {!item.isCustom && (
                            <div>
                              <span className="text-gray-600">Estoque: </span>
                              <span className="font-semibold text-gray-800">
                                {item.estoqueAtual} {item.unidade}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Quantidade: </span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) =>
                                handleUpdateQuantity(index, parseInt(e.target.value) || 1)
                              }
                              className="w-16 lg:w-20 px-2 py-1 text-xs lg:text-sm border border-gray-300 rounded text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-gray-600 whitespace-nowrap">{item.unidade}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition self-start sm:self-auto"
                        title="Remover item"
                      >
                        <Trash2 className="w-4 h-4 lg:w-5 lg:h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Informações do Pedido */}
          <div className="space-y-3 lg:space-y-4 mb-4 lg:mb-6">
            <div>
              <label className="block text-gray-700 text-xs lg:text-sm font-bold mb-2">
                Setor de Destino *
              </label>
              <input
                type="text"
                value={setorDestino}
                onChange={(e) => setSetorDestino(e.target.value)}
                className="w-full px-3 lg:px-4 py-2 text-sm lg:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: PSF Centro, PSF Bairro X, etc."
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 text-xs lg:text-sm font-bold mb-2">
                WhatsApp do Solicitante
              </label>
              <input
                type="text"
                value={whatsappSolicitante}
                onChange={(e) => setWhatsappSolicitante(e.target.value)}
                className="w-full px-3 lg:px-4 py-2 text-sm lg:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: (11) 99999-9999 ou 11999999999"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-xs lg:text-sm font-bold mb-2">
                Observações
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows="3"
                className="w-full px-3 lg:px-4 py-2 text-sm lg:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Observações adicionais sobre o pedido"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end pt-3 lg:pt-4">
            <button
              onClick={handleSubmitOrder}
              disabled={loading || orderItems.length === 0}
              className="action-button w-full sm:w-auto px-4 lg:px-6 py-2 text-sm lg:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition relative overflow-hidden"
            >
              <div className="action-button-ring">
                <i></i>
              </div>
              <Send className="w-4 h-4 lg:w-5 lg:h-5 relative z-10" />
              <span className="relative z-10">
                {loading ? "Enviando..." : "Enviar Pedido"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Orders;

