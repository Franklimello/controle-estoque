import { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { getUserRole, initializeAdmin, getUserPermissions, updateUserEmail } from "../services/users";
import { ADMIN_UID, USER_ROLES, PERMISSIONS, ROLE_PERMISSIONS } from "../config/constants";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState(USER_ROLES.READ_ONLY);
  const [userPermissions, setUserPermissions] = useState([]);

  // Função para carregar permissões do usuário
  const loadUserPermissions = async (userId) => {
    try {
      const role = await getUserRole(userId);
      const adminStatus = role === USER_ROLES.ADMIN;
      
      // Buscar permissões do usuário
      let permissions = await getUserPermissions(userId);
      
      // Se for admin inicial mas não foi reconhecido, forçar admin e todas as permissões
      if (userId === ADMIN_UID && !adminStatus) {
        console.warn("⚠️ ATENÇÃO: Usuário é o admin inicial mas não foi reconhecido como admin!");
        console.warn("⚠️ Forçando role 'admin' localmente...");
        // Forçar admin localmente mesmo se o banco não atualizou
        setUserRole(USER_ROLES.ADMIN);
        setIsAdmin(true);
        // Admin tem todas as permissões
        permissions = Object.values(PERMISSIONS);
      } else {
        setUserRole(role);
        setIsAdmin(adminStatus);
        setUserPermissions(permissions);
      }
    } catch (error) {
      console.error("❌ Erro ao buscar permissões do usuário:", error);
      // Se for o admin inicial, garantir que seja admin mesmo com erro
      if (userId === ADMIN_UID) {
        setUserRole(USER_ROLES.ADMIN);
        setIsAdmin(true);
        setUserPermissions(Object.values(PERMISSIONS));
      } else {
        setUserRole(USER_ROLES.READ_ONLY);
        setIsAdmin(false);
        setUserPermissions([]);
      }
    }
  };

  useEffect(() => {
    let unsubscribeAuth = null;
    let unsubscribeUserDoc = null;

    unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      // Limpar listener anterior se existir
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }
      
      if (user) {
        try {
          // Atualizar email do usuário no Firestore se disponível
          if (user.email) {
            try {
              await updateUserEmail(user.uid, user.email);
            } catch (emailError) {
              // Silenciar erro, não é crítico
            }
          }
          
          // Se for o admin inicial, tentar inicializar explicitamente
          if (user.uid === ADMIN_UID) {
            try {
              await initializeAdmin(user.uid);
            } catch (initError) {
              console.warn("⚠️ Erro ao inicializar admin (continuando mesmo assim):", initError);
            }
          }
          
          // Carregar permissões iniciais
          await loadUserPermissions(user.uid);
          
          // 🔄 Listener em tempo real para mudanças no documento do usuário
          unsubscribeUserDoc = onSnapshot(
            doc(db, "users", user.uid),
            async (docSnapshot) => {
              if (docSnapshot.exists()) {
                const userData = docSnapshot.data();
                
                // Atualizar role se mudou
                const newRole = userData.role || USER_ROLES.READ_ONLY;
                const adminStatus = newRole === USER_ROLES.ADMIN;
                
                setUserRole(newRole);
                setIsAdmin(adminStatus);
                
                // Atualizar permissões
                if (userData.customPermissions && Array.isArray(userData.customPermissions)) {
                  // Usar permissões customizadas
                  setUserPermissions(userData.customPermissions);
                } else {
                  // Usar permissões do role
                  const rolePermissions = ROLE_PERMISSIONS[newRole] || [];
                  setUserPermissions(rolePermissions);
                }
                
                // Se for admin inicial, garantir todas as permissões
                if (user.uid === ADMIN_UID) {
                  setUserRole(USER_ROLES.ADMIN);
                  setIsAdmin(true);
                  setUserPermissions(Object.values(PERMISSIONS));
                }
              } else {
                // Documento não existe, usar valores padrão
                await loadUserPermissions(user.uid);
              }
            },
            (error) => {
              console.error("Erro no listener de permissões:", error);
              // Em caso de erro, tentar carregar permissões normalmente
              loadUserPermissions(user.uid);
            }
          );
        } catch (error) {
          console.error("❌ Erro ao inicializar usuário:", error);
          // Se for o admin inicial, garantir que seja admin mesmo com erro
          if (user.uid === ADMIN_UID) {
            setUserRole(USER_ROLES.ADMIN);
            setIsAdmin(true);
            setUserPermissions(Object.values(PERMISSIONS));
          } else {
            setUserRole(USER_ROLES.READ_ONLY);
            setIsAdmin(false);
            setUserPermissions([]);
          }
        }
      } else {
        setUserRole(USER_ROLES.READ_ONLY);
        setIsAdmin(false);
        setUserPermissions([]);
      }
      
      setLoading(false);
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Função helper para verificar permissões
  const hasPermission = (permission) => {
    if (isAdmin) return true; // Admin tem todas as permissões
    return userPermissions.includes(permission);
  };

  // Função para atualizar permissões em tempo real (útil quando admin atualiza permissões)
  const refreshPermissions = async () => {
    if (!currentUser) return;
    
    try {
      const role = await getUserRole(currentUser.uid);
      setUserRole(role);
      const adminStatus = role === USER_ROLES.ADMIN;
      setIsAdmin(adminStatus);
      
      const permissions = await getUserPermissions(currentUser.uid);
      setUserPermissions(permissions);
    } catch (error) {
      console.error("Erro ao atualizar permissões:", error);
    }
  };

  const value = {
    currentUser,
    isAdmin,
    userRole,
    userPermissions,
    hasPermission,
    refreshPermissions,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};


