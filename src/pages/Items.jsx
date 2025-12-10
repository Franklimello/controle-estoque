import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useItems } from "../context/ItemsContext";
import { getItems } from "../services/items";
import ItemCard from "../components/ItemCard";
import { Search, Plus } from "lucide-react";

const Items = () => {
  const { items, refreshItems } = useItems();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredItems, setFilteredItems] = useState([]);

  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredItems(items);
    } else {
      const filtered = items.filter(
        (item) =>
          item.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  }, [searchTerm, items]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Itens do Estoque</h1>
          <button
            onClick={() => navigate("/new-item")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Item</span>
          </button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome, código ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {searchTerm ? "Nenhum item encontrado" : "Nenhum item cadastrado"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => navigate(`/edit-item/${item.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Items;


