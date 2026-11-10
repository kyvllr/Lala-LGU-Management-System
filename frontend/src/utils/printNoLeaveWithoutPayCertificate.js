const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getIssuanceDate = (date = new Date()) => {
  const day = date.getDate();
  const lastTwoDigits = day % 100;
  const suffix = lastTwoDigits >= 11 && lastTwoDigits <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th');
  const month = date.toLocaleDateString('en-US', { month: 'long' });

  return {
    certificateLine: `Issued this ${day}${suffix} day of ${month} ${date.getFullYear()}`,
    signatureDate: date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
};

export default function printNoLeaveWithoutPayCertificate(request) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  const issuanceDate = getIssuanceDate();
  const municipalLogo = `${window.location.origin}/logo.jpg`;
  const bagongPilipinasLogo = `${window.location.origin}/Bagong%20Pilipinas.png`;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Certificate - ${escapeHtml(request.fullName)}</title>
        <style>
          @page { size: A4 portrait; margin: 20mm 23mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #111;
            font-family: "Times New Roman", Times, serif;
            font-size: 13pt;
            line-height: 1.25;
          }
          .certificate { width: 100%; }
          .header {
            display: grid;
            grid-template-columns: 30mm 1fr 32mm;
            align-items: center;
            min-height: 34mm;
            text-align: center;
          }
          .header img { display: block; width: 28mm; height: 28mm; object-fit: contain; }
          .header .bagong { width: 32mm; height: 28mm; }
          .header p { margin: 0; }
          .province, .office { font-weight: 700; }
          .rule { border: 0; border-top: 1px solid #111; margin: 2mm 0 7mm; }
          h1 {
            margin: 0 0 12mm;
            text-align: center;
            font-size: 16pt;
            letter-spacing: 3px;
            text-decoration: underline;
          }
          h2 { margin: 0 0 12mm; font-size: 14pt; }
          .body-copy { margin: 0 0 6mm; }
          .signature { margin-top: 28mm; }
          .signature p { margin: 0; }
          .signature .name { font-weight: 700; text-decoration: underline; }
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
          <h1>CERTIFICATION</h1>
          <h2>TO WHOM IT MAY CONCERN:</h2>
          <p class="body-copy">
            This is to certify that per record/s of the Office,
            <strong>${escapeHtml(request.fullName)}</strong> (<strong>${escapeHtml(request.position)}</strong>),
            of Local Government Unit, Municipality of Lala, Province of Lanao del Norte, had NO Leave of Absence
            Without Pay from <strong>${escapeHtml(formatDate(request.periodFrom))}</strong> to
            <strong>${escapeHtml(formatDate(request.periodTo))}</strong>.
          </p>
          <p class="body-copy">
            ${escapeHtml(issuanceDate.certificateLine)} at the Local Government Unit, Municipality of Lala,
            Lanipao, Lala, Lanao del Norte.
          </p>
          <div class="signature">
            <p class="name">WARNIE B. EDREA</p>
            <p>HRMO IV</p>
            <p>Date: ${escapeHtml(issuanceDate.signatureDate)}</p>
          </div>
        </main>
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => {
    const images = Array.from(printWindow.document.images);
    Promise.all(images.map((image) => (
      image.complete ? Promise.resolve() : new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      })
    ))).then(() => printWindow.print());
  }, 100);
  return true;
}
