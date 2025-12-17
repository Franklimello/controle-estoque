import { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useItems } from "../context/ItemsContext";
import { useToastContext } from "../context/ToastContext";
import { addExit } from "../services/exits";
import { getItemByCodigo } from "../services/items";
import { validateExit } from "../utils/validators";
import { Save, AlertTriangle, Search } from "lucide-react";
import { ESTOQUE_BAIXO_LIMITE } from "../config/constants";
import { fuzzySearch, sortByRelevance } from "../utils/fuzzySearch";
import Modal from "./Modal";

const ExitModal = ({ isOpen, onClose, onSuccess }) => {
  const { currentUser } = useAuth();
  const { items } = useItems();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  const resetForm = () => {
    setFormData({
      codigo: "",
      itemId: "",
      quantidade: "",
      setorDestino: "",
      retiradoPor: "",
      observacao: "",
    });
    setItemFound(null);
    setError("");
    setSearchTerm("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
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

    if (!itemFound && (!formData.itemId || formData.itemId.trim().length === 0)) {
      setError("Selecione um item pelo código ou pela busca.");
      setLoading(false);
      return;
    }

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

      success("Saída registrada com sucesso!");
      resetForm();
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      showError("Erro ao registrar saída: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isLowStock = itemFound && (itemFound.quantidade || 0) <= ESTOQUE_BAIXO_LIMITE;
  const estoqueAposSaida =
    itemFound && formData.quantidade
      ? (itemFound.quantidade || 0) - parseFloat(formData.quantidade)
      : null;
  const alertaEstoqueBaixo =
    estoqueAposSaida !== null && estoqueAposSaida <= ESTOQUE_BAIXO_LIMITE;

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const filtered = items
      .filter((it) => fuzzySearch(it, searchTerm, ['nome', 'codigo'], 0.5))
      .slice(0, 8);
    return sortByRelevance(filtered, searchTerm, ['nome', 'codigo']);
  }, [items, searchTerm]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Registrar Saída"
      showConfirm={false}
      showCancel={false}
      size="lg"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {error && (
          <div className="alert-ring bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <i></i>
            <span className="relative z-10">{error}</span>
          </div>
        )}

        {itemFound && (
          <div
            className={`rounded-lg p-4 ${
              isLowStock
                ? "bg-red-50 border border-red-200"
                : "bg-blue-50 border border-blue-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-semibold ${isLowStock ? "text-red-800" : "text-blue-800"}`}>
                  <strong>Item:</strong> {itemFound.nome}
                </p>
                <p className={`text-sm mt-1 ${isLowStock ? "text-red-700" : "text-blue-700"}`}>
                  Estoque atual: <strong>{itemFound.quantidade || 0} {itemFound.unidade || "UN"}</strong>
                </p>
                {estoqueAposSaida !== null && (
                  <p
                    className={`text-sm mt-1 ${
                      alertaEstoqueBaixo ? "text-red-700 font-bold" : "text-gray-700"
                    }`}
                  >
                    Estoque após saída: <strong>{estoqueAposSaida} {itemFound.unidade || "UN"}</strong>
                  </p>
                )}
              </div>
              {isLowStock && <AlertTriangle className="w-8 h-8 text-red-600" />}
            </div>
          </div>
        )}

        {alertaEstoqueBaixo && (
          <div className="bg-yellow-50 border border-yellow-400 text-yellow-800 px-4 py-3 rounded flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span>Atenção: O estoque ficará abaixo do mínimo após esta saída!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Código de Barras</label>
            <input
              type="text"
              name="codigo"
              value={formData.codigo}
              onChange={handleCodigoChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Digite ou escaneie o código (opcional)"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Buscar Item (nome ou código)</label>
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
                      setSearchTerm("");
                      setError("");
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-red-50 focus:outline-none"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-800">{it.nome}</p>
                        <p className="text-xs text-gray-500">Código: {it.codigo || "Sem código"}</p>
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
            <label className="block text-gray-700 text-sm font-bold mb-2">Quantidade *</label>
            <input
              type="number"
              name="quantidade"
              value={formData.quantidade}
              onChange={handleChange}
              step="0.01"
              min="0.01"
              max={itemFound ? itemFound.quantidade : undefined}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
            {itemFound && (
              <p className="text-xs text-gray-500 mt-1">
                Máximo disponível: {itemFound.quantidade || 0} {itemFound.unidade || "UN"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Setor Destino *</label>
            <input
              type="text"
              name="setorDestino"
              value={formData.setorDestino}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Ex: Administração, Manutenção, etc."
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Retirado Por</label>
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
            <label className="block text-gray-700 text-sm font-bold mb-2">Observação</label>
            <textarea
              name="observacao"
              value={formData.observacao}
              onChange={handleChange}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Observações adicionais"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !itemFound}
              className="action-button px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition relative overflow-hidden"
            >
              <div className="action-button-ring">
                <i></i>
              </div>
              <Save className="w-5 h-5 relative z-10" />
              <span className="relative z-10">{loading ? "Registrando..." : "Registrar Saída"}</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ExitModal;

