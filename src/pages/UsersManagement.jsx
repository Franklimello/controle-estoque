import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import { getAllUsers, updateUserPermissions, getUserInfo } from "../services/users";
import { PERMISSIONS } from "../config/constants";
import { Users, Save, Copy, Check, CheckSquare, Square } from "lucide-react";
import { getErrorMessage } from "../utils/errorHandler";

const UsersManagement = () => {
  const { currentUser, isAdmin, refreshPermissions } = useAuth();
  const { success, error: showError } = useToastContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState({}); // { userId: [permissions] }

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
          const permissions = info?.permissions || [];
          return {
            ...user,
            email: user.email || `Usuário ${user.id.substring(0, 8)}...`,
            permissions,
          };
        })
      );
      
      setUsers(usersWithInfo);
      
      // Inicializar permissões selecionadas com as permissões atuais de cada usuário
      const initialPermissions = {};
      usersWithInfo.forEach((user) => {
        initialPermissions[user.id] = user.permissions || [];
      });
      setSelectedPermissions(initialPermissions);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      showError("Erro ao carregar usuários: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (userId, permission) => {
    setSelectedPermissions((prev) => {
      const current = prev[userId] || [];
      const isSelected = current.includes(permission);
      
      return {
        ...prev,
        [userId]: isSelected
          ? current.filter((p) => p !== permission)
          : [...current, permission],
      };
    });
  };

  const handleSavePermissions = async (userId) => {
    if (!currentUser) return;
    
    try {
      setSaving((prev) => ({ ...prev, [userId]: true }));
      const permissions = selectedPermissions[userId] || [];
      await updateUserPermissions(userId, permissions, currentUser.uid);
      success(`Permissões do usuário atualizadas com sucesso!`);
      await loadUsers();
    } catch (error) {
      console.error("Erro ao atualizar permissões:", error);
      showError("Erro ao atualizar permissões: " + getErrorMessage(error));
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
      [PERMISSIONS.ADJUST_STOCK]: "Ajustar Estoque",
    };
    return labels[permission] || permission;
  };

  const getPermissionGroup = (permission) => {
    if (permission.startsWith("view_")) return "Visualização";
    if (permission.startsWith("create_") || permission.startsWith("edit_") || permission.startsWith("delete_")) return "Ações";
    if (permission.startsWith("manage_")) return "Gerenciamento";
    return "Outros";
  };

  // Agrupar permissões por categoria
  const groupedPermissions = Object.values(PERMISSIONS).reduce((acc, permission) => {
    const group = getPermissionGroup(permission);
    if (!acc[group]) acc[group] = [];
    acc[group].push(permission);
    return acc;
  }, {});

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
              const userSelectedPermissions = selectedPermissions[user.id] || [];
              const hasChanges = JSON.stringify(userSelectedPermissions.sort()) !== JSON.stringify((user.permissions || []).sort());
              
              return (
                <div
                  key={user.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden"
                >
                  <div className="p-6">
                    {/* User Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                          <Users className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-800 mb-1">
                            {user.email || `Usuário ${user.id.substring(0, 8)}...`}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap mt-2">
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

                    {/* Permissions Checkboxes */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-4">
                        Permissões de Acesso
                      </label>
                      
                      <div className="space-y-6">
                        {Object.entries(groupedPermissions).map(([groupName, permissions]) => (
                          <div key={groupName} className="border border-gray-200 rounded-lg p-4">
                            <h4 className="text-sm font-bold text-gray-700 mb-3 pb-2 border-b border-gray-200">
                              {groupName}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {permissions.map((permission) => {
                                const isChecked = userSelectedPermissions.includes(permission);
                                return (
                                  <label
                                    key={permission}
                                    className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50"
                                    style={{
                                      borderColor: isChecked ? "#3b82f6" : "#e5e7eb",
                                      backgroundColor: isChecked ? "#eff6ff" : "transparent",
                                    }}
                                  >
                                    <div className="flex-shrink-0">
                                      {isChecked ? (
                                        <CheckSquare className="w-5 h-5 text-blue-600" />
                                      ) : (
                                        <Square className="w-5 h-5 text-gray-400" />
                                      )}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 flex-1">
                                      {getPermissionLabel(permission)}
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handlePermissionToggle(user.id, permission)}
                                      className="sr-only"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold">
                          {userSelectedPermissions.length} permissão(ões) selecionada(s)
                        </span>
                        {hasChanges && (
                          <span className="ml-2 text-orange-600 font-medium">
                            (alterações não salvas)
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleSavePermissions(user.id)}
                        disabled={saving[user.id] || !hasChanges}
                        className={`
                          flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all
                          ${hasChanges && !saving[user.id]
                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }
                        `}
                      >
                        <Save className="w-4 h-4" />
                        {saving[user.id] ? "Salvando..." : "Salvar Permissões"}
                      </button>
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

