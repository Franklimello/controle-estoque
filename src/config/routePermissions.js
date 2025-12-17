import { PERMISSIONS } from "./constants";

/**
 * Mapeamento de rotas para permissões necessárias
 * Cada rota pode ter uma ou mais permissões
 * Se múltiplas permissões, o usuário precisa ter pelo menos uma (OR)
 */
export const ROUTE_PERMISSIONS = {
  "/dashboard": PERMISSIONS.VIEW_DASHBOARD,
  "/items": PERMISSIONS.VIEW_ITEMS,
  "/new-item": PERMISSIONS.CREATE_ITEMS,
  "/edit-item": PERMISSIONS.EDIT_ITEMS,
  "/entry": PERMISSIONS.CREATE_ENTRY,
  "/exit": PERMISSIONS.CREATE_EXIT,
  "/entries-history": PERMISSIONS.VIEW_ENTRIES_HISTORY,
  "/exits-history": PERMISSIONS.VIEW_EXITS_HISTORY,
  "/reports": PERMISSIONS.VIEW_REPORTS,
  "/orders": PERMISSIONS.CREATE_ORDER,
  "/orders-management": PERMISSIONS.MANAGE_ORDERS,
  "/users-management": PERMISSIONS.MANAGE_USERS,
};

/**
 * Verifica se uma rota requer permissão específica
 * @param {string} path - Caminho da rota
 * @returns {string|Array<string>|null} Permissão(ões) necessária(s) ou null se não requer
 */
export const getRoutePermission = (path) => {
  // Remover parâmetros da rota (ex: /edit-item/:id -> /edit-item)
  const basePath = path.split("/").slice(0, 3).join("/");
  
  // Verificar correspondência exata primeiro
  if (ROUTE_PERMISSIONS[path]) {
    return ROUTE_PERMISSIONS[path];
  }
  
  // Verificar correspondência parcial para rotas com parâmetros
  for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
    if (path.startsWith(route) || basePath.startsWith(route)) {
      return permission;
    }
  }
  
  return null;
};





