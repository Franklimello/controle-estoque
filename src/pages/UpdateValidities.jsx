import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import { useItems } from "../context/ItemsContext";
import { getItems } from "../services/items";
import { getBatchesByItem, updateBatchValidity, addOrIncrementBatch } from "../services/batches";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, RefreshCw, Eye, EyeOff } from "lucide-react";
import { getErrorMessage } from "../utils/errorHandler";
import { calculateSimilarity as calcSimilarity } from "../utils/fuzzySearch";

const UpdateValidities = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin } = useAuth();
  const { success, error: showError } = useToastContext();
  const { refreshItems } = useItems();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [results, setResults] = useState(null);
  const [showPreview, setShowPreview] = useState(true);
  const [mode, setMode] = useState("preview"); // "preview" ou "real"

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Acesso restrito</h1>
            <p className="text-gray-600">Apenas administradores podem atualizar validades.</p>
          </div>
        </div>
      </div>
    );
  }

  // Normalizar string para comparação
  const normalizeString = (str) => {
    if (!str) return "";
    return str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const parseCSV = (text) => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const delimiter = firstLine.includes(";") ? ";" : ",";

    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
    
    const nomeIndex = headers.findIndex(h => h.includes("produto") || h.includes("nome") || h === "produtos");
    const validadeIndex = headers.findIndex(h => h.includes("vencimento") || h.includes("validade"));

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim());
      
      const nome = nomeIndex >= 0 ? values[nomeIndex] : "";
      const validade = validadeIndex >= 0 ? values[validadeIndex] : "";

      if (!nome || nome.trim().length === 0) continue;

      // Normalizar validade
      let validadeNormalizada = null;
      if (validade && validade.trim().length > 0) {
        const validadeTrim = validade.trim();
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
        nome: nome ? nome.toUpperCase().trim() : nome,
        validade: validadeNormalizada
      });
    }

    return items;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      showError("Por favor, selecione um arquivo CSV");
      return;
    }

    setFile(selectedFile);
    setPreview([]);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const items = parseCSV(text);
        setPreview(items);
      } catch (error) {
        showError("Erro ao ler arquivo: " + error.message);
      }
    };
    reader.readAsText(selectedFile);
  };

  const processCSVAndUpload = async () => {
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
          const csvItems = parseCSV(text);

          if (csvItems.length === 0) {
            showError("Nenhum item encontrado no arquivo");
            setLoading(false);
            return;
          }

          // Buscar todos os itens do sistema
          const allItems = await getItems();
          const uniqueItems = allItems.filter(item => !item.isExpanded);

          let updatedCount = 0;
          let createdCount = 0;
          let notFoundCount = 0;
          let errorCount = 0;
          const errors = [];
          const matches = [];

          for (const csvItem of csvItems) {
            try {
              // Buscar item correspondente (exato ou fuzzy)
              const normalizedCsvItemName = normalizeString(csvItem.nome);
              let matchingItem = null;
              let isExactMatch = false;
              let isHighConfidence = false;

              // 1. Tentar match exato primeiro
              matchingItem = uniqueItems.find(item => normalizeString(item.nome) === normalizedCsvItemName);
              if (matchingItem) {
                isExactMatch = true;
                isHighConfidence = true;
              } else {
                // 2. Tentar match por similaridade (fuzzy)
                const potentialMatches = uniqueItems
                  .map(item => ({
                    item,
                    similarity: calcSimilarity(item.nome, csvItem.nome)
                  }))
                  .filter(match => match.similarity >= 0.5)
                  .sort((a, b) => b.similarity - a.similarity);

                if (potentialMatches.length > 0) {
                  matchingItem = potentialMatches[0].item;
                  const similarity = potentialMatches[0].similarity;
                  if (similarity >= 0.8) {
                    isHighConfidence = true;
                  }
                }
              }

              if (!matchingItem) {
                notFoundCount++;
                errors.push({
                  item: csvItem.nome,
                  error: "Produto não encontrado no sistema"
                });
                continue;
              }

              // Se estiver em modo preview, apenas registrar matches
              if (mode === "preview") {
                matches.push({
                  csvItem: csvItem.nome,
                  systemItem: matchingItem.nome,
                  validade: csvItem.validade,
                  isExactMatch,
                  isHighConfidence,
                  confidence: isExactMatch ? 1.0 : calcSimilarity(matchingItem.nome, csvItem.nome)
                });
                continue;
              }

              // Modo real: atualizar validades
              const itemId = matchingItem.id;
              const batches = await getBatchesByItem(itemId);

              if (batches.length === 0 && matchingItem.quantidade > 0) {
                // Se não tem lotes, criar lote com a quantidade atual do item
                await addOrIncrementBatch(itemId, csvItem.validade, matchingItem.quantidade);
                createdCount++;
              } else if (batches.length > 0) {
                // Se já tem lotes, atualizar a validade do lote principal
                const existingBatchWithSameValidity = batches.find(b => b.validade === csvItem.validade);
                
                if (existingBatchWithSameValidity) {
                  // Já existe lote com essa validade, não precisa fazer nada
                  updatedCount++;
                } else {
                  // Não existe lote com essa validade, atualizar o lote principal
                  let batchToUpdate = null;
                  
                  if (batches.length === 1) {
                    // Apenas 1 lote, atualizar esse
                    batchToUpdate = batches[0];
                  } else {
                    // Múltiplos lotes: priorizar lote sem validade, senão o mais antigo
                    const batchWithoutValidity = batches.find(b => b.validade === "sem-validade" || !b.validade);
                    if (batchWithoutValidity) {
                      batchToUpdate = batchWithoutValidity;
                    } else {
                      // Pegar o lote mais antigo (menor validade)
                      batches.sort((a, b) => {
                        const dateA = a.validadeDate?.toDate ? a.validadeDate.toDate() : new Date(a.validade);
                        const dateB = b.validadeDate?.toDate ? b.validadeDate.toDate() : new Date(b.validade);
                        return dateA - dateB;
                      });
                      batchToUpdate = batches[0];
                    }
                  }

                  if (batchToUpdate) {
                    await updateBatchValidity(batchToUpdate.id, csvItem.validade);
                    updatedCount++;
                  } else {
                    // Fallback: se não encontrou lote para atualizar, criar um novo
                    await addOrIncrementBatch(itemId, csvItem.validade, matchingItem.quantidade);
                    createdCount++;
                  }
                }
              }
            } catch (error) {
              errorCount++;
              errors.push({
                item: csvItem.nome,
                error: error.message || "Erro desconhecido"
              });
            }
          }

          if (mode === "preview") {
            setResults({
              mode: "preview",
              total: csvItems.length,
              matches,
              notFound: notFoundCount
            });
          } else {
            setResults({
              mode: "real",
              total: csvItems.length,
              updated: updatedCount,
              created: createdCount,
              notFound: notFoundCount,
              errors: errorCount,
              errorList: errors
            });

            if (updatedCount > 0 || createdCount > 0) {
              success(`Atualização concluída! ${updatedCount} lote(s) atualizado(s), ${createdCount} lote(s) criado(s).`);
              // 🔄 Invalidar cache via evento (otimizado)
              window.dispatchEvent(new Event('invalidateItemsCache'));
            }

            if (errorCount > 0 || notFoundCount > 0) {
              showError(`${errorCount + notFoundCount} item(s) não puderam ser processados. Verifique os detalhes.`);
            }
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-blue-600" />
              Atualizar Validades
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
              <li>Colunas esperadas: Produto/Nome, Vencimento/Validade</li>
              <li>Delimitador: vírgula (,) ou ponto e vírgula (;)</li>
              <li>Formato de data: DD/MM/YYYY ou YYYY-MM-DD</li>
              <li>O sistema fará busca inteligente para encontrar produtos similares</li>
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

          <div className="mb-6 flex gap-3">
            <button
              onClick={() => {
                setMode("preview");
                processCSVAndUpload();
              }}
              disabled={loading || !file}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && mode === "preview" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Visualizar Matches
                </>
              )}
            </button>
            <button
              onClick={() => {
                if (!confirm("Deseja realmente atualizar as validades? Esta ação não pode ser desfeita.")) {
                  return;
                }
                setMode("real");
                processCSVAndUpload();
              }}
              disabled={loading || !file}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && mode === "real" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Atualizar Validades
                </>
              )}
            </button>
          </div>

          {results && results.mode === "preview" && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-700">Matches encontrados ({results.matches.length}):</h3>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {showPreview && (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm border border-gray-200">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">CSV</th>
                        <th className="px-3 py-2 text-left">Sistema</th>
                        <th className="px-3 py-2 text-left">Validade</th>
                        <th className="px-3 py-2 text-left">Confiança</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.matches.map((match, index) => (
                        <tr key={index} className={`border-t ${match.isHighConfidence ? "bg-green-50" : "bg-yellow-50"}`}>
                          <td className="px-3 py-2">{match.csvItem}</td>
                          <td className="px-3 py-2">{match.systemItem}</td>
                          <td className="px-3 py-2">{match.validade || "-"}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              match.isExactMatch ? "bg-green-200 text-green-800" :
                              match.isHighConfidence ? "bg-blue-200 text-blue-800" :
                              "bg-yellow-200 text-yellow-800"
                            }`}>
                              {match.isExactMatch ? "Exato" : `${Math.round(match.confidence * 100)}%`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {results.notFound > 0 && (
                <p className="mt-2 text-sm text-red-600">
                  {results.notFound} produto(s) não encontrado(s) no sistema
                </p>
              )}
            </div>
          )}

          {results && results.mode === "real" && (
            <div className={`p-4 rounded-lg ${results.errors > 0 ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                {results.errors > 0 ? (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
                <h3 className="font-semibold">
                  {results.errors > 0 ? "Atualização concluída com erros" : "Atualização concluída com sucesso"}
                </h3>
              </div>
              <p className="text-sm text-gray-700">
                Total: {results.total} | Atualizados: {results.updated} | Criados: {results.created} | Não encontrados: {results.notFound} | Erros: {results.errors}
              </p>
              {results.errorList && results.errorList.length > 0 && (
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

export default UpdateValidities;

