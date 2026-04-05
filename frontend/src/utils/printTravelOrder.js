const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatLongDate = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'N/A'
    : parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString();
};

export default function printTravelOrder(order) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return false;
  }

  const isAbroad = order.travelType === 'abroad' || Boolean(order.controlNo);
  const headerTitle = isAbroad ? 'AUTHORITY TO TRAVEL ABROAD' : 'TRAVEL ORDER / OFFICE ORDER';
  const logoUrl = `${window.location.origin}/logo.png`;
  const bagongUrl = `${window.location.origin}/${encodeURIComponent('Bagong Pilipinas.png')}`;

  const rows = isAbroad
    ? [
        ['Date Prepared', formatLongDate(order.datePrepared)],
        ['Control No.', order.controlNo || 'N/A'],
        ['Region', order.region || 'N/A'],
        ['Province', order.province || 'N/A'],
        ['Municipality', order.municipality || 'N/A'],
        ['Date of Filing', formatLongDate(order.abroadDateOfFiling || order.dateOfFiling || order.createdAt)],
        ['Name', order.abroadName || order.staffName || 'N/A'],
        ['Office', order.office || order.permanentStation || 'N/A'],
        ['Position/Designation', order.position || (Array.isArray(order.designations) ? order.designations.join(', ') : '') || 'N/A'],
        ['Period', order.period || `${formatLongDate(order.dateFrom)} - ${formatLongDate(order.dateTo)}`],
        ['Destination', order.travelDestination || order.destination || order.venueDestination || 'N/A'],
        ['Fund Source', order.fundSource || order.fundSourcePapCode || order.fundSourceCode || 'N/A'],
        ['Attachment', order.attachment || order.attachmentName || order.attachments || 'N/A'],
        ['Remarks', order.remarks || ''],
      ]
    : [
        ['Date Prepared', formatLongDate(order.datePrepared || order.dateOfFiling || order.createdAt)],
        ['Control No.', order.controlNo || 'N/A'],
        ['Name', (order.designations && order.designations.length) ? order.designations.join(', ') : (Array.isArray(order.staffName) ? order.staffName.join(', ') : (order.staffName || 'N/A'))],
        ['Position/Designation', order.designations?.length ? order.designations.join(', ') : (order.position || 'N/A')],
        ['Period', `${formatLongDate(order.periodCoveredFrom || order.dateFrom)} - ${formatLongDate(order.periodCoveredTo || order.dateTo)}`],
        ['Destination', order.venueDestination || order.destination || 'N/A'],
        ['Fund Source', order.fundSourcePapCode || order.fundSource || order.fundSourceCode || 'N/A'],
        ['Attachment', order.attachment || order.attachmentName || order.attachments || 'N/A'],
        ['Purpose of Travel', order.purposeOfTravel || order.purpose || 'N/A'],
        ['Activity Organized/Sponsored By', order.activitySponsoredBy || 'N/A'],
        ['Expenses Covered', order.expensesCovered || 'N/A'],
        ['Remarks', order.remarks || ''],
      ];

  const rowsHtml = rows
    .map(([label, value]) => `
        <tr>
          <td class="label">${escapeHtml(label)}</td>
          <td class="value">${escapeHtml(value)}</td>
        </tr>
      `)
    .join('');

  let htmlContent = '';

  if (!isAbroad) {
    const currentDate = formatLongDate(new Date());
    htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${escapeHtml(headerTitle)}</title>
          <style>
            @page { size: A4 portrait; margin: 6mm 10mm 6mm 10mm; }
            body { font-family: 'Times New Roman', Times, serif; color: #111; margin: 0; font-size:13px }
            .sheet { width: 100%; height: 140mm; box-sizing: border-box; padding: 6mm 10mm; }
            .logos { display:flex; align-items:center; justify-content:center; margin-bottom:6px; }
            .logos .left, .logos .right { width: 100px; }
            .logos .left { visibility: hidden; }
            .logos .right { display:flex; justify-content:flex-start; }
            .logo-bagong { width: 120px; height: 56px; object-fit: contain; display:block; }
            .logo-main { width: 60px; height: 60px; object-fit: contain; display:block; margin-bottom: 4px; }
            .header-text { text-align: center; margin: 0; }
            .header-text p { margin: 0; line-height: 1; }
            .province { font-weight: 700; font-size: 15px; }
            .title { text-align: center; margin-top: 6px; font-size: 16px; font-weight: 700; }
            .divider { border: 0; border-top: 4px solid #64b6ec; margin: 8px 0; }
            .grid { width: 100%; border-collapse: collapse; font-size: 14px; border: 2px solid #222; }
            .grid td { border: none; padding: 4px 6px; vertical-align: top; line-height:1; }
            .grid tr.sep td { border-bottom: 1px solid #222; }
            .grid tr.inner td:first-child { border-right: 1px solid #222; }
            .grid tr.inner td:last-child { border-left: 1px solid #222; }
            .grid tr.strong-sep td { border-bottom: 2px solid #222; }
            .grid tr.top-block td { border-bottom: none; }
            .grid .fw { font-weight: 700; font-size:11px }
            .two-cols { display: flex; gap: 8px; }
            .col { flex: 1; }
            .sign-box { height: 40px; }
            .small { font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="sheet">

            <div class="logos">
              <div class="left"></div>
              <div class="center"><img class="logo-main" src="${logoUrl}" alt="logo" /></div>
              <div class="right"><img class="logo-bagong" src="${bagongUrl}" alt="Bagong Pilipinas" /></div>
            </div>

            <div class="header-text">
              <p class="small">Republic of the Philippines</p>
              <p class="province">PROVINCE OF LANAO DEL NORTE</p>
              <p class="small">Municipality of Lala</p>
              <p class="small">Lanipao, Lala, Lanao del Norte</p>
            </div>
            <br/> 
            <div class="divider" style="color:blue;"></div>

            <table class="grid" style="margin-top:8px; width:100%">
              <tbody>
                <tr class="top-block">
                  <td colspan="2" style="text-align:center; font-weight:700; font-size:14px; padding:6px 0">${escapeHtml(headerTitle)}</td>
                </tr>
                <tr class="top-block">
                  <td style="width:50%; vertical-align:top; font-weight:700">REGION: X</td>
                  <td style="vertical-align:top">${escapeHtml(order.region || order.regionName || '')}</td>
                </tr>
                <tr class="top-block">
                  <td style="font-weight:700">PROVINCE: LANAO DEL NORTE</td>
                  <td>${escapeHtml(order.province || '')}</td>
                </tr>
                <tr class="sep">
                  <td style="font-weight:700">MUNICIPALITY: LALA</td>
                  <td>${escapeHtml(order.municipality || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">DATE OF FILING:</td>
                  <td>${escapeHtml(formatLongDate(order.datePrepared || order.dateOfFiling || order.createdAt))}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">NAME/S / DESIGNATION</td>
                  <td>${escapeHtml((order.designations && order.designations.length) ? order.designations.join(', ') : (Array.isArray(order.staffName) ? order.staffName.join(', ') : (order.staffName || '')))}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">PERMANENT STATION</td>
                  <td>${escapeHtml(order.permanentStation || order.office || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">ACTIVITY ORGANIZED/SPONSORED BY</td>
                  <td>${escapeHtml(order.activitySponsoredBy || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">PERIOD COVERED</td>
                  <td>${escapeHtml(`${formatLongDate(order.dateFrom)} - ${formatLongDate(order.dateTo)}`)}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">PLEASE CHECK</td>
                  <td>${escapeHtml([order.officialBusiness ? 'Official Business' : null, order.officialTime ? 'Official Time' : null].filter(Boolean).join(', '))}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">VENUE / DESTINATION</td>
                  <td>${escapeHtml(order.venueDestination || order.destination || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">EXPENSES COVERED</td>
                  <td>${escapeHtml(order.expensesCovered || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">FUND SOURCE (Pap Code)</td>
                  <td>${escapeHtml(order.fundSourcePapCode || order.fundSource || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">Recommending Approval:</td>
                  <td style="font-weight:700">Approved:</td>
                </tr>
                <tr class="sep inner">
                  <td style="height:45px; vertical-align:top"></td>
                  <td style="vertical-align:bottom; text-align:center">
                  <br/>
                    <div class="fw">ANGEL L. YAP</div>
                    <div class="small">Municipal Mayor</div>
                  </td>
                </tr>
                <tr class="sep">
                  <td colspan="2" style="text-align:center; font-weight:700; vertical-align:middle; height:15px">Date: ${escapeHtml(currentDate)}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">Title of Training Attended</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </body>
      </html>
      `;
  } else {
    // abroad template (more generic)
    htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${escapeHtml(headerTitle)}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm 20mm 20mm 20mm; }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #111;
              margin: 0;
              line-height: 1.2;
              font-size: 16px;
            }
            .container { max-width: 760px; margin: 0 auto; }
            .header { text-align: center; }
            .logo { width: 80px; height: 80px; object-fit: contain; margin: 0 auto 6px; display: block; }
            .gov-line { margin: 0; }
            .province { margin: 0; font-weight: 700; }
            .office-line { margin: 4px 0 0; }
            .rule { border: none; border-top: 2px solid #222; margin: 18px 0; }
            .title {
              text-align: center;
              margin: 0 0 14px;
              font-size: 21px;
              font-weight: 700;
              line-height: 1.15;
              white-space: nowrap;
            }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            td { border: 1px solid #222; padding: 7px 10px; font-size: 16px; vertical-align: top; }
            td.label { width: 30%; }
            td.value { width: 70%; }
            .footer { margin-top: 8px; }
            .recommend { margin-bottom: 20px; }
            .name { font-size: 18px; margin: 0; font-weight: 700; }
            .role, .contact { margin: 0; font-size: 14px; }
            .approved { text-align: right; margin-top: 8px; }
            .approved .name { text-decoration: underline; }
            .date-line { margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img class="logo" src="${logoUrl}" alt="LGU Logo" />
              <p class="gov-line">Republic of the Philippines</p>
              <p class="province">PROVINCE OF LANAO DEL NORTE</p>
              <p class="gov-line">Municipality of Lala</p>
              <p class="office-line">OFFICE OF THE MUNICIPAL MAYOR</p>
            </div>

            <hr class="rule" />
            <h1 class="title">${escapeHtml(headerTitle)}</h1>

            <table>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="footer">
              <div class="recommend">
                <p>Recommending Approval:</p>
                <p class="name">WARNIE B. EDREA</p>
                <p class="role">Human Resource Management Officer IV</p>
                <p class="contact">Contact Number: 0921-932-0448</p>
              </div>

              <div class="approved">
                <p>Approved:</p>
                <p class="name">ANGEL L. YAP</p>
                <p class="role">Municipal Mayor</p>
                <p class="date-line">Date: ____________________</p>
              </div>
            </div>
          </div>
        </body>
      </html>
      `;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 250);

  return true;
}
