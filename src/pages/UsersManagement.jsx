import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import { getAllUsers, updateUserRole, getUserInfo } from "../services/users";
import { USER_ROLES, ROLE_PERMISSIONS, PERMISSIONS } from "../config/constants";
import { Users, Shield, Eye, ShoppingCart, PackageCheck, Save, Copy, Check, X } from "lucide-react";
import { getErrorMessage } from "../utils/errorHandler";

const UsersManagement = () => {
  const { currentUser, isAdmin } = useAuth();
  const { success, error: showError } = useToastContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersData = await getAllUsers();
      
      // Buscar informações completas de cada usuário
      const usersWithInfo = await Promise.all(
        usersData.map(async (user) => {
          const info = await getUserInfo(user.id);
          return {
            ...user,
            email: user.email || `Usuário ${user.id.substring(0, 8)}...`,
            permissions: info?.permissions || [],
          };
        })
      );
      
      setUsers(usersWithInfo);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      showError("Erro ao carregar usuários: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!currentUser) return;
    
    try {
      setSaving((prev) => ({ ...prev, [userId]: true }));
      await updateUserRole(userId, newRole, currentUser.uid);
      success(`Role do usuário atualizado para: ${getRoleLabel(newRole)}`);
      await loadUsers();
    } catch (error) {
      console.error("Erro ao atualizar role:", error);
      showError("Erro ao atualizar role: " + getErrorMessage(error));
    } finally {
      setSaving((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const copyUserId = (userId) => {
    navigator.clipboard.writeText(userId);
    setCopiedId(userId);
    success("ID do usuário copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getRoleLabel = (role) => {
    const labels = {
      [USER_ROLES.ADMIN]: "Administrador",
      [USER_ROLES.READ_ONLY]: "Somente Leitura",
      [USER_ROLES.ORDER_ONLY]: "Apenas Pedidos",
      [USER_ROLES.ENTRY_MANAGER]: "Entrada + Pedidos",
    };
    return labels[role] || role;
  };

  const getRoleIcon = (role) => {
    const icons = {
      [USER_ROLES.ADMIN]: Shield,
      [USER_ROLES.READ_ONLY]: Eye,
      [USER_ROLES.ORDER_ONLY]: ShoppingCart,
      [USER_ROLES.ENTRY_MANAGER]: PackageCheck,
    };
    return icons[role] || Users;
  };

  const getRoleColor = (role) => {
    const colors = {
      [USER_ROLES.ADMIN]: "from-blue-500 to-indigo-600",
      [USER_ROLES.READ_ONLY]: "from-gray-500 to-slate-600",
      [USER_ROLES.ORDER_ONLY]: "from-amber-500 to-orange-600",
      [USER_ROLES.ENTRY_MANAGER]: "from-green-500 to-emerald-600",
    };
    return colors[role] || "from-gray-400 to-gray-500";
  };

  const getPermissionLabel = (permission) => {
    const labels = {
      [PERMISSIONS.VIEW_ITEMS]: "Ver Itens",
      [PERMISSIONS.VIEW_DASHBOARD]: "Ver Dashboard",
      [PERMISSIONS.VIEW_REPORTS]: "Ver Relatórios",
      [PERMISSIONS.VIEW_ENTRIES_HISTORY]: "Ver Hist. Entradas",
      [PERMISSIONS.VIEW_EXITS_HISTORY]: "Ver Hist. Saídas",
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Acesso restrito</h1>
            <p className="text-gray-600">
              Apenas administradores podem acessar esta página.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-ring mx-auto">
            <i></i>
            <i></i>
          </div>
          <p className="mt-4 text-gray-600">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Usuários</h1>
              <p className="text-sm text-gray-600">Controle de permissões e acesso ao sistema</p>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-4">
          {users.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum usuário encontrado</p>
            </div>
          ) : (
            users.map((user) => {
              const RoleIcon = getRoleIcon(user.role || USER_ROLES.READ_ONLY);
              const roleColor = getRoleColor(user.role || USER_ROLES.READ_ONLY);
              const userPermissions = user.permissions || [];
              
              return (
                <div
                  key={user.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden"
                >
                  <div className="p-6">
                    {/* User Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${roleColor} flex items-center justify-center shadow-lg`}>
                          <RoleIcon className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-800 mb-1">
                            {user.email || "Usuário sem email"}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-gray-500">ID:</span>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                              {user.id}
                            </code>
                            <button
                              onClick={() => copyUserId(user.id)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                              title="Copiar ID"
                            >
                              {copiedId === user.id ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-500" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Role Selector */}
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tipo de Acesso
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {Object.values(USER_ROLES).map((role) => {
                          const Icon = getRoleIcon(role);
                          const color = getRoleColor(role);
                          const isSelected = (user.role || USER_ROLES.READ_ONLY) === role;
                          
                          return (
                            <button
                              key={role}
                              onClick={() => handleRoleChange(user.id, role)}
                              disabled={saving[user.id]}
                              className={`
                                relative p-4 rounded-xl border-2 transition-all duration-200
                                ${isSelected
                                  ? `border-blue-500 bg-blue-50 shadow-md`
                                  : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                }
                                ${saving[user.id] ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                              `}
                            >
                              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-2 mx-auto`}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <p className="text-sm font-semibold text-gray-800 mb-1">
                                {getRoleLabel(role)}
                              </p>
                              {isSelected && (
                                <div className="absolute top-2 right-2">
                                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Permissions List */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Permissões Ativas ({userPermissions.length})
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {userPermissions.length > 0 ? (
                          userPermissions.map((permission) => (
                            <span
                              key={permission}
                              className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
                            >
                              {getPermissionLabel(permission)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">Nenhuma permissão ativa</span>
                        )}
                      </div>
                    </div>

                    {/* Role Description */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">
                        <strong>Descrição:</strong>{" "}
                        {user.role === USER_ROLES.ADMIN && "Acesso total ao sistema. Pode gerenciar usuários, itens, entradas, saídas e pedidos."}
                        {user.role === USER_ROLES.READ_ONLY && "Apenas visualização. Pode ver itens, relatórios e histórico, mas não pode fazer alterações."}
                        {user.role === USER_ROLES.ORDER_ONLY && "Pode visualizar itens e criar pedidos, mas não pode fazer entradas, saídas ou gerenciar pedidos."}
                        {user.role === USER_ROLES.ENTRY_MANAGER && "Pode criar entradas, visualizar itens, criar pedidos e gerenciar pedidos. Não pode criar saídas ou gerenciar usuários."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersManagement;

