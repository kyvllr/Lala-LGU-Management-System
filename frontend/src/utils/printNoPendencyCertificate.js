const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const getIssuanceDate = (date = new Date()) => {
  const day = date.getDate();
  const lastTwoDigits = day % 100;
  const suffix = lastTwoDigits >= 11 && lastTwoDigits <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th');
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();

  return {
    certificateLine: `Issued this ${day}${suffix} day of ${month} ${year}`,
    signatureDate: date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
};

export default function printNoPendencyCertificate(request) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  const issuanceDate = getIssuanceDate();
  const hasPendingCase = String(request.pendingCase).toLowerCase() === 'yes';
  const caseStatement = hasPendingCase
    ? 'has a pending case filed/received against him/her.'
    : 'has no pending case filed/received against him/her.';
  const municipalLogo = `${window.location.origin}/logo.jpg`;
  const bagongPilipinasLogo = `${window.location.origin}/Bagong%20Pilipinas.png`;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Certificate of No Pendency/Non-Pendency Case - ${escapeHtml(request.fullName)}</title>
        <style>
          @page { size: A4 portrait; margin: 16mm 18mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #111;
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 1.25;
          }
          .certificate { width: 100%; }
          .header {
            display: grid;
            grid-template-columns: 28mm 1fr 30mm;
            align-items: center;
            min-height: 29mm;
            text-align: center;
          }
          .header img { display: block; width: 26mm; height: 26mm; object-fit: contain; }
          .header .bagong { width: 30mm; height: 26mm; }
          .header p { margin: 0; }
          .province, .office { font-weight: 700; }
          .rule { border: 0; border-top: 1px solid #111; margin: 2mm 0 11mm; }
          h1 { margin: 0 0 14mm; text-align: center; font-size: 14pt; }
          .body-copy { margin: 0 0 6mm; text-indent: 13mm; }
          .name { font-weight: 700; text-decoration: underline; }
          .position { font-weight: 700; }
          .signature { margin-top: 27mm; text-align: right; }
          .signature p { margin: 0; }
          .signature .name { font-weight: 700; }
          @media print {
            html, body { width: 210mm; }
            .certificate { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <main class="certificate">
          <header class="header">
            <img src="${municipalLogo}" alt="Municipality of Lala seal" />
            <div>
              <p>Republic of the Philippines</p>
              <p class="province">PROVINCE OF LANAO DEL NORTE</p>
              <p>Municipality of Lala</p>
              <p class="office">OFFICE OF THE MUNICIPAL MAYOR</p>
            </div>
            <img class="bagong" src="${bagongPilipinasLogo}" alt="Bagong Pilipinas" />
          </header>
          <hr class="rule" />
          <h1>CERTIFICATE OF NO PENDENCY/NON-PENDENCY CASE</h1>
          <p class="body-copy">
            This is to certify that based on the record,
            <span class="name">${escapeHtml(request.fullName)}</span>
            . (<span class="position">${escapeHtml(request.position)}</span>) In the Office of the Municipal General Services,
            Municipality of Lala, Province of Lanao del Norte, ${caseStatement}
          </p>
          <p class="body-copy">
            This certification is issued to support the death benefit claim of the beneficiaries.
          </p>
          <p class="body-copy">
            ${escapeHtml(issuanceDate.certificateLine)} at Lala, Lanao del Norte, Philippines.
          </p>
          <div class="signature">
            <p class="name">WARNIE B. EDREA</p>
            <p>Human Resource Management Office</p>
            <p>Date: ${escapeHtml(issuanceDate.signatureDate)}</p>
          </div>
        </main>
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 500);
  return true;
}
