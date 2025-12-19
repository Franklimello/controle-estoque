import { useState, useMemo } from "react";

/**
 * Hook para paginação de listas
 * @param {Array} items - Lista de itens para paginar
 * @param {number} itemsPerPage - Número de itens por página (padrão: 10)
 * @returns {Object} { currentItems, currentPage, totalPages, goToPage, nextPage, prevPage, setItemsPerPage }
 */
export const usePagination = (items = [], itemsPerPage = 10) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(itemsPerPage);

  const totalPages = useMemo(() => {
    return Math.ceil(items.length / perPage);
  }, [items.length, perPage]);

  const currentItems = useMemo(() => {
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = startIndex + perPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, perPage]);

  const goToPage = (page) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNumber);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const setItemsPerPage = (newPerPage) => {
    setPerPage(newPerPage);
    setCurrentPage(1); // Reset para primeira página
  };

  // Reset para primeira página quando a lista mudar
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  return {
    currentItems,
    currentPage,
    totalPages,
    itemsPerPage: perPage,
    goToPage,
    nextPage,
    prevPage,
    setItemsPerPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
};







