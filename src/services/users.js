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
import { ADMIN_UID } from "../config/constants";

const USERS_COLLECTION = "users";

/**
 * Obtém o role de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<string>} Role do usuário ('admin' ou 'user')
 */
export const getUserRole = async (userId) => {
  try {
    if (!userId) return "user";
    
    const isInitialAdmin = userId === ADMIN_UID;
    
    // Se for o admin inicial, SEMPRE retornar "admin" primeiro
    // e depois tentar garantir que está salvo no banco
    if (isInitialAdmin) {
      try {
        const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
        
        if (userDoc.exists()) {
          const currentRole = userDoc.data().role || "user";
          
          // Se não tiver role "admin", atualizar
          if (currentRole !== "admin") {
            try {
              await updateDoc(doc(db, USERS_COLLECTION, userId), {
                role: "admin",
                updatedAt: serverTimestamp(),
              });
              console.log("✅ Role do administrador inicial atualizado para 'admin' no Firestore.");
            } catch (updateError) {
              console.warn("⚠️ Não foi possível atualizar o documento, mas o usuário é admin inicial:", updateError);
              // Continuar e retornar "admin" mesmo assim
            }
          }
        } else {
          // Criar documento do admin se não existir
          try {
            await setDoc(doc(db, USERS_COLLECTION, userId), {
              role: "admin",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            console.log("✅ Documento do administrador inicial criado no Firestore.");
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
      return "admin";
    }
    
    // Para outros usuários, buscar do banco normalmente
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    
    if (userDoc.exists()) {
      return userDoc.data().role || "user";
    }
    
    // Se não existe, criar com role "user"
    try {
      await setDoc(doc(db, USERS_COLLECTION, userId), {
        role: "user",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (createError) {
      console.error("Erro ao criar documento do usuário:", createError);
    }
    
    return "user";
  } catch (error) {
    console.error("Erro ao buscar role do usuário:", error);
    // Se for o admin inicial, SEMPRE retornar "admin" mesmo em caso de erro
    if (userId === ADMIN_UID) {
      return "admin";
    }
    return "user"; // Default para user em caso de erro
  }
};

/**
 * Verifica se um usuário é admin
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} true se for admin
 */
export const isUserAdmin = async (userId) => {
  const role = await getUserRole(userId);
  return role === "admin";
};

/**
 * Atualiza o role de um usuário (apenas admins podem fazer isso)
 * @param {string} userId - ID do usuário
 * @param {string} role - Novo role ('admin' ou 'user')
 * @param {string} updatedBy - ID do usuário que está fazendo a atualização
 * @returns {Promise<void>}
 */
export const updateUserRole = async (userId, role, updatedBy) => {
  try {
    if (!["admin", "user"].includes(role)) {
      throw new Error("Role inválido. Use 'admin' ou 'user'");
    }
    
    // Verificar se quem está atualizando é admin
    const updaterRole = await getUserRole(updatedBy);
    if (updaterRole !== "admin") {
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
 * Lista todos os usuários
 * @returns {Promise<Array>} Lista de usuários
 */
export const getAllUsers = async () => {
  try {
    const q = query(collection(db, USERS_COLLECTION));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
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
      if (currentRole === "admin") {
        console.log("Administrador já está configurado corretamente.");
        return;
      }
      
      // Atualizar para admin se não for
      // As regras do Firestore permitem que o admin inicial atualize seu próprio documento
      await updateDoc(doc(db, USERS_COLLECTION, adminUserId), {
        role: "admin",
        updatedAt: serverTimestamp(),
      });
      console.log("Role do administrador atualizado para 'admin'.");
    } else {
      // Criar documento do admin
      // As regras do Firestore permitem que o admin inicial crie seu documento como "admin"
      await setDoc(doc(db, USERS_COLLECTION, adminUserId), {
        role: "admin",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log("Administrador inicial criado com sucesso.");
    }
  } catch (error) {
    console.error("Erro ao inicializar administrador:", error);
    throw error;
  }
};

