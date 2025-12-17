/**
 * Configurações do sistema de estoque
 */

// Limite mínimo de estoque para considerar como "estoque baixo"
export const ESTOQUE_BAIXO_LIMITE = 50;

// Dias antes do vencimento para considerar como "vencimento próximo"
export const VENCIMENTO_PROXIMO_DIAS = 90;

// Usuário administrador autorizado a criar/editar/excluir
export const ADMIN_UID = "xaFyAiOHhiWEPaWElr7REqGxBXX2";

// Tipos de roles/permissões disponíveis
export const USER_ROLES = {
  ADMIN: "admin",           // Acesso total
  READ_ONLY: "read_only",   // Apenas leitura
  ORDER_ONLY: "order_only", // Apenas fazer pedidos
  ENTRY_MANAGER: "entry_manager" // Entrada + leitura + gerenciar pedidos
};

// Permissões por funcionalidade
export const PERMISSIONS = {
  // Visualização
  VIEW_ITEMS: "view_items",
  VIEW_DASHBOARD: "view_dashboard",
  VIEW_REPORTS: "view_reports",
  VIEW_ENTRIES_HISTORY: "view_entries_history",
  VIEW_EXITS_HISTORY: "view_exits_history",
  
  // Ações
  CREATE_ITEMS: "create_items",
  EDIT_ITEMS: "edit_items",
  DELETE_ITEMS: "delete_items",
  CREATE_ENTRY: "create_entry",
  CREATE_EXIT: "create_exit",
  CREATE_ORDER: "create_order",
  MANAGE_ORDERS: "manage_orders",
  MANAGE_USERS: "manage_users"
};

// Mapeamento de roles para permissões
export const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: Object.values(PERMISSIONS), // Admin tem todas as permissões
  
  [USER_ROLES.READ_ONLY]: [
    PERMISSIONS.VIEW_ITEMS,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_ENTRIES_HISTORY,
    PERMISSIONS.VIEW_EXITS_HISTORY
  ],
  
  [USER_ROLES.ORDER_ONLY]: [
    PERMISSIONS.VIEW_ITEMS,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.CREATE_ORDER
  ],
  
  [USER_ROLES.ENTRY_MANAGER]: [
    PERMISSIONS.VIEW_ITEMS,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_ENTRIES_HISTORY,
    PERMISSIONS.VIEW_EXITS_HISTORY,
    PERMISSIONS.CREATE_ENTRY,
    PERMISSIONS.CREATE_ORDER,
    PERMISSIONS.MANAGE_ORDERS
  ]
};

// Outras constantes podem ser adicionadas aqui
// export const OUTRA_CONSTANTE = valor;

