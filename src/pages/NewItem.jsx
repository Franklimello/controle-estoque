import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { addItem, getItemByCodigo } from "../services/items";
import { validateItem } from "../utils/validators";
import { Save, X, Package } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import { getErrorMessage } from "../utils/errorHandler";
import { PERMISSIONS, CATEGORIAS_ALMOXARIFADO } from "../config/constants";

const NewItem = () => {
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAuth();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const codigoTimeoutRef = useRef(null);
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
    return () => {
      if (codigoTimeoutRef.current) {
        clearTimeout(codigoTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "quantidade" ? parseFloat(value) || 0 : value
    }));
  };

  const handleCodigoChange = async (e) => {
    const codigo = e.target.value;
    setFormData((prev) => ({ ...prev, codigo }));

    // Limpar timeout anterior
    if (codigoTimeoutRef.current) {
      clearTimeout(codigoTimeoutRef.current);
    }

    // Verificar duplicidade quando o usuário parar de digitar
    if (codigo.trim().length > 0) {
      codigoTimeoutRef.current = setTimeout(async () => {
        const existingItem = await getItemByCodigo(codigo);
        if (existingItem) {
          setError("Já existe um item com este código de barras!");
        } else {
          setError("");
        }
      }, 500);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validação
    const validation = validateItem(formData);
    if (!validation.isValid) {
      setError(validation.errors.join(", "));
      setLoading(false);
      return;
    }

    // Verificar duplicidade final apenas se houver código
    if (formData.codigo && formData.codigo.trim().length > 0) {
      const existingItem = await getItemByCodigo(formData.codigo);
      if (existingItem) {
        setError("Já existe um item com este código de barras!");
        setLoading(false);
        return;
      }
    }

    try {
      // Salvar com a quantidade informada pelo usuário
      await addItem(
        {
          ...formData,
          quantidade: parseFloat(formData.quantidade) || 0,
        },
        currentUser?.uid
      );
      
      success("Item cadastrado com sucesso!");
      setTimeout(() => {
        navigate("/items");
      }, 1000);
    } catch (error) {
      showError("Erro ao cadastrar item: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission(PERMISSIONS.CREATE_ITEMS)) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Acesso restrito</h1>
            <p className="text-gray-600">
              Você não tem permissão para cadastrar novos itens.
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <Package className="w-6 h-6 mr-2" />
              Novo Item
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
                  onChange={handleCodigoChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Digite ou escaneie o código (opcional)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Você pode digitar ou escanear o código de barras (opcional)
                </p>
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Categoria
                </label>
                <select
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  Quantidade Inicial
                </label>
                <input
                  type="number"
                  name="quantidade"
                  value={formData.quantidade}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Quantidade inicial do estoque (pode ser 0)
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
                className="action-button px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50 transition relative overflow-hidden"
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
    </div>
  );
};

export default NewItem;

