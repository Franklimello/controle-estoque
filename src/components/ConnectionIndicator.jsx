import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";

/**
 * Componente que indica o status da conexão com a internet
 */
const ConnectionIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowNotification(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showNotification && isOnline) {
    return null;
  }

  return (
    <div
      className={`fixed top-20 right-4 z-50 transition-all duration-300 ${
        showNotification ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
      }`}
    >
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
          isOnline
            ? "bg-green-500 text-white"
            : "bg-red-500 text-white"
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="w-5 h-5" />
            <span className="font-medium">Conexão restaurada</span>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">Sem conexão com a internet</span>
          </>
        )}
      </div>
    </div>
  );
};

export default ConnectionIndicator;






