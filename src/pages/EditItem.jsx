import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getItemById, updateItem, deleteItem } from "../services/items";
import { validateItem } from "../utils/validators";
import { Save, X, Package, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import Modal from "../components/Modal";

const EditItem = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, currentUser } = useAuth();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    codigo: "",
    categoria: "",
    unidade: "UN",
    local: "",
    fornecedor: "",
    validade: "",
    quantidade: 0
  });

  useEffect(() => {
    const loadItem = async () => {
      try {
        const item = await getItemById(id);
        if (item) {
          setFormData({
            nome: item.nome || "",
            codigo: item.codigo || "",
            categoria: item.categoria || "",
            unidade: item.unidade || "UN",
            local: item.local || "",
            fornecedor: item.fornecedor || "",
            validade: item.validade || "",
            quantidade: item.quantidade || 0
          });
        } else {
          setError("Item não encontrado");
        }
      } catch (error) {
        setError("Erro ao carregar item: " + error.message);
      } finally {
        setLoadingData(false);
      }
    };

    if (id) {
      loadItem();
    }
  }, [id]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Acesso restrito</h1>
            <p className="text-gray-600">
              Apenas o administrador pode editar itens.
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "quantidade" ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const validation = validateItem(formData);
    if (!validation.isValid) {
      setError(validation.errors.join(", "));
      setLoading(false);
      return;
    }

    try {
      await updateItem(
        id,
        {
          nome: formData.nome,
          categoria: formData.categoria,
          unidade: formData.unidade,
          local: formData.local,
          fornecedor: formData.fornecedor,
          validade: formData.validade || null,
          // Não atualizar quantidade aqui - use Entradas/Saídas
        },
        currentUser?.uid
      );
      
      success("Item atualizado com sucesso!");
      setTimeout(() => {
        navigate("/items");
      }, 1000);
    } catch (error) {
      showError("Erro ao atualizar item: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await deleteItem(id, currentUser?.uid);
      success("Item excluído com sucesso!");
      setTimeout(() => {
        navigate("/items");
      }, 1000);
    } catch (error) {
      showError("Erro ao excluir item: " + error.message);
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-ring">
            <i></i>
            <i></i>
          </div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-0 md:p-6">
      <div className="max-w-full md:max-w-2xl mx-auto px-4 md:px-0">
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <div className="flex items-center justify-between mb-6 pt-4 md:pt-0 gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center flex-1 min-w-0">
              <Package className="w-5 h-5 md:w-6 md:h-6 mr-2 flex-shrink-0" />
              <span className="truncate">Editar Item</span>
            </h1>
            <button
              onClick={() => navigate("/items")}
              className="text-gray-600 hover:text-gray-800 flex-shrink-0"
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Nome do Item *
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Código de Barras
                </label>
                <input
                  type="text"
                  name="codigo"
                  value={formData.codigo}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  O código de barras não pode ser alterado
                </p>
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Categoria
                </label>
                <input
                  type="text"
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Local
                </label>
                <input
                  type="text"
                  name="local"
                  value={formData.local}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Quantidade Atual
                </label>
                <input
                  type="number"
                  name="quantidade"
                  value={formData.quantidade}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use Entradas/Saídas para alterar a quantidade
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-end gap-3 md:space-x-4 pt-4">
              <button
                type="button"
                onClick={() => navigate("/items")}
                className="w-full md:w-auto px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                disabled={loading}
                className="action-button w-full md:w-auto px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center space-x-2 disabled:opacity-50 transition relative overflow-hidden"
              >
                <div className="action-button-ring">
                  <i></i>
                </div>
                <Trash2 className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Excluir</span>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="action-button w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2 disabled:opacity-50 transition relative overflow-hidden"
              >
                <div className="action-button-ring">
                  <i></i>
                </div>
                <Save className="w-5 h-5 relative z-10" />
                <span className="relative z-10">{loading ? "Salvando..." : "Salvar"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirmar Exclusão"
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={handleDelete}
        confirmVariant="danger"
        showConfirm={true}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600">
            <Trash2 className="w-8 h-8" />
            <p className="text-lg font-semibold">Atenção!</p>
          </div>
          <p className="text-gray-700">
            Tem certeza que deseja excluir o item{" "}
            <strong>"{formData.nome || "sem nome"}"</strong>
            {formData.codigo ? ` (código: ${formData.codigo})` : ""}?
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              <strong>⚠️ Esta ação não pode ser desfeita.</strong> Todos os dados
              relacionados a este item serão permanentemente removidos.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EditItem;


