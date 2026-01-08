import { Package, AlertTriangle, Clock } from "lucide-react";
import { formatDate } from "../utils/validators";
import { ESTOQUE_BAIXO_LIMITE } from "../config/constants";
import { checkExpiringDate, formatExpiryDate } from "../utils/dateUtils";

const ItemCard = ({ item, onClick, clickable = true, badge, badgeColor }) => {
  const isLowStock = (item.quantidade || 0) <= ESTOQUE_BAIXO_LIMITE;
  const expiryInfo = checkExpiringDate(item.validade);
  const hasWarning = isLowStock || expiryInfo.isExpiring || expiryInfo.isExpired;
  const isExpiringOrExpired = expiryInfo.isExpiring || expiryInfo.isExpired;

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`item-card bg-white rounded-lg shadow-md p-6 relative overflow-hidden transition-all duration-300 ${
        clickable 
          ? "cursor-pointer hover:scale-[1.02] hover:shadow-xl hover-lift border-l-4" 
          : "cursor-default opacity-90 border-l-4"
      } ${
        isExpiringOrExpired
          ? clickable 
            ? "border-red-500 hover:border-red-600" 
            : "border-red-500"
          : isLowStock
          ? clickable
            ? "border-orange-500 hover:border-orange-600"
            : "border-orange-500"
          : clickable
            ? "border-green-500 hover:border-green-600"
            : "border-green-500"
      }`}
    >
      {clickable && (
        <div className={`item-card-ring ${isExpiringOrExpired ? "text-red-600" : isLowStock ? "text-orange-600" : "text-blue-600"}`}>
          <i></i>
          <i></i>
        </div>
      )}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`p-3 rounded-full ${
              isExpiringOrExpired ? "bg-red-100" : isLowStock ? "bg-orange-100" : "bg-blue-100"
            }`}
          >
            <Package
              className={`w-6 h-6 ${
                isExpiringOrExpired ? "text-red-600" : isLowStock ? "text-orange-600" : "text-blue-600"
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {item.isGroupChild && (
                <div className="flex items-center">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <div className="w-0.5 h-full bg-blue-400"></div>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 -ml-1"></div>
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-800">
                {item.nome}
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {item.isExpanded && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  Lote
                </span>
              )}
              <p className="text-sm text-gray-500">
                Código: {item.codigo || "Sem código"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isLowStock && (
            <div
              className="flex items-center space-x-1 text-orange-500"
              title="Estoque baixo"
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          {expiryInfo.isExpiring && !expiryInfo.isExpired && (
            <div
              className="flex items-center space-x-1 text-red-500"
              title={`Vence em ${expiryInfo.daysUntilExpiry} dias`}
            >
              <Clock className="w-5 h-5" />
            </div>
          )}
          {expiryInfo.isExpired && (
            <div
              className="flex items-center space-x-1 text-red-600"
              title="Vencido"
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Categoria:</span>
          <span className="font-medium">{item.categoria || "N/A"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Unidade:</span>
          <span className="font-medium">{item.unidade || "UN"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Local:</span>
          <span className="font-medium">{item.local || "N/A"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Fornecedor:</span>
          <span className="font-medium">{item.fornecedor || "N/A"}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-gray-600 font-medium">Estoque:</span>
          <div className="text-right">
            <span
              className={`text-xl font-bold ${
                isLowStock ? "text-orange-600" : "text-green-600"
              }`}
            >
              {item.quantidade || 0} {item.unidade || "UN"}
            </span>
            {item.isExpanded && item.quantidadeTotal && (
              <p className="text-xs text-gray-500 mt-1">
                Total: {item.quantidadeTotal} {item.unidade || "UN"}
              </p>
            )}
          </div>
        </div>
        {item.validade && (
          <div
            className={`flex justify-between items-center pt-2 border-t ${
              expiryInfo.isExpired
                ? "bg-red-50 p-2 rounded"
                : expiryInfo.isExpiring
                ? "bg-red-50 p-2 rounded"
                : ""
            }`}
          >
            <span className="text-gray-600 font-medium">Validade:</span>
            <span
              className={`font-bold ${
                expiryInfo.isExpired
                  ? "text-red-600"
                  : expiryInfo.isExpiring
                  ? "text-red-600"
                  : "text-gray-800"
              }`}
            >
              {formatExpiryDate(item.validade)}
              {expiryInfo.isExpired && " (VENCIDO)"}
              {expiryInfo.isExpiring &&
                !expiryInfo.isExpired &&
                ` (${expiryInfo.daysUntilExpiry} dias)`}
            </span>
          </div>
        )}
        {item.updatedAt && (
          <p className="text-xs text-gray-400 mt-2">
            Atualizado: {formatDate(item.updatedAt)}
          </p>
        )}
        {badge && (
          <span
            className={`inline-block mt-3 px-3 py-1 text-xs font-semibold rounded ${badgeColor || "bg-gray-200 text-gray-800"}`}
          >
            {badge}
          </span>
        )}
        {!clickable && (
          <p className="text-[11px] text-gray-400 mt-2">Somente leitura</p>
        )}
      </div>
    </div>
  );
};

export default ItemCard;

