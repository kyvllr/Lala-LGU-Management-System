const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const REASON_LABELS = {
  retirement: 'Retirement',
  death: 'Death',
  resignation: 'Resignation',
  termination: 'Termination',
  'drop-from-roles': 'Drop from the Roles',
  'transfer-to-other-agency': 'Transfer to other agency',
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
};

const formatCompensation = (value) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : 'N/A';
};

export const renderSeparationOrder = (targetWindow, record) => {
  const order = record?.separationOrder || {};
  const name = order.fullName || [
    record?.surname,
    record?.firstName,
    record?.middleName,
    record?.nameExtension,
  ].filter(Boolean).join(', ');
  const orderNumber = order.orderNumber || 'N/A';
  const orderYear = order.year || new Date().getFullYear();
  const reason = REASON_LABELS[order.separationReason || record?.separationReason] || 'N/A';
  const currentWork = (record?.workExperience || []).find((work) => (
    !work?.to || ['present', 'current'].includes(String(work.to).trim().toLowerCase())
  )) || record?.workExperience?.[0];
  const firstAvailable = (values) => values.find((value) => (
    value && String(value).trim().toLowerCase() !== 'n/a'
  )) || 'N/A';
  const position = firstAvailable([
    order.position,
    currentWork?.positionTitle,
    record?.matchedStaff?.position,
    record?.jobApplication?.positionTitle,
  ]);
  const department = firstAvailable([
    order.department,
    record?.matchedStaff?.department,
    record?.department,
    record?.officeDepartment,
    record?.jobApplication?.office,
  ]);
  const compensation = formatCompensation(
    order.monthlyCompensation
      ?? record?.matchedStaff?.monthlyBasicSalary
      ?? record?.matchedStaff?.grossSalary
      ?? record?.jobApplication?.monthlySalary
  );
  const orderDate = formatDate(order.orderDate || new Date());
  const effectivityDate = formatDate(order.effectivityDate || record?.effectivityDate);
  const assetBase = new URL('/', window.location.href).href;

  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Special Order No. ${escapeHtml(orderNumber)} s. ${escapeHtml(orderYear)}</title>
        <style>
          @page { size: A4; margin: 20mm 24mm; }
          * { box-sizing: border-box; }
          body {
            color: #111;
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            margin: 0;
          }
          .page { min-height: 257mm; position: relative; }
          .letterhead {
            align-items: center;
            border-bottom: 1px solid #111;
            display: grid;
            grid-template-columns: 28mm 1fr 28mm;
            min-height: 33mm;
            padding: 0 0 3mm;
            text-align: center;
          }
          .letterhead img { height: 27mm; object-fit: contain; width: 27mm; }
          .letterhead img:last-child { height: 25mm; width: 25mm; }
          .government { font-size: 11pt; line-height: 1.15; }
          .government strong { display: block; font-size: 12pt; }
          .order-meta { display: flex; justify-content: space-between; margin-top: 1mm; }
          .order-name { font-weight: bold; }
          h1 { font-size: 14pt; margin: 18mm 0 15mm; text-align: center; }
          .body-copy { line-height: 1.35; margin: 0; text-align: justify; }
          .signatory { margin: 22mm 0 0 auto; text-align: center; width: 45%; }
          .signatory strong { display: block; }
          .references { bottom: 0; left: 0; line-height: 1.35; position: absolute; }
          .references-title { margin-bottom: 7mm; }
          .copy-title { margin-bottom: 1mm; }
          .references ol { margin: 0; padding-left: 18mm; }
          .references li { padding-left: 1mm; }
          @media screen {
            body { background: #e5e7eb; padding: 12mm 0; }
            .page { background: #fff; margin: 0 auto; max-width: 210mm; min-height: 297mm; padding: 20mm 24mm; }
          }
          @media print {
            .page { min-height: 257mm; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="letterhead">
            <img src="${assetBase}logo.PNG" alt="Municipality of Lala seal">
            <div class="government">
              <div>Republic of the Philippines</div>
              <strong>PROVINCE OF LANAO DEL NORTE</strong>
              <div>Municipality of Lala</div>
              <div>OFFICE OF THE MUNICIPAL MAYOR</div>
            </div>
            <img src="${assetBase}Bagong%20Pilipinas.png" alt="Bagong Pilipinas">
          </header>
          <div class="order-meta">
            <div><span class="order-name">SPECIAL ORDER</span><br>No. ${escapeHtml(orderNumber)} s. ${escapeHtml(orderYear)}</div>
            <div>${escapeHtml(orderDate)}</div>
          </div>
          <h1>SEPARATION ORDER</h1>
          <p class="body-copy">
            It is hereby made a matter of record that <u>${escapeHtml(name || 'N/A')}</u>,
            <u>${escapeHtml(position)}</u>, <u>${escapeHtml(department)}</u>, Local Government Unit of Lala
            with a monthly compensation rate &#8369;<u>${escapeHtml(compensation)}</u> is hereby separated
            from the service due to <u>${escapeHtml(reason)}</u>, effective
            <u>${escapeHtml(effectivityDate)}</u>.
          </p>
          <div class="signatory">
            <strong>ANGEL L. YAP</strong>
            <div>Municipal Mayor</div>
          </div>
          <footer class="references">
            <div class="references-title">References:</div>
            <div class="copy-title">Copy Furnished:</div>
            <ol>
              <li>Immediate Head</li>
              <li>Planning Officer</li>
              <li>CSC Field Office</li>
              <li>GSIS-Iligan</li>
              <li>Accounting Office</li>
              <li>Treasurer's Office</li>
            </ol>
          </footer>
        </main>
        <script>
          Promise.all(Array.from(document.images, function (image) {
            if (image.complete) return Promise.resolve();
            return new Promise(function (resolve) {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          })).then(function () {
            window.setTimeout(function () { window.print(); }, 100);
          });
        </script>
      </body>
    </html>`);
  targetWindow.document.close();
  targetWindow.focus();
};

export const openSeparationOrder = (record) => {
  const targetWindow = window.open('', '_blank');
  if (!targetWindow) return false;
  renderSeparationOrder(targetWindow, record);
  return true;
};
