import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PERMISSIONS } from "../config/constants";
import { Lock, AlertTriangle } from "lucide-react";

/**
 * Componente para proteger rotas com verificação de permissões
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componente a ser renderizado se tiver permissão
 * @param {string|Array<string>} props.permission - Permissão(ões) necessária(s)
 * @param {boolean} props.requireAll - Se true, requer todas as permissões. Se false, requer apenas uma
 * @param {string} props.redirectTo - Rota para redirecionar se não tiver permissão (padrão: /items)
 */
const ProtectedRoute = ({ 
  children, 
  permission, 
  requireAll = false,
  redirectTo = "/items" 
}) => {
  const { currentUser, loading, hasPermission, isAdmin } = useAuth();

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

  // Se não estiver autenticado, redirecionar para login
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Admin tem acesso a tudo
  if (isAdmin) {
    return children;
  }

  // Se não especificou permissão, permitir acesso (rota pública para usuários autenticados)
  if (!permission) {
    return children;
  }

  // Verificar permissões
  const permissions = Array.isArray(permission) ? permission : [permission];
  let hasAccess = false;

  if (requireAll) {
    // Requer todas as permissões
    hasAccess = permissions.every(perm => hasPermission(perm));
  } else {
    // Requer apenas uma das permissões
    hasAccess = permissions.some(perm => hasPermission(perm));
  }

  if (!hasAccess) {
    // Mostrar página de acesso negado
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
          <p className="text-gray-600 mb-6">
            Você não tem permissão para acessar esta página.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-semibold text-yellow-800 mb-1">
                  Permissão necessária:
                </p>
                <ul className="text-xs text-yellow-700 space-y-1">
                  {permissions.map((perm, index) => (
                    <li key={index}>• {getPermissionLabel(perm)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <button
            onClick={() => window.history.back()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return children;
};

/**
 * Função helper para obter label da permissão
 */
const getPermissionLabel = (permission) => {
  const labels = {
    [PERMISSIONS.VIEW_ITEMS]: "Ver Itens",
    [PERMISSIONS.VIEW_DASHBOARD]: "Ver Dashboard",
    [PERMISSIONS.VIEW_REPORTS]: "Ver Relatórios",
    [PERMISSIONS.VIEW_ENTRIES_HISTORY]: "Ver Histórico de Entradas",
    [PERMISSIONS.VIEW_EXITS_HISTORY]: "Ver Histórico de Saídas",
    [PERMISSIONS.CREATE_ITEMS]: "Criar Itens",
    [PERMISSIONS.EDIT_ITEMS]: "Editar Itens",
    [PERMISSIONS.DELETE_ITEMS]: "Excluir Itens",
    [PERMISSIONS.CREATE_ENTRY]: "Criar Entrada",
    [PERMISSIONS.CREATE_EXIT]: "Criar Saída",
    [PERMISSIONS.CREATE_ORDER]: "Criar Pedido",
    [PERMISSIONS.MANAGE_ORDERS]: "Gerenciar Pedidos",
    [PERMISSIONS.MANAGE_USERS]: "Gerenciar Usuários",
  };
  return labels[permission] || permission;
};

export default ProtectedRoute;









