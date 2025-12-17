import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PERMISSIONS } from "../config/constants";
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
  ChevronRight,
  BarChart3,
  ChevronLeft,
  ShoppingCart,
  PackageCheck,
  Users,
} from "lucide-react";

const Sidebar = () => {
  const { currentUser, isAdmin, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

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
    { 
      to: "/dashboard", 
      icon: Home, 
      label: "Dashboard", 
      permission: PERMISSIONS.VIEW_DASHBOARD,
      gradient: "from-blue-500 to-indigo-600",
      bgGradient: "from-blue-50 to-indigo-50",
      hoverGradient: "from-blue-100 to-indigo-100"
    },
    { 
      to: "/items", 
      icon: List, 
      label: "Itens", 
      permission: PERMISSIONS.VIEW_ITEMS,
      gradient: "from-emerald-500 to-teal-600",
      bgGradient: "from-emerald-50 to-teal-50",
      hoverGradient: "from-emerald-100 to-teal-100"
    },
    { 
      to: "/entry", 
      icon: ArrowDownCircle, 
      label: "Entrada", 
      permission: PERMISSIONS.CREATE_ENTRY,
      gradient: "from-amber-500 to-orange-600",
      bgGradient: "from-amber-50 to-orange-50",
      hoverGradient: "from-amber-100 to-orange-100"
    },
    { 
      to: "/exit", 
      icon: ArrowUpCircle, 
      label: "Saída", 
      permission: PERMISSIONS.CREATE_EXIT,
      gradient: "from-rose-500 to-red-600",
      bgGradient: "from-rose-50 to-red-50",
      hoverGradient: "from-rose-100 to-red-100"
    },
    {
      to: "/entries-history",
      icon: History,
      label: "Hist. Entradas",
      permission: PERMISSIONS.VIEW_ENTRIES_HISTORY,
      gradient: "from-cyan-500 to-blue-600",
      bgGradient: "from-cyan-50 to-blue-50",
      hoverGradient: "from-cyan-100 to-blue-100"
    },
    {
      to: "/exits-history",
      icon: History,
      label: "Hist. Saídas",
      permission: PERMISSIONS.VIEW_EXITS_HISTORY,
      gradient: "from-pink-500 to-rose-600",
      bgGradient: "from-pink-50 to-rose-50",
      hoverGradient: "from-pink-100 to-rose-100"
    },
    {
      to: "/reports",
      icon: FileText,
      label: "Relatórios",
      permission: PERMISSIONS.VIEW_REPORTS,
      gradient: "from-purple-500 to-violet-600",
      bgGradient: "from-purple-50 to-violet-50",
      hoverGradient: "from-purple-100 to-violet-100"
    },
    {
      to: "/orders",
      icon: ShoppingCart,
      label: "Pedidos",
      permission: PERMISSIONS.CREATE_ORDER,
      gradient: "from-indigo-500 to-blue-600",
      bgGradient: "from-indigo-50 to-blue-50",
      hoverGradient: "from-indigo-100 to-blue-100"
    },
    {
      to: "/orders-management",
      icon: PackageCheck,
      label: "Gerenciar Pedidos",
      permission: PERMISSIONS.MANAGE_ORDERS,
      gradient: "from-teal-500 to-cyan-600",
      bgGradient: "from-teal-50 to-cyan-50",
      hoverGradient: "from-teal-100 to-cyan-100"
    },
    {
      to: "/users-management",
      icon: Users,
      label: "Gerenciar Usuários",
      permission: PERMISSIONS.MANAGE_USERS,
      gradient: "from-purple-500 to-pink-600",
      bgGradient: "from-purple-50 to-pink-50",
      hoverGradient: "from-purple-100 to-pink-100"
    },
  ];

  if (!currentUser) return null;

  return (
    <aside className={`
      hidden lg:flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50 
      border-r border-slate-200/60 shadow-2xl sticky top-0 h-screen backdrop-blur-xl
      transition-all duration-300 ease-in-out
      ${isCollapsed ? 'w-20' : 'w-72'}
    `}>
      <div className="flex flex-col h-full">
        {/* Logo/Header Premium */}
        <div className={`border-b border-slate-200/60 relative transition-all duration-300 ${isCollapsed ? 'p-4' : 'p-6'}`}>
          <div className={`flex items-center gap-3 transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div className={`
              transition-all duration-300 overflow-hidden whitespace-nowrap
              ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'}
            `}>
              <h2 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Inventory Pro
              </h2>
              <p className="text-xs text-slate-500 font-medium">Sistema de Gestão</p>
            </div>
          </div>
          
          {/* Toggle Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`
              absolute top-1/2 -translate-y-1/2
              w-7 h-7 rounded-full bg-white border-2 border-slate-200
              shadow-lg hover:shadow-xl
              flex items-center justify-center
              transition-all duration-300 hover:scale-110 active:scale-95
              hover:border-blue-400 hover:bg-blue-50
              group z-10
              ${isCollapsed ? '-right-3.5' : '-right-3'}
            `}
            aria-label={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            <ChevronLeft className={`
              w-4 h-4 text-slate-600 group-hover:text-blue-600
              transition-all duration-300
              ${isCollapsed ? 'rotate-180' : 'rotate-0'}
            `} />
          </button>
        </div>

        {/* Navigation Links Premium */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2">
          <div className={`
            mb-3 transition-all duration-300 overflow-hidden
            ${isCollapsed ? 'max-h-0 opacity-0 mb-0' : 'max-h-10 opacity-100 mb-3'}
          `}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">
              Navegação
            </p>
          </div>
          <ul className="flex flex-col gap-2">
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
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className={`
                        group relative flex items-center rounded-xl
                        transition-all duration-300 ease-out overflow-hidden
                        ${isCollapsed ? 'px-2 py-3.5 justify-center' : 'px-4 py-3.5 gap-4'}
                        ${active 
                          ? `bg-gradient-to-r ${link.bgGradient} shadow-lg scale-[1.02]` 
                          : 'hover:bg-slate-50 hover:shadow-md hover:scale-[1.01]'
                        }
                      `}
                      title={isCollapsed ? link.label : ''}
                    >
                      {/* Background Gradient on Hover */}
                      <div className={`
                        absolute inset-0 bg-gradient-to-r ${link.hoverGradient} 
                        opacity-0 group-hover:opacity-100 transition-opacity duration-300
                        ${active ? 'opacity-100' : ''}
                      `} />
                      
                      {/* Active Indicator */}
                      {active && !isCollapsed && (
                        <div className={`
                          absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 
                          bg-gradient-to-b ${link.gradient} rounded-r-full
                          shadow-lg
                        `} />
                      )}
                      
                      {/* Icon Container */}
                      <div className={`
                        relative z-10 rounded-lg flex items-center justify-center flex-shrink-0
                        transition-all duration-300
                        ${isCollapsed ? 'w-9 h-9' : 'w-10 h-10'}
                        ${active 
                          ? `bg-gradient-to-br ${link.gradient} shadow-lg` 
                          : 'bg-slate-100 group-hover:bg-white group-hover:shadow-md'
                        }
                      `}>
                        <Icon className={`
                          w-5 h-5 transition-all duration-300
                          ${active 
                            ? 'text-white' 
                            : 'text-slate-600 group-hover:text-slate-800'
                          }
                        `} />
                      </div>
                      
                      {/* Label */}
                      <span className={`
                        relative z-10 flex-1 font-medium transition-all duration-300 whitespace-nowrap
                        ${active 
                          ? 'text-slate-800 font-semibold' 
                          : 'text-slate-600 group-hover:text-slate-800'
                        }
                        ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'}
                        overflow-hidden
                      `}>
                        {link.label}
                      </span>
                      
                      {/* Arrow Indicator */}
                      <ChevronRight className={`
                        relative z-10 w-4 h-4 transition-all duration-300 flex-shrink-0
                        ${isCollapsed ? 'hidden' : ''}
                        ${active 
                          ? 'text-slate-700 opacity-100 translate-x-0' 
                          : 'text-slate-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                        }
                      `} />
                    </Link>
                  </li>
                );
              })}
          </ul>
        </nav>

        {/* User Info Premium */}
        <div className={`p-4 border-t border-slate-200/60 space-y-3 transition-all duration-300 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          {/* User Card */}
          <div className={`
            relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl
            transition-all duration-300
            ${isCollapsed ? 'p-3 w-full' : 'p-4'}
          `}>
            {/* Decorative Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl" />
            
            <div className={`relative flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
              <div className={`
                rounded-xl flex items-center justify-center shadow-lg flex-shrink-0
                transition-all duration-300
                ${isCollapsed ? 'w-9 h-9' : 'w-12 h-12'}
                ${isAdmin 
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                  : 'bg-gradient-to-br from-amber-500 to-orange-600'
                }
              `}>
                {isAdmin ? (
                  <User className={`text-white transition-all duration-300 ${isCollapsed ? 'w-5 h-5' : 'w-6 h-6'}`} />
                ) : (
                  <Lock className={`text-white transition-all duration-300 ${isCollapsed ? 'w-5 h-5' : 'w-6 h-6'}`} />
                )}
              </div>
              <div className={`
                flex-1 min-w-0 transition-all duration-300 overflow-hidden whitespace-nowrap
                ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'}
              `}>
                <p className="text-sm font-semibold text-white truncate">
                  {currentUser.email}
                </p>
                <p className={`
                  text-xs font-medium flex items-center gap-1.5 mt-0.5
                  ${isAdmin ? 'text-blue-300' : 'text-amber-300'}
                `}>
                  <span className={`
                    w-1.5 h-1.5 rounded-full flex-shrink-0
                    ${isAdmin ? 'bg-blue-400' : 'bg-amber-400'}
                  `} />
                  {isAdmin ? 'Administrador' : 'Somente leitura'}
                </p>
              </div>
            </div>
          </div>

          {/* Logout Button Premium */}
          <button
            onClick={handleLogout}
            className={`
              group w-full flex items-center rounded-xl
              bg-gradient-to-r from-red-500 to-rose-600
              hover:from-red-600 hover:to-rose-700
              text-white
              transition-all duration-300 ease-out
              font-semibold shadow-lg shadow-red-500/25
              hover:shadow-xl hover:shadow-red-500/40
              hover:scale-[1.02] active:scale-[0.98]
              ${isCollapsed ? 'justify-center px-3 py-3.5' : 'justify-center gap-3 px-4 py-3.5'}
            `}
            title={isCollapsed ? 'Sair da conta' : ''}
          >
            <LogOut className={`
              transition-all duration-300 group-hover:-translate-x-1
              w-5 h-5 flex-shrink-0
            `} />
            <span className={`
              transition-all duration-300 overflow-hidden whitespace-nowrap
              ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-full opacity-100'}
            `}>
              Sair da conta
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;