import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useItems } from "../context/ItemsContext";
import { useToastContext } from "../context/ToastContext";
import { getOrders, updateOrderStatus, finalizeOrder } from "../services/orders";
import { Check, X, Package, ShoppingCart, AlertTriangle, Clock, CheckCircle, XCircle, MessageCircle } from "lucide-react";
import { formatDate } from "../utils/validators";

const OrdersManagement = () => {
  const { currentUser, isAdmin } = useAuth();
  const { items } = useItems();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState("pendente"); // pendente, aprovado, rejeitado, finalizado
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [observacaoAdmin, setObservacaoAdmin] = useState("");
  // Estado para controlar itens selecionados e quantidades editadas antes de baixar
  const [itemsToFinalize, setItemsToFinalize] = useState({}); // { orderId: { itemIndex: { selected: boolean, quantidade: number } } }

  useEffect(() => {
    loadOrders();
  }, [filterStatus]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const ordersData = await getOrders(filterStatus);
      setOrders(ordersData);
    } catch (error) {
      showError("Erro ao carregar pedidos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orderId) => {
    if (!observacaoAdmin.trim() && !confirm("Deseja aprovar este pedido sem observação?")) {
      return;
    }

    setLoading(true);
    try {
      await updateOrderStatus(orderId, "aprovado", currentUser.uid, observacaoAdmin);
      success("Pedido aprovado com sucesso!");
      setSelectedOrder(null);
      setObservacaoAdmin("");
      loadOrders();
    } catch (error) {
      showError("Erro ao aprovar pedido: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (orderId) => {
    if (!observacaoAdmin.trim()) {
      showError("Informe o motivo da rejeição");
      return;
    }

    setLoading(true);
    try {
      await updateOrderStatus(orderId, "rejeitado", currentUser.uid, observacaoAdmin);
      success("Pedido rejeitado");
      setSelectedOrder(null);
      setObservacaoAdmin("");
      loadOrders();
    } catch (error) {
      showError("Erro ao rejeitar pedido: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Inicializar itens para finalização quando um pedido aprovado é selecionado
  const initializeItemsToFinalize = (order) => {
    if (order.status === "aprovado" && !itemsToFinalize[order.id]) {
      const itemsState = {};
      order.itens.forEach((item, index) => {
        itemsState[index] = {
          selected: !item.isCustom, // Itens cadastrados são selecionados por padrão
          quantidade: item.quantidade,
        };
      });
      setItemsToFinalize((prev) => ({
        ...prev,
        [order.id]: itemsState,
      }));
    }
  };

  // Toggle seleção de item para finalização
  const handleToggleItemForFinalize = (orderId, itemIndex) => {
    setItemsToFinalize((prev) => {
      const orderItems = prev[orderId] || {};
      return {
        ...prev,
        [orderId]: {
          ...orderItems,
          [itemIndex]: {
            ...orderItems[itemIndex],
            selected: !orderItems[itemIndex]?.selected,
          },
        },
      };
    });
  };

  // Atualizar quantidade de item para finalização
  const handleUpdateQuantityForFinalize = (orderId, itemIndex, quantidade) => {
    if (quantidade < 0) return;
    setItemsToFinalize((prev) => {
      const orderItems = prev[orderId] || {};
      return {
        ...prev,
        [orderId]: {
          ...orderItems,
          [itemIndex]: {
            ...orderItems[itemIndex],
            quantidade: Math.max(0, quantidade),
          },
        },
      };
    });
  };

  const handleFinalize = async (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const orderItemsState = itemsToFinalize[orderId] || {};
    const selectedItems = Object.entries(orderItemsState)
      .filter(([index, state]) => state.selected)
      .map(([index, state]) => ({
        index: parseInt(index),
        quantidade: state.quantidade,
      }));

    if (selectedItems.length === 0) {
      showError("Selecione pelo menos um item para baixar");
      return;
    }

    // Validar quantidades
    for (const { index, quantidade } of selectedItems) {
      const item = order.itens[index];
      if (!item.isCustom && item.itemId) {
        // 🔧 CORREÇÃO: Buscar item original do banco para ter quantidade total correta
        const { getItemById } = await import("../services/items");
        const originalItem = await getItemById(item.itemId);
        
        if (originalItem && quantidade > (originalItem.quantidade || 0)) {
          showError(
            `Quantidade solicitada (${quantidade}) maior que o estoque disponível (${originalItem.quantidade || 0}) para ${item.nome || item.nomeProduto}`
          );
          return;
        }
      }
      if (quantidade <= 0) {
        showError("A quantidade deve ser maior que zero");
        return;
      }
    }

    if (!confirm("Ao finalizar, os itens selecionados serão baixados do estoque automaticamente. Deseja continuar?")) {
      return;
    }

    setLoading(true);
    try {
      // Preparar itens editados para envio
      const editedItems = selectedItems.map(({ index, quantidade }) => ({
        ...order.itens[index],
        quantidade,
      }));

      await finalizeOrder(orderId, currentUser.uid, editedItems);
      success("Pedido finalizado e itens baixados do estoque!");
      setSelectedOrder(null);
      setObservacaoAdmin("");
      // Limpar estado dos itens
      setItemsToFinalize((prev) => {
        const newState = { ...prev };
        delete newState[orderId];
        return newState;
      });
      loadOrders();
    } catch (error) {
      showError("Erro ao finalizar pedido: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Formatar número de WhatsApp (remover caracteres não numéricos)
  const formatWhatsAppNumber = (phone) => {
    if (!phone) return null;
    // Remove tudo exceto números
    const cleaned = phone.replace(/\D/g, "");
    // Se começar com 0, remove
    const withoutLeadingZero = cleaned.startsWith("0") ? cleaned.substring(1) : cleaned;
    return withoutLeadingZero || null;
  };

  // Gerar link do WhatsApp com mensagem pré-formatada
  const getWhatsAppLink = (order) => {
    const phone = formatWhatsAppNumber(order.whatsappSolicitante);
    if (!phone) return null;

    const message = encodeURIComponent(
      `Olá! Seu pedido #${order.id.substring(0, 8)} está separado e pronto para ser coletado.`
    );
    
    return `https://wa.me/55${phone}?text=${message}`;
  };

  const getStatusBadge = (status) => {
    const badges = {
      pendente: (
        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Pendente
        </span>
      ),
      aprovado: (
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Aprovado
        </span>
      ),
      rejeitado: (
        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Rejeitado
        </span>
      ),
      finalizado: (
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Finalizado
        </span>
      ),
    };
    return badges[status] || badges.pendente;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Acesso restrito</h1>
            <p className="text-gray-600">
              Apenas o administrador pode gerenciar pedidos.
            </p>
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
              <ShoppingCart className="w-6 h-6 mr-2 text-blue-600" />
              Gerenciar Pedidos
            </h1>
          </div>

          {/* Filtros */}
          <div className="mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterStatus("pendente")}
              className={`px-4 py-2 rounded-lg transition ${
                filterStatus === "pendente"
                  ? "bg-yellow-100 text-yellow-800 font-semibold"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Pendentes
            </button>
            <button
              onClick={() => setFilterStatus("aprovado")}
              className={`px-4 py-2 rounded-lg transition ${
                filterStatus === "aprovado"
                  ? "bg-blue-100 text-blue-800 font-semibold"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Aprovados
            </button>
            <button
              onClick={() => setFilterStatus("rejeitado")}
              className={`px-4 py-2 rounded-lg transition ${
                filterStatus === "rejeitado"
                  ? "bg-red-100 text-red-800 font-semibold"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Rejeitados
            </button>
            <button
              onClick={() => setFilterStatus("finalizado")}
              className={`px-4 py-2 rounded-lg transition ${
                filterStatus === "finalizado"
                  ? "bg-green-100 text-green-800 font-semibold"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Finalizados
            </button>
          </div>

          {loading && orders.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="loading-ring">
                  <i></i>
                  <i></i>
                </div>
                <p className="text-gray-700 font-medium">Carregando pedidos...</p>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className={`border-2 rounded-lg p-4 lg:p-6 transition ${
                    selectedOrder?.id === order.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-800">
                          Pedido #{order.id.substring(0, 8)}
                        </h3>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-semibold">Solicitado por:</span>{" "}
                          {order.solicitadoPorNome || "N/A"}
                        </div>
                        <div>
                          <span className="font-semibold">Setor:</span> {order.setorDestino || "N/A"}
                        </div>
                        <div>
                          <span className="font-semibold">Data:</span>{" "}
                          {formatDate(order.createdAt)}
                        </div>
                      </div>
                      {order.observacao && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-semibold">Observação:</span> {order.observacao}
                        </div>
                      )}
                      {order.observacaoAdmin && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-semibold">Observação Admin:</span>{" "}
                          {order.observacaoAdmin}
                        </div>
                      )}
                      {order.whatsappSolicitante && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-semibold">WhatsApp:</span> {order.whatsappSolicitante}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {getWhatsAppLink(order) && (
                        <a
                          href={getWhatsAppLink(order)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span className="hidden sm:inline">Avisar no WhatsApp</span>
                          <span className="sm:hidden">WhatsApp</span>
                        </a>
                      )}
                      <button
                        onClick={() => {
                          const isSelecting = selectedOrder?.id !== order.id;
                          setSelectedOrder(isSelecting ? order : null);
                          setObservacaoAdmin("");
                          if (isSelecting && order.status === "aprovado") {
                            initializeItemsToFinalize(order);
                          }
                        }}
                        className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        {selectedOrder?.id === order.id ? "Ocultar" : "Ver Detalhes"}
                      </button>
                    </div>
                  </div>

                  {selectedOrder?.id === order.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="font-bold text-gray-800 mb-3">Itens do Pedido:</h4>
                      <div className="space-y-2 mb-4">
                        {order.itens.map((item, index) => {
                          // 🔧 CORREÇÃO: Buscar item considerando originalItemId se expandido
                          const itemData = items.find((it) => {
                            const originalId = it.originalItemId || it.id;
                            return originalId === item.itemId || it.id === item.itemId;
                          });
                          
                          const itemState = itemsToFinalize[order.id]?.[index] || {
                            selected: !item.isCustom,
                            quantidade: item.quantidade,
                          };
                          
                          // 🔧 CORREÇÃO: Se item expandido, usar quantidadeTotal, senão usar quantidade
                          const estoqueAtual = !item.isCustom && itemData 
                            ? (itemData.isExpanded && itemData.quantidadeTotal 
                                ? itemData.quantidadeTotal 
                                : (itemData.quantidade || 0))
                            : 0;
                          
                          const quantidadeEditada = itemState.quantidade;
                          const estoqueInsuficiente =
                            !item.isCustom && itemData && quantidadeEditada > estoqueAtual;
                          const isEditable = order.status === "aprovado";

                          return (
                            <div
                              key={index}
                              className={`p-3 lg:p-4 rounded-lg border-2 ${
                                estoqueInsuficiente
                                  ? "bg-red-50 border-red-200"
                                  : itemState.selected && isEditable
                                  ? "bg-blue-50 border-blue-200"
                                  : "bg-gray-50 border-gray-200"
                              }`}
                            >
                              {isEditable && (
                                <div className="flex items-center gap-3 mb-3">
                                  <input
                                    type="checkbox"
                                    checked={itemState.selected}
                                    onChange={() => handleToggleItemForFinalize(order.id, index)}
                                    disabled={item.isCustom} // Produtos não cadastrados não podem ser baixados
                                    className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <label className="text-sm font-semibold text-gray-700 cursor-pointer flex-1">
                                    {item.isCustom
                                      ? "Produto não cadastrado (não será baixado do estoque)"
                                      : "Marcar para baixar do estoque"}
                                  </label>
                                </div>
                              )}
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                <div className="flex-1">
                                  <p className="font-semibold text-sm lg:text-base text-gray-800">
                                    {item.nome || item.nomeProduto}
                                    {item.isCustom && (
                                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                        Não cadastrado
                                      </span>
                                    )}
                                  </p>
                                  <div className="text-xs lg:text-sm text-gray-600 mt-1 space-y-1">
                                    <div>
                                      <span className="font-semibold">Quantidade solicitada:</span>{" "}
                                      {item.quantidade} {item.unidade || "UN"}
                                    </div>
                                    {!item.isCustom && itemData && (
                                      <div>
                                        <span className="font-semibold">Estoque disponível:</span>{" "}
                                        {estoqueAtual} {itemData.unidade || "UN"}
                                        {itemData.isExpanded && itemData.quantidadeTotal && (
                                          <span className="text-xs text-gray-500 ml-1">
                                            (total em múltiplos lotes)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {isEditable && itemState.selected && !item.isCustom && (
                                      <div className="mt-2">
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                                          Quantidade a baixar:
                                        </label>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            min="0"
                                            value={quantidadeEditada}
                                            onChange={(e) =>
                                              handleUpdateQuantityForFinalize(
                                                order.id,
                                                index,
                                                parseInt(e.target.value) || 0
                                              )
                                            }
                                            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                          <span className="text-sm text-gray-600">{item.unidade || "UN"}</span>
                                          {quantidadeEditada > estoqueAtual && (
                                            <span className="text-xs text-red-600 font-semibold">
                                              (Máx: {estoqueAtual})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {estoqueInsuficiente && (
                                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {order.status === "pendente" && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Observação (opcional)
                            </label>
                            <textarea
                              value={observacaoAdmin}
                              onChange={(e) => setObservacaoAdmin(e.target.value)}
                              rows="2"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Adicione uma observação sobre a aprovação ou rejeição"
                            />
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleApprove(order.id)}
                              disabled={loading}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <Check className="w-5 h-5" />
                              Aprovar Pedido
                            </button>
                            <button
                              onClick={() => handleReject(order.id)}
                              disabled={loading}
                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <X className="w-5 h-5" />
                              Rejeitar Pedido
                            </button>
                          </div>
                        </div>
                      )}

                      {order.status === "aprovado" && (
                        <div>
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs lg:text-sm text-gray-700 mb-2">
                              <strong>Instruções:</strong>
                            </p>
                            <ul className="text-xs lg:text-sm text-gray-600 space-y-1 list-disc list-inside">
                              <li>Marque os itens que deseja baixar do estoque</li>
                              <li>Edite as quantidades se necessário (ex: cliente pediu 10, mas só tem 9)</li>
                              <li>Produtos não cadastrados não podem ser baixados do estoque</li>
                            </ul>
                          </div>
                          <button
                            onClick={() => handleFinalize(order.id)}
                            disabled={loading}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Package className="w-4 h-4 lg:w-5 lg:h-5" />
                            <span className="text-sm lg:text-base">
                              {loading ? "Processando..." : "Baixar Itens Selecionados do Estoque"}
                            </span>
                          </button>
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Apenas os itens marcados serão baixados do estoque
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersManagement;


