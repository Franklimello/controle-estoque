import { useEffect, useState } from "react";
import { useItems } from "../context/ItemsContext";
import { useAuth } from "../context/AuthContext";
import { getEntriesByDate, getRecentEntries } from "../services/entries";
import { getExitsByDate, getRecentExits } from "../services/exits";
import { Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { formatDate } from "../utils/validators";
import { formatExpiryDate, checkExpiringDate } from "../utils/dateUtils";

const Dashboard = () => {
  const { items, lowStockItems, expiringItems, loading: itemsLoading } = useItems();
  const { currentUser } = useAuth();
  const [entriesToday, setEntriesToday] = useState([]);
  const [exitsToday, setExitsToday] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [recentExits, setRecentExits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const today = new Date();
        
        const [entries, exits, recentEnt, recentExt] = await Promise.all([
          getEntriesByDate(today),
          getExitsByDate(today),
          getRecentEntries(5),
          getRecentExits(5)
        ]);
        
        setEntriesToday(entries);
        setExitsToday(exits);
        setRecentEntries(recentEnt);
        setRecentExits(recentExt);
      } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const totalEntriesToday = entriesToday.reduce((sum, entry) => sum + (entry.quantidade || 0), 0);
  const totalExitsToday = exitsToday.reduce((sum, exit) => sum + (exit.quantidade || 0), 0);

  if (loading || itemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <div className="loading-ring">
            <i></i>
            <i></i>
          </div>
          <div className="space-y-2">
            <p className="text-gray-700 font-medium">Carregando dados...</p>
            <p className="text-sm text-gray-500">Aguarde um momento</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 relative overflow-hidden hover-lift transition-all duration-300 border border-gray-100">
            <div className="dashboard-card-ring text-blue-600">
              <i></i>
              <i></i>
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total de Itens</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{items.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="w-10 h-10 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 relative overflow-hidden">
            <div className="dashboard-card-ring text-green-600">
              <i></i>
              <i></i>
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-gray-600 text-sm">Entradas Hoje</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{totalEntriesToday}</p>
              </div>
              <ArrowDownCircle className="w-12 h-12 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 relative overflow-hidden">
            <div className="dashboard-card-ring text-red-600">
              <i></i>
              <i></i>
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-gray-600 text-sm">Saídas Hoje</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{totalExitsToday}</p>
              </div>
              <ArrowUpCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 relative overflow-hidden">
            <div className="dashboard-card-ring text-orange-600">
              <i></i>
              <i></i>
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-gray-600 text-sm">Estoque Baixo</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{lowStockItems.length}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-orange-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 relative overflow-hidden">
            <div className="dashboard-card-ring text-red-600">
              <i></i>
              <i></i>
            </div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-gray-600 text-sm">Vencimento Próximo</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{expiringItems.length}</p>
              </div>
              <Clock className="w-12 h-12 text-red-600" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Itens com Estoque Baixo */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
              Itens com Estoque Baixo
            </h2>
            {lowStockItems.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum item com estoque baixo</p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">{item.nome}</p>
                      <p className="text-sm text-gray-600">Código: {item.codigo || "Sem código"}</p>
                    </div>
                    <span className="text-lg font-bold text-orange-600">
                      {item.quantidade || 0} {item.unidade || "UN"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Itens Próximos do Vencimento */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <Clock className="w-5 h-5 text-red-600 mr-2" />
              Itens Próximos do Vencimento
            </h2>
            {expiringItems.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum item próximo do vencimento</p>
            ) : (
              <div className="space-y-3">
                {expiringItems.slice(0, 5).map((item,index) => {
                  const expiryInfo = checkExpiringDate(item.validade);
                  return (
                    <div
                      key={`exp-${item.id}-${index}`}
                      className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${
                        expiryInfo.isExpired
                          ? "bg-red-50 border-red-500"
                          : "bg-orange-50 border-orange-500"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-gray-800">
                          {item.nome}
                        </p>
                        <p className="text-sm text-gray-600">
                          Código: {item.codigo || "Sem código"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Validade: {formatExpiryDate(item.validade)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-lg font-bold ${
                            expiryInfo.isExpired
                              ? "text-red-600"
                              : "text-orange-600"
                          }`}
                        >
                          {expiryInfo.isExpired
                            ? "VENCIDO"
                            : `${expiryInfo.daysUntilExpiry} dias`}
                        </span>
                        <p className="text-xs text-gray-500">
                          {item.quantidade || 0} {item.unidade || "UN"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Últimas Entradas */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
              Últimas 5 Entradas
            </h2>
            {recentEntries.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhuma entrada registrada</p>
            ) : (
              <div className="space-y-3">
                {recentEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border-l-4 border-green-500"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">Código: {entry.codigo}</p>
                      <p className="text-sm text-gray-600">
                        {entry.fornecedor && `Fornecedor: ${entry.fornecedor}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(entry.data || entry.createdAt)}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      +{entry.quantidade}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Últimas Saídas */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <TrendingDown className="w-5 h-5 text-red-600 mr-2" />
              Últimas 5 Saídas
            </h2>
            {recentExits.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhuma saída registrada</p>
            ) : (
              <div className="space-y-3">
                {recentExits.map((exit) => (
                  <div
                    key={exit.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border-l-4 border-red-500"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">Código: {exit.codigo}</p>
                      <p className="text-sm text-gray-600">
                        {exit.setorDestino && `Setor: ${exit.setorDestino}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(exit.data || exit.createdAt)}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-red-600">
                      -{exit.quantidade}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

