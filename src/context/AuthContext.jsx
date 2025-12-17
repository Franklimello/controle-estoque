import { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { getUserRole, initializeAdmin, getUserPermissions } from "../services/users";
import { ADMIN_UID, USER_ROLES, PERMISSIONS } from "../config/constants";

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          console.log("🔍 Verificando role do usuário:", user.uid);
          console.log("🔑 ADMIN_UID configurado:", ADMIN_UID);
          console.log("🔐 É o admin inicial?", user.uid === ADMIN_UID);
          
          // Se for o admin inicial, tentar inicializar explicitamente
          if (user.uid === ADMIN_UID) {
            try {
              console.log("🔧 Inicializando administrador...");
              await initializeAdmin(user.uid);
              console.log("✅ Administrador inicializado com sucesso");
            } catch (initError) {
              console.warn("⚠️ Erro ao inicializar admin (continuando mesmo assim):", initError);
            }
          }
          
          const role = await getUserRole(user.uid);
          console.log("✅ Role obtido:", role);
          setUserRole(role);
          const adminStatus = role === USER_ROLES.ADMIN;
          setIsAdmin(adminStatus);
          console.log("👤 Usuário é admin?", adminStatus);
          
          // Buscar permissões do usuário
          let permissions = await getUserPermissions(user.uid);
          
          // Se for admin inicial mas não foi reconhecido, forçar admin e todas as permissões
          if (user.uid === ADMIN_UID && !adminStatus) {
            console.warn("⚠️ ATENÇÃO: Usuário é o admin inicial mas não foi reconhecido como admin!");
            console.warn("⚠️ Forçando role 'admin' localmente...");
            // Forçar admin localmente mesmo se o banco não atualizou
            setUserRole(USER_ROLES.ADMIN);
            setIsAdmin(true);
            // Admin tem todas as permissões
            permissions = Object.values(PERMISSIONS);
          }
          
          setUserPermissions(permissions);
          console.log("🔐 Permissões do usuário:", permissions);
        } catch (error) {
          console.error("❌ Erro ao buscar role do usuário:", error);
          // Se for o admin inicial, garantir que seja admin mesmo com erro
          if (user.uid === ADMIN_UID) {
            console.log("🔧 Forçando role 'admin' para administrador inicial devido a erro");
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

    return unsubscribe;
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

  const value = {
    currentUser,
    isAdmin,
    userRole,
    userPermissions,
    hasPermission,
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


