export default function downloadPaymentProof(response, fileName) {
  const blobUrl = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName || 'proof-of-payment';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
}
