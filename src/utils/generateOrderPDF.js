import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "./validators";

export const generateOrderPDF = (order) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(10);
  doc.text("SECRETARIA MUNICIPAL DE SAÚDE", 105, 10, null, null, "center");
  doc.text("PREFEITURA MUNICIPAL DE LAJINHA - MG", 105, 15, null, null, "center");
  doc.text("Rua Nestor Vieira de Gouveia, 69 – CEP 36980-000 – Lajinha/MG", 105, 20, null, null, "center");
  doc.text("CNPJ: 18.392.522/0001-41", 105, 25, null, null, "center");

  doc.setFontSize(14);
  doc.text("PEDIDO DE MATERIAL", 105, 40, null, null, "center");

  doc.setFontSize(10);
  doc.text(`Pedido #: ${order.id.substring(0, 8)}`, 14, 50);
  doc.text(`Data: ${formatDate(order.createdAt)}`, 14, 55);
  doc.text(`Solicitante: ${order.solicitadoPorNome || "N/A"}`, 14, 60);
  doc.text(`Setor: ${order.setorDestino || "N/A"}`, 14, 65);
  if (order.whatsappSolicitante) {
    doc.text(`WhatsApp: ${order.whatsappSolicitante}`, 14, 70);
  }
  if (order.observacao) {
    doc.text(`Observação: ${order.observacao}`, 14, 75);
  }
  if (order.observacaoAdmin) {
    doc.text(`Obs. Admin: ${order.observacaoAdmin}`, 14, 80);
  }

  // Items Table
  const tableColumn = ["Item", "Produto", "Quantidade", "Unidade"];
  const tableRows = [];

  order.itens.forEach(item => {
    const itemData = [
      item.itemId ? item.itemId.substring(0, 8) : "N/A",
      item.nome || item.nomeProduto,
      item.quantidade,
      item.unidade || "UN"
    ];
    tableRows.push(itemData);
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 90,
    headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0] },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { top: 10 }
  });

  // Signature Line - calcular posição final baseado na altura da tabela
  // Altura aproximada: cabeçalho (8px) + linhas (6px cada) + margem
  const tableHeight = 8 + (tableRows.length * 6) + 10;
  const finalY = 90 + tableHeight + 20;
  doc.text(`Lajinha/MG, ${new Date().toLocaleDateString('pt-BR')}`, 14, finalY);
  doc.text("________________________________________", 14, finalY + 10);
  doc.text("Responsável pela separação", 14, finalY + 15);

  doc.text("________________________________________", 105, finalY + 10);
  doc.text("Assinatura do Solicitante", 105, finalY + 15);

  doc.save(`Pedido_${order.id.substring(0, 8)}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
};

