import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import { addEntry } from "../services/entries";
import { getItemByCodigo } from "../services/items";
import { validateEntry } from "../utils/validators";
import { CATEGORIAS_ALMOXARIFADO } from "../config/constants";
import { ArrowDownCircle, Save, Package } from "lucide-react";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";

const EntryModal = ({ isOpen, onClose, onSuccess }) => {
  const { currentUser } = useAuth();
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExpiredDateModal, setShowExpiredDateModal] = useState(false);
  const [pendingEntry, setPendingEntry] = useState(null);
  const [itemFound, setItemFound] = useState(null);
  const codigoTimeoutRef = useRef(null);
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
    semValidade: false,
  });

  useEffect(() => {
    return () => {
      if (codigoTimeoutRef.current) {
        clearTimeout(codigoTimeoutRef.current);
      }
    };
  }, []);

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
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
      // Se marcar "sem validade", limpar o campo de validade
      ...(name === "semValidade" && checked ? { validade: "" } : {}),
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

    if (
      (!formData.codigo || formData.codigo.trim().length === 0) &&
      (!formData.nome || formData.nome.trim().length === 0)
    ) {
      setError("Nome do item é obrigatório quando não há código de barras");
      return false;
    }

    // ✅ VALIDAÇÃO DE DATA DE VALIDADE: Alertar se a validade está vencida (apenas se não for "sem validade")
    if (!formData.semValidade && formData.validade && formData.validade.trim().length > 0) {
      const validadeDate = new Date(formData.validade + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      validadeDate.setHours(0, 0, 0, 0);
      
      if (validadeDate < today) {
        // Armazenar dados da entrada para processar após confirmação
        setPendingEntry({
          codigo: formData.codigo,
          quantidade: parseFloat(formData.quantidade),
          fornecedor: formData.fornecedor,
          observacao: formData.observacao,
          nome: formData.nome,
          categoria: formData.categoria,
          unidade: formData.unidade,
          local: formData.local,
          validade: formData.semValidade ? null : (formData.validade || null),
        });
        setShowExpiredDateModal(true);
        setLoading(false);
        return false;
      }
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
          validade: formData.semValidade ? null : (formData.validade || null),
        },
        currentUser.uid
      );

      success("Entrada registrada com sucesso!");
      resetForm();
      if (onSuccess) onSuccess();
      return true;
    } catch (error) {
      showError("Erro ao registrar entrada: " + error.message);
      return false;
    }
  };

  const resetForm = () => {
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
      semValidade: false,
    });
    setItemFound(null);
    setError("");
  };

  const handleConfirmCreate = async () => {
    setShowCreateModal(false);
    setLoading(true);
    setError("");
    const result = await processEntry();
    setLoading(false);
    if (result) {
      onClose();
    }
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

    if (!itemFound && formData.codigo && formData.codigo.trim().length > 0) {
      setShowCreateModal(true);
      setLoading(false);
      return;
    }

    const result = await processEntry();
    setLoading(false);
    if (result) {
      onClose();
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Registrar Entrada"
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Item encontrado:</strong> {itemFound.nome} - Estoque atual:{" "}
                {itemFound.quantidade || 0} {itemFound.unidade || "UN"}
              </p>
            </div>
          )}

          {!itemFound && formData.codigo && formData.codigo.trim().length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Atenção:</strong> Item não encontrado. Você pode criar um novo item preenchendo os dados abaixo.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
            </div>

            {(!itemFound || !formData.codigo || formData.codigo.trim().length === 0) && (
              <>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Nome do Item {(!formData.codigo || formData.codigo.trim().length === 0) && "*"}
                  </label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Nome do item"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">Categoria</label>
                    <select
                      name="categoria"
                      value={formData.categoria}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    <label className="block text-gray-700 text-sm font-bold mb-2">Unidade</label>
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
                  <label className="block text-gray-700 text-sm font-bold mb-2">Local</label>
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
              <label className="block text-gray-700 text-sm font-bold mb-2">Quantidade *</label>
              <input
                type="number"
                name="quantidade"
                value={formData.quantidade}
                onChange={handleChange}
                step="0.01"
                min="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">Validade</label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="semValidade"
                    checked={formData.semValidade}
                    onChange={handleChange}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    Sem validade (produtos que não vencem, ex: limpeza)
                  </span>
                </label>
                <input
                  type="date"
                  name="validade"
                  value={formData.validade}
                  onChange={handleChange}
                  disabled={formData.semValidade}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    formData.semValidade ? "bg-gray-100 cursor-not-allowed opacity-60" : ""
                  }`}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formData.semValidade 
                  ? "Produto sem validade - não será criado lote com data de vencimento"
                  : "Data de validade do lote (opcional)"}
              </p>
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">Fornecedor</label>
              <input
                type="text"
                name="fornecedor"
                value={formData.fornecedor}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">Observação</label>
              <textarea
                name="observacao"
                value={formData.observacao}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
      </Modal>

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
        </div>
      </Modal>

      {/* Modal de Confirmação de Data Vencida */}
      {showExpiredDateModal && pendingEntry && (() => {
        const validadeDate = new Date(pendingEntry.validade + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        validadeDate.setHours(0, 0, 0, 0);
        const daysExpired = Math.floor((today - validadeDate) / (1000 * 60 * 60 * 24));
        
        return (
          <ConfirmModal
            isOpen={showExpiredDateModal}
            onClose={() => {
              setShowExpiredDateModal(false);
              setPendingEntry(null);
              setError("Entrada cancelada. Verifique a data de validade.");
            }}
            onConfirm={handleConfirmExpiredDate}
            title="⚠️ Atenção: Data de Validade Vencida"
            message={`A data de validade informada (${pendingEntry.validade}) está vencida há ${daysExpired} dia(s).\n\nDeseja continuar mesmo assim?`}
            confirmText="Continuar"
            cancelText="Cancelar"
            variant="warning"
          />
        );
      })()}
    </>
  );
};

export default EntryModal;

