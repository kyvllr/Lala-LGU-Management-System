function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
}

function getStaffRows(overtime) {
  const rows = Array.isArray(overtime?.staffDetails) ? overtime.staffDetails : [];
  if (rows.length > 0) {
    return rows.map((row, index) => ({
      no: index + 1,
      name: row?.name || '',
      position: row?.position || '',
    }));
  }

  const fallbackName = `${overtime?.firstName || ''} ${overtime?.middleName || ''} ${overtime?.lastName || ''}`
    .replace(/\s+/g, ' ')
    .trim();

  if (fallbackName || overtime?.position) {
    return [{ no: 1, name: fallbackName, position: overtime?.position || '' }];
  }

  return [];
}

function buildRowsHtml(rows) {
  const minRows = 4;
  const normalized = [...rows];
  while (normalized.length < minRows) {
    normalized.push({ no: normalized.length + 1, name: '', position: '' });
  }

  return normalized
    .map(
      (row) => `
        <tr>
          <td class="cell center" style="width: 5%; padding: 6px 2px; text-align: center;">${escapeHtml(row.no)}</td>
          <td class="cell" style="width: 57%; padding: 6px 6px;">${escapeHtml(row.name)}</td>
          <td class="cell" style="width: 38%; padding: 6px 6px;">${escapeHtml(row.position)}</td>
        </tr>
      `
    )
    .join('');
}

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function showPrintSignatoryModal({ requestedOptions, budgetOptions, requestedDefault, budgetDefault }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.45)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:99999',
      'padding:16px',
    ].join(';');

    const modal = document.createElement('div');
    modal.style.cssText = [
      'width:100%',
      'max-width:560px',
      'background:#fff',
      'border-radius:10px',
      'padding:18px',
      'font-family:Arial,sans-serif',
      'box-shadow:0 10px 30px rgba(0,0,0,0.25)',
    ].join(';');

    const requestedOptionHtml = requestedOptions
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join('');
    const budgetOptionHtml = budgetOptions
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join('');

    modal.innerHTML = `
      <h3 style="margin:0 0 4px 0;font-size:18px;">Fill Signatories Before Print</h3>
      <p style="margin:0 0 14px 0;font-size:13px;color:#444;">Choose names for the printed overtime form.</p>

      <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Requested By (Head of Requisitioning Office)</label>
      <select id="requestedSelect" style="width:100%;height:36px;margin-bottom:8px;border:1px solid #ccc;border-radius:6px;padding:0 8px;">
        ${requestedOptionHtml}
        <option value="__others__">Others (manual input)</option>
      </select>
      <input id="requestedOther" type="text" placeholder="Enter requested by name" style="display:none;width:100%;height:36px;margin-bottom:14px;border:1px solid #ccc;border-radius:6px;padding:0 10px;" />

      <br/> <br/>
      <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Certified as to appropriation (Municipal Budget Officer)</label>
      <select id="budgetSelect" style="width:100%;height:36px;margin-bottom:8px;border:1px solid #ccc;border-radius:6px;padding:0 8px;">
        ${budgetOptionHtml}
        <option value="__others__">Others (manual input)</option>
      </select>
      <input id="budgetOther" type="text" placeholder="Enter budget officer name" style="display:none;width:100%;height:36px;margin-bottom:14px;border:1px solid #ccc;border-radius:6px;padding:0 10px;" />

      <p id="signatoryError" style="display:none;margin:0 0 12px 0;color:#b91c1c;font-size:12px;"></p>

      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button id="cancelSignatoryBtn" type="button" style="height:34px;padding:0 14px;border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer;">Cancel</button>
        <button id="proceedSignatoryBtn" type="button" style="height:34px;padding:0 14px;border:1px solid #1d4ed8;background:#1d4ed8;color:#fff;border-radius:6px;cursor:pointer;">Proceed to Print</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const requestedSelect = modal.querySelector('#requestedSelect');
    const budgetSelect = modal.querySelector('#budgetSelect');
    const requestedOther = modal.querySelector('#requestedOther');
    const budgetOther = modal.querySelector('#budgetOther');
    const cancelBtn = modal.querySelector('#cancelSignatoryBtn');
    const proceedBtn = modal.querySelector('#proceedSignatoryBtn');
    const errorNode = modal.querySelector('#signatoryError');

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    const toggleOtherInputs = () => {
      requestedOther.style.display = requestedSelect.value === '__others__' ? 'block' : 'none';
      budgetOther.style.display = budgetSelect.value === '__others__' ? 'block' : 'none';
    };

    requestedSelect.value = requestedOptions.includes(requestedDefault) ? requestedDefault : requestedOptions[0] || '__others__';
    budgetSelect.value = budgetOptions.includes(budgetDefault) ? budgetDefault : budgetOptions[0] || '__others__';
    toggleOtherInputs();

    requestedSelect.addEventListener('change', toggleOtherInputs);
    budgetSelect.addEventListener('change', toggleOtherInputs);

    cancelBtn.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(null);
    });

    proceedBtn.addEventListener('click', () => {
      const requestedBy = requestedSelect.value === '__others__'
        ? requestedOther.value.trim()
        : requestedSelect.value;
      const budgetBy = budgetSelect.value === '__others__'
        ? budgetOther.value.trim()
        : budgetSelect.value;

      if (!requestedBy || !budgetBy) {
        errorNode.textContent = 'Please complete both signatories before printing.';
        errorNode.style.display = 'block';
        return;
      }

      close({ requestedBy, budgetBy });
    });
  });
}

export default async function printOvertimeRequest(overtime) {
  const requestedByDefault = overtime?.headRequisitioningOfficerApproval?.approvedBy || '';
  const budgetByDefault = overtime?.budgetOfficerApproval?.approvedBy || '';

  const requestedOptions = uniqueNonEmpty([
    requestedByDefault,
    overtime?.approvedBy,
    'JO ANA Y. ECHAVEZ',
    'JUAN DELA CRUZ',
    'PRINCESS MAE G. VILLAR',
    'MARIA M. MANGALINO',
  ]);
  const budgetOptions = uniqueNonEmpty([
    budgetByDefault,
    'ALFREDO B. MANGALINO',
    'MARIA LOURDES M. MANGALINO',
  ]);

  const selectedSignatories = await showPrintSignatoryModal({
    requestedOptions,
    budgetOptions,
    requestedDefault: requestedByDefault,
    budgetDefault: budgetByDefault,
  });

  if (!selectedSignatories) {
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1000,height=1200');
  if (!printWindow) {
    alert('Unable to open print window. Please allow pop-ups and try again.');
    return;
  }

  const logoUrl = `${window.location.origin}/logo.PNG`;
  const filingDate = formatDate(overtime?.filingDate);
  const inclusiveStart = formatDate(overtime?.inclusiveDateStart);
  const inclusiveEnd = formatDate(overtime?.inclusiveDateEnd);
  const inclusiveDates = [inclusiveStart, inclusiveEnd].filter(Boolean).join(' - ');

  const requestedBy = selectedSignatories.requestedBy;
  const budgetBy = selectedSignatories.budgetBy;
  const recommendingBy = overtime?.adminApproval?.approvedBy || overtime?.approvedBy || 'WARNIE B. EDREA';

  const rowsHtml = buildRowsHtml(getStaffRows(overtime));

  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Request for Overtime</title>
    <style>
      @page { size: A4 portrait; margin: 15mm 12mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        color: #000;
      }
      .sheet {
        width: 100%;
        max-width: 100%;
        padding: 0;
      }
      .header {
        display: grid;
        grid-template-columns: 75px 1fr;
        gap: 8px;
        align-items: flex-start;
        margin-bottom: 2px;
      }
      .logo {
        width: 85px;
        height: 85px;
        object-fit: contain;
      }
      .header-text {
        text-align: center;
        line-height: 1.15;
        padding-top: 4px;
      }
      .rp {
        font-style: italic;
        font-family: "Garamond", serif;
        font-size: 15px;
        font-weight: normal;
        letter-spacing: 0.5px;
      }
      .province {
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: bold;
        letter-spacing: 1px;
        margin-top: 1px;
      }
      .municipality {
        font-style: italic;
        font-family: "Garamond", serif;
        font-size: 14px;
        margin-top: 0px;
      }
      .office {
        text-align: center;
        font-family: Arial, sans-serif;
        font-size: 15px;
        font-weight: bold;
        letter-spacing: 1px;
        margin-top: 6px;
        margin-bottom: 2px;
        margin-left: 100px;
      }
      .office-rule {
        border-top: 1.5px solid #000;
        margin: 2px 0 8px 0;
      }
      .form-title {
        text-align: center;
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: bold;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
        margin-left: 100px;
      }
      table.form {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid #000;
        table-layout: fixed;
      }
      .form td {
        border: 1px solid #000;
        padding: 5px 6px;
        font-size: 11px;
        vertical-align: top;
      }
      .form th {
        border: 1px solid #000;
        padding: 5px 6px;
        font-size: 11px;
        font-weight: bold;
        text-align: left;
        background: #fff;
      }
      .label {
        font-weight: bold;
        white-space: nowrap;
        font-size: 11px;
      }
      .value {
        min-height: 16px;
        font-size: 11px;
      }
      .top-row {
        height: 20px;
      }
      .checkline {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 10px;
        margin-top: 2px;
      }
      .checklabel {
        font-weight: bold;
        white-space: nowrap;
        font-size: 10px;
      }
      .checkbox {
        width: 12px;
        height: 12px;
        border: 1px solid #000;
        display: inline-block;
        padding: 0;
        margin-right: 3px;
        text-align: center;
        line-height: 11px;
        font-size: 9px;
      }
      .checkbox-label {
        font-weight: bold;
        font-size: 10px;
      }
      .subhead {
        font-weight: bold;
        text-align: center;
        background: #f9f9f9;
      }
      .center {
        text-align: center;
      }
      .cell {
        height: 24px;
      }
      .sig-label {
        font-weight: bold;
        font-size: 10px;
        margin-bottom: 2px;
      }
      .sig-line {
        border-top: 1px solid #000;
        margin-bottom: 2px;
        height: 0;
      }
      .sig-name {
        font-weight: bold;
        font-size: 12px;
        margin-bottom: 0px;
      }
      .sig-role {
        font-size: 10px;
        margin-top: 0px;
      }
      @media print {
        body { margin: 0; padding: 0; }
        .sheet { max-width: none; padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <img class="logo" src="${logoUrl}" alt="Municipality Logo" onerror="this.style.visibility='hidden'" />
        <div class="header-text">
          <div class="rp">Republic of the Philippines</div>
          <div class="province">PROVINCE OF LANAO DEL NORTE</div>
          <div class="municipality">Municipality of Lala</div>
        </div>
      </div>

      <div class="office">OFFICE OF THE MUNICIPAL MAYOR</div>
      <div class="office-rule"></div>

      <div class="form-title">REQUEST FOR OVERTIME</div>

      <table class="form">
        <colgroup>
          <col style="width: 5%;" />
          <col style="width: 57%;" />
          <col style="width: 38%;" />
        </colgroup>
        <tr class="top-row">
          <td style="width: 50%; border-top: none; border-bottom: none; border-left: none; border-right: none;"><span class="label">Date of Filing:</span> <span class="value">${escapeHtml(filingDate)}</span></td>
          <td style="width: 50%; border-top: none; border-bottom: none; border-left: none; border-right: none;"><span class="label">Office:</span> <span class="value">${escapeHtml(overtime?.office || '')}</span></td>
        </tr>
        <tr>
          <td colspan="2" style="height: 48px;  border-left: none; border-right: none;"><span class="label">Purpose of Overtime:</span> <span class="value">${escapeHtml(overtime?.purposeOfOvertime || '')}</span></td>
          <td style=" border-left: none; border-right: none;"></td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top: 8px; padding-bottom: 4px; none; border-left: none; border-right: none;"><span class="label">Inclusive Dates:</span> <span class="value">${escapeHtml(inclusiveDates)}</span></td>
          <td style=" border-left: none; border-right: none;"></td>
        </tr>
        <tr>
          <td colspan="2" style="padding-top: 4px; padding-bottom: 8px;">
            <div class="checkline" style="margin-top: 0;">
              <span class="checklabel">Please Check:</span>
              <span><span class="checkbox">${overtime?.officeStaffPersonnel ? '✓' : ''}</span><span class="checkbox-label">Office Staff/Personnel</span></span>
              <span style="margin-left: 12px;"><span class="checkbox">${overtime?.departmentHeadOfficer ? '✓' : ''}</span><span class="checkbox-label">Department Head/Officer-In-Charge</span></span>
            </div>
          </td>
          <td></td>
        </tr>
        <tr>
          <th class="subhead" style="width: 10%; padding: 6px 2px; text-align: center;">No.</th>
          <th class="subhead" style="width: 57%; padding: 6px 6px;">Name/s</th>
          <th class="subhead" style="width: 38%; padding: 6px 6px;">Position/Designation</th>
        </tr>
        ${rowsHtml}
        <tr>
          <td style="width: 33.33%; padding: 6px 8px; vertical-align: top; border-right: none; border-top: none; border-bottom: none;">
            <div class="sig-label">Requested by:</div><br><br/>
            <div class="sig-name">${escapeHtml(requestedBy)}</div>
            <div class="sig-line" style="margin-top: 2px;"></div>
            
            <div class="sig-role">Head of Requisitioning Office</div>
          </td>
          <td style="width: 33.33%; padding: 6px 8px; vertical-align: top; border-left: none; border-right: none; border-top: none; border-bottom: none;">
            <div class="sig-label">Certified as to appropriation:</div><br><br/>
            <div class="sig-name">${escapeHtml(budgetBy)}</div>
            <div class="sig-line" style="margin-top: 2px;"></div>
            
            <div class="sig-role">Municipal Budget Officer</div>
          </td>
          <td style="width: 33.34%; padding: 6px 8px; vertical-align: top; border-left: none; border-top: none; border-bottom: none;">
            <div class="sig-label">Recommending Approval:</div> <br><br/>
            <div class="sig-name">WARNIE B. EDREA</div>
            <div class="sig-line" style="margin-top: 2px;"></div>
            
            <div class="sig-role">HRMO IV</div>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}
