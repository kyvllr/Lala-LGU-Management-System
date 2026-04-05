export function openPrintWindow(leave = {}) {
  const applicantName =
    leave.staffName ||
    [leave.firstName, leave.middleName, leave.lastName].filter(Boolean).join(' ') ||
    '';
  const office = leave.office || leave.staffDepartment || '';
  const dateFiled = leave.filingDate || leave.createdAt || '';
  const position = leave.position || leave.jobTitle || '';
  const salary = leave.salary ?? '';
  const leaveType = String(leave.leaveType || '').trim();
  const details = leave.leaveDetailsSpecific || {};

  const typeIncludes = (...keywords) => {
    const haystack = `${leaveType} ${leave.type || ''} ${leave.category || ''}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(String(keyword).toLowerCase()));
  };

  const detailIncludes = (...keywords) => {
    const parts = [
      leave.reason,
      leave.remarks,
      leave.details,
      leave.purpose,
      leave.notes,
      leave.destination,
      leave.location,
      leave.studyPurpose,
      leave.medicalNotes,
      details.sickInHospitalIllness,
      details.sickOutPatientIllness,
      details.womenIllness,
      details.studyOtherDetails,
    ];
    const haystack = parts.filter(Boolean).join(' ').toLowerCase();
    return keywords.some((keyword) => haystack.includes(String(keyword).toLowerCase()));
  };

  const box = (checked) => (checked ? '&#10003;' : '&nbsp;');

  const isVacation = typeIncludes('vacation leave', 'vacation', 'vl');
  const isMandatory = typeIncludes('mandatory/force leave', 'mandatory', 'force leave');
  const isSick = typeIncludes('sick leave', 'sick', 'sl');
  const isMaternity = typeIncludes('maternity leave', 'maternity');
  const isPaternity = typeIncludes('paternity leave', 'paternity');
  const isSpecialPrivilege = typeIncludes('special privilege leave', 'special privilege');
  const isSoloParent = typeIncludes('solo parent leave', 'solo parent');
  const isStudy = typeIncludes('study leave', 'study');
  const isVAWC = typeIncludes('10-day vawc leave', '10-day', '10 day', 'vawc');
  const isRehabilitation = typeIncludes('rehabilitation privilege', 'rehabilitation');
  const isEmergency = typeIncludes('special emergency (calamity) leave', 'calamity', 'emergency');
  const isKnownType =
    isVacation ||
    isMandatory ||
    isSick ||
    isMaternity ||
    isPaternity ||
    isSpecialPrivilege ||
    isSoloParent ||
    isStudy ||
    isVAWC ||
    isRehabilitation ||
    isEmergency;
  const isOtherType = !isKnownType;

  const isAbroad = Boolean(details.vacationAbroad) || detailIncludes('abroad');
  const isWithinPH = Boolean(details.vacationWithinPH) || ((isVacation || isSpecialPrivilege) && !isAbroad);
  const isSickHospital = Boolean(details.sickInHospital) || detailIncludes('in hospital', 'hospital');
  const isSickOutpatient = Boolean(details.sickOutPatient) || detailIncludes('out patient', 'outpatient');
  const isWomenBenefit = Boolean(details.womenIllness) || typeIncludes('special leave benefits for women');
  const isStudyMasters = Boolean(details.studyMastersDegree) || detailIncludes("master's", 'masters');
  const isStudyBoard = Boolean(details.studyBoardExam) || detailIncludes('bar', 'board examination');
  const isStudyOther = Boolean(details.studyOther);
  const isMonetization = Boolean(details.purposeMonetization) || detailIncludes('monetization');
  const isTerminal = Boolean(details.purposeTerminal) || detailIncludes('terminal leave');

  const inclusiveDates = getInclusiveDates(leave);
  const numberOfDays = leave.numberOfDays ?? computeWorkingDays(leave.dateRanges);
  const sickHospitalIllness = details.sickInHospitalIllness || '';
  const sickOutPatientIllness = details.sickOutPatientIllness || '';
  const womenIllness = details.womenIllness || '';
  const studyOtherDetails = details.studyOtherDetails || '';
  const commutationNotRequested = Boolean(leave.commutationNotRequested ?? leave.communicationNotRequested);
  const commutationRequested = Boolean(leave.commutationRequested ?? leave.communicationRequested);
  const otherLeaveText = isOtherType ? leaveType : '';

  // Leave Credits - extract from multiple possible field locations
  const currentDate = new Date().toLocaleDateString();
  
  // Get vacation leave data
  const vacationLeaveEarned = 
    leave.vacationLeaveEarned ?? 
    leave.leaveCredits?.vacationLeaveEarned ?? 
    leave.vacationEarned ?? 
    leave.vacationBalance?.earned ?? 
    leave.vl?.earned ?? 
    '';
  
  const vacationLeaveUsed = 
    leave.vacationLeaveUsed ?? 
    leave.leaveCredits?.vacationLeaveUsed ?? 
    leave.vacationUsed ?? 
    (isVacation ? numberOfDays : '') ??
    '';
  
  const vacationLeaveBalance = 
    leave.vacationLeaveBalance ??
    leave.leaveCredits?.vacationLeaveBalance ??
    leave.vacationBalance?.balance ??
    (vacationLeaveEarned && vacationLeaveUsed ? (vacationLeaveEarned - vacationLeaveUsed) : '');

  // Get sick leave data
  const sickLeaveEarned = 
    leave.sickLeaveEarned ?? 
    leave.leaveCredits?.sickLeaveEarned ?? 
    leave.sickEarned ?? 
    leave.sickBalance?.earned ?? 
    leave.sl?.earned ?? 
    '';
  
  const sickLeaveUsed = 
    leave.sickLeaveUsed ?? 
    leave.leaveCredits?.sickLeaveUsed ?? 
    leave.sickUsed ?? 
    (isSick ? numberOfDays : '') ??
    '';
  
  const sickLeaveBalance = 
    leave.sickLeaveBalance ??
    leave.leaveCredits?.sickLeaveBalance ??
    leave.sickBalance?.balance ??
    (sickLeaveEarned && sickLeaveUsed ? (sickLeaveEarned - sickLeaveUsed) : '');

  // Get CTO data
  const ctoEarned = 
    leave.ctoEarned ?? 
    leave.leaveCredits?.ctoEarned ?? 
    leave.ctoBalance?.earned ?? 
    '';
  
  const ctoUsed = 
    leave.ctoUsed ?? 
    leave.leaveCredits?.ctoUsed ?? 
    '';
  
  const ctoBalance = 
    leave.ctoBalance ??
    leave.leaveCredits?.ctoBalance ??
    leave.ctoBalance?.balance ??
    (ctoEarned && ctoUsed ? (ctoEarned - ctoUsed) : '');

  const requestedDaysValue = Number(numberOfDays);
  const hasRequestedDays = Number.isFinite(requestedDaysValue) && requestedDaysValue > 0;
  const hasVacationLeaveBalance = Number(vacationLeaveBalance) > 0;
  const approvedDaysWithPay = hasRequestedDays && hasVacationLeaveBalance ? requestedDaysValue : '';
  const approvedDaysWithoutPay = hasRequestedDays && !hasVacationLeaveBalance ? requestedDaysValue : '';
  const approvedDaysWithPayDisplay = approvedDaysWithPay !== ''
    ? `<span class="approved-days-value">${escapeHtml(String(approvedDaysWithPay))}</span>`
    : '_____';
  const approvedDaysWithoutPayDisplay = approvedDaysWithoutPay !== ''
    ? `<span class="approved-days-value">${escapeHtml(String(approvedDaysWithoutPay))}</span>`
    : '_____';
  const printRecommendation = String(leave.printRecommendation || 'For Approval');
  const isForApproval = printRecommendation === 'For Approval';
  const isForDisapproval = printRecommendation === 'For Disapproval';
  const disapprovalRemark = leave.printRecommendationRemark || '';
  const disapprovedDueTo = leave.printDisapprovedDueTo || '';
  const municipalAssessor = leave.municipalAssessor || 'MICHAEL V. POGOY';

  const sealSrc = '/logo.PNG';

  const html = `
  <html>
    <head>
      <title>Application for Leave - ${escapeHtml(applicantName)}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: A4 portrait; margin: 6mm; }
        body {
          margin: 0;
          color: #000;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10.5px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .page {
          width: 196mm;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .header {
          display: table;
          width: 100%;
          margin-bottom: 4px;
        }
        .header-left,
        .header-center,
        .header-right {
          display: table-cell;
          vertical-align: top;
        }
        .header-left,
        .header-right {
          width: 32%;
          font-size: 11px;
          line-height: 1.2;
        }
        .header-center {
          width: 36%;
          text-align: center;
        }
        .annex { font-weight: 700; }
        .italic { font-style: italic; }
        .header-right { text-align: center; padding-top: 14px; }
        .logo-line {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 2px;
        }
        .seal {
          width: 42px;
          height: 42px;
          object-fit: contain;
        }
        .gov-title {
          font-size: 14px;
          margin: 0;
          line-height: 1.05;
          letter-spacing: 0;
        }
        .subline {
          margin: 0;
          line-height: 1.05;
          font-size: 10.5px;
        }
          .subline2 {
          margin: 0;
          font-weight: 800;
          line-height: 1.05;
          font-size: 10.5px;
        }
        .form-title {
          text-align: center;
          font-weight: 700;
          font-size: 15px;
          margin: 6px 0 5px;
          letter-spacing: 0.2px;
        }
        table.form {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 14px;
        }
        table.form td,
        table.form th {
          border: 1px solid #000;
          padding: 2px 4px;
          vertical-align: top;
        }
        .sec-title {
          text-align: center;
          font-weight: 700;
          font-size: 11px;
          padding: 1px 0;
        }
        .field-line {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #000;
          min-height: 11px;
          line-height: 11px;
          vertical-align: bottom;
          margin-left: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .line-office { width: 145px;}
        .line-date { width: 95px; }
        .line-pos { width: 98px; }
        .line-salary { width: 72px; }
        .line-salary-php { margin-left: 8px; }
        .first-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .first-office {
          flex: 0 0 32%;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0;
        }
        .office-label {
          font-size: 10.5px;
          white-space: nowrap;
          margin-bottom: 6px;
        }
        .first-name {
          flex: 1;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .name-label-text {
          white-space: nowrap;
          font-size: 10.5px;
        }
        .second-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .second-field {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .second-field-label {
          font-size: 10.5px;
          white-space: nowrap;
        }
        .salary-wrapper {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .salary-field {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .salary-label {
          font-size: 10.5px;
          white-space: nowrap;
        }
        .salary-input-group {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .line-salary-amount {
          width: 48px;
        }
        .salary-currency {
          font-size: 10.5px;
        }
        .name-col {
          flex: 1;
          min-width: 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .name-label-inline {
          text-align: center;
          font-size: 9.5px;
          line-height: 1;
          margin-bottom: 2px;
        }
        .name-value {
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #000;
          width: 100%;
          min-height: 11px;
        }
        .check-row { display: flex; align-items: flex-start; margin-bottom: 1px; line-height: 1.15; margin-left: 22px; }
        .check {
          width: 10px;
          height: 10px;
          border: 1px solid #000;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 4px;
          font-size: 9px;
          line-height: 9px;
          flex: 0 0 10px;
        }
        .text-line {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #000;
          min-height: 11px;
          vertical-align: bottom;
        }
        .line-wide { width: 155px; }
        .line-mid { width: 120px; }
        .line-small { width: 85px; }
        .label-italic {
          font-style: italic;
          font-size: 9.5px;
          margin-top: 1px;
          margin-bottom: 1px;
        }
        .days-value {
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #000;
          min-height: 12px;
          padding-bottom: 1px;
        }
        .inclusive {
          margin-top: 4px;
          text-align: center;
          font-weight: 700;
          font-size: 10px;
          margin-left: 2px;
        }
        .inclusive-box {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
          border-bottom: 1px solid #000;
          min-height: 12px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .credits {
          width: 100%;
          border-collapse: collapse;
          margin-top: 4px;
        }
        .credits td,
        .credits th {
          border: 1px solid #000;
          padding: 2px 3px;
          font-size: 9.5px;
        }
        .sign-name {
          text-align: center;
          font-weight: 700;
          margin-top: 16px;
          text-decoration: underline;
          text-underline-offset: 1px;
        }
        .sign-role {
          text-align: center;
          margin-top: 1px;
        }
        .last-row-content {
          display: flex;
          align-items: flex-start;
          gap: 40px;
        }
        .last-row-left {
          flex: 1;
        }
        .last-row-right {
          flex: 1;
        }
        .signature-row {
          text-align: center;
          padding: 8px 0;
          margin-top: 8px;
          border-top: none;
        }
        .remark-line {
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #000;
          min-height: 11px;
          margin-bottom: 3px;
        }
        .approved-days-value {
          display: inline-block;
          min-width: 38px;
          text-align: center;
          border-bottom: 1px solid #000;
          line-height: 1;
          padding-bottom: 1px;
        }
        .tight { line-height: 1.15; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="header-left">
            <div class="annex">ANNEX A</div>
            <div class="italic">Civil Service Form No. 6</div>
            <div class="italic">Revised 2020</div>
          </div>
          <div class="header-center">
            <div class="logo-line">
              <img src="${sealSrc}" alt="Municipal Seal" class="seal" onerror="this.style.display='none'" />
              <div class="tight">
                <p class="gov-title">Republic of the Philippines</p>
                <p class="subline">(LGU-LALA)</p>
                <p class="subline2">(Lala, Lanao del Norte)</p>
              </div>
            </div>
          </div>
          <div class="header-right">Stamp of Date of<br/>Receipt</div>
        </div>
<br/> <br/>
        <div class="form-title">APPLICATION FOR LEAVE</div>

        <table class="form">
          <tr>
            <td colspan="2">
              <div class="first-row">
                <div class="first-office">
                  <div class="office-label">1. OFFICE/DEPARTMENT</div>
                  <span class="field-line line-office">${escapeHtml(office)}</span>
                </div>
                <div class="first-name">
                  <span class="name-label-text">2. Name:</span>
                  <div class="name-col">
                    <div class="name-label-inline">(Last)</div>
                    <div class="name-value" >${escapeHtml(getNameLast(applicantName, leave.lastName))}</div>
                  </div>
                  <div class="name-col">
                    <div class="name-label-inline">(First)</div>
                    <div class="name-value" >${escapeHtml(getNameFirst(applicantName, leave.firstName))}</div>
                  </div>
                  <div class="name-col">
                    <div class="name-label-inline">(Middle)</div>
                    <div class="name-value" >${escapeHtml(getNameMiddle(applicantName, leave.middleName))}</div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="second-row">
                <span class="second-field-label">3. DATE OF FILING</span>
                <span class="field-line line-date">${escapeHtml(formatDate(dateFiled))}</span>
                <span class="second-field-label">4. POSITION:</span>
                <span class="field-line line-pos">${escapeHtml(position)}</span>
                <span class="second-field-label">5. SALARY:</span>
                <span class="field-line line-salary-amount">${escapeHtml(formatCurrency(salary))}</span>
                <span class="salary-currency">Php.</span>
                <span class="field-line" style="width: 45px;"></span>
              </div>
            </td>
          </tr>

          <tr>
            <td colspan="2" class="sec-title">6. DETAILS OF APPLICATION</td>
          </tr>

          <tr>
            <td style="width: 56%;">
              <div><strong>6. A TYPE OF LEAVE TO BE AVAILED OF</strong></div>
              <div class="check-row"><span class="check">${box(isVacation)}</span><span>Vacation Leave (Sec. 51, Rules XVI, Omnibus Rules E.O NO 292)</span></div>
              <div class="check-row"><span class="check">${box(isMandatory)}</span><span>Mandatory/force Leave (Sec. 25, Rules XVI, Omnibus Rules E.O NO. 292)</span></div>
              <div class="check-row"><span class="check">${box(isSick)}</span><span>Sick Leave (Sec. 43, Rules XVI, Omnibus Rules E.O NO. 292)</span></div>
              <div class="check-row"><span class="check">${box(isMaternity)}</span><span>Maternity Leave (R.A No. 11210/IRR issued by CSC, DOLE and SSS)</span></div>
              <div class="check-row"><span class="check">${box(isPaternity)}</span><span>Paternity Leave (R.A No. 8187 / CSC MC No. 71, s 1998, as amended)</span></div>
              <div class="check-row"><span class="check">${box(isSpecialPrivilege)}</span><span>Special Privilege Leave (Sec. 21, Rules XVI, Omnibus Rules E.O NO. 292)</span></div>
              <div class="check-row"><span class="check">${box(isSoloParent)}</span><span>Solo Parent Leave (R.A No. 8972 / CSC No.8 s. 2004)</span></div>
              <div class="check-row"><span class="check">${box(isStudy)}</span><span>Study Leave (Sec. 88, Rules XVI, Omnibus Rules E.O NO. 292)</span></div>
              <div class="check-row"><span class="check">${box(isVAWC)}</span><span>10-Day VAWC Leave (R.A No. 9262, Omnibus / CSC MC No. 15, s.2010)</span></div>
              <div class="check-row"><span class="check">${box(isRehabilitation)}</span><span>Rehabilitation Privilege (Sec. 55 Rule XVI Omnibus Rules E.O NO. 292)</span></div>
              <div class="check-row"><span class="check">${box(isEmergency)}</span><span>Special Leave Emergency (Calamity) Leave (CSC MC No. 2, s.2012, as amended)</span></div>
              <div class="check-row">
                <span class="check">${box(isOtherType)}</span>
                <span>Others: <span class="text-line line-wide">${escapeHtml(otherLeaveText)}</span></span>
              </div>
            </td>
            <td style="width: 44%;">
              <div><strong>6. B DETAILS OF LEAVE</strong></div>
              <div class="label-italic">In case of Vacation/Special Privilege Leave:</div>
              <div class="check-row"><span class="check">${box(isWithinPH)}</span><span>Within the Philippines</span></div>
              <div class="check-row"><span class="check">${box(isAbroad)}</span><span>Abroad (Specify) <span class="text-line line-small"></span></span></div>
              <br/>

              <div class="label-italic" style="margin-top: 4px;">In case of Sick Leave:</div>
              <div class="check-row"><span class="check">${box(isSickHospital)}</span><span>In hospital (Specify Illness) <span class="text-line line-mid">${escapeHtml(sickHospitalIllness)}</span></span></div>
              <div class="check-row"><span class="check">${box(isSickOutpatient)}</span><span>Out Patient (Specify Illness) <span class="text-line line-mid">${escapeHtml(sickOutPatientIllness)}</span></span></div>
              <br/> 

              <div class="label-italic" style="margin-top: 4px;">In case of Special Leave Benefits for Women:</div>
              <div class="check-row"><span class="check">${box(isWomenBenefit)}</span><span>(Specify Illness) <span class="text-line line-mid">${escapeHtml(womenIllness)}</span></span></div>
                <br/> 

              <div class="label-italic" style="margin-top: 4px;">In case of Study Leave:</div>
              <div class="check-row"><span class="check">${box(isStudyMasters)}</span><span>Complementation of Master's Degree</span></div>
              <div class="check-row"><span class="check">${box(isStudyBoard)}</span><span>BAR/BOARD EXAMINATION REVIEW</span></div>
              <div class="check-row"><span class="check">${box(isStudyOther)}</span><span>Other <span class="text-line line-small">${escapeHtml(studyOtherDetails)}</span></span></div>
              <br/> 

              <div class="label-italic" style="margin-top: 4px;">Purpose:</div>
              <div class="check-row"><span class="check">${box(isMonetization)}</span><span>Monetization of Leave Credits</span></div>
              <div class="check-row"><span class="check">${box(isTerminal)}</span><span>Terminal Leave</span></div>
            </td>
          </tr>

          <tr>
            <td>
              <div><strong>6. C NUMBER OF WORKING DAYS APPLIED FOR</strong></div>
              <div class="days-value">${escapeHtml(numberOfDays)}</div>
              <div class="inclusive">INCLUSIVE DATES</div>
              <div class="inclusive-box">${escapeHtml(inclusiveDates)}</div>
<br/>
            </td>
            
            <td>
              <div><strong>6. D COMMUTATION</strong></div>
              <div class="check-row" style="margin-top: 6px;"><span class="check">${box(commutationNotRequested)}</span><span>Not Requested</span></div>
              <div class="check-row"><span class="check">${box(commutationRequested)}</span><span>Requested</span></div>
              <div style="text-align: center; margin-top: 14px; line-height: 1.2;">____________________<br/>(Signature of applicant)</div>
            </td>
          </tr>

          <tr>
            <td colspan="2" class="sec-title">7. DETAILS OF ACTION ON APPLICATION</td>
          </tr>

          <tr>
            <td>
              <div><strong>7. A CERTIFICATION OF LEAVE CREDITS</strong></div>
              <div style="margin: 3px 0; text-align:center;">As of ${escapeHtml(currentDate)}</div>
              <table class="credits">
                <tr>
                  <th style="width: 35%;"></th>
                  <th style="width: 21%;">Vacation Leave</th>
                  <th style="width: 21%;">Sick Leave</th>
                  <th style="width: 23%;">CTO</th>
                </tr>
                <tr><td>Current Balance</td><td>${escapeHtml(vacationLeaveEarned)}</td><td>${escapeHtml(sickLeaveEarned)}</td><td>${escapeHtml(ctoEarned)}</td></tr>
                <tr><td>Less this application</td><td>${escapeHtml(vacationLeaveUsed)}</td><td>${escapeHtml(sickLeaveUsed)}</td><td>${escapeHtml(ctoUsed)}</td></tr>
                <tr><td>Balance</td><td>${escapeHtml(vacationLeaveBalance)}</td><td>${escapeHtml(sickLeaveBalance)}</td><td>${escapeHtml(ctoBalance)}</td></tr>
              </table>
              <br/>
              <div class="sign-name">WARNIE B. EDREA</div>
              <div class="sign-role">Authorized Officer / (HRMO-IV)</div>
            </td>
            <td>
              <div><strong>7. B RECOMMENDATION</strong></div>
              <div class="check-row" style="margin-top: 10px;"><span class="check">${box(isForApproval)}</span><span>For Approval</span></div>
              <div class="check-row"><span class="check">${box(isForDisapproval)}</span><span>For Disapproval due to <span class="text-line line-wide">${escapeHtml(isForDisapproval ? disapprovalRemark : '')}</span></span></div>
              <div class="remark-line"></div>
              <div class="remark-line"></div>
              <div class="sign-name" style="margin-top: 34px;">${escapeHtml(municipalAssessor)}</div>
              <div class="sign-role">Municipal Assessor</div>
            </td>
          </tr>

          <tr>
            <td colspan="2">
              <div class="last-row-content">
                <div class="last-row-left">
                  <div><strong>7. C APPROVED FOR:</strong></div>
                  <div class="tight">${approvedDaysWithPayDisplay} days with pay</div>
                  <div class="tight">${approvedDaysWithoutPayDisplay} days without pay</div>
                  <div class="tight">_____ others (specify)</div>
                </div>
                <div class="last-row-right">
                  <div><strong>7. D. DISSAPROVED DUE TO:</strong></div>
                  <div class="remark-line" style="margin-top: 8px; justify-content: flex-start; padding-left: 4px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(disapprovedDueTo)}</div>
                  <div class="remark-line"></div>
                  <div class="remark-line"></div>
                </div>
              </div>
              <div class="signature-row">
                <div class="sign-name" style="margin-top: 12px;">WARNIE B. EDREA</div>
                <div class="sign-role">Authorized Officer / (HRMO-IV)</div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    </body>
  </html>
  `;

  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) {
    alert('Unable to open print window. Please allow popups for this site.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 500);
}

function formatDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString();
  } catch {
    return String(value);
  }
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '';
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNameLast(full, explicitLastName) {
  if (explicitLastName) return explicitLastName;
  if (!full) return '';
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : full;
}
function getNameFirst(full, explicitFirstName) {
  if (explicitFirstName) return explicitFirstName;
  if (!full) return '';
  const parts = full.trim().split(/\s+/);
  return parts.length ? parts[0] : full;
}
function getNameMiddle(full, explicitMiddleName) {
  if (explicitMiddleName) return explicitMiddleName;
  if (!full) return '';
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 2) return '';
  return parts.slice(1, parts.length - 1).join(' ');
}

function getInclusiveDates(leave) {
  if (!Array.isArray(leave.dateRanges) || leave.dateRanges.length === 0) {
    if (leave.startDate || leave.endDate) {
      const from = formatDate(leave.startDate);
      const to = formatDate(leave.endDate);
      return from && to ? `${from} - ${to}` : from || to;
    }
    return '';
  }

  // Collect all dates from ranges
  const allDates = [];
  leave.dateRanges.forEach((range) => {
    const startStr = range.startDate || range.from || range.dateFrom;
    const endStr = range.endDate || range.to || range.dateTo;
    
    if (!startStr || !endStr) return;
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;
    
    const current = new Date(start);
    while (current <= end) {
      allDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  });

  if (allDates.length === 0) return '';

  // Sort and deduplicate by converting to ISO date string
  const uniqueDateStrings = [...new Set(allDates.map(d => d.toISOString().split('T')[0]))];
  const uniqueDates = uniqueDateStrings.map(str => new Date(str + 'T00:00:00')).sort((a, b) => a - b);

  // Group by month/year
  const groups = [];
  let currentGroup = [];
  let currentMonth = null;
  let currentYear = null;

  uniqueDates.forEach((date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    
    if (currentMonth !== month || currentYear !== year) {
      if (currentGroup.length > 0) {
        groups.push({ dates: currentGroup, month: currentMonth, year: currentYear });
      }
      currentGroup = [date];
      currentMonth = month;
      currentYear = year;
    } else {
      currentGroup.push(date);
    }
  });

  if (currentGroup.length > 0) {
    groups.push({ dates: currentGroup, month: currentMonth, year: currentYear });
  }

  // Format each group
  const result = groups.map((group) => {
    const monthName = group.dates[0].toLocaleDateString(undefined, { month: 'long' });
    const year = group.dates[0].getFullYear();
    
    // Format dates within the month
    const dateTokens = [];
    let i = 0;
    while (i < group.dates.length) {
      const startDay = group.dates[i].getDate();
      
      // Check for consecutive dates
      let j = i + 1;
      while (j < group.dates.length && group.dates[j].getDate() === group.dates[j - 1].getDate() + 1) {
        j++;
      }
      
      const endDay = group.dates[j - 1].getDate();
      const consecutiveCount = j - i;
      
      if (consecutiveCount >= 3) {
        // Range of 3+ consecutive dates
        dateTokens.push(`${startDay}-${endDay}`);
      } else if (consecutiveCount === 2) {
        // Two consecutive dates - show as comma separated
        dateTokens.push(`${startDay},${endDay}`);
      } else {
        // Single date
        dateTokens.push(String(startDay));
      }
      
      i = j;
    }
    
    return `${monthName} ${dateTokens.join(',')} ${year}`;
  });

  return result.join('\n');
}

function computeWorkingDays(dateRanges) {
  if (!Array.isArray(dateRanges) || dateRanges.length === 0) return '';
  let totalDays = 0;

  dateRanges.forEach((range) => {
    const fromValue = range.startDate || range.from || range.dateFrom;
    const toValue = range.endDate || range.to || range.dateTo;
    if (!fromValue || !toValue) return;

    const from = new Date(fromValue);
    const to = new Date(toValue);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return;

    const diffMs = to.getTime() - from.getTime();
    totalDays += Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  });

  return totalDays > 0 ? totalDays : '';
}

export default function PrintableLeaveForm() {
  return null;
}
