import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Home,
  List,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  LogOut,
  User,
  Lock,
} from "lucide-react";

const Sidebar = () => {
  const { currentUser, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      navigate("/login");
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navLinks = [
    { to: "/dashboard", icon: Home, label: "Dashboard", adminOnly: false },
    { to: "/items", icon: List, label: "Itens", adminOnly: false },
    { to: "/entry", icon: ArrowDownCircle, label: "Entrada", adminOnly: true },
    { to: "/exit", icon: ArrowUpCircle, label: "Saída", adminOnly: true },
    {
      to: "/entries-history",
      icon: History,
      label: "Hist. Entradas",
      adminOnly: false,
    },
    {
      to: "/exits-history",
      icon: History,
      label: "Hist. Saídas",
      adminOnly: false,
    },
  ];

  if (!currentUser) return null;

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 shadow-lg sticky top-0 h-screen">
      <div className="flex flex-col h-full">
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Menu</h2>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navLinks
            .filter((link) => (link.adminOnly ? isAdmin : true))
            .map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                    active
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
        </nav>

        {/* User Info and Logout */}
        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
              {isAdmin ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Lock className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentUser.email}
              </p>
              {!isAdmin && (
                <p className="text-xs text-yellow-600 font-medium">
                  Somente leitura
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

