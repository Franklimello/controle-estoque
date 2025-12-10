import { useState, useEffect } from "react";
import { getEntries } from "../services/entries";
import { formatDate, exportToCSV } from "../utils/validators";
import { Search, Download, ArrowDownCircle } from "lucide-react";

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
        console.error("Erro ao carregar entradas:", error);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
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

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-green-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Fornecedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Observação
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                      Nenhuma entrada encontrada
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.data || entry.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {entry.codigo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="text-green-600 font-semibold">
                          +{entry.quantidade}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.fornecedor || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {entry.observacao || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Total de entradas: {filteredEntries.length}
        </div>
      </div>
    </div>
  );
};

export default EntriesHistory;


