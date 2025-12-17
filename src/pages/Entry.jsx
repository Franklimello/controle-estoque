import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import { addEntry } from "../services/entries";
import { getItemByCodigo } from "../services/items";
import { validateEntry } from "../utils/validators";
import { ArrowDownCircle, Save, X, Package } from "lucide-react";
import Modal from "../components/Modal";

const Entry = () => {
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [itemFound, setItemFound] = useState(null);
  const [formData, setFormData] = useState({
    codigo: "",
    quantidade: "",
    fornecedor: "",
    observacao: "",
    nome: "",
    categoria: "",
    unidade: "UN",
    local: "",
    validade: "",
  });

  const handleCodigoChange = async (e) => {
    const codigo = e.target.value;
    setFormData((prev) => ({ ...prev, codigo }));
    setItemFound(null);
    setError("");

    if (codigo.trim().length > 0) {
      // Aguardar um pouco antes de buscar (debounce)
      setTimeout(async () => {
        const item = await getItemByCodigo(codigo);
        if (item) {
          setItemFound(item);
          setFormData((prev) => ({
            ...prev,
            nome: item.nome || "",
            categoria: item.categoria || "",
            unidade: item.unidade || "UN",
            local: item.local || "",
            validade: item.validade || "",
          }));
        } else {
          setItemFound(null);
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

  const processEntry = async () => {
    const validation = validateEntry({
      codigo: formData.codigo,
      nome: formData.nome,
      quantidade: parseFloat(formData.quantidade),
    });

    if (!validation.isValid) {
      setError(validation.errors.join(", "));
      return false;
    }

    // Se não há código, nome é obrigatório
    if (
      (!formData.codigo || formData.codigo.trim().length === 0) &&
      (!formData.nome || formData.nome.trim().length === 0)
    ) {
      setError("Nome do item é obrigatório quando não há código de barras");
      return false;
    }

    try {
      await addEntry(
        {
          codigo: formData.codigo,
          quantidade: parseFloat(formData.quantidade),
          fornecedor: formData.fornecedor,
          observacao: formData.observacao,
          nome: formData.nome,
          categoria: formData.categoria,
          unidade: formData.unidade,
          local: formData.local,
          validade: formData.validade || null,
        },
        currentUser.uid
      );

      success("Entrada registrada com sucesso!");

      // Limpar formulário
      setTimeout(() => {
        setFormData({
          codigo: "",
          quantidade: "",
          fornecedor: "",
          observacao: "",
          nome: "",
          categoria: "",
          unidade: "UN",
          local: "",
          validade: "",
        });
        setItemFound(null);
      }, 1000);
      return true;
    } catch (error) {
      showError("Erro ao registrar entrada: " + error.message);
      return false;
    }
  };

  const handleConfirmCreate = async () => {
    setShowCreateModal(false);
    setLoading(true);
    setError("");
    await processEntry();
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const validation = validateEntry({
      codigo: formData.codigo,
      nome: formData.nome,
      quantidade: parseFloat(formData.quantidade),
    });

    if (!validation.isValid) {
      setError(validation.errors.join(", "));
      setLoading(false);
      return;
    }

    // Se item não existe e há código, mostrar modal para criar
    if (!itemFound && formData.codigo && formData.codigo.trim().length > 0) {
      setShowCreateModal(true);
      setLoading(false);
      return;
    }

    await processEntry();
    setLoading(false);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Acesso restrito</h1>
            <p className="text-gray-600">
              Apenas o administrador pode registrar entradas.
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
              <ArrowDownCircle className="w-6 h-6 mr-2 text-green-600" />
              Registrar Entrada
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Item encontrado:</strong> {itemFound.nome} - Estoque
                atual: {itemFound.quantidade || 0} {itemFound.unidade || "UN"}
              </p>
            </div>
          )}

          {!itemFound &&
            formData.codigo &&
            formData.codigo.trim().length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Atenção:</strong> Item não encontrado. Você pode criar
                  um novo item preenchendo os dados abaixo.
                </p>
              </div>
            )}

          {(!formData.codigo || formData.codigo.trim().length === 0) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Informação:</strong> Código de barras não informado.
                Preencha o nome do item para criar ou identificar.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-3 lg:space-y-4">
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Digite ou escaneie o código (opcional)"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deixe em branco se o item não tiver código de barras
                </p>
              </div>

              {(!itemFound ||
                !formData.codigo ||
                formData.codigo.trim().length === 0) && (
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Nome do Item{" "}
                    {(!formData.codigo ||
                      formData.codigo.trim().length === 0) &&
                      "*"}
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Nome do item"
                  />
                  {(!formData.codigo ||
                    formData.codigo.trim().length === 0) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Obrigatório quando não há código de barras
                    </p>
                  )}
                </div>
              )}
            </div>

            {(!itemFound ||
              !formData.codigo ||
              formData.codigo.trim().length === 0) && (
              <div className="lg:grid lg:grid-cols-3 lg:gap-6">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Categoria
                  </label>
                  <input
                    type="text"
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Unidade
                  </label>
                  <select
                    name="unidade"
                    value={formData.unidade}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="UN">UN</option>
                    <option value="KG">KG</option>
                    <option value="LT">LT</option>
                    <option value="MT">MT</option>
                    <option value="CX">CX</option>
                    <option value="PC">PC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Local
                  </label>
                  <input
                    type="text"
                    name="local"
                    value={formData.local}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            )}

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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Validade
                </label>
                <input
                  type="date"
                  name="validade"
                  value={formData.validade}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Data de validade do lote (opcional)
                </p>
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Fornecedor
                </label>
                <input
                  type="text"
                  name="fornecedor"
                  value={formData.fornecedor}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

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
                disabled={loading}
                className="action-button px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 disabled:opacity-50 transition relative overflow-hidden"
              >
                <div className="action-button-ring">
                  <i></i>
                </div>
                <Save className="w-5 h-5 relative z-10" />
                <span className="relative z-10">{loading ? "Registrando..." : "Registrar Entrada"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Confirmação de Criação */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Criar Novo Item"
        confirmText="Criar e Registrar Entrada"
        cancelText="Cancelar"
        onConfirm={handleConfirmCreate}
        confirmVariant="success"
        showConfirm={true}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-blue-600">
            <Package className="w-8 h-8" />
            <p className="text-lg font-semibold">Item não encontrado</p>
          </div>
          <p className="text-gray-700">
            O código de barras <strong>"{formData.codigo}"</strong> não foi encontrado no sistema.
          </p>
          <p className="text-gray-700">
            Deseja criar um novo item com este código e registrar a entrada?
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ Informação:</strong> Um novo item será criado automaticamente com os dados informados.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Entry;
