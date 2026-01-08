import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { ADMIN_UID, USER_ROLES, ROLE_PERMISSIONS, PERMISSIONS } from "../config/constants";

const USERS_COLLECTION = "users";

/**
 * Atualiza ou cria o email do usuário no Firestore
 * @param {string} userId - ID do usuário
 * @param {string} email - Email do usuário
 * @returns {Promise<void>}
 */
export const updateUserEmail = async (userId, email) => {
  try {
    if (!userId || !email) return;
    
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (userDoc.exists()) {
      // Atualizar email se já existe documento
      const currentData = userDoc.data();
      if (currentData.email !== email) {
        await updateDoc(doc(db, USERS_COLLECTION, userId), {
          email,
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      // Criar documento com email se não existe
      await setDoc(doc(db, USERS_COLLECTION, userId), {
        email,
        role: USER_ROLES.READ_ONLY,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Erro ao atualizar email do usuário:", error);
    // Não lançar erro, é opcional
  }
};

/**
 * Obtém o role de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<string>} Role do usuário ('admin' ou 'user')
 */
export const getUserRole = async (userId) => {
  try {
    if (!userId) return USER_ROLES.READ_ONLY;
    
    const isInitialAdmin = userId === ADMIN_UID;
    
    // Se for o admin inicial, SEMPRE retornar "admin" primeiro
    // e depois tentar garantir que está salvo no banco
    if (isInitialAdmin) {
      try {
        const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
        
        if (userDoc.exists()) {
          const currentRole = userDoc.data().role || USER_ROLES.READ_ONLY;
          
          // Se não tiver role "admin", atualizar
          if (currentRole !== USER_ROLES.ADMIN) {
            try {
              await updateDoc(doc(db, USERS_COLLECTION, userId), {
                role: USER_ROLES.ADMIN,
                updatedAt: serverTimestamp(),
              });
            } catch (updateError) {
              console.warn("⚠️ Não foi possível atualizar o documento, mas o usuário é admin inicial:", updateError);
              // Continuar e retornar "admin" mesmo assim
            }
          }
        } else {
          // Criar documento do admin se não existir
          try {
            await setDoc(doc(db, USERS_COLLECTION, userId), {
              role: USER_ROLES.ADMIN,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (createError) {
            console.warn("⚠️ Não foi possível criar o documento, mas o usuário é admin inicial:", createError);
            // Continuar e retornar "admin" mesmo assim
          }
        }
      } catch (dbError) {
        console.warn("⚠️ Erro ao acessar Firestore, mas o usuário é admin inicial:", dbError);
        // Continuar e retornar "admin" mesmo assim
      }
      
      // SEMPRE retornar "admin" se for o admin inicial
      return USER_ROLES.ADMIN;
    }
    
    // Para outros usuários, buscar do banco normalmente
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    
    if (userDoc.exists()) {
      return userDoc.data().role || USER_ROLES.READ_ONLY;
    }
    
    // Se não existe, criar com role "read_only" (padrão)
    // Nota: O email será atualizado quando o usuário fizer login
    try {
      await setDoc(doc(db, USERS_COLLECTION, userId), {
        role: USER_ROLES.READ_ONLY,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (createError) {
      console.error("Erro ao criar documento do usuário:", createError);
    }
    
    return USER_ROLES.READ_ONLY;
  } catch (error) {
    console.error("Erro ao buscar role do usuário:", error);
    // Se for o admin inicial, SEMPRE retornar "admin" mesmo em caso de erro
    if (userId === ADMIN_UID) {
      return USER_ROLES.ADMIN;
    }
    return USER_ROLES.READ_ONLY; // Default para read_only em caso de erro
  }
};

/**
 * Verifica se um usuário é admin
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} true se for admin
 */
export const isUserAdmin = async (userId) => {
  const role = await getUserRole(userId);
  return role === USER_ROLES.ADMIN;
};

/**
 * Atualiza o role de um usuário (apenas admins podem fazer isso)
 * @param {string} userId - ID do usuário
 * @param {string} role - Novo role
 * @param {string} updatedBy - ID do usuário que está fazendo a atualização
 * @returns {Promise<void>}
 */
export const updateUserRole = async (userId, role, updatedBy) => {
  try {
    const validRoles = Object.values(USER_ROLES);
    if (!validRoles.includes(role)) {
      throw new Error(`Role inválido. Use: ${validRoles.join(", ")}`);
    }
    
    // Verificar se quem está atualizando é admin
    const updaterRole = await getUserRole(updatedBy);
    if (updaterRole !== USER_ROLES.ADMIN) {
      throw new Error("Apenas administradores podem atualizar roles");
    }
    
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      role,
      updatedAt: serverTimestamp(),
      updatedBy,
    });
  } catch (error) {
    console.error("Erro ao atualizar role do usuário:", error);
    throw error;
  }
};

/**
 * Obtém as permissões de um usuário baseado no seu role e permissões customizadas
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array<string>>} Lista de permissões
 */
export const getUserPermissions = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (!userDoc.exists()) {
      const role = await getUserRole(userId);
      return ROLE_PERMISSIONS[role] || [];
    }
    
    const userData = userDoc.data();
    const role = userData.role || USER_ROLES.READ_ONLY;
    
    // Se tiver permissões customizadas, usar elas (sobrescreve o role)
    if (userData.customPermissions && Array.isArray(userData.customPermissions)) {
      return userData.customPermissions;
    }
    
    // Caso contrário, usar permissões do role
    return ROLE_PERMISSIONS[role] || [];
  } catch (error) {
    console.error("Erro ao buscar permissões do usuário:", error);
    const role = await getUserRole(userId);
    return ROLE_PERMISSIONS[role] || [];
  }
};

/**
 * Verifica se um usuário tem uma permissão específica
 * @param {string} userId - ID do usuário
 * @param {string} permission - Permissão a verificar
 * @returns {Promise<boolean>} true se tiver a permissão
 */
export const hasPermission = async (userId, permission) => {
  try {
    const permissions = await getUserPermissions(userId);
    return permissions.includes(permission);
  } catch (error) {
    console.error("Erro ao verificar permissão:", error);
    return false;
  }
};

/**
 * Atualiza permissões customizadas de um usuário (apenas admins)
 * @param {string} userId - ID do usuário
 * @param {Array<string>} customPermissions - Lista de permissões customizadas
 * @param {string} updatedBy - ID do usuário que está fazendo a atualização
 * @returns {Promise<void>}
 */
export const updateUserPermissions = async (userId, customPermissions, updatedBy) => {
  try {
    // Verificar se quem está atualizando é admin
    const updaterRole = await getUserRole(updatedBy);
    if (updaterRole !== USER_ROLES.ADMIN) {
      throw new Error("Apenas administradores podem atualizar permissões");
    }
    
    // Validar permissões
    const validPermissions = Object.values(PERMISSIONS);
    const invalidPermissions = customPermissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      throw new Error(`Permissões inválidas: ${invalidPermissions.join(", ")}`);
    }
    
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      customPermissions,
      updatedAt: serverTimestamp(),
      updatedBy,
    });
  } catch (error) {
    console.error("Erro ao atualizar permissões do usuário:", error);
    throw error;
  }
};

/**
 * Lista todos os usuários com informações do Firebase Auth
 * @returns {Promise<Array>} Lista de usuários com email e informações
 */
export const getAllUsers = async () => {
  try {
    const q = query(collection(db, USERS_COLLECTION));
    const querySnapshot = await getDocs(q);
    const users = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Buscar emails do Firebase Auth (se disponível)
    // Nota: Para buscar emails, seria necessário usar Admin SDK ou Cloud Functions
    // Por enquanto, retornamos apenas os dados do Firestore
    
    return users;
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    throw error;
  }
};

/**
 * Obtém informações completas de um usuário incluindo permissões
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Dados completos do usuário
 */
export const getUserInfo = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    // Buscar permissões (considera customPermissions se existir)
    const permissions = await getUserPermissions(userId);
    
    return {
      id: userDoc.id,
      ...userData,
      permissions,
    };
  } catch (error) {
    console.error("Erro ao buscar informações do usuário:", error);
    throw error;
  }
};

/**
 * Inicializa o usuário administrador no Firestore
 * Esta função pode ser chamada manualmente para garantir que o admin está configurado
 * Pode ser chamada pelo próprio admin inicial mesmo que ainda não tenha role "admin"
 * @param {string} adminUserId - ID do usuário administrador (padrão: ADMIN_UID)
 * @returns {Promise<void>}
 */
export const initializeAdmin = async (adminUserId = ADMIN_UID) => {
  try {
    if (!adminUserId) {
      throw new Error("ID do administrador não fornecido");
    }
    
    // Verificar se é o admin inicial
    if (adminUserId !== ADMIN_UID) {
      throw new Error("Esta função só pode ser usada para inicializar o administrador inicial");
    }
    
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, adminUserId));
    
    if (userDoc.exists()) {
      const currentRole = userDoc.data().role;
      if (currentRole === USER_ROLES.ADMIN) {
        return;
      }
      
      // Atualizar para admin se não for
      // As regras do Firestore permitem que o admin inicial atualize seu próprio documento
      await updateDoc(doc(db, USERS_COLLECTION, adminUserId), {
        role: USER_ROLES.ADMIN,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Criar documento do admin
      // As regras do Firestore permitem que o admin inicial crie seu documento como "admin"
      await setDoc(doc(db, USERS_COLLECTION, adminUserId), {
        role: USER_ROLES.ADMIN,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Erro ao inicializar administrador:", error);
    throw error;
  }
};

