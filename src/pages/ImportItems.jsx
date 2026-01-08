import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import { useItems } from "../context/ItemsContext";
import { addItem, getItemByCodigo } from "../services/items";
import { addOrIncrementBatch, getEarliestBatchValidity } from "../services/batches";
import { updateItem } from "../services/items";
import { fixMissingBatches } from "../utils/fixMissingBatches";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, RefreshCw } from "lucide-react";
import { getErrorMessage } from "../utils/errorHandler";

const ImportItems = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const { success, error: showError } = useToastContext();
  const { refreshItems } = useItems();
  const [loading, setLoading] = useState(false);
  const [fixingBatches, setFixingBatches] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [results, setResults] = useState(null);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Acesso restrito</h1>
            <p className="text-gray-600">Apenas administradores podem importar itens.</p>
          </div>
        </div>
      </div>
    );
  }

  const parseCSV = (text) => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length === 0) return [];

    // Detectar delimitador (vírgula ou ponto e vírgula)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(";") ? ";" : ",";

    // Processar header
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
    
    // Mapear colunas possíveis
    const nomeIndex = headers.findIndex(h => h.includes("produto") || h.includes("nome") || h === "produtos");
    const codigoIndex = headers.findIndex(h => h.includes("código") || h.includes("codigo") || h.includes("clas"));
    const validadeIndex = headers.findIndex(h => h.includes("vencimento") || h.includes("validade"));
    const quantidadeIndex = headers.findIndex(h => h.includes("estoque") || h.includes("quantidade") || h === "estoque");
    const categoriaIndex = headers.findIndex(h => h.includes("categoria") || h.includes("categ"));
    const unidadeIndex = headers.findIndex(h => h.includes("unidade") || h === "un");

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim());
      
      const produtos = nomeIndex >= 0 ? values[nomeIndex] : "";
      const codigo = codigoIndex >= 0 ? values[codigoIndex] : "";
      const validade = validadeIndex >= 0 ? values[validadeIndex] : "";
      const estoque = quantidadeIndex >= 0 ? values[quantidadeIndex] : "0";
      const categoria = categoriaIndex >= 0 ? values[categoriaIndex] : "";
      const unidade = unidadeIndex >= 0 ? values[unidadeIndex] : "UN";

      if (!produtos || produtos.trim().length === 0) continue;

      // Converter quantidade
      const quantidade = parseFloat(estoque.toString().replace(",", ".")) || 0;

      // Normalizar validade (formato esperado: DD/MM/YYYY ou YYYY-MM-DD)
      let validadeNormalizada = null;
      if (validade && validade.trim().length > 0) {
        const validadeTrim = validade.trim();
        // Tentar converter DD/MM/YYYY para YYYY-MM-DD
        if (validadeTrim.includes("/")) {
          const parts = validadeTrim.split("/");
          if (parts.length === 3) {
            const day = parts[0].padStart(2, "0");
            const month = parts[1].padStart(2, "0");
            const year = parts[2];
            validadeNormalizada = `${year}-${month}-${day}`;
          }
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(validadeTrim)) {
          validadeNormalizada = validadeTrim;
        }
      }

      items.push({
        nome: produtos ? produtos.toUpperCase().trim() : produtos,
        codigo: codigo || "",
        categoria: categoria || "",
        unidade: unidade || "UN",
        validade: validadeNormalizada,
        quantidade: quantidade
      });
    }

    return items;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv") && !selectedFile.name.endsWith(".xlsx")) {
      showError("Por favor, selecione um arquivo CSV ou XLSX");
      return;
    }

    setFile(selectedFile);
    setPreview([]);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (selectedFile.name.endsWith(".csv")) {
          const text = event.target.result;
          const items = parseCSV(text);
          setPreview(items.slice(0, 10)); // Mostrar apenas os 10 primeiros
        } else {
          showError("Arquivos XLSX precisam ser convertidos para CSV primeiro");
        }
      } catch (error) {
        showError("Erro ao ler arquivo: " + error.message);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!file) {
      showError("Selecione um arquivo primeiro");
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target.result;
          const items = parseCSV(text);

          if (items.length === 0) {
            showError("Nenhum item encontrado no arquivo");
            setLoading(false);
            return;
          }

          let successCount = 0;
          let errorCount = 0;
          const errors = [];

          // Cadastrar cada item
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
              // Verificar se já existe pelo código
              let existingItem = null;
              if (item.codigo && item.codigo.trim().length > 0) {
                existingItem = await getItemByCodigo(item.codigo);
              }

              let itemId;
              if (existingItem) {
                itemId = existingItem.id;
                // Atualizar item existente se necessário
                await updateItem(itemId, {
                  nome: item.nome,
                  categoria: item.categoria || existingItem.categoria || "",
                  unidade: item.unidade || existingItem.unidade || "UN"
                }, currentUser?.uid);
              } else {
                // Criar o item primeiro
                itemId = await addItem({
                  nome: item.nome,
                  codigo: item.codigo || "",
                  categoria: item.categoria || "",
                  unidade: item.unidade || "UN",
                  local: "",
                  fornecedor: "",
                  quantidade: 0
                }, currentUser?.uid);
              }

              // Se houver quantidade > 0, criar lote
              if (item.quantidade > 0) {
                // Criar ou incrementar lote
                await addOrIncrementBatch(itemId, item.validade, item.quantidade);

                // Atualizar validade do item principal com a validade mais próxima dos lotes
                const earliestValidity = await getEarliestBatchValidity(itemId);
                if (earliestValidity) {
                  await updateItem(itemId, { validade: earliestValidity }, currentUser?.uid);
                }
              }

              successCount++;
            } catch (error) {
              errorCount++;
              errors.push({
                item: item.nome,
                error: error.message || "Erro desconhecido"
              });
            }
          }

          setResults({
            total: items.length,
            success: successCount,
            errors: errorCount,
            errorList: errors
          });

          if (successCount > 0) {
            success(`Importação concluída! ${successCount} item(s) importado(s) com sucesso.`);
            refreshItems();
          }

          if (errorCount > 0) {
            showError(`${errorCount} item(s) falharam na importação. Verifique os detalhes.`);
          }
        } catch (error) {
          showError(getErrorMessage(error) || "Erro ao processar arquivo");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      showError(getErrorMessage(error) || "Erro ao ler arquivo");
      setLoading(false);
    }
  };

  const handleFixBatches = async () => {
    if (!confirm("Deseja corrigir lotes faltantes para todos os itens? Esta operação pode demorar.")) {
      return;
    }

    setFixingBatches(true);
    try {
      const result = await fixMissingBatches(currentUser?.uid);
      if (result.success) {
        success(`Correção concluída! ${result.fixed} item(s) corrigido(s).`);
        refreshItems();
      } else {
        showError(result.error || "Erro ao corrigir lotes");
      }
    } catch (error) {
      showError(getErrorMessage(error) || "Erro ao corrigir lotes");
    } finally {
      setFixingBatches(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              Importar Itens
            </h1>
            <button
              onClick={() => navigate("/items")}
              className="text-gray-600 hover:text-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Formato do arquivo CSV:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Colunas esperadas: Produto/Nome, Código (opcional), Vencimento (opcional), Estoque/Quantidade</li>
              <li>Delimitador: vírgula (,) ou ponto e vírgula (;)</li>
              <li>Formato de data: DD/MM/YYYY ou YYYY-MM-DD</li>
              <li>Nomes serão padronizados para maiúsculas automaticamente</li>
            </ul>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Selecionar arquivo CSV
            </label>
            <div className="flex items-center gap-4">
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600">
                    {file ? file.name : "Clique para selecionar arquivo CSV"}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {preview.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">Preview (primeiros 10 itens):</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Nome</th>
                      <th className="px-3 py-2 text-left">Código</th>
                      <th className="px-3 py-2 text-left">Validade</th>
                      <th className="px-3 py-2 text-left">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-3 py-2">{item.nome}</td>
                        <td className="px-3 py-2">{item.codigo || "-"}</td>
                        <td className="px-3 py-2">{item.validade || "-"}</td>
                        <td className="px-3 py-2">{item.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 mb-6">
            <button
              onClick={handleImport}
              disabled={loading || !file}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Importar Itens
                </>
              )}
            </button>
            <button
              onClick={handleFixBatches}
              disabled={fixingBatches}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {fixingBatches ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Corrigir Lotes Faltantes
                </>
              )}
            </button>
          </div>

          {results && (
            <div className={`p-4 rounded-lg ${results.errors > 0 ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                {results.errors > 0 ? (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
                <h3 className="font-semibold">
                  {results.errors > 0 ? "Importação concluída com erros" : "Importação concluída com sucesso"}
                </h3>
              </div>
              <p className="text-sm text-gray-700">
                Total: {results.total} | Sucesso: {results.success} | Erros: {results.errors}
              </p>
              {results.errorList.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Erros:</p>
                  {results.errorList.map((err, index) => (
                    <p key={index} className="text-xs text-red-600">
                      {err.item}: {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportItems;

