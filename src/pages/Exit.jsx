import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useItems } from "../context/ItemsContext";
import { addExit } from "../services/exits";
import { getItemByCodigo } from "../services/items";
import { validateExit } from "../utils/validators";
import { ArrowUpCircle, Save, X, AlertTriangle, Search } from "lucide-react";
import { ESTOQUE_BAIXO_LIMITE } from "../config/constants";

const Exit = () => {
  const { currentUser } = useAuth();
  const { items } = useItems();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [itemFound, setItemFound] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const validation = validateExit({
      codigo: formData.codigo,
      itemId: formData.itemId,
      quantidade: parseFloat(formData.quantidade),
      setorDestino: formData.setorDestino,
    });

    if (!validation.isValid) {
      setError(validation.errors.join(", "));
      setLoading(false);
      return;
    }

    if (
      !itemFound &&
      (!formData.itemId || formData.itemId.trim().length === 0)
    ) {
      setError("Selecione um item pelo código ou pela busca.");
      setLoading(false);
      return;
    }

    // Verificar estoque suficiente
    const quantidadeSolicitada = parseFloat(formData.quantidade);
    const estoqueAtual = itemFound.quantidade || 0;

    if (quantidadeSolicitada > estoqueAtual) {
      setError(
        `Estoque insuficiente! Disponível: ${estoqueAtual}, Solicitado: ${quantidadeSolicitada}`
      );
      setLoading(false);
      return;
    }

    try {
      await addExit(
        {
          codigo: formData.codigo,
          itemId: formData.itemId || (itemFound ? itemFound.id : ""),
          quantidade: quantidadeSolicitada,
          setorDestino: formData.setorDestino,
          retiradoPor: formData.retiradoPor,
          observacao: formData.observacao,
        },
        currentUser.uid
      );

      setSuccess("Saída registrada com sucesso!");

      // Limpar formulário
      setTimeout(() => {
        setFormData({
          codigo: "",
          itemId: "",
          quantidade: "",
          setorDestino: "",
          retiradoPor: "",
          observacao: "",
        });
        setItemFound(null);
        setSuccess("");
      }, 2000);
    } catch (error) {
      setError("Erro ao registrar saída: " + error.message);
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

  // ✅ Agora o hook useMemo está no lugar CORRETO
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return [];

    return items
      .filter(
        (it) =>
          (it.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (it.codigo || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 8);
  }, [items, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
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
                  {/* AGORA USANDO filteredItems SEM HOOK NO JSX */}
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
                  Máximo disponível: {itemFound.quantidade || 0}{" "}
                  {itemFound.unidade || "UN"}
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
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Save className="w-5 h-5" />
                <span>{loading ? "Registrando..." : "Registrar Saída"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Exit;
