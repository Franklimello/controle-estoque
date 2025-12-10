import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getItemById, updateItem } from "../services/items";
import { validateItem } from "../utils/validators";
import { Save, X, Package } from "lucide-react";

const EditItem = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
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
      await updateItem(id, {
        nome: formData.nome,
        categoria: formData.categoria,
        unidade: formData.unidade,
        local: formData.local,
        fornecedor: formData.fornecedor,
        validade: formData.validade || null
        // Não atualizar quantidade aqui - use Entradas/Saídas
      });
      
      navigate("/items");
    } catch (error) {
      setError("Erro ao atualizar item: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <Package className="w-6 h-6 mr-2" />
              Editar Item
            </h1>
            <button
              onClick={() => navigate("/items")}
              className="text-gray-600 hover:text-gray-800"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
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
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50 transition"
              >
                <Save className="w-5 h-5" />
                <span>{loading ? "Salvando..." : "Salvar"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditItem;


