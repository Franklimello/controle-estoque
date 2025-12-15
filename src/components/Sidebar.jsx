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
  FileText,
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
    {
      to: "/reports",
      icon: FileText,
      label: "Relatórios",
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
          <ul className="flex flex-col gap-3">
            {navLinks
              .filter((link) => (link.adminOnly ? isAdmin : true))
              .map((link) => {
                const Icon = link.icon;
                const active = isActive(link.to);
                const colors = {
                  "/dashboard": { i: "#3b82f6", j: "#8b5cf6" },
                  "/items": { i: "#10b981", j: "#059669" },
                  "/entry": { i: "#f59e0b", j: "#d97706" },
                  "/exit": { i: "#ef4444", j: "#dc2626" },
                  "/entries-history": { i: "#06b6d4", j: "#0891b2" },
                  "/exits-history": { i: "#ec4899", j: "#db2777" },
                };
                const colorScheme = colors[link.to] || { i: "#3b82f6", j: "#8b5cf6" };
                
                return (
                  <li
                    key={link.to}
                    className={`expanding-nav-item ${active ? "active" : ""}`}
                    style={{
                      "--i": colorScheme.i,
                      "--j": colorScheme.j,
                    }}
                  >
                    <Link
                      to={link.to}
                      className="w-full h-full flex items-center justify-center relative"
                    >
                      <Icon className="nav-icon w-6 h-6" />
                      <span className="nav-title">{link.label}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
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

