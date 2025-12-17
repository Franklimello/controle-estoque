import { useState, useEffect } from "react";
import { getExits } from "../services/exits";
import { formatDate, exportToCSV } from "../utils/validators";
import { Search, Download, ArrowUpCircle } from "lucide-react";

// --- Componente de Item da Lista (Card Mobile) ---
const ExitListItem = ({ exit }) => {
  // Garante que a quantidade seja sempre positiva para exibição
  const absoluteQuantity = Math.abs(exit.quantidade);

  return (
    <div
      key={exit.id}
      // Estilo Card: Borda vermelha de destaque e sombra
      className="bg-white shadow-md rounded-lg p-4 border-l-4 border-red-600 space-y-2 transition-shadow hover:shadow-lg"
    >
      <div className="flex justify-between items-start text-sm border-b pb-2 mb-2">
        <span className="font-semibold text-gray-700">
          {formatDate(exit.data || exit.createdAt)}
        </span>
        <span className="text-red-600 font-bold text-lg">
          -{absoluteQuantity}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">Código:</dt>
        <dd className="font-medium truncate">{exit.codigo}</dd>

        <dt className="text-gray-500">Setor Destino:</dt>
        <dd className="truncate">{exit.setorDestino || "-"}</dd>

        <dt className="text-gray-500">Retirado por:</dt>
        <dd className="truncate">{exit.retiradoPor || "-"}</dd>

        {exit.observacao && (
          <>
            <dt className="text-gray-500">Obs:</dt>
            <dd className="col-span-2 text-xs italic">{exit.observacao}</dd>
          </>
        )}
      </dl>

      {exit.batchesConsumed?.length > 0 && (
        <div className="pt-2 mt-2 border-t border-gray-200">
          <p className="font-semibold text-xs text-gray-600 mb-1">
            Lotes Consumidos:
          </p>
          {exit.batchesConsumed.map((b, idx) => (
            <div
              key={idx}
              className="flex justify-between text-xs text-gray-500"
            >
              <span>Val: {b.validity || "s/d"}</span>
              <span className="text-red-500 font-medium">-{b.consumed}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
// -------------------------------------------------

const ExitsHistory = () => {
  const [exits, setExits] = useState([]);
  const [filteredExits, setFilteredExits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [setorFilter, setSetorFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(""); // --- Lógica de Carregamento ---

  useEffect(() => {
    const loadExits = async () => {
      try {
        setLoading(true);
        const data = await getExits();
        console.log("✅ Saídas carregadas:", data.length);
        setExits(data);
        setFilteredExits(data);
      } catch (error) {
        console.error("❌ Erro ao carregar saídas:", error);
        console.error("Detalhes do erro:", error.message, error.code);
        // Garantir que arrays vazios sejam definidos mesmo em caso de erro
        setExits([]);
        setFilteredExits([]);
      } finally {
        setLoading(false);
      }
    };

    loadExits();
  }, []); // --- Lógica de Filtro ---

  useEffect(() => {
    let filtered = exits;

    if (searchTerm.trim()) {
      filtered = filtered.filter((exit) =>
        exit.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (setorFilter.trim()) {
      filtered = filtered.filter((exit) =>
        exit.setorDestino?.toLowerCase().includes(setorFilter.toLowerCase())
      );
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter((exit) => {
        const exitDate = exit.data?.toDate ? exit.data.toDate() : exit.data;
        if (!exitDate) return false;

        const exitClean = new Date(exitDate);
        exitClean.setHours(0, 0, 0, 0);
        filterDate.setHours(0, 0, 0, 0);

        return exitClean.getTime() === filterDate.getTime();
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
      Data: formatDate(exit.data || exit.createdAt),
    }));

    exportToCSV(exportData, "saidas.csv");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-0 md:p-6">
      <div className="max-w-full lg:max-w-7xl mx-auto px-4 md:px-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-4 md:pt-0 mb-6 gap-3">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center">
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

        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <input
              type="text"
              placeholder="Filtrar por setor..."
              value={setorFilter}
              onChange={(e) => setSetorFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>

        <div className="md:hidden space-y-4 pb-4">
          {filteredExits.length > 0 ? (
            filteredExits.map((exit) => (
              <ExitListItem key={exit.id} exit={exit} />
            ))
          ) : (
            <p className="text-gray-500 p-4 bg-white rounded-lg shadow text-center">
              Nenhuma saída encontrada com os filtros atuais.
            </p>
          )}
          <p className="text-sm text-gray-600 mt-4 text-center">
            Total de saídas: {filteredExits.length}
          </p>
        </div>

        <div className="hidden md:block bg-white shadow rounded-lg mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-red-50 text-gray-700 uppercase">
                <tr>
                  <th className="px-6 py-3 min-w-[150px]">Data</th>
                  <th className="px-6 py-3 min-w-[150px]">Código</th>
                  <th className="px-6 py-3">Qtd</th>
                  <th className="px-6 py-3 min-w-[120px]">Setor</th>
                  <th className="px-6 py-3 min-w-[150px]">Retirado por</th>
                  <th className="px-6 py-3 min-w-[200px]">Obs</th>
                  <th className="px-6 py-3 min-w-[150px]">Lotes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredExits.length > 0 ? (
                  filteredExits.map((exit) => (
                    <tr key={exit.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        {formatDate(exit.data || exit.createdAt)}
                      </td>
                      <td className="px-6 py-3 font-medium">{exit.codigo}</td>
                      <td className="px-6 py-3 text-red-600 font-semibold">
                        -{Math.abs(exit.quantidade)}
                      </td>
                      <td className="px-6 py-3">{exit.setorDestino || "-"}</td>
                      <td className="px-6 py-3">{exit.retiradoPor || "-"}</td>
                      <td className="px-6 py-3 text-gray-500">
                        {exit.observacao || "-"}
                      </td>
                      <td className="px-6 py-3 text-xs">
                        {exit.batchesConsumed?.map((b, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-gray-600"
                          >
                            <span>Val: {b.validity || "s/d"}</span>
                            <span className="text-red-500">-{b.consumed}</span>
                          </div>
                        )) || "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Nenhuma saída encontrada com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t bg-gray-50 text-sm font-medium text-gray-700">
            Total de saídas: {filteredExits.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExitsHistory;
