import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ItemsProvider } from "./context/ItemsContext";
import { ToastProvider } from "./context/ToastContext";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import ConnectionIndicator from "./components/ConnectionIndicator";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Items from "./pages/Items";
import NewItem from "./pages/NewItem";
import EditItem from "./pages/EditItem";
import Entry from "./pages/Entry";
import Exit from "./pages/Exit";
import EntriesHistory from "./pages/EntriesHistory";
import ExitsHistory from "./pages/ExitsHistory";
import Reports from "./pages/Reports";
import Orders from "./pages/Orders";
import OrdersManagement from "./pages/OrdersManagement";
import UsersManagement from "./pages/UsersManagement";
import StockAdjustment from "./pages/StockAdjustment";
import { PERMISSIONS } from "./config/constants";

// Componente para proteger rotas (apenas autenticação)
const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

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

  return currentUser ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <div className="min-h-screen bg-gray-50" translate="no">
      <ConnectionIndicator />
      {!isLoginPage && <Navbar />}
      <div className={isLoginPage ? "" : "flex"}>
        {!isLoginPage && <Sidebar />}
        <div className={isLoginPage ? "" : "flex-1"}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_DASHBOARD}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/items"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_ITEMS}>
                  <Items />
                </ProtectedRoute>
              }
            />
            <Route
              path="/new-item"
              element={
                <ProtectedRoute permission={PERMISSIONS.CREATE_ITEMS}>
                  <NewItem />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-item/:id"
              element={
                <ProtectedRoute permission={PERMISSIONS.EDIT_ITEMS}>
                  <EditItem />
                </ProtectedRoute>
              }
            />
            <Route
              path="/entry"
              element={
                <ProtectedRoute permission={PERMISSIONS.CREATE_ENTRY}>
                  <Entry />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exit"
              element={
                <ProtectedRoute permission={PERMISSIONS.CREATE_EXIT}>
                  <Exit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/entries-history"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_ENTRIES_HISTORY}>
                  <EntriesHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/exits-history"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_EXITS_HISTORY}>
                  <ExitsHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute permission={PERMISSIONS.CREATE_ORDER}>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders-management"
              element={
                <ProtectedRoute permission={PERMISSIONS.MANAGE_ORDERS}>
                  <OrdersManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users-management"
              element={
                <ProtectedRoute permission={PERMISSIONS.MANAGE_USERS}>
                  <UsersManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock-adjustment"
              element={
                <ProtectedRoute permission={PERMISSIONS.ADJUST_STOCK}>
                  <StockAdjustment />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/items" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ItemsProvider>
        <ToastProvider>
          <Router>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </Router>
        </ToastProvider>
      </ItemsProvider>
    </AuthProvider>
  );
}

export default App;
