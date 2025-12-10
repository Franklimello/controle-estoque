import { useState, useEffect } from "react";
import { getExits } from "../services/exits";
import { formatDate, exportToCSV } from "../utils/validators";
import { Search, Download, ArrowUpCircle } from "lucide-react";

const ExitsHistory = () => {
  const [exits, setExits] = useState([]);
  const [filteredExits, setFilteredExits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [setorFilter, setSetorFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    const loadExits = async () => {
      try {
        setLoading(true);
        const data = await getExits();
        setExits(data);
        setFilteredExits(data);
      } catch (error) {
        console.error("Erro ao carregar saídas:", error);
      } finally {
        setLoading(false);
      }
    };

    loadExits();
  }, []);

  useEffect(() => {
    let filtered = exits;

    if (searchTerm.trim()) {
      filtered = filtered.filter(
        (exit) =>
          exit.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (setorFilter.trim()) {
      filtered = filtered.filter(
        (exit) =>
          exit.setorDestino?.toLowerCase().includes(setorFilter.toLowerCase())
      );
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter((exit) => {
        const exitDate = exit.data?.toDate ? exit.data.toDate() : exit.data;
        if (!exitDate) return false;
        const exitDateOnly = new Date(exitDate);
        exitDateOnly.setHours(0, 0, 0, 0);
        filterDate.setHours(0, 0, 0, 0);
        return exitDateOnly.getTime() === filterDate.getTime();
      });
    }

    setFilteredExits(filtered);
  }, [searchTerm, setorFilter, dateFilter, exits]);

  const handleExport = () => {
    const exportData = filteredExits.map((exit) => ({
      Código: exit.codigo,
      Quantidade: exit.quantidade,
      "Setor Destino": exit.setorDestino || "",
      "Retirado Por": exit.retiradoPor || "",
      Observação: exit.observacao || "",
      Data: formatDate(exit.data || exit.createdAt)
    }));
    exportToCSV(exportData, "saidas.csv");
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
            <ArrowUpCircle className="w-6 h-6 mr-2 text-red-600" />
            Histórico de Saídas
          </h1>
          <button
            onClick={handleExport}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2 transition"
          >
            <Download className="w-5 h-5" />
            <span>Exportar CSV</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Filtrar por setor..."
                value={setorFilter}
                onChange={(e) => setSetorFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <input
                type="date"
                placeholder="Filtrar por data..."
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-red-50">
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
                    Setor Destino
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Retirado Por
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Observação
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Lotes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExits.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                      Nenhuma saída encontrada
                    </td>
                  </tr>
                ) : (
                  filteredExits.map((exit) => (
                    <tr key={exit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(exit.data || exit.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {exit.codigo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="text-red-600 font-semibold">
                          -{exit.quantidade}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {exit.setorDestino || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {exit.retiradoPor || "-"}
                      </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {exit.observacao || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {exit.batchesConsumed && exit.batchesConsumed.length > 0 ? (
                        <div className="space-y-1">
                          {exit.batchesConsumed.map((b, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span>Val: {b.validity || "sem data"}</span>
                              <span className="font-semibold">-{b.consumed}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Total de saídas: {filteredExits.length}
        </div>
      </div>
    </div>
  );
};

export default ExitsHistory;


