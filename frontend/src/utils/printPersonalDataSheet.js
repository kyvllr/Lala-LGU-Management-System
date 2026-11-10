const asText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const escapeHtml = (value) => {
  return asText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return asText(value);
  return date.toLocaleDateString('en-US');
};

const fullName = (...parts) => parts.map(asText).filter(Boolean).join(' ');

const yesNo = (value) => (asText(value).toUpperCase() === 'Y' ? 'Yes' : 'No');

const checkMark = (checked) => `<span class="chk${checked ? ' on' : ''}"></span>`;

const addressText = (address) => {
  if (!address || typeof address !== 'object') return '';
  const parts = [
    address.houseBlockLotNo,
    address.street,
    address.subdivisionVillage,
    address.barangay,
    address.cityMunicipality,
    address.province,
    address.zipCode,
  ].map(asText).filter(Boolean);
  return parts.join(', ');
};

const renderAddressGrid = (address = {}) => {
  return `
    <table class="addr-grid">
      <tr>
        <td class="addr-label">House/Block/Lot No.</td>
        <td class="addr-label">Street</td>
      </tr>
      <tr>
        <td class="addr-value">${escapeHtml(address.houseBlockLotNo)}</td>
        <td class="addr-value">${escapeHtml(address.street)}</td>
      </tr>
      <tr>
        <td class="addr-label">Subdivision/Village</td>
        <td class="addr-label">Barangay</td>
      </tr>
      <tr>
        <td class="addr-value">${escapeHtml(address.subdivisionVillage)}</td>
        <td class="addr-value">${escapeHtml(address.barangay)}</td>
      </tr>
      <tr>
        <td class="addr-label">City/Municipality</td>
        <td class="addr-label">Province</td>
      </tr>
      <tr>
        <td class="addr-value">${escapeHtml(address.cityMunicipality)}</td>
        <td class="addr-value">${escapeHtml(address.province)}</td>
      </tr>
    </table>
  `;
};

const renderRows = (rows, emptyMessage = 'No records') => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `<tr><td colspan="99" class="empty">${escapeHtml(emptyMessage)}</td></tr>`;
  }
  return rows.join('');
};

const renderList = (items) => {
  if (!Array.isArray(items) || items.length === 0) return 'N/A';
  const values = items.map(asText).filter(Boolean);
  return values.length ? escapeHtml(values.join(', ')) : 'N/A';
};

const renderTable = (title, headers, bodyRows) => {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  return `
    <section class="section">
      <h3>${escapeHtml(title)}</h3>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${renderRows(bodyRows)}</tbody>
      </table>
    </section>
  `;
};

const row = (cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;

const renderHtmlDocument = (record) => {
  const spouse = record?.familyBackground?.spouse || {};
  const father = record?.familyBackground?.father || {};
  const mother = record?.familyBackground?.mother || {};
  const children = Array.isArray(record?.familyBackground?.children) ? record.familyBackground.children : [];
  const education = Array.isArray(record?.educationalBackground) ? record.educationalBackground : [];
  const civilService = Array.isArray(record?.civilServiceEligibilities) ? record.civilServiceEligibilities : [];
  const workExperience = Array.isArray(record?.workExperience) ? record.workExperience : [];
  const voluntaryWork = Array.isArray(record?.voluntaryWork) ? record.voluntaryWork : [];
  const learningDevelopment = Array.isArray(record?.learningDevelopment) ? record.learningDevelopment : [];
  const references = Array.isArray(record?.references) ? record.references : [];
  const photoDataUrl = /^data:image\/(?:jpeg|png|webp);base64,/.test(record?.photoDataUrl || '')
    ? record.photoDataUrl
    : '';

  const educationRows = education.map((item) => row([
    item?.level,
    item?.schoolName,
    item?.basicEducationDegreeCourse,
    item?.periodFrom,
    item?.periodTo,
    item?.highestLevelUnitsEarned,
    item?.yearGraduated,
    item?.scholarshipAcademicHonorsReceived,
  ]));

  const civilServiceRows = civilService.map((item) => row([
    item?.eligibilityType,
    item?.rating,
    formatDate(item?.dateOfExaminationOrConferment),
    item?.placeOfExaminationOrConferment,
    item?.licenseNumber,
    formatDate(item?.licenseValidUntil),
  ]));

  const workRows = workExperience.map((item) => row([
    formatDate(item?.inclusiveDatesFrom || item?.from),
    formatDate(item?.inclusiveDatesTo || item?.to),
    item?.positionTitle,
    item?.departmentAgencyOfficeCompany || item?.company,
    item?.monthlySalary,
    item?.salaryJobPayGrade,
    item?.statusOfAppointment,
    item?.governmentService || item?.govtService,
  ]));

  const voluntaryRows = voluntaryWork.map((item) => row([
    item?.organizationNameAndAddress || item?.organization,
    formatDate(item?.inclusiveDatesFrom || item?.from),
    formatDate(item?.inclusiveDatesTo || item?.to),
    item?.numberOfHours,
    item?.positionNatureOfWork,
  ]));

  const learningRows = learningDevelopment.map((item) => row([
    item?.titleOfLearningAndDevelopmentInterventionsTrainingPrograms || item?.title,
    formatDate(item?.inclusiveDatesFrom || item?.from),
    formatDate(item?.inclusiveDatesTo || item?.to),
    item?.numberOfHours || item?.hours,
    item?.typeOfLdManagerialSupervisoryTechnicalEtc || item?.type,
    item?.conductedSponsoredBy || item?.conductedBy,
  ]));

  const childrenRows = children.map((item) => row([item?.name, formatDate(item?.dateOfBirth)]));
  const referenceRows = references.map((item) => row([item?.name, item?.address, item?.contact]));

  const buildCivilRows = (totalRows = 7) => {
    return Array.from({ length: totalRows }, (_, index) => {
      const item = civilService[index] || {};
      return `
        <tr>
          <td>${escapeHtml(item?.eligibilityType)}</td>
          <td>${escapeHtml(item?.rating)}</td>
          <td>${escapeHtml(formatDate(item?.dateOfExaminationOrConferment))}</td>
          <td>${escapeHtml(item?.placeOfExaminationOrConferment)}</td>
          <td>${escapeHtml(item?.licenseNumber)}</td>
          <td>${escapeHtml(formatDate(item?.licenseValidUntil))}</td>
        </tr>
      `;
    }).join('');
  };

  const buildWorkRows = (totalRows = 24) => {
    return Array.from({ length: totalRows }, (_, index) => {
      const item = workExperience[index] || {};
      const salaryValue = asText(item?.monthlySalary);
      const monthlySalary = salaryValue && !Number.isNaN(Number(salaryValue.replace(/[₱,\s]/g, '')))
        ? `₱${Number(salaryValue.replace(/[₱,\s]/g, '')).toLocaleString('en-PH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
        : salaryValue;
      return `
        <tr>
          <td class="date-col">${escapeHtml(formatDate(item?.inclusiveDatesFrom || item?.from))}</td>
          <td class="date-col">${escapeHtml(formatDate(item?.inclusiveDatesTo || item?.to))}</td>
          <td>${escapeHtml(item?.positionTitle)}</td>
          <td>${escapeHtml(item?.departmentAgencyOfficeCompany || item?.company)}</td>
          <td class="salary-col">${escapeHtml(monthlySalary)}</td>
          <td class="salary-col">${escapeHtml(item?.salaryJobPayGrade)}</td>
          <td>${escapeHtml(item?.statusOfAppointment)}</td>
          <td class="gov-col">${escapeHtml(asText(item?.governmentService || item?.govtService).toUpperCase())}</td>
        </tr>
      `;
    }).join('');
  };

  const toList = (value) => {
    if (Array.isArray(value)) {
      return value.map(asText).filter(Boolean);
    }
    const text = asText(value);
    if (!text) return [];
    return text.split(',').map((item) => item.trim()).filter(Boolean);
  };

  const isAffirmative = (value) => ['y', 'yes', 'true', '1'].includes(asText(value).toLowerCase());
  const isNegative = (value) => ['n', 'no', 'false', '0'].includes(asText(value).toLowerCase());
  const yesNoChecks = (value) => `${checkMark(isAffirmative(value))} YES &nbsp;&nbsp;&nbsp; ${checkMark(isNegative(value))} NO`;

  const buildVoluntaryRows = (totalRows = 7) => {
    return Array.from({ length: totalRows }, (_, index) => {
      const item = voluntaryWork[index] || {};
      return `
        <tr>
          <td>${escapeHtml(item?.organizationNameAndAddress || item?.organizationName || item?.organization)}</td>
          <td class="date-col">${escapeHtml(formatDate(item?.inclusiveDatesFrom || item?.from))}</td>
          <td class="date-col">${escapeHtml(formatDate(item?.inclusiveDatesTo || item?.to))}</td>
          <td class="hours-col">${escapeHtml(item?.numberOfHours || item?.hours)}</td>
          <td>${escapeHtml(item?.positionNatureOfWork || item?.position || item?.natureOfWork)}</td>
        </tr>
      `;
    }).join('');
  };

  const buildLearningRows = (totalRows = 20) => {
    return Array.from({ length: totalRows }, (_, index) => {
      const item = learningDevelopment[index] || {};
      return `
        <tr>
          <td>${escapeHtml(item?.titleOfLearningAndDevelopmentInterventionsTrainingPrograms || item?.title)}</td>
          <td class="date-col">${escapeHtml(formatDate(item?.inclusiveDatesFrom || item?.from))}</td>
          <td class="date-col">${escapeHtml(formatDate(item?.inclusiveDatesTo || item?.to))}</td>
          <td class="hours-col">${escapeHtml(item?.numberOfHours || item?.hours)}</td>
          <td>${escapeHtml(item?.typeOfLdManagerialSupervisoryTechnicalEtc || item?.type)}</td>
          <td>${escapeHtml(item?.conductedSponsoredBy || item?.conductedBy)}</td>
        </tr>
      `;
    }).join('');
  };

  const buildOtherInfoRows = (totalRows = 7) => {
    const skills = toList(record?.specialSkills);
    const distinctionsList = toList(record?.distinctions);
    const membershipsList = toList(record?.memberships);

    return Array.from({ length: totalRows }, (_, index) => {
      return `
        <tr>
          <td>${escapeHtml(skills[index])}</td>
          <td>${escapeHtml(distinctionsList[index])}</td>
          <td>${escapeHtml(membershipsList[index])}</td>
        </tr>
      `;
    }).join('');
  };

  const sexAtBirth = asText(record?.sexAtBirth || record?.sex || record?.gender).toLowerCase();
  const civilStatus = asText(record?.civilStatus).toLowerCase();
  const citizenshipType = asText(record?.citizenship?.type || record?.citizenship).toLowerCase();
  const dualMode = asText(record?.citizenship?.dualCitizenshipMode).toLowerCase();

  const getEducationByLevel = (keyword) => {
    return education.find((item) => asText(item?.level).toLowerCase().includes(keyword)) || {};
  };

  const elementary = getEducationByLevel('elementary');
  const secondary = getEducationByLevel('secondary');
  const vocational = getEducationByLevel('vocational');
  const college = getEducationByLevel('college');
  const graduate = getEducationByLevel('graduate');

  const firstPage = `
    <div class="page pds-page-1">
      <div class="pds-sheet">
        <div class="pds-top">
          <div class="pds-form-meta">
            <div class="meta-main">CS Form No. 212</div>
            <div class="meta-sub">Revised 2025</div>
          </div>
          <div class="pds-title">PERSONAL DATA SHEET</div>
        </div>
        <div class="pds-note warning">WARNING: Any misrepresentation made in the Personal Data Sheet and the Work Experience Sheet shall cause the filing of administrative/criminal case/s against the person concerned.</div>
        <div class="pds-note" style="font-weight: bold;">READ THE ATTACHED GUIDE TO FILLING OUT THE PERSONAL DATA SHEET (PDS) BEFORE ACCOMPLISHING THE PDS FORM.</div>
        <div class="pds-note">Print legibly if accomplished through own handwriting. Tick appropriate boxes () and use separate sheet if necessary. Indicate N/A if not applicable. DO NOT ABBREVIATE.</div>

        <div class="pds-section-header">I. PERSONAL INFORMATION</div>
        <table class="pds-table">
          <tr>
            <td class="pds-field w18 name-col first">1. SURNAME</td>
            <td class="pds-value" colspan="3">${escapeHtml(record?.surname)}</td>
          </tr>
          <tr>
            <td class="pds-field name-col">2. FIRST NAME</td>
            <td class="pds-value" colspan="2">${escapeHtml(record?.firstName)}</td>
            <td class="pds-value small">NAME EXTENSION (JR., SR) <br/> ${escapeHtml(record?.nameExtension)}</td>
          </tr>
          <tr>
            <td class="pds-field name-col last">MIDDLE NAME</td>
            <td class="pds-value" colspan="3">${escapeHtml(record?.middleName)}</td>
          </tr>
          <tr>
            <td class="pds-field">3. DATE OF BIRTH (dd/mm/yyyy)</td>
            <td class="pds-value">${escapeHtml(formatDate(record?.dateOfBirth))}</td>
            <td class="pds-field" rowspan="4">16. CITIZENSHIP<br/><br/>If holder of dual citizenship,<br/>please indicate the details.</td>
            <td class="pds-value" rowspan="4">
              ${checkMark(citizenshipType === 'filipino')} Filipino &nbsp;&nbsp;&nbsp;
              ${checkMark(citizenshipType.includes('dual'))} Dual Citizenship<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${checkMark(dualMode === 'by birth')} by birth &nbsp;&nbsp;
              ${checkMark(dualMode === 'by naturalization')} by naturalization<br/>
              Pls. indicate country: ${escapeHtml(record?.citizenship?.dualCitizenshipCountry)}
            </td>
          </tr>
          <tr>
            <td class="pds-field">4. PLACE OF BIRTH</td>
            <td class="pds-value">${escapeHtml(record?.placeOfBirth)}</td>
          </tr>
          <tr>
            <td class="pds-field">5. SEX AT BIRTH</td>
            <td class="pds-value">${checkMark(sexAtBirth.startsWith('m'))} Male &nbsp;&nbsp;&nbsp; ${checkMark(sexAtBirth.startsWith('f'))} Female</td>
          </tr>
          <tr>
            <td class="pds-field">6. CIVIL STATUS</td>
            <td class="pds-value">
              ${checkMark(civilStatus === 'single')} Single &nbsp;&nbsp;&nbsp; ${checkMark(civilStatus === 'married')} Married<br/>
              ${checkMark(civilStatus === 'widowed')} Widowed &nbsp;&nbsp;&nbsp; ${checkMark(civilStatus === 'separated')} Separated<br/>
              ${checkMark(!['single', 'married', 'widowed', 'separated'].includes(civilStatus) && Boolean(civilStatus))} Other/s: ${escapeHtml(record?.civilStatus)}
            </td>
          </tr>
          <tr>
            <td class="pds-field">7. HEIGHT (m)</td>
            <td class="pds-value">${escapeHtml(record?.height)}</td>
            <td class="pds-field" rowspan="2">17. RESIDENTIAL ADDRESS <br/><br/><br/><br/><br/><br/><br/><br/><br/> ZIP CODE </td>
            <td class="pds-value">${renderAddressGrid(record?.residentialAddress || {})}</td>
          </tr>
          <tr>
            <td class="pds-field">8. WEIGHT (kg)</td>
            <td class="pds-value">${escapeHtml(record?.weight)}</td>
            <td class="pds-value"> ${escapeHtml(record?.residentialAddress?.zipCode)}</td>
          </tr>
          <tr>
            <td class="pds-field">9. BLOOD TYPE</td>
            <td class="pds-value">${escapeHtml(record?.bloodType)}</td>
            <td class="pds-field" rowspan="2">18. PERMANENT ADDRESS <br/><br/><br/><br/><br/><br/><br/><br/><br/> ZIP CODE</td>
            <td class="pds-value">${renderAddressGrid(record?.permanentAddress || {})}</td>
          </tr>
          <tr>
            <td class="pds-field">10. UMID ID NO.</td>
            <td class="pds-value">${escapeHtml(record?.gsisNo)}</td>
            <td class="pds-value"> ${escapeHtml(record?.permanentAddress?.zipCode)}</td>
          </tr>
          <tr>
            <td class="pds-field">11. PAG-IBIG ID NO.</td>
            <td class="pds-value">${escapeHtml(record?.pagibigNo)}</td>
            <td class="pds-field">19. TELEPHONE NO.</td>
            <td class="pds-value">${escapeHtml(record?.telephone)}</td>
          </tr>
          <tr>
            <td class="pds-field">12. PHILHEALTH NO.</td>
            <td class="pds-value">${escapeHtml(record?.philhealthNo)}</td>
            <td class="pds-field">20. MOBILE NO.</td>
            <td class="pds-value">${escapeHtml(record?.mobile)}</td>
          </tr>
          <tr>
            <td class="pds-field">13. PhilSys Number (PSN):</td>
            <td class="pds-value">${escapeHtml(record?.sssNo)}</td>
            <td class="pds-field">21. E-MAIL ADDRESS (if any)</td>
            <td class="pds-value">${escapeHtml(record?.email)}</td>
          </tr>
          <tr>
            <td class="pds-field">14. TIN NO.</td>
            <td class="pds-value">${escapeHtml(record?.tinNo)}</td>
            <td class="pds-field"></td>
            <td class="pds-value"></td>
          </tr>
          <tr>
            <td class="pds-field" style="font-size: 8px;">15. AGENCY EMPLOYEE NO.</td>
            <td class="pds-value">${escapeHtml(record?.agencyEmployeeNo)}</td>
            <td class="pds-field"></td>
            <td class="pds-value"></td>
          </tr>
        </table>

        <div class="pds-section-header">II. FAMILY BACKGROUND</div>
        <table class="pds-table">
          <tr>
            <td class="pds-field">22. SPOUSE'S SURNAME</td>
            <td class="pds-value">${escapeHtml(spouse?.surname)}</td>
            <td class="pds-field">23. NAME OF CHILDREN (Write full name and list all)</td>
            <td class="pds-field small">DATE OF BIRTH <br/>(dd/mm/yyyy)</td>
          </tr>
          <tr>
            <td class="pds-field">FIRST NAME</td>
            <td class="pds-value">${escapeHtml(spouse?.firstName)}</td>
            <td class="pds-value">${escapeHtml(children[0]?.name)}</td>
            <td class="pds-value">${escapeHtml(formatDate(children[0]?.dateOfBirth))}</td>
          </tr>
          <tr>
            <td class="pds-field">MIDDLE NAME</td>
            <td class="pds-value">${escapeHtml(spouse?.middleName)} ${escapeHtml(spouse?.nameExtension)}</td>
            <td class="pds-value">${escapeHtml(children[1]?.name)}</td>
            <td class="pds-value">${escapeHtml(formatDate(children[1]?.dateOfBirth))}</td>
          </tr>
          <tr>
            <td class="pds-field">OCCUPATION</td>
            <td class="pds-value">${escapeHtml(spouse?.occupation)}</td>
            <td class="pds-value">${escapeHtml(children[2]?.name)}</td>
            <td class="pds-value">${escapeHtml(formatDate(children[2]?.dateOfBirth))}</td>
          </tr>
          <tr>
            <td class="pds-field">EMPLOYER/BUSINESS NAME</td>
            <td class="pds-value">${escapeHtml(spouse?.employerBusinessName)}</td>
            <td class="pds-value">${escapeHtml(children[3]?.name)}</td>
            <td class="pds-value">${escapeHtml(formatDate(children[3]?.dateOfBirth))}</td>
          </tr>
          <tr>
            <td class="pds-field">BUSINESS ADDRESS</td>
            <td class="pds-value">${escapeHtml(spouse?.businessAddress)}</td>
            <td class="pds-value">${escapeHtml(children[4]?.name)}</td>
            <td class="pds-value">${escapeHtml(formatDate(children[4]?.dateOfBirth))}</td>
          </tr>
          <tr>
            <td class="pds-field">TELEPHONE NO.</td>
            <td class="pds-value">${escapeHtml(spouse?.telephone)}</td>
            <td class="pds-value">${escapeHtml(children[5]?.name)}</td>
            <td class="pds-value">${escapeHtml(formatDate(children[5]?.dateOfBirth))}</td>
          </tr>
          <tr>
            <td class="pds-field">24. FATHER'S SURNAME</td>
            <td class="pds-value">${escapeHtml(father?.surname)}</td>
            <td class="pds-value">${escapeHtml(children[6]?.name)}</td>
            <td class="pds-value">${escapeHtml(formatDate(children[6]?.dateOfBirth))}</td>
          </tr>
          <tr>
            <td class="pds-field">FIRST NAME</td>
            <td class="pds-value">${escapeHtml(father?.firstName)} ${escapeHtml(father?.nameExtension)}</td>
            <td class="pds-value">${escapeHtml(children[7]?.name)}</td>
            <td class="pds-value">${escapeHtml(formatDate(children[7]?.dateOfBirth))}</td>
          </tr>
          <tr>
            <td class="pds-field">MIDDLE NAME</td>
            <td class="pds-value">${escapeHtml(father?.middleName)}</td>
            <td class="pds-value">${escapeHtml(children[8]?.name)}</td>
            <td class="pds-value">${escapeHtml(formatDate(children[8]?.dateOfBirth))}</td>
          </tr>
          <tr>
            <td class="pds-field">25. MOTHER'S MAIDEN NAME</td>
            <td class="pds-value">${escapeHtml(mother?.surname)}</td>
            <td class="pds-value">${escapeHtml(children[9]?.name)}</td>
            <td class="pds-value">${escapeHtml(formatDate(children[9]?.dateOfBirth))}</td>
          </tr>
          <tr>
            <td class="pds-field">FIRST NAME</td>
            <td class="pds-value">${escapeHtml(mother?.firstName)}</td>
            <td class="pds-value" colspan="2"></td>
          </tr>
          <tr>
            <td class="pds-field">MIDDLE NAME</td>
            <td class="pds-value">${escapeHtml(mother?.middleName)}</td>
            <td class="pds-value continue-note" colspan="2" style="height: 8px; font-size: 7px; text-align: center; background-color: #dddddd;">(Continue on separate sheet if necessary)</td>
          </tr>
        </table>

        <div class="pds-section-header">III. EDUCATIONAL BACKGROUND</div>
        <table class="pds-table edu-table">
          <colgroup>
            <col style="width: 10%" />
            <col style="width: 20%" />
            <col style="width: 20%" />
            <col style="width: 7%" />
            <col style="width: 7%" />
            <col style="width: 12%" />
            <col style="width: 12%" />
            <col style="width: 12%" />
          </colgroup>
          <tr>
            <th rowspan="2">26.<br/> <br/>LEVEL</th>
            <th rowspan="2">NAME OF SCHOOL<br/>(Write in full)</th>
            <th rowspan="2">BASIC EDUCATION/ <br/>DEGREE/COURSE<br/>(Write in full)</th>
            <th colspan="2" >PERIOD OF ATTENDANCE</th>
            <th rowspan="2">HIGHEST LEVEL/UNITS EARNED<br/>(if not graduated)</th>
            <th rowspan="2">YEAR GRADUATED</th>
            <th rowspan="2">SCHOLARSHIP/<br/>ACADEMIC HONORS RECEIVED</th>
          </tr>
          <tr>
            <th>From</th>
            <th>To</th>
          </tr>
          <tr>
            <td>ELEMENTARY</td>
            <td>${escapeHtml(elementary?.schoolName)}</td>
            <td>${escapeHtml(elementary?.basicEducationDegreeCourse)}</td>
            <td>${escapeHtml(elementary?.periodFrom)}</td>
            <td>${escapeHtml(elementary?.periodTo)}</td>
            <td>${escapeHtml(elementary?.highestLevelUnitsEarned)}</td>
            <td>${escapeHtml(elementary?.yearGraduated)}</td>
            <td>${escapeHtml(elementary?.scholarshipAcademicHonorsReceived)}</td>
          </tr>
          <tr>
            <td>SECONDARY</td>
            <td>${escapeHtml(secondary?.schoolName)}</td>
            <td>${escapeHtml(secondary?.basicEducationDegreeCourse)}</td>
            <td>${escapeHtml(secondary?.periodFrom)}</td>
            <td>${escapeHtml(secondary?.periodTo)}</td>
            <td>${escapeHtml(secondary?.highestLevelUnitsEarned)}</td>
            <td>${escapeHtml(secondary?.yearGraduated)}</td>
            <td>${escapeHtml(secondary?.scholarshipAcademicHonorsReceived)}</td>
          </tr>
          <tr>
            <td>VOCATIONAL / TRADE COURSE</td>
            <td>${escapeHtml(vocational?.schoolName)}</td>
            <td>${escapeHtml(vocational?.basicEducationDegreeCourse)}</td>
            <td>${escapeHtml(vocational?.periodFrom)}</td>
            <td>${escapeHtml(vocational?.periodTo)}</td>
            <td>${escapeHtml(vocational?.highestLevelUnitsEarned)}</td>
            <td>${escapeHtml(vocational?.yearGraduated)}</td>
            <td>${escapeHtml(vocational?.scholarshipAcademicHonorsReceived)}</td>
          </tr>
          <tr>
            <td>COLLEGE</td>
            <td>${escapeHtml(college?.schoolName)}</td>
            <td>${escapeHtml(college?.basicEducationDegreeCourse)}</td>
            <td>${escapeHtml(college?.periodFrom)}</td>
            <td>${escapeHtml(college?.periodTo)}</td>
            <td>${escapeHtml(college?.highestLevelUnitsEarned)}</td>
            <td>${escapeHtml(college?.yearGraduated)}</td>
            <td>${escapeHtml(college?.scholarshipAcademicHonorsReceived)}</td>
          </tr>
          <tr>
            <td>GRADUATE STUDIES</td>
            <td>${escapeHtml(graduate?.schoolName)}</td>
            <td>${escapeHtml(graduate?.basicEducationDegreeCourse)}</td>
            <td>${escapeHtml(graduate?.periodFrom)}</td>
            <td>${escapeHtml(graduate?.periodTo)}</td>
            <td>${escapeHtml(graduate?.highestLevelUnitsEarned)}</td>
            <td>${escapeHtml(graduate?.yearGraduated)}</td>
            <td>${escapeHtml(graduate?.scholarshipAcademicHonorsReceived)}</td>
          </tr>
          <tr>
            <td class="continue-note" colspan="8" style="height: 8px; font-size: 7px; text-align: center; background-color: #dddddd;">(Continue on separate sheet if necessary)</td>
          </tr>
        </table>

        <table class="pds-footer-table">
          <tr>
            <td class="pds-footer-cell" style="font-size: 13px; font-style: italic;"><strong>SIGNATURE</strong></td>
            <td class="pds-footer-cell continue-note" style="font-size: 9px; ">(wet signature/e-signature/digital certificate)</td>
            <td class="pds-footer-cell" style="font-size: 13px; font-style: italic;"><strong>DATE</strong></td>
            <td style="width: 25%;"></td>
          </tr>
        </table>
        
      </div>
      <div class="pds-page-number">CS FORM 212 (Revised 2025), Page 1 of 4</div>
    </div>
  `;

  const secondPage = `
    <div class="page pds-page-2">
      <div class="pds-sheet">
        <div class="pds-band">IV. CIVIL SERVICE ELIGIBILITY</div>
        <table class="pds-table page2-civil-table">
          <colgroup>
            <col style="width: 34%" />
            <col style="width: 14%" />
            <col style="width: 14%" />
            <col style="width: 18%" />
            <col style="width: 10%" />
            <col style="width: 10%" />
          </colgroup>
          <tr>
            <th rowspan="2">27. CS/SC/CE/CAREER SERVICE/RA 1080 (BOARD/BAR) UNDER SPECIAL LAWS/CATEGORY IV/ ELIGIBILITY and ELIGIBILITIES FOR UNIFORMED PERSONNEL</th>
            <th rowspan="2">RATING<br/><span class="thin">(If Applicable)</span></th>
            <th rowspan="2">DATE OF EXAMINATION / CONFERMENT</th>
            <th rowspan="2">PLACE OF EXAMINATION / CONFERMENT</th>
            <th colspan="2">LICENSE (if applicable)</th>
          </tr>
          <tr>
            <th>NUMBER</th>
            <th>Valid Until</th>
          </tr>
          ${buildCivilRows(7)}
          <tr>
            <td class="continue-note" colspan="7" style="height: 8px; font-size: 7px; text-align: center; background-color: #dddddd;">(Continue on separate sheet if necessary)</td>
          </tr>
        </table>

        <div class="pds-band no-inner-border">V. WORK EXPERIENCE</div>
        <div class="pds-band-sub">(Include private employment. Start from your recent work.) Description of duties should be indicated in the attached Work Experience Sheet.</div>
        <table class="pds-table page2-work-table">
          <colgroup>
            <col style="width: 8%" />
            <col style="width: 8%" />
            <col style="width: 22%" />
            <col style="width: 22%" />
            <col style="width: 10%" />
            <col style="width: 10%" />
            <col style="width: 11%" />
            <col style="width: 9%" />
          </colgroup>
          <tr>
            <th colspan="2">28. INCLUSIVE DATES<br/><span class="thin">(dd/mm/yy)</span></th>
            <th rowspan="2">POSITION TITLE<br/><span class="thin">(Write in full/Do not abbreviate)</span></th>
            <th rowspan="2">DEPARTMENT / AGENCY / OFFICE / COMPANY<br/><span class="thin">(Write in full/Do not abbreviate)</span></th>
            <th rowspan="2">MONTHLY SALARY</th>
            <th rowspan="2">SALARY / JOB / PAY GRADE (if applicable) &amp; STEP INCREMENT<br/><span class="thin">(Format "00-0")</span></th>
            <th rowspan="2">STATUS OF APPOINTMENT</th>
            <th rowspan="2">GOV'T SERVICE<br/><span class="thin">(Y / N)</span></th>
          </tr>
          <tr>
            <th>From</th>
            <th>To</th>
          </tr>
          ${buildWorkRows(30)}
          <tr>
            <td class="continue-note" colspan="8" style="height: 8px; font-size: 7px; text-align: center; background-color: #dddddd;">(Continue on separate sheet if necessary)</td>
          </tr>
        </table>

        <table class="pds-footer-table page2-footer-table">
          <tr>
        <td class="pds-footer-cell"><strong>SIGNATURE</strong></td>
            <td class="pds-footer-cell continue-note" style="font-size: 9px;">(wet signature/e-signature/digital certificate)</td>
            <td class="pds-footer-cell"><strong>DATE</strong></td>
            <td style="width: 25%;"></td>
          </tr>
        </table>
      </div>
      <div class="pds-page-number">CS FORM 212 (Revised 2025), Page 2 of 4</div>
    </div>
  `;

  const thirdPage = `
    <div class="page pds-page-3">
      <div class="pds-sheet">
        <div class="pds-band page3-band">VI. VOLUNTARY WORK OR INVOLVEMENT IN CIVIC / NON-GOVERNMENT / PEOPLE / VOLUNTARY ORGANIZATION/S</div>
        <table class="pds-table page3-voluntary-table">
          <colgroup>
            <col style="width: 35%" />
            <col style="width: 10%" />
            <col style="width: 10%" />
            <col style="width: 10%" />
            <col style="width: 35%" />
          </colgroup>
          <tr>
            <th rowspan="2">29. NAME &amp; ADDRESS OF ORGANIZATION<br/><span class="thin">(Write in full)</span></th>
            <th colspan="2">INCLUSIVE DATES<br/><span class="thin">(dd/mm/yyyy)</span></th>
            <th rowspan="2">NUMBER OF HOURS</th>
            <th rowspan="2">POSITION / NATURE OF WORK</th>
          </tr>
          <tr>
            <th>From</th>
            <th>To</th>
          </tr>
          ${buildVoluntaryRows(7)}
          <tr>
            <td class="continue-note continue-strip" colspan="5" style="height: 8px; font-size: 7px; text-align: center; background-color: #dddddd;">(Continue on separate sheet if necessary)</td>
          </tr>
        </table>

        <div class="pds-band page3-band">VII. LEARNING AND DEVELOPMENT (L&amp;D) INTERVENTIONS/TRAINING PROGRAMS ATTENDED</div>
        <table class="pds-table page3-learning-table">
          <colgroup>
            <col style="width: 35%" />
            <col style="width: 10%" />
            <col style="width: 10%" />
            <col style="width: 10%" />
            <col style="width: 10%" />
            <col style="width: 25%" />
          </colgroup>
          <tr>
            <th rowspan="2">30. TITLE OF LEARNING AND DEVELOPMENT INTERVENTIONS/TRAINING PROGRAMS<br/><span class="thin">(Write in full)</span></th>
            <th colspan="2">INCLUSIVE DATES OF ATTENDANCE<br/><span class="thin">(dd/mm/yyyy)</span></th>
            <th rowspan="2">NUMBER OF HOURS</th>
            <th rowspan="2">Type of L&amp;D<br/><span class="thin">(Managerial/Supervisory/Technical/etc)</span></th>
            <th rowspan="2">CONDUCTED/ SPONSORED BY<br/><span class="thin">(Write in full)</span></th>
          </tr>
          <tr>
            <th>From</th>
            <th>To</th>
          </tr>
          ${buildLearningRows(20)}
          <tr>
            <td class="continue-note continue-strip" colspan="6" style="height: 8px; font-size: 7px; text-align: center; background-color: #dddddd;">(Continue on separate sheet if necessary)</td>
          </tr>
        </table>

        <div class="pds-band page3-band">VIII. OTHER INFORMATION</div>
        <table class="pds-table page3-other-table">
          <colgroup>
            <col style="width: 26%" />
            <col style="width: 49%" />
            <col style="width: 25%" />
          </colgroup>
          <tr>
            <th>31. SPECIAL SKILLS and HOBBIES<br/><span class="thin">(Write in full)</span></th>
            <th>32. NON-ACADEMIC DISTINCTIONS / RECOGNITION<br/><span class="thin">(Write in full)</span></th>
            <th>33. MEMBERSHIP IN ASSOCIATION/ORGANIZATION<br/><span class="thin">(Write in full)</span></th>
          </tr>
          ${buildOtherInfoRows(7)}
          <tr>
            <td class="continue-note continue-strip" colspan="3" style="height: 8px; font-size: 7px; text-align: center; background-color: #dddddd;">(Continue on separate sheet if necessary)</td>
          </tr>
        </table>

        <table class="pds-footer-table page3-footer-table">
          <tr>
            <td class="pds-footer-cell"><strong>SIGNATURE</strong></td>
            <td class="pds-footer-cell continue-note" style="font-size: 9px;">(wet signature/e-signature/digital certificate)</td>
            <td class="pds-footer-cell"><strong>DATE</strong></td>
            <td style="width: 25%;"></td>
          </tr>
        </table>
      </div>
      <div class="pds-page-number">CS FORM 212 (Revised 2025), Page 3 of 4</div>
    </div>
  `;

  const refs = [references[0] || {}, references[1] || {}, references[2] || {}];

  const fourthPage = `
    <div class="page pds-page-4">
      <div class="pds-sheet">
        <table class="pds-table page4-q-table">
          <colgroup>
            <col style="width: 64%" />
            <col style="width: 36%" />
          </colgroup>
          <tr>
            <td class="q-left">
              <div class="q-num">34.</div>
              <div class="q-text">Are you related by consanguinity or affinity to the appointing or recommending authority, or to the chief of bureau or office or to the person who has immediate supervision over you in the Office, Bureau or Department where you will be appointed,</div>
              <div class="sub-q">a. within the third degree?</div>
              <div class="sub-q">b. within the fourth degree (for Local Government Unit - Career Employees)?</div>
            </td>
            <td class="q-right">
              <div class="yn-row">${yesNoChecks(record?.relatedThirdDegree)}</div>
              <div class="yn-row">${yesNoChecks(record?.relatedFourthDegree)}</div>
              <div class="detail-label">If YES, give details:</div>
              <div class="line-fill">${escapeHtml(record?.relatedDetails)}</div>
            </td>
          </tr>
          <tr>
            <td class="q-left">
              <div class="q-num">35.</div>
              <div class="sub-q">a. Have you ever been found guilty of any administrative offense?</div>
              <div class="sub-q" style="margin-top: 14px;">b. Have you been criminally charged before any court?</div>
            </td>
            <td class="q-right">
              <div class="yn-row">${yesNoChecks(record?.adminOffense)}</div>
              <div class="detail-label">If YES, give details:</div>
              <div class="line-fill">${escapeHtml(record?.adminOffenseDetails)}</div>
              <div class="yn-row" style="margin-top: 6px;">${yesNoChecks(record?.criminalCharge)}</div>
              <div class="detail-label">If YES, give details:</div>
              <div class="line-fill">${escapeHtml(record?.criminalChargeDetails)}</div>
              <div class="detail-inline"><span>Date Filed:</span><span class="line-fill short">${escapeHtml(formatDate(record?.criminalChargeDateFiled))}</span></div>
              <div class="detail-inline"><span>Status of Case/s:</span><span class="line-fill short">${escapeHtml(record?.criminalChargeStatus)}</span></div>
            </td>
          </tr>
          <tr>
            <td class="q-left">
              <div class="q-num">36.</div>
              <div class="q-text">Have you ever been convicted of any crime or violation of any law, decree, ordinance or regulation by any court or tribunal?</div>
            </td>
            <td class="q-right">
              <div class="yn-row">${yesNoChecks(record?.convicted)}</div>
              <div class="detail-label">If YES, give details:</div>
              <div class="line-fill">${escapeHtml(record?.convictedDetails)}</div>
            </td>
          </tr>
          <tr>
            <td class="q-left">
              <div class="q-num">37.</div>
              <div class="q-text">Have you ever been separated from the service in any of the following modes: resignation, retirement, dropped from the roles, dismissal, termination, end of term, finished contract or phased out (abolition) in the public or private sector?</div>
            </td>
            <td class="q-right">
              <div class="yn-row">${yesNoChecks(record?.separated)}</div>
              <div class="detail-label">If YES, give details:</div>
              <div class="line-fill">${escapeHtml(record?.separatedDetails)}</div>
            </td>
          </tr>
          <tr>
            <td class="q-left">
              <div class="q-num">38.</div>
              <div class="sub-q">a. Have you ever been a candidate in a national or local election held within the last year (except Barangay election)?</div>
              <div class="sub-q" style="margin-top: 12px;">b. Have you resigned from the government service during the three (3)-month period before the last election to promote/actively campaign for a national or local candidate?</div>
            </td>
            <td class="q-right">
              <div class="yn-row">${yesNoChecks(record?.candidate)}</div>
              <div class="detail-label">If YES, give details:</div>
              <div class="line-fill">${escapeHtml(record?.candidateDetails)}</div>
              <div class="yn-row" style="margin-top: 6px;">${yesNoChecks(record?.resignedToCampaign)}</div>
              <div class="detail-label">If YES, give details:</div>
              <div class="line-fill">${escapeHtml(record?.resignedDetails)}</div>
            </td>
          </tr>
          <tr>
            <td class="q-left">
              <div class="q-num">39.</div>
              <div class="q-text">Have you acquired the status of an immigrant or permanent resident of another country?</div>
            </td>
            <td class="q-right">
              <div class="yn-row">${yesNoChecks(record?.immigrant)}</div>
              <div class="detail-label">If YES, give details (country):</div>
              <div class="line-fill">${escapeHtml(record?.immigrantCountry)}</div>
            </td>
          </tr>
          <tr>
            <td class="q-left">
              <div class="q-num">40.</div>
              <div class="q-text">Pursuant to: (a) Indigenous People's Act (RA 8371); (b) Magna Carta for Disabled Persons (RA 7277, as amended); and (c) Expanded Solo Parents Welfare Act (RA 11861), please answer the following items:</div>
              <div class="sub-q">a. Are you a member of any indigenous group?</div>
              <div class="sub-q">b. Are you a person with disability?</div>
              <div class="sub-q">c. Are you a solo parent?</div>
            </td>
            <td class="q-right">
              <div class="yn-row">${yesNoChecks(record?.indigenous)}</div>
              <div class="detail-inline"><span>If YES, please specify:</span><span class="line-fill short">${escapeHtml(record?.indigenousDetails)}</span></div>
              <div class="yn-row" style="margin-top: 6px;">${yesNoChecks(record?.pwd)}</div>
              <div class="detail-inline"><span>If YES, please specify ID No:</span><span class="line-fill short">${escapeHtml(record?.pwdId)}</span></div>
              <div class="yn-row" style="margin-top: 6px;">${yesNoChecks(record?.soloParent)}</div>
              <div class="detail-inline"><span>If YES, please specify ID No:</span><span class="line-fill short">${escapeHtml(record?.soloParentId)}</span></div>
            </td>
          </tr>
        </table>

        <div class="page4-ref-photo-wrap">
          <table class="pds-table page4-ref-table">
            <tr>
              <th colspan="3" style="text-align: left;" class="thin">41. REFERENCES <span style="font-weight: bold;">(Person not related by consanguinity or affinity to applicant / appointee)</span></th>
            </tr>
            <tr>
              <th>NAME</th>
              <th>OFFICE / RESIDENTIAL ADDRESS</th>
              <th>CONTACT NO. AND/OR EMAIL</th>
            </tr>
            <tr>
              <td>${escapeHtml(refs[0]?.name)}</td>
              <td>${escapeHtml(refs[0]?.address)}</td>
              <td>${escapeHtml(refs[0]?.contact)}</td>
            </tr>
            <tr>
              <td>${escapeHtml(refs[1]?.name)}</td>
              <td>${escapeHtml(refs[1]?.address)}</td>
              <td>${escapeHtml(refs[1]?.contact)}</td>
            </tr>
            <tr>
              <td>${escapeHtml(refs[2]?.name)}</td>
              <td>${escapeHtml(refs[2]?.address)}</td>
              <td>${escapeHtml(refs[2]?.contact)}</td>
            </tr>
            <tr>
              <td colspan="3" class="q-declare" style="font-size: 10px;">42. I declare under oath that I have personally accomplished this Personal Data Sheet which is a true, correct, and complete statement pursuant to the provisions of pertinent laws, rules, and regulations of the Republic of the Philippines. I authorize the agency head/authorized representative to verify/validate the contents stated herein. I agree that any misrepresentation made in this document and its attachments shall cause the filing of administrative/criminal case/s against me.</td>
            </tr>
          </table>

          <div class="page4-photo-col" style="border-color: white">
            <div class="photo-box">
              ${photoDataUrl
                ? `<img src="${escapeHtml(photoDataUrl)}" alt="PDS photo" />`
                : `<div>Passport-sized unfiltered digital</div>
                   <div>picture taken within</div>
                   <div>the last 6 months</div>
                   <div>4.5cm. x 3.5 cm</div>`}
            </div>
            <div class="photo-label">PHOTO</div>
          </div>
        </div>

        <div class="page4-sign-wrap">
          <table class="pds-table page4-govid-table">
            <tr>
              <td style="background: #dddddd;">Government Issued ID <span class="thin">(i.e.Passport, GSIS, SSS, PRC, Driver's License, etc.)</span><br/><i>PLEASE INDICATE ID Number and Date of Issuance</i></td>
            </tr>
            <tr><td>Government Issued ID: ${escapeHtml(record?.govId?.type || record?.govId?.idType)}</td></tr>
            <tr><td>ID/License/Passport No.: ${escapeHtml(record?.govId?.number)}</td></tr>
            <tr><td>Date/Place of Issuance: ${escapeHtml(record?.govId?.datePlace)}</td></tr>
          </table>

          <table class="pds-table page4-sign-table">
            <tr><td class="continue-note" style="background: white;"><br/><br/>(wet signature/e-signature/digital certificate)<br/><br/><br/></td></tr>
            <tr><td class="center">Signature (Sign inside the box)</td></tr>
            <tr><td class="center" style="background: white;"><br></td></tr>
            <tr><td class="center">Date Accomplished</td></tr>
          </table>

          <table class="pds-table page4-thumb-table">
            <tr><td class="thumb-box" style="background: #ffffff;"></td></tr>
            <tr><td class="center">Right Thumbmark</td></tr>
          </table>
        </div>

        <div class="page4-oath">
          <div class="oath-line">SUBSCRIBED AND SWORN to before me this ________________________, affiant exhibiting his/her validly issued government ID as indicated above.</div>
          <table class="pds-table page4-oath-sign">
            <tr><td class="continue-note" style="background: white; font-size: 8px;"> <br/><br/> (wet signature/e-signature/digital certificate except for notary public) <br/><br/><br/></td></tr>
            <tr><td class="center">Person Administering Oath</td></tr>
          </table>
        </div>
      </div>
      <div class="pds-page-number">CS FORM 212 (Revised 2025), Page 4 of 4</div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Personal Data Sheet</title>
        <style>
          @page { size: A4 portrait; margin: 6mm; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }

          .pds-sheet { border: 1px solid #111; padding: 0; }
          .pds-top { padding: 4px 6px; }
          .pds-form-meta { font-size: 9px; line-height: 1.1; margin-bottom: 2px; }
          .meta-main { font-style: italic; font-weight: 700; }
          .meta-sub { font-style: italic; }
          .pds-title { text-align: center; font-size: 24px; font-family: "Arial Black", Arial, sans-serif; font-weight: 900; letter-spacing: 0.4px; }
          .pds-note { font-size: 9px; line-height: 1.2; padding: 2px 6px; }
          .pds-note.warning { font-style: italic; font-weight: 700; }
          .chk {
            display: inline-block;
            width: 10px;
            height: 10px;
            border: 1px solid #111;
            box-sizing: border-box;
            vertical-align: middle;
            position: relative;
          }
          .chk.on::before {
            content: '\\25A0';
            position: absolute;
            font-size: 13px;
            color: #111;
            line-height: 1;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }
          .pds-section-header {
            font-size: 15px;
            font-style: italic;
            font-weight: 700;
            color: #fff;
            background: #666;
            border-top: 1px solid #111;
            border-bottom: 1px solid #111;
            padding: 2px 6px;
          }
          .pds-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; height: 10px; }
          .pds-table td, .pds-table th { border: 1px solid #111; padding: 2px 4px; vertical-align: top; }
          .pds-field.name-col { border-top: 0; border-bottom: 0; }
          .pds-field.name-col.first { border-top: 1px solid #111; }
          .pds-field.name-col.last { border-bottom: 1px solid #111; }
          .pds-field { font-size: 9px; background: #dddddd; height: 10px; }
          .pds-field.small { font-size: 9px; }
          .pds-value { font-size: 9px; font-weight: 700; }
          .small { font-size: 9px; background: #dddddd;}
          .w18 { width: 18%; }
          .continue-note { color: #d00; font-style: italic; font-weight: 700; text-align: center; }

          .addr-grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .addr-grid td { border: 1px solid #111; padding: 1px 2px; }
          .addr-grid .addr-label { font-size: 8px; text-align: center; font-style: italic; font-weight: 200;}
          .addr-grid .addr-value { font-size: 10px; height: 12px; font-weight: 700; text-align: center;}

          .edu-table th { font-size: 9px; text-align: center; background: #dddddd; }
          .edu-table td { font-size: 10px; }
          .pds-footer-table { width: 100%; border-collapse: collapse; margin-top: 1px; }
          .pds-footer-table td { border: 1px solid #111; text-align: center; padding: 6px; font-size: 20px; font-style: italic; }
          .pds-page-number { text-align: right; font-size: 7px; padding: 3px 6px 4px; font-style: italic;}
          .pds-band {
            background: #666;
            color: #fff;
            font-style: italic;
            font-weight: 700;
            font-size: 15px;
            line-height: 1.1;
            padding: 3px 6px;
            border-top: 1px solid #111;
            border-bottom: 1px solid #111;
          }
          .pds-band.no-inner-border {
            border-bottom: 0;
          }
          .pds-band-sub {
            background: #666;
            color: #fff;
            font-style: italic;
            font-weight: 700;
            font-size: 9px;
            line-height: 1.2;
            padding: 3px 6px;
            border-bottom: 1px solid #111;
          }
          .left-head { width: 26px; text-align: center; vertical-align: top !important; }
          .thin { font-weight: 400; }
          .page2-civil-table th, .page2-civil-table td,
          .page2-work-table th, .page2-work-table td {
            font-size: 8px;
            text-align: center;
            padding: 2px;
            line-height: 1.15;
          }
          .page2-civil-table td,
          .page2-work-table td {
            height: 17px;
            text-align: left;
            vertical-align: top;
          }
          .page2-civil-table th,
          .page2-work-table th {
            font-weight: 700;
            vertical-align: middle;
            background: #dddddd;
          }
          .page2-civil-table td {
            height: 20px;
          }
          .page2-work-table td.date-col,
          .page2-work-table td.gov-col {
            text-align: center;
          }
          .page2-footer-table td {
            font-size: 13px;
            padding: 8px 6px;
          }
          .page3-band {
            font-size: 14px;
            padding: 2px 6px;
          }
          .page3-voluntary-table th, .page3-voluntary-table td,
          .page3-learning-table th, .page3-learning-table td,
          .page3-other-table th, .page3-other-table td {
            font-size: 7px;
            padding: 2px;
            line-height: 1.15;
          }
          .page3-voluntary-table th,
          .page3-learning-table th,
          .page3-other-table th {
            background: #dddddd;
            text-align: center;
            vertical-align: middle;
            font-weight: 700;
          }
          .page3-voluntary-table td,
          .page3-learning-table td,
          .page3-other-table td {
            height: 17px;
            vertical-align: top;
            text-align: left;
          }
          .page3-voluntary-table td.idx-col,
          .page3-learning-table td.idx-col,
          .page3-voluntary-table td.date-col,
          .page3-learning-table td.date-col,
          .page3-voluntary-table td.hours-col,
          .page3-learning-table td.hours-col {
            text-align: center;
          }
          .continue-strip {
            height: 8px !important;
            font-size: 7px !important;
            background-color: #dddddd;
          }
          .page3-footer-table td {
            font-size: 13px;
            padding: 6px;
          }
          .page4-q-table th, .page4-q-table td,
          .page4-ref-table th, .page4-ref-table td,
          .page4-govid-table td,
          .page4-sign-table td,
          .page4-thumb-table td,
          .page4-oath-sign td {
            border: 1px solid #111;
            font-size: 10px;
            padding: 3px 4px;
            vertical-align: top;
          }
          .page4-q-table { width: 100%; border-collapse: collapse; }
          .page4-q-table .q-left { background: #dddddd; }
          .page4-q-table .q-right { background: #fff; }
          .q-num { float: left; width: 18px; font-weight: 700; }
          .q-text, .sub-q { margin-left: 18px; line-height: 1.25; }
          .sub-q { margin-top: 6px; }
          .yn-row { line-height: 1.5; margin-bottom: 2px; }
          .detail-label { margin-top: 2px; }
          .line-fill {
            border-bottom: 1px solid #111;
            min-height: 12px;
            line-height: 12px;
            margin: 1px 0 2px;
            font-weight: 700;
          }
          .detail-inline { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
          .line-fill.short { flex: 1; min-width: 80px; }

          .page4-ref-photo-wrap {
            display: grid;
            grid-template-columns: 1fr 190px;
            gap: 8px;
            margin-top: 2px;
          }
          .page4-ref-table { width: 100%; border-collapse: collapse; }
          .page4-ref-table th { background: #dddddd; text-align: center; }
          .page4-ref-table td { background: #fff; padding: 5px 6px; }
          .page4-ref-table td:not(.q-declare) { height: 18px; }
          .page4-ref-table td.q-declare { background: #dddddd; }
          .q-declare { text-align: justify; line-height: 1.3;}
          .page4-photo-col {
            border: 1px solid #111;
            background: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px;
          }
          .photo-box {
            width: 120px;
            height: 150px;
            border: 2px solid #111;
            background: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 9px;
            line-height: 1.2;
          }
          .photo-box img { width: 100%; height: 100%; object-fit: cover; }
          .photo-label { font-size: 10px; color: #666; }

          .page4-sign-wrap {
            display: grid;
            grid-template-columns: 260px 1fr 170px;
            gap: 8px;
            margin-top: 6px;
          }
          .page4-govid-table,
          .page4-sign-table,
          .page4-thumb-table { width: 100%; border-collapse: collapse; }
          .page4-govid-table td { background: #ffffff; padding: 5px 6px; height: 14px; }
          .page4-sign-table td,
          .page4-thumb-table td { background: #dddddd; }
          .thumb-box { height: 98px;}
          .center { text-align: center; }

          .page4-oath {
            margin-top: 8px;
            border-top: 1px solid #111;
            padding-top: 4px;
          }
          .oath-line { text-align: center; font-size: 8px; margin-bottom: 4px; }
          .page4-oath-sign {
            width: 290px;
            margin: 0 auto;
            border-collapse: collapse;
          }
          .page4-oath-sign td { background: #dddddd; }

          .header { margin-bottom: 12px; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
          h1 { margin: 0; font-size: 20px; letter-spacing: 0.4px; }
          h2 { margin: 6px 0 0; font-size: 14px; color: #334155; font-weight: 600; }
          .section { margin: 12px 0; }
          .section h3 { margin: 0 0 6px; font-size: 13px; color: #1e293b; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; }
          .field { font-size: 12px; }
          .label { font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #94a3b8; text-align: left; vertical-align: top; padding: 4px 6px; }
          th { background: #e2e8f0; font-weight: 700; }
          .empty { text-align: center; color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        ${firstPage}

        ${secondPage}

        ${thirdPage}

        ${fourthPage}
      </body>
    </html>
  `;
};

export default async function printPersonalDataSheet(record) {
  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return false;

    const html = renderHtmlDocument(record || {});
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // Ignore direct print failures from restrictive browser policies.
      }
    };

    printWindow.onload = triggerPrint;
    setTimeout(triggerPrint, 700);
    return true;
  } catch {
    return false;
  }
}
