import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import { useItems } from "../context/ItemsContext";
import { addAdjustment, getAdjustments } from "../services/adjustments";
import { getItemByCodigo, getItemById } from "../services/items";
import { Settings, Save, X, Search, AlertTriangle, Package } from "lucide-react";
import { fuzzySearch, sortByRelevance } from "../utils/fuzzySearch";
import ConfirmModal from "../components/ConfirmModal";

const StockAdjustment = () => {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  const { items, refreshItems } = useItems();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [itemFound, setItemFound] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAdjustment, setPendingAdjustment] = useState(null);
  const codigoTimeoutRef = useRef(null);
  const [formData, setFormData] = useState({
    codigo: "",
    quantidadeAnterior: "",
    quantidadeNova: "",
    motivo: "",
    observacao: "",
  });
  const [recentAdjustments, setRecentAdjustments] = useState([]);

  // Buscar ajustes recentes
  useEffect(() => {
    const loadRecentAdjustments = async () => {
      try {
        const adjustments = await getAdjustments();
        setRecentAdjustments(adjustments.slice(0, 5));
      } catch (error) {
        // Log do erro mas não mostrar para o usuário (não é crítico)
        console.error("Erro ao carregar ajustes recentes:", error);
      }
    };
    loadRecentAdjustments();
  }, []);

  useEffect(() => {
    return () => {
      if (codigoTimeoutRef.current) {
        clearTimeout(codigoTimeoutRef.current);
      }
    };
  }, []);

  // Busca fuzzy de itens
  const filteredItems = items
    .filter((it) => fuzzySearch(it, searchTerm, ['nome', 'codigo'], 0.5))
    .slice(0, 8);

  const handleCodigoChange = async (e) => {
    const codigo = e.target.value;
    setFormData((prev) => ({ ...prev, codigo }));
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
          setFormData((prev) => ({
            ...prev,
            quantidadeAnterior: item.quantidade || 0,
            quantidadeNova: item.quantidade || 0,
          }));
        } else {
          setItemFound(null);
        }
      }, 500);
    }
  };

  const handleItemSelect = (item) => {
    setItemFound(item);
    setFormData((prev) => ({
      ...prev,
      codigo: item.codigo || "",
      quantidadeAnterior: item.quantidade || 0,
      quantidadeNova: item.quantidade || 0,
    }));
    setSearchTerm("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validações
    if (!itemFound) {
      setError("Selecione um item para ajustar");
      return;
    }

    if (!formData.motivo || formData.motivo.trim().length === 0) {
      setError("Motivo do ajuste é obrigatório");
      return;
    }

    const quantidadeAnterior = parseFloat(formData.quantidadeAnterior);
    const quantidadeNova = parseFloat(formData.quantidadeNova);

    if (isNaN(quantidadeAnterior) || isNaN(quantidadeNova)) {
      setError("Quantidades devem ser números válidos");
      return;
    }

    if (quantidadeNova < 0) {
      setError("Quantidade não pode ser negativa");
      return;
    }

    if (quantidadeAnterior === quantidadeNova) {
      setError("A quantidade nova deve ser diferente da anterior");
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
              Ajuste Manual de Estoque
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
                  ⚠️ Ajuste Manual de Estoque
                </p>
                <p className="text-xs text-yellow-700">
                  Use esta funcionalidade para corrigir divergências encontradas em inventários físicos ou para ajustar quantidades manualmente. 
                  Todos os ajustes são registrados no histórico com motivo obrigatório.
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
              {searchTerm && filteredItems.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-lg max-h-60 overflow-y-auto">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemSelect(item)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{item.nome}</p>
                          {item.codigo && (
                            <p className="text-xs text-gray-500">Código: {item.codigo}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-700">
                            {item.quantidade || 0} {item.unidade || "UN"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Código de Barras (alternativa) */}
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Ou escaneie o código de barras
              </label>
              <input
                type="text"
                name="codigo"
                value={formData.codigo}
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
                Motivo do Ajuste *
              </label>
              <select
                name="motivo"
                value={formData.motivo}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Selecione o motivo</option>
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
            <div className="flex justify-end space-x-4 pt-4">
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
                className="action-button px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2 disabled:opacity-50 transition relative overflow-hidden"
              >
                <div className="action-button-ring">
                  <i></i>
                </div>
                <Save className="w-5 h-5 relative z-10" />
                <span className="relative z-10">
                  {loading ? "Registrando..." : "Registrar Ajuste"}
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
          )          }
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

              success("Ajuste de estoque registrado com sucesso!");
              refreshItems();

              // Limpar formulário
              setFormData({
                codigo: "",
                quantidadeAnterior: "",
                quantidadeNova: "",
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
          title="Confirmar Ajuste de Estoque"
          message={`Item: ${pendingAdjustment.itemNome}\n` +
            `Quantidade anterior: ${pendingAdjustment.quantidadeAnterior}\n` +
            `Quantidade nova: ${pendingAdjustment.quantidadeNova}\n` +
            `Diferença: ${pendingAdjustment.diferenca > 0 ? '+' : ''}${pendingAdjustment.diferenca}\n\n` +
            `Motivo: ${pendingAdjustment.motivo}`}
          confirmText="Confirmar"
          cancelText="Cancelar"
          variant="info"
        />
      )}
    </div>
  );
};

export default StockAdjustment;

