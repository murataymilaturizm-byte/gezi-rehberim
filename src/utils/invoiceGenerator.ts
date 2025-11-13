import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface InvoiceData {
  invoiceNumber: string;
  transactionId: string;
  date: string;
  agencyName: string;
  planName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
}

export const generateInvoicePDF = (data: InvoiceData) => {
  const doc = new jsPDF();
  
  // Colors
  const primaryColor = '#0EA5E9'; // Sky blue
  const darkGray = '#1F2937';
  const lightGray = '#6B7280';
  const bgGray = '#F3F4F6';
  
  // Header with company info
  doc.setFillColor(primaryColor);
  doc.rect(0, 0, 210, 40, 'F');
  
  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('TurzzAI', 15, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Akıllı Tur Satış Sistemi', 15, 28);
  doc.text('WhatsApp Otomasyon Platformu', 15, 34);
  
  // Invoice title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FATURA', 160, 25);
  
  // Invoice details box
  doc.setFillColor(bgGray);
  doc.rect(140, 50, 55, 35, 'F');
  
  doc.setTextColor(darkGray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Fatura No:', 145, 58);
  doc.text('Tarih:', 145, 66);
  doc.text('İşlem No:', 145, 74);
  
  doc.setFont('helvetica', 'normal');
  doc.text(data.invoiceNumber, 145, 63);
  doc.text(format(new Date(data.date), 'd MMMM yyyy', { locale: tr }), 145, 71);
  doc.text(data.transactionId, 145, 79);
  
  // Customer info
  doc.setTextColor(darkGray);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('FATURA EDİLEN:', 15, 58);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.agencyName, 15, 66);
  
  // Divider line
  doc.setDrawColor(primaryColor);
  doc.setLineWidth(0.5);
  doc.line(15, 95, 195, 95);
  
  // Table header
  doc.setFillColor(primaryColor);
  doc.rect(15, 105, 180, 10, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('AÇIKLAMA', 20, 111);
  doc.text('TUTAR', 170, 111);
  
  // Table content
  doc.setFillColor(bgGray);
  doc.rect(15, 115, 180, 15, 'F');
  
  doc.setTextColor(darkGray);
  doc.setFont('helvetica', 'normal');
  doc.text('Abonelik Ücreti', 20, 121);
  doc.text(`${data.planName} Paketi`, 20, 127);
  doc.text(`Ödeme Yöntemi: ${data.paymentMethod}`, 20, 133);
  
  // Amount
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const amountText = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: data.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(data.amount);
  
  const amountWidth = doc.getTextWidth(amountText);
  doc.text(amountText, 190 - amountWidth, 124);
  
  // Subtotal line
  doc.setDrawColor(lightGray);
  doc.setLineWidth(0.3);
  doc.line(15, 140, 195, 140);
  
  // KDV info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(lightGray);
  doc.text('* KDV dahildir', 20, 147);
  
  // Total
  doc.setFillColor(primaryColor);
  doc.rect(125, 152, 70, 12, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOPLAM:', 130, 159);
  
  doc.setFontSize(13);
  const totalWidth = doc.getTextWidth(amountText);
  doc.text(amountText, 190 - totalWidth, 159);
  
  // Footer
  doc.setTextColor(lightGray);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  const footerY = 270;
  doc.text('Bu fatura elektronik ortamda oluşturulmuştur ve yasal olarak geçerlidir.', 105, footerY, { align: 'center' });
  doc.text('TurzzAI - Akıllı Tur Satış Sistemi', 105, footerY + 5, { align: 'center' });
  doc.text('www.turzzai.com | destek@turzzai.com', 105, footerY + 10, { align: 'center' });
  
  // Border
  doc.setDrawColor(primaryColor);
  doc.setLineWidth(1);
  doc.rect(10, 10, 190, 277);
  
  // Save PDF
  const fileName = `Fatura_${data.invoiceNumber}_${format(new Date(data.date), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
};
