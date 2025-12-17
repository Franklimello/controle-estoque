import { useState, useEffect, useRef } from "react";

/**
 * Hook para cache de dados com TTL (Time To Live)
 * @param {Function} fetchFunction - Função que busca os dados
 * @param {number} ttl - Tempo de vida do cache em milissegundos (padrão: 5 minutos)
 * @param {Array} dependencies - Dependências para invalidar o cache
 * @returns {Object} { data, loading, error, refetch }
 */
export const useCache = (fetchFunction, ttl = 5 * 60 * 1000, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef({ data: null, timestamp: null });
  const mountedRef = useRef(true);

  const fetchData = async (force = false) => {
    const now = Date.now();
    const cache = cacheRef.current;

    // Se tem cache válido e não é forçado, retorna cache
    if (!force && cache.data && cache.timestamp && (now - cache.timestamp) < ttl) {
      setData(cache.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFunction();
      
      if (mountedRef.current) {
        cacheRef.current = {
          data: result,
          timestamp: now,
        };
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setData(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
    };
  }, dependencies);

  const refetch = () => fetchData(true);
  const clearCache = () => {
    cacheRef.current = { data: null, timestamp: null };
  };

  return { data, loading, error, refetch, clearCache };
};

