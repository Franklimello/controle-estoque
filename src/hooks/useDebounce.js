import { useEffect, useRef } from "react";

/**
 * Hook para debounce de valores
 * @param {Function} callback - Função a ser executada após o delay
 * @param {number} delay - Delay em milissegundos (padrão: 500ms)
 * @returns {Function} Função para cancelar o debounce
 */
export const useDebounce = (callback, delay = 500) => {
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = (...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };

  const cancel = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return { debouncedCallback, cancel };
};

