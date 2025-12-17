import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PERMISSIONS } from "../config/constants";
import {
  LogOut,
  Home,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  List,
  Menu,
  X,
  User,
  Lock,
  FileText,
  ShoppingCart,
  PackageCheck,
  Users,
} from "lucide-react";
import logoPrefeitura from "../assets/prefeiturajpg.png";

const Navbar = () => {
  const { currentUser, isAdmin, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      navigate("/login");
      setMobileMenuOpen(false);
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navLinks = [
    { to: "/dashboard", icon: Home, label: "Dashboard", permission: PERMISSIONS.VIEW_DASHBOARD },
    { to: "/items", icon: List, label: "Itens", permission: PERMISSIONS.VIEW_ITEMS },
    { to: "/entry", icon: ArrowDownCircle, label: "Entrada", permission: PERMISSIONS.CREATE_ENTRY },
    { to: "/exit", icon: ArrowUpCircle, label: "Saída", permission: PERMISSIONS.CREATE_EXIT },
    {
      to: "/entries-history",
      icon: History,
      label: "Hist. Entradas",
      permission: PERMISSIONS.VIEW_ENTRIES_HISTORY,
    },
    {
      to: "/exits-history",
      icon: History,
      label: "Hist. Saídas",
      permission: PERMISSIONS.VIEW_EXITS_HISTORY,
    },
    {
      to: "/reports",
      icon: FileText,
      label: "Relatórios",
      permission: PERMISSIONS.VIEW_REPORTS,
    },
    {
      to: "/orders",
      icon: ShoppingCart,
      label: "Pedidos",
      permission: PERMISSIONS.CREATE_ORDER,
    },
    {
      to: "/orders-management",
      icon: PackageCheck,
      label: "Gerenciar Pedidos",
      permission: PERMISSIONS.MANAGE_ORDERS,
    },
    {
      to: "/users-management",
      icon: Users,
      label: "Gerenciar Usuários",
      permission: PERMISSIONS.MANAGE_USERS,
    },
  ];

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl sticky top-0 z-50 border-b border-slate-700/50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 gap-4">
          {/* Logo e Título */}
          <Link
            to="/items"
            className="flex items-center space-x-3 lg:space-x-4 group flex-shrink-0"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl blur-md opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
              <div className="relative bg-white rounded-2xl p-3 shadow-xl ring-1 ring-slate-200 group-hover:ring-red-500/50 transition-all duration-300">
                <img
                  src={logoPrefeitura}
                  alt="Logo Prefeitura"
                  className="h-11 w-auto object-contain"
                />
              </div>
            </div>
            <div className="hidden md:block">
              <h1 className="text-base lg:text-lg font-bold tracking-wide text-white whitespace-nowrap">
                Prefeitura de Lajinha
              </h1>
              <div className="flex items-center space-x-2">
                <div className="h-1 w-1 bg-red-500 rounded-full"></div>
                <h2 className="text-xs lg:text-sm font-medium text-slate-300 whitespace-nowrap">
                  Controle de Estoque
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 whitespace-nowrap">
                Sistema de Almoxarifado
              </p>
            </div>
          </Link>

          {/* Usuário e Logout Desktop */}
          {currentUser && (
            <>
              <div className="hidden lg:flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-slate-800/50 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-slate-700/50 shadow-lg">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg">
                    {isAdmin ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Lock className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-200 max-w-xs truncate">
                    {currentUser.email}
                  </span>
                  {!isAdmin && (
                    <span className="text-[11px] font-semibold text-yellow-200 bg-yellow-600/20 border border-yellow-500/40 px-2 py-0.5 rounded">
                      Somente leitura
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="group flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-red-600 border border-slate-700 hover:border-red-500 rounded-xl transition-all duration-300 shadow-lg hover:shadow-red-500/25"
                >
                  <LogOut className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                    Sair
                  </span>
                </button>
              </div>

              {/* Botão Menu Mobile */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2.5 rounded-xl hover:bg-slate-700/50 transition-all duration-300"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </>
          )}
        </div>

        {/* Menu Mobile */}
        {currentUser && mobileMenuOpen && (
          <div className="lg:hidden pb-4 border-t border-slate-700/50 mt-2 pt-4 animate-in slide-in-from-top duration-300">
            <div className="space-y-1.5">
              {navLinks
                .filter((link) => {
                  // Admin tem acesso a tudo
                  if (isAdmin) return true;
                  // Se não tem permissão definida, mostrar para todos autenticados
                  if (!link.permission) return true;
                  // Verificar se tem a permissão necessária
                  return hasPermission(link.permission);
                })
                .map((link) => {
                const Icon = link.icon;
                const active = isActive(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      active
                        ? "bg-gradient-to-r from-red-600 to-red-500 shadow-lg shadow-red-500/25"
                        : "hover:bg-slate-700/50"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        active ? "text-white" : "text-slate-400"
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        active ? "text-white" : "text-slate-300"
                      }`}
                    >
                      {link.label}
                    </span>
                  </Link>
                );
              })}
              <div className="pt-4 border-t border-slate-700/50 mt-4 space-y-2">
                <div className="flex items-center space-x-3 px-4 py-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                    {isAdmin ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Lock className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-200 truncate">
                    {currentUser.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-slate-800 hover:bg-red-600 border border-slate-700 hover:border-red-500 rounded-xl transition-all duration-300"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sair</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
