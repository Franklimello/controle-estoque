import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { addEntry } from "../services/entries";
import { getItemByCodigo } from "../services/items";
import { validateEntry } from "../utils/validators";
import { ArrowDownCircle, Save, X } from "lucide-react";

const Entry = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
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

    // Se item não existe e há código, perguntar se deseja criar
    if (!itemFound && formData.codigo && formData.codigo.trim().length > 0) {
      const confirmCreate = window.confirm(
        "Item não encontrado. Deseja criar um novo item com este código?"
      );
      if (!confirmCreate) {
        setLoading(false);
        return;
      }
    }

    // Se não há código, nome é obrigatório
    if (
      (!formData.codigo || formData.codigo.trim().length === 0) &&
      (!formData.nome || formData.nome.trim().length === 0)
    ) {
      setError("Nome do item é obrigatório quando não há código de barras");
      setLoading(false);
      return;
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

      setSuccess("Entrada registrada com sucesso!");

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
        setSuccess("");
      }, 2000);
    } catch (error) {
      setError("Erro ao registrar entrada: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
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
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
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

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
              <>
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
                    // validação custom via JS (sem required nativo)
                  />
                  {(!formData.codigo ||
                    formData.codigo.trim().length === 0) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Obrigatório quando não há código de barras
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
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
              </>
            )}

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
                Validade *
              </label>
              <input
                type="date"
                name="validade"
                value={formData.validade}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Data de validade do lote que está entrando
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
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 disabled:opacity-50 transition"
              >
                <Save className="w-5 h-5" />
                <span>{loading ? "Registrando..." : "Registrar Entrada"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Entry;
