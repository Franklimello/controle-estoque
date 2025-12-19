import { useState, useEffect } from "react";
import { getEntries } from "../services/entries";
import { formatDate, exportToCSV } from "../utils/validators";
import { Search, Download, ArrowDownCircle } from "lucide-react";

// --- Componente de Item da Lista (Card Mobile) ---
const EntryListItem = ({ entry }) => {
  return (
    <div
      key={entry.id}
      // Estilo Card: Borda verde de destaque e sombra
      className="bg-white shadow-md rounded-lg p-4 border-l-4 border-green-600 space-y-2 transition-shadow hover:shadow-lg"
    >
      <div className="flex justify-between items-start text-sm border-b pb-2 mb-2">
        <span className="font-semibold text-gray-700">
          {formatDate(entry.data || entry.createdAt)}
        </span>
        <span className="text-green-600 font-bold text-lg">
          +{entry.quantidade}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">Código:</dt>
        <dd className="font-medium truncate">{entry.codigo}</dd>

        {entry.fornecedor && (
          <>
            <dt className="text-gray-500">Fornecedor:</dt>
            <dd className="truncate">{entry.fornecedor}</dd>
          </>
        )}

        {entry.observacao && (
          <>
            <dt className="text-gray-500">Obs:</dt>
            <dd className="col-span-2 text-xs italic">{entry.observacao}</dd>
          </>
        )}
      </dl>
    </div>
  );
};
// -------------------------------------------------

const EntriesHistory = () => {
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    const loadEntries = async () => {
      try {
        setLoading(true);
        const data = await getEntries();
        setEntries(data);
        setFilteredEntries(data);
      } catch (error) {
        console.error("❌ Erro ao carregar entradas:", error);
        console.error("Detalhes do erro:", error.message, error.code);
        // Garantir que arrays vazios sejam definidos mesmo em caso de erro
        setEntries([]);
        setFilteredEntries([]);
      } finally {
        setLoading(false);
      }
    };

    loadEntries();
  }, []);

  useEffect(() => {
    let filtered = entries;

    if (searchTerm.trim()) {
      filtered = filtered.filter(
        (entry) =>
          entry.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter((entry) => {
        const entryDate = entry.data?.toDate ? entry.data.toDate() : entry.data;
        if (!entryDate) return false;
        const entryDateOnly = new Date(entryDate);
        entryDateOnly.setHours(0, 0, 0, 0);
        filterDate.setHours(0, 0, 0, 0);
        return entryDateOnly.getTime() === filterDate.getTime();
      });
    }

    setFilteredEntries(filtered);
  }, [searchTerm, dateFilter, entries]);

  const handleExport = () => {
    const exportData = filteredEntries.map((entry) => ({
      Código: entry.codigo,
      Quantidade: entry.quantidade,
      Fornecedor: entry.fornecedor || "",
      Observação: entry.observacao || "",
      Data: formatDate(entry.data || entry.createdAt)
    }));
    exportToCSV(exportData, "entradas.csv");
  };

  if (loading) {
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
      <div className="max-w-full lg:max-w-7xl mx-auto px-4 md:px-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-4 md:pt-0 mb-6 gap-3">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center">
            <ArrowDownCircle className="w-6 h-6 mr-2 text-green-600" />
            Histórico de Entradas
          </h1>
          <button
            onClick={handleExport}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 transition"
          >
            <Download className="w-5 h-5" />
            <span>Exportar CSV</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <input
                type="date"
                placeholder="Filtrar por data..."
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        {/* 📱 MOBILE (LISTA DE CARDS) */}
        <div className="md:hidden space-y-4 pb-4">
          {filteredEntries.length > 0 ? (
            filteredEntries.map((entry) => (
              <EntryListItem key={entry.id} entry={entry} />
            ))
          ) : (
            <p className="text-gray-500 p-4 bg-white rounded-lg shadow text-center">
              Nenhuma entrada encontrada com os filtros atuais.
            </p>
          )}
          <p className="text-sm text-gray-600 mt-4 text-center">
            Total de entradas: {filteredEntries.length}
          </p>
        </div>

        {/* 🖥️ DESKTOP (TABELA TRADICIONAL) */}
        <div className="hidden md:block bg-white shadow rounded-lg mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-green-50 text-gray-700 uppercase">
                <tr>
                  <th className="px-6 py-3 min-w-[150px]">Data</th>
                  <th className="px-6 py-3 min-w-[150px]">Código</th>
                  <th className="px-6 py-3">Qtd</th>
                  <th className="px-6 py-3 min-w-[150px]">Fornecedor</th>
                  <th className="px-6 py-3 min-w-[200px]">Obs</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEntries.length > 0 ? (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        {formatDate(entry.data || entry.createdAt)}
                      </td>
                      <td className="px-6 py-3 font-medium">{entry.codigo}</td>
                      <td className="px-6 py-3 text-green-600 font-semibold">
                        +{entry.quantidade}
                      </td>
                      <td className="px-6 py-3">{entry.fornecedor || "-"}</td>
                      <td className="px-6 py-3 text-gray-500">
                        {entry.observacao || "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Nenhuma entrada encontrada com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t bg-gray-50 text-sm font-medium text-gray-700">
            Total de entradas: {filteredEntries.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntriesHistory;


