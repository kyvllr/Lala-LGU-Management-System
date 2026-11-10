const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `₱ ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'N/A';
};

const formatCaseStatus = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'N/A';
};

export default function printCOE(coe) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  const staff = coe.staffDetails || {};
  const rows = [
    ['Name:', coe.fullName || coe.staffName],
    ['Position:', coe.positionTitle || staff.position],
    ['Address:', coe.address ?? staff.address],
    ['Status of Employment:', coe.employmentStatus ?? staff.employmentStatus],
    ['Office/Department:', coe.office || staff.department || coe.staffDepartment],
    ['Length of Service:', coe.lengthOfService ?? staff.lengthOfService],
    ['Monthly Basic Salary:', formatCurrency(coe.monthlySalary ?? staff.monthlyBasicSalary)],
    ['PERA/RATA:', coe.peraRata ?? staff.peraRata],
    ['Gross Salary:', formatCurrency(coe.grossSalary ?? staff.grossSalary)],
    ['Pending Administrative Case:', formatCaseStatus(coe.pendingAdministrativeCase ?? staff.pendingAdministrativeCase)],
    ['Pending Criminal Case:', formatCaseStatus(coe.pendingCriminalCase ?? staff.pendingCriminalCase)],
  ];
  const logoUrl = `${window.location.origin}/logo.jpg`;
  const bagongPilipinasUrl = `${window.location.origin}/Bagong%20Pilipinas.png`;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Certificate of Employment - ${escapeHtml(coe.fullName || coe.staffName)}</title>
        <style>
          @page { size: A4 portrait; margin: 14mm 17mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #111;
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 1.22;
          }
          .certificate { width: 100%; }
          .header {
            display: grid;
            grid-template-columns: 25mm 1fr 30mm;
            align-items: center;
            min-height: 27mm;
            text-align: center;
          }
          .header img { display: block; width: 25mm; height: 25mm; object-fit: contain; }
          .header .bagong { width: 29mm; height: 25mm; }
          .header p { margin: 0; }
          .province, .office { font-weight: 700; }
          .rule { border: 0; border-top: 1px solid #111; margin: 2mm 0 11mm; }
          h1 { margin: 0 0 10mm; text-align: center; font-size: 14pt; }
          h2 { margin: 0 0 7mm; font-size: 12pt; }
          .intro { margin: 0 0 6mm; text-indent: 13mm; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          td { border: 1px solid #111; padding: 1.25mm 2mm; vertical-align: middle; }
          td:first-child { width: 49%; font-weight: 700; }
          .value { min-height: 6mm; overflow-wrap: anywhere; }
          .certification { margin: 8mm 0 7mm; text-indent: 13mm; }
          .given { margin: 0; text-indent: 13mm; }
          .date-blank { display: inline-block; width: 48mm; border-bottom: 1px solid #111; }
          .signature { margin: 17mm 5mm 0 0; text-align: right; }
          .signature strong { text-decoration: underline; }
          .signature p { margin: 0; }
          @media print {
            html, body { width: 210mm; }
            .certificate { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <main class="certificate">
          <header class="header">
            <img src="${logoUrl}" alt="Municipality of Lala seal" />
            <div>
              <p>Republic of the Philippines</p>
              <p class="province">PROVINCE OF LANAO DEL NORTE</p>
              <p>Municipality of Lala</p>
              <p class="office">OFFICE OF THE MUNICIPAL MAYOR</p>
            </div>
            <img class="bagong" src="${bagongPilipinasUrl}" alt="Bagong Pilipinas" />
          </header>
          <hr class="rule" />
          <h1>CERTIFICATE OF EMPLOYMENT</h1>
          <h2>TO WHOM IT MAY CONCERN:</h2>
          <p class="intro">This is to certify that the person named hereunder is an employee of Local Government Unit, Municipality of Lala, Lanao del Norte, with the following records and details to with:</p>
          <table>
            <tbody>
              ${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td class="value">${escapeHtml(value || 'N/A')}</td></tr>`).join('')}
            </tbody>
          </table>
          <p class="certification">This certification is being issued upon the request of the above-named for any legal purpose it may serve.</p>
          <p class="given">Given this <span class="date-blank">&nbsp;</span> at Lala, Lanao del Norte, Philippines.</p>
          <div class="signature">
            <p><strong>WARNIE B. EDREA</strong></p>
            <p>HRMO IV</p>
          </div>
        </main>
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 500);
  return true;
}
