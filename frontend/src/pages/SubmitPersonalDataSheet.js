import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { jobPortalAPI, personalDataSheetAPI } from '../api';
import { isAdmin, normalizeRole } from '../constants';
import { EDUCATION_LEVELS, evaluateJobQualifications, isQualificationNotRequired, normalizeEligibilityList } from '../utils/jobQualifications';
import PersonalStep from './SubmitPDSPersonal';
import FamilyStep from './SubmitPDSFamily';
import EducationStep from './SubmitPDSEducation';
import CivilServiceStep from './SubmitPDSCivilService';
import WorkExperienceStep from './SubmitPDSWorkExperience';
import VoluntaryStep from './SubmitPDSVoluntary';
import LearningStep from './SubmitPDSLearning';
import OtherStep from './SubmitPDSOther';

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const ensureArrayWithFallback = (value, fallback) => {
  return Array.isArray(value) && value.length > 0 ? value : fallback;
};

const parsePossiblyStringified = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      try {
        // eslint-disable-next-line no-new-func
        return Function('"use strict";return (' + trimmed + ')')();
      } catch {
        const objectBlocks = trimmed.match(/\{[\s\S]*?\}/g);
        if (!objectBlocks || objectBlocks.length === 0) return value;

        try {
          return objectBlocks.map((block) => {
            const normalized = block
              // Recover malformed concatenated fragments: ' + " ... " + '
              .replace(/["']\s*\+\s*["']/g, '')
              .replace(/["']\s*\+\s*/g, '')
              .replace(/\s*\+\s*["']/g, '')
              .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
              .replace(/'/g, '"')
              .replace(/,\s*}/g, '}');
            return JSON.parse(normalized);
          });
        } catch {
          return value;
        }
      }
    }
  }

  return value;
};

const normalizeObjectArray = (value, fallback, keys) => {
  const base = ensureArrayWithFallback(parsePossiblyStringified(value), fallback);
  if (!Array.isArray(base)) return fallback;

  const normalized = base
    .map((item) => parsePossiblyStringified(item))
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => keys.reduce((acc, key) => {
      acc[key] = item[key] ?? '';
      return acc;
    }, {}));

  return normalized.length > 0 ? normalized : fallback;
};

const COUNTRY_OPTIONS = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
          
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
  'Other',
];

const SORTED_COUNTRY_OPTIONS = [
  ...COUNTRY_OPTIONS.filter((country) => country !== 'Other').sort((first, second) => first.localeCompare(second)),
  ...(COUNTRY_OPTIONS.includes('Other') ? ['Other'] : []),
];

const initialEducationRows = [
  {
    level: 'Elementary',
    schoolName: '',
    basicEducationDegreeCourse: '',
    periodFrom: '',
    periodTo: '',
    highestLevelUnitsEarned: '',
    yearGraduated: '',
    scholarshipAcademicHonorsReceived: '',
  },
  {
    level: 'Secondary',
    schoolName: '',
    basicEducationDegreeCourse: '',
    periodFrom: '',
    periodTo: '',
    highestLevelUnitsEarned: '',
    yearGraduated: '',
    scholarshipAcademicHonorsReceived: '',
  },
  {
    level: 'Vocational / Trade Course',
    schoolName: '',
    basicEducationDegreeCourse: '',
    periodFrom: '',
    periodTo: '',
    highestLevelUnitsEarned: '',
    yearGraduated: '',
    scholarshipAcademicHonorsReceived: '',
  },
  {
    level: 'College',
    schoolName: '',
    basicEducationDegreeCourse: '',
    periodFrom: '',
    periodTo: '',
    highestLevelUnitsEarned: '',
    yearGraduated: '',
    scholarshipAcademicHonorsReceived: '',
  },
  {
    level: 'Graduate Studies',
    schoolName: '',
    basicEducationDegreeCourse: '',
    periodFrom: '',
    periodTo: '',
    highestLevelUnitsEarned: '',
    yearGraduated: '',
    scholarshipAcademicHonorsReceived: '',
  },
];

export default function SubmitPersonalDataSheet() {
  const [formData, setFormData] = useState({
    surname: '',
    firstName: '',
    middleName: '',
    nameExtension: '',
    dateOfBirth: '',
    placeOfBirth: '',
    sexAtBirth: '',
    civilStatus: '',
    height: '',
    weight: '',
    bloodType: '',
    gsisNo: '',
    pagibigNo: '',
    philhealthNo: '',
    sssNo: '',
    tinNo: '',
    agencyEmployeeNo: '',
    citizenship: {
      type: 'Filipino',
      dualCitizenshipMode: '',
      dualCitizenshipCountry: '',
    },
    residentialAddress: {
      houseBlockLotNo: '',
      street: '',
      subdivisionVillage: '',
      barangay: '',
      cityMunicipality: '',
      province: '',
      zipCode: '',
    },
    permanentAddress: {
      houseBlockLotNo: '',
      street: '',
      subdivisionVillage: '',
      barangay: '',
      cityMunicipality: '',
      province: '',
      zipCode: '',
    },
    telephone: '',
    mobile: '',
    email: '',
    photoDataUrl: '',
    familyBackground: {
      spouse: {
        surname: '',
        firstName: '',
        middleName: '',
        nameExtension: '',
        occupation: '',
        employerBusinessName: '',
        businessAddress: '',
        telephone: '',
      },
      father: {
        surname: '',
        firstName: '',
        middleName: '',
        nameExtension: '',
      },
      mother: {
        surname: '',
        firstName: '',
        middleName: '',
      },
      children: [
        { name: '', dateOfBirth: '' },
      ],
    },
    educationalBackground: initialEducationRows,
    civilServiceEligibilities: [
      {
        eligibilityType: '',
        rating: '',
        dateOfExaminationOrConferment: '',
        placeOfExaminationOrConferment: '',
        licenseNumber: '',
        licenseValidUntil: '',
      },
    ],
    workExperience: [
      {
        from: '',
        to: '',
        positionTitle: '',
        company: '',
        salaryJobPayGrade: '',
        monthlySalary: '',
        statusOfAppointment: '',
        govtService: '',
        duties: '',
      },
    ],
    voluntaryWork: [
      {
        organization: '',
        from: '',
        to: '',
        hours: '',
        position: '',
      },
    ],
    learningDevelopment: [
      {
        title: '',
        from: '',
        to: '',
        hours: '',
        type: '',
        conductedBy: '',
      },
    ],
    specialSkills: [''],
    distinctions: [''],
    memberships: [''],
    relatedThirdDegree: '',
    relatedFourthDegree: '',
    relatedDetails: '',
    adminOffense: '',
    adminOffenseDetails: '',
    criminalCharge: '',
    criminalChargeDetails: '',
    criminalChargeDateFiled: '',
    criminalChargeStatus: '',
    convicted: '',
    convictedDetails: '',
    separated: '',
    separatedDetails: '',
    candidate: '',
    candidateDetails: '',
    resignedToCampaign: '',
    resignedDetails: '',
    immigrant: '',
    immigrantCountry: '',
    indigenous: '',
    indigenousDetails: '',
    pwd: '',
    pwdId: '',
    soloParent: '',
    soloParentId: '',
    references: [
      { name: '', address: '', contact: '' },
    ],
    declaration: false,
    govId: { type: '', number: '', datePlace: '' },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [jobPostings, setJobPostings] = useState([]);
  const [jobPostingsLoading, setJobPostingsLoading] = useState(false);
  const [jobPostingsError, setJobPostingsError] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitAs, setSubmitAs] = useState('applicant');
  const [selectedPostingId, setSelectedPostingId] = useState('');
  const [applicantQualifications, setApplicantQualifications] = useState({
    eligibility: '',
    education: '',
    trainingChoice: '',
    trainingOther: '',
    workExperienceChoice: '',
    workExperienceOther: '',
  });
  const [isPermanentSameAsResidential, setIsPermanentSameAsResidential] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPrefilledMode, setIsPrefilledMode] = useState(false);
  const prefillKeyRef = React.useRef('');
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminEditingPds = Boolean(location.state?.adminEdit && location.state?.pdsId);
  const isUserEditingPds = Boolean(location.state?.userEdit && location.state?.pdsId && !isAdminEditingPds);
  const editingPdsId = location.state?.pdsId;
  const currentUser = React.useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const currentRole = normalizeRole(currentUser?.role);
  const isAdminUser = isAdmin(currentRole);

  React.useEffect(() => {
    let active = true;
    const loadPublishedPositions = async () => {
      try {
        setJobPostingsLoading(true);
        setJobPostingsError('');
        const response = await jobPortalAPI.getPostings('Published');
        if (active) setJobPostings(Array.isArray(response.data) ? response.data : []);
      } catch (requestError) {
        if (active) {
          setJobPostingsError(requestError.response?.data?.message || 'Unable to load published positions.');
        }
      } finally {
        if (active) setJobPostingsLoading(false);
      }
    };
    loadPublishedPositions();
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    const requestedPostingId = String(location.state?.jobPosting?.postingId || '').trim();
    if (!requestedPostingId || !jobPostings.some((posting) => posting.postingId === requestedPostingId)) return;
    setSubmitAs('position');
    setSelectedPostingId(requestedPostingId);
  }, [jobPostings, location.state?.jobPosting?.postingId]);

  const normalizeText = (value) => String(value || '').trim().toLowerCase();
  const currentEmail = normalizeText(currentUser?.email);

  const isOwnedMyPdsRecord = React.useCallback((record) => {
    if (!record) return false;

    const ownerEmail = normalizeText(record.ownerEmail);
    const subjectEmail = normalizeText(record.email);

    return (
      (Boolean(currentEmail) && ownerEmail === currentEmail) ||
      (Boolean(currentEmail) && subjectEmail === currentEmail)
    );
  }, [currentEmail]);

  const applyPrefillFromPds = React.useCallback((latest) => {
    if (!latest) return;

    setIsPrefilledMode(true);

    const residentialAddress = {
      houseBlockLotNo: latest.residentialAddress?.houseBlockLotNo || '',
      street: latest.residentialAddress?.street || '',
      subdivisionVillage: latest.residentialAddress?.subdivisionVillage || '',
      barangay: latest.residentialAddress?.barangay || '',
      cityMunicipality: latest.residentialAddress?.cityMunicipality || '',
      province: latest.residentialAddress?.province || '',
      zipCode: latest.residentialAddress?.zipCode || '',
    };

    const permanentAddress = {
      houseBlockLotNo: latest.permanentAddress?.houseBlockLotNo || '',
      street: latest.permanentAddress?.street || '',
      subdivisionVillage: latest.permanentAddress?.subdivisionVillage || '',
      barangay: latest.permanentAddress?.barangay || '',
      cityMunicipality: latest.permanentAddress?.cityMunicipality || '',
      province: latest.permanentAddress?.province || '',
      zipCode: latest.permanentAddress?.zipCode || '',
    };

    setFormData((prev) => {
      return {
        ...prev,
        surname: latest.surname || '',
        firstName: latest.firstName || '',
        middleName: latest.middleName || '',
        nameExtension: latest.nameExtension || '',
        dateOfBirth: toDateInputValue(latest.dateOfBirth),
        placeOfBirth: latest.placeOfBirth || '',
        sexAtBirth: latest.sexAtBirth || '',
        civilStatus: latest.civilStatus || '',
        height: latest.height || '',
        weight: latest.weight || '',
        bloodType: latest.bloodType || '',
        gsisNo: latest.gsisNo || '',
        pagibigNo: latest.pagibigNo || '',
        philhealthNo: latest.philhealthNo || '',
        sssNo: latest.sssNo || '',
        tinNo: latest.tinNo || '',
        agencyEmployeeNo: latest.agencyEmployeeNo || '',
        citizenship: {
          type: latest.citizenship?.type || 'Filipino',
          dualCitizenshipMode: latest.citizenship?.dualCitizenshipMode || '',
          dualCitizenshipCountry: latest.citizenship?.dualCitizenshipCountry || '',
        },
        residentialAddress,
        permanentAddress,
        telephone: latest.telephone || '',
        mobile: latest.mobile || '',
        email: latest.email || '',
        photoDataUrl: latest.photoDataUrl || '',
        familyBackground: {
          spouse: {
            surname: latest.familyBackground?.spouse?.surname || '',
            firstName: latest.familyBackground?.spouse?.firstName || '',
            middleName: latest.familyBackground?.spouse?.middleName || '',
            nameExtension: latest.familyBackground?.spouse?.nameExtension || '',
            occupation: latest.familyBackground?.spouse?.occupation || '',
            employerBusinessName: latest.familyBackground?.spouse?.employerBusinessName || '',
            businessAddress: latest.familyBackground?.spouse?.businessAddress || '',
            telephone: latest.familyBackground?.spouse?.telephone || '',
          },
          father: {
            surname: latest.familyBackground?.father?.surname || '',
            firstName: latest.familyBackground?.father?.firstName || '',
            middleName: latest.familyBackground?.father?.middleName || '',
            nameExtension: latest.familyBackground?.father?.nameExtension || '',
          },
          mother: {
            surname: latest.familyBackground?.mother?.surname || latest.familyBackground?.mother?.maidenName || '',
            firstName: latest.familyBackground?.mother?.firstName || '',
            middleName: latest.familyBackground?.mother?.middleName || '',
          },
          children: ensureArrayWithFallback(
            (latest.familyBackground?.children || []).map((child) => ({
              name: child?.name || '',
              dateOfBirth: toDateInputValue(child?.dateOfBirth),
            })),
            [{ name: '', dateOfBirth: '' }]
          ),
        },
        educationalBackground: ensureArrayWithFallback(latest.educationalBackground, prev.educationalBackground),
        civilServiceEligibilities: ensureArrayWithFallback(latest.civilServiceEligibilities, prev.civilServiceEligibilities),
        workExperience: normalizeObjectArray(
          latest.workExperience,
          prev.workExperience,
          ['from', 'to', 'positionTitle', 'company', 'monthlySalary', 'salaryJobPayGrade', 'statusOfAppointment', 'govtService', 'duties']
        ),
        voluntaryWork: normalizeObjectArray(
          latest.voluntaryWork,
          prev.voluntaryWork,
          ['organization', 'from', 'to', 'hours', 'position']
        ),
        learningDevelopment: normalizeObjectArray(
          latest.learningDevelopment,
          prev.learningDevelopment,
          ['title', 'from', 'to', 'hours', 'type', 'conductedBy']
        ),
        specialSkills: ensureArrayWithFallback(latest.specialSkills, prev.specialSkills),
        distinctions: ensureArrayWithFallback(latest.distinctions, prev.distinctions),
        memberships: ensureArrayWithFallback(latest.memberships, prev.memberships),
        relatedThirdDegree: latest.relatedThirdDegree || '',
        relatedFourthDegree: latest.relatedFourthDegree || '',
        relatedDetails: latest.relatedDetails || '',
        adminOffense: latest.adminOffense || '',
        adminOffenseDetails: latest.adminOffenseDetails || '',
        criminalCharge: latest.criminalCharge || '',
        criminalChargeDetails: latest.criminalChargeDetails || '',
        criminalChargeDateFiled: toDateInputValue(latest.criminalChargeDateFiled),
        criminalChargeStatus: latest.criminalChargeStatus || '',
        convicted: latest.convicted || '',
        convictedDetails: latest.convictedDetails || '',
        separated: latest.separated || '',
        separatedDetails: latest.separatedDetails || '',
        candidate: latest.candidate || '',
        candidateDetails: latest.candidateDetails || '',
        resignedToCampaign: latest.resignedToCampaign || '',
        resignedDetails: latest.resignedDetails || '',
        immigrant: latest.immigrant || '',
        immigrantCountry: latest.immigrantCountry || '',
        indigenous: latest.indigenous || '',
        indigenousDetails: latest.indigenousDetails || '',
        pwd: latest.pwd || '',
        pwdId: latest.pwdId || '',
        soloParent: latest.soloParent || '',
        soloParentId: latest.soloParentId || '',
        references: ensureArrayWithFallback(latest.references, prev.references),
        declaration: Boolean(latest.declaration),
        govId: {
          type: latest.govId?.type || latest.govId?.idType || '',
          number: latest.govId?.number || '',
          datePlace: latest.govId?.datePlace || '',
        },
      };
    });

    setIsPermanentSameAsResidential(
      JSON.stringify(residentialAddress) === JSON.stringify(permanentAddress)
    );

    if (latest.status === 'For Revision' && latest.remarks) {
      setError(`Admin revision remarks: ${latest.remarks}`);
    }
  }, []);

  const formMode = isAdminEditingPds
    ? { label: 'Editing Existing PDS', style: 'bg-amber-100 text-amber-800 border border-amber-200' }
    : isUserEditingPds
      ? { label: 'Editing Approved PDS For Resubmission', style: 'bg-sky-100 text-sky-800 border border-sky-200' }
    : isPrefilledMode
      ? { label: 'Updating From Existing Data', style: 'bg-blue-100 text-blue-800 border border-blue-200' }
      : { label: 'New Blank Submission', style: 'bg-emerald-100 text-emerald-800 border border-emerald-200' };

  React.useEffect(() => {
    const prefillKey = [
      isAdminEditingPds ? 'edit' : 'new',
      editingPdsId || '',
      location.state?.prefill ? 'prefill' : 'noprefill',
      location.state?.skipPrefill ? 'skip' : 'noskip',
      location.state?.fromPdsRecord ? 'record' : 'norecord',
    ].join('|');

    if (prefillKeyRef.current === prefillKey) {
      return;
    }
    prefillKeyRef.current = prefillKey;

    const prefillLatestSubmission = async () => {
      try {
        const hasSession = Boolean(localStorage.getItem('token') && localStorage.getItem('user'));
        if (!hasSession) return;

        if (isAdminEditingPds) {
          const editingSheet = location.state?.editPds;
          if (!editingSheet) {
            setError('Unable to load selected PDS for editing. Please reopen from PDS Requests.');
            return;
          }

          applyPrefillFromPds(editingSheet);
          return;
        }

        if (isUserEditingPds) {
          const editingSheet = location.state?.editPds;
          if (editingSheet) {
            applyPrefillFromPds(editingSheet);
            return;
          }

          const response = await personalDataSheetAPI.getMy();
          const approved = response.data?.approvedPds;
          if (!approved || approved.pdsId !== editingPdsId) {
            setError('Unable to load your approved PDS for editing. Please reopen from My PDS.');
            return;
          }

          if (!isOwnedMyPdsRecord(approved)) {
            setError('You are not allowed to edit this PDS record.');
            return;
          }

          applyPrefillFromPds(approved);
          return;
        }

        if (location.state?.skipPrefill) return;

        // Admin fresh submissions should always start blank.
        if (isAdminUser) return;

        const response = await personalDataSheetAPI.getMy();
        const latest = response.data?.latestSubmission;
        if (!latest) return;

        if (!isOwnedMyPdsRecord(latest)) return;

        const shouldPrefill = Boolean(location.state?.prefill) || ['For Revision', 'Disapproved'].includes(latest.status);
        if (!shouldPrefill) return;
        applyPrefillFromPds(latest);
      } catch (prefillError) {
        console.error('Failed to prefill PDS data for update:', prefillError);
      }
    };

    prefillLatestSubmission();
  }, [
    applyPrefillFromPds,
    editingPdsId,
    isAdminEditingPds,
    isUserEditingPds,
    isAdminUser,
    isOwnedMyPdsRecord,
    location.state?.fromPdsRecord,
    location.state?.prefill,
    location.state?.skipPrefill,
  ]);

  const validatePersonalInformationPage = () => {
    if (!formData.surname || !formData.firstName || !formData.mobile || !formData.email) {
      setError('Please fill in all required fields: Surname, First Name, Mobile No., and Email.');
      return false;
    }

    if (
      formData.citizenship.type === 'Dual Citizenship' &&
      (!formData.citizenship.dualCitizenshipMode || !formData.citizenship.dualCitizenshipCountry)
    ) {
      setError('For dual citizenship, please select whether by birth or by naturalization and choose a country.');
      return false;
    }

    return true;
  };

  const validateCivilServiceEligibilities = () => {
    if (!formData.civilServiceEligibilities || formData.civilServiceEligibilities.length === 0) return true;

    for (let i = 0; i < formData.civilServiceEligibilities.length; i++) {
      const cse = formData.civilServiceEligibilities[i];
      const anyFilled = !!(
        cse.eligibilityType ||
        cse.rating ||
        cse.dateOfExaminationOrConferment ||
        cse.placeOfExaminationOrConferment ||
        cse.licenseNumber ||
        cse.licenseValidUntil
      );

      if (anyFilled && !cse.eligibilityType) {
        setError(`Please provide Eligibility for Civil Service entry #${i + 1}.`);
        return false;
      }

      if (cse.licenseNumber && !cse.licenseValidUntil) {
        setError(`Please provide 'Valid Until' for license in Civil Service entry #${i + 1}.`);
        return false;
      }

      if (cse.dateOfExaminationOrConferment && isNaN(Date.parse(cse.dateOfExaminationOrConferment))) {
        setError(`Invalid Date of Examination / Conferment in Civil Service entry #${i + 1}.`);
        return false;
      }

      if (cse.licenseValidUntil && isNaN(Date.parse(cse.licenseValidUntil))) {
        setError(`Invalid License 'Valid Until' date in Civil Service entry #${i + 1}.`);
        return false;
      }
    }

    return true;
  };

  const validateAllFields = () => {
    // Personal Information - excluding date fields
    const requiredPersonalFields = [
      'surname', 'firstName', 'mobile', 'email', 'placeOfBirth', 
      'sexAtBirth', 'civilStatus'
    ];
    
    for (const field of requiredPersonalFields) {
      if (!formData[field] || formData[field].trim() === '') {
        setError(`Please fill in all fields. "${field}" cannot be empty - enter "N/A" if no information.`);
        setCurrentPage(1);
        return false;
      }
    }

    // Address fields
    const residentialAddressFields = ['barangay', 'cityMunicipality'];
    for (const field of residentialAddressFields) {
      if (!formData.residentialAddress[field] || formData.residentialAddress[field].trim() === '') {
        setError(`Please fill in Residential Address "${field}" - enter "N/A" if no information.`);
        setCurrentPage(1);
        return false;
      }
    }

    // Family Background - Spouse
    if (formData.familyBackground.spouse.surname || formData.familyBackground.spouse.firstName) {
      const spouseFields = ['surname', 'firstName', 'occupation', 'employerBusinessName', 'businessAddress'];
      for (const field of spouseFields) {
        if (!formData.familyBackground.spouse[field] || formData.familyBackground.spouse[field].trim() === '') {
          setError(`If spouse information is provided, all spouse fields must be filled - enter "N/A" if not applicable.`);
          setCurrentPage(2);
          return false;
        }
      }
    }

    // Family Background - Father
    if (formData.familyBackground.father.surname || formData.familyBackground.father.firstName) {
      const fatherFields = ['surname', 'firstName'];
      for (const field of fatherFields) {
        if (!formData.familyBackground.father[field] || formData.familyBackground.father[field].trim() === '') {
          setError(`If father information is provided, all father fields must be filled - enter "N/A" if not applicable.`);
          setCurrentPage(2);
          return false;
        }
      }
    }

    // Family Background - Mother
    if (formData.familyBackground.mother.surname || formData.familyBackground.mother.firstName) {
      const motherFields = ['surname', 'firstName'];
      for (const field of motherFields) {
        if (!formData.familyBackground.mother[field] || formData.familyBackground.mother[field].trim() === '') {
          setError(`If mother information is provided, all mother fields must be filled - enter "N/A" if not applicable.`);
          setCurrentPage(2);
          return false;
        }
      }
    }

    // Educational Background - each row must be complete (excluding date fields)
    for (let i = 0; i < formData.educationalBackground.length; i++) {
      const edu = formData.educationalBackground[i];
      const anyFilled = !!(edu.level || edu.schoolName || edu.basicEducationDegreeCourse);
      
      if (anyFilled) {
        const eduFields = ['level', 'schoolName', 'basicEducationDegreeCourse'];
        for (const field of eduFields) {
          if (!edu[field] || edu[field].trim() === '') {
            setError(`Education entry #${i + 1}: All fields must be filled - enter "N/A" if not applicable.`);
            setCurrentPage(3);
            return false;
          }
        }
      }
    }

    // Work Experience - each row must be complete (excluding date fields)
    for (let i = 0; i < formData.workExperience.length; i++) {
      const work = formData.workExperience[i];
      const anyFilled = !!(work.positionTitle || work.company);
      
      if (anyFilled) {
        const workFields = ['positionTitle', 'company', 'statusOfAppointment'];
        for (const field of workFields) {
          if (!work[field] || work[field].trim() === '') {
            setError(`Work Experience entry #${i + 1}: All fields must be filled - enter "N/A" if not applicable.`);
            setCurrentPage(5);
            return false;
          }
        }
      }

      if (work.salaryJobPayGrade && !/^(?:\d{2}-\d|N\/A)$/i.test(work.salaryJobPayGrade.trim())) {
        setError(`Work Experience entry #${i + 1}: Salary / Job / Pay Grade must use the format 00-0 (for example, 24-1), or N/A.`);
        setCurrentPage(5);
        return false;
      }
    }

    // Voluntary Work - each row must be complete (excluding date fields)
    for (let i = 0; i < formData.voluntaryWork.length; i++) {
      const vol = formData.voluntaryWork[i];
      const anyFilled = !!(vol.organization);
      
      if (anyFilled) {
        const volFields = ['organization', 'hours', 'position'];
        for (const field of volFields) {
          if (!vol[field] || vol[field].toString().trim() === '') {
            setError(`Voluntary Work entry #${i + 1}: All fields must be filled - enter "N/A" if not applicable.`);
            setCurrentPage(6);
            return false;
          }
        }
      }
    }

    // Learning and Development - each row must be complete (excluding date fields)
    for (let i = 0; i < formData.learningDevelopment.length; i++) {
      const ld = formData.learningDevelopment[i];
      const anyFilled = !!(ld.title);
      
      if (anyFilled) {
        const ldFields = ['title', 'hours', 'type', 'conductedBy'];
        for (const field of ldFields) {
          if (!ld[field] || ld[field].toString().trim() === '') {
            setError(`Learning and Development entry #${i + 1}: All fields must be filled - enter "N/A" if not applicable.`);
            setCurrentPage(7);
            return false;
          }
        }
      }
    }

    // Other declarations - all yes/no fields must be answered
    const declarationFields = [
      'relatedThirdDegree', 'relatedFourthDegree', 'adminOffense', 'criminalCharge',
      'convicted', 'separated', 'candidate', 'resignedToCampaign', 'immigrant',
      'indigenous', 'pwd', 'soloParent'
    ];
    
    for (const field of declarationFields) {
      if (!formData[field] || formData[field].trim() === '') {
        setError(`All yes/no questions on page 8 must be answered. "${field}" cannot be empty.`);
        setCurrentPage(8);
        return false;
      }
    }

    return true;
  };

  const handleNextPage = () => {
    setError('');

    if (currentPage === 1 && !validatePersonalInformationPage()) {
      return;
    }

    setCurrentPage((prev) => Math.min(prev + 1, 8));
  };

  const handlePreviousPage = () => {
    setError('');
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleStepClick = (targetPage) => {
    setError('');

    if (targetPage === currentPage) return;
    if (targetPage < 1 || targetPage > 8) return;

    if (currentPage === 1 && targetPage > 1 && !validatePersonalInformationPage()) {
      return;
    }

    setCurrentPage(targetPage);
  };

  const handleWorkChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.workExperience];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, workExperience: updated };
    });
  };

  const addWorkRow = () => {
    setFormData((prev) => ({
      ...prev,
      workExperience: [
        ...prev.workExperience,
        {
          from: '',
          to: '',
          positionTitle: '',
          company: '',
          salaryJobPayGrade: '',
          monthlySalary: '',
          statusOfAppointment: '',
          govtService: '',
          duties: '',
        },
      ],
    }));
  };

  const removeWorkRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      workExperience: prev.workExperience.filter((_, i) => i !== index),
    }));
  };

  const handleVolChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.voluntaryWork];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, voluntaryWork: updated };
    });
  };

  const addVolRow = () => {
    setFormData((prev) => ({
      ...prev,
      voluntaryWork: [
        ...prev.voluntaryWork,
        { organization: '', from: '', to: '', hours: '', position: '' },
      ],
    }));
  };

  const removeVolRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      voluntaryWork: prev.voluntaryWork.filter((_, i) => i !== index),
    }));
  };

  const handleLdChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.learningDevelopment];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, learningDevelopment: updated };
    });
  };

  const addLdRow = () => {
    setFormData((prev) => ({
      ...prev,
      learningDevelopment: [
        ...prev.learningDevelopment,
        { title: '', from: '', to: '', hours: '', type: '', conductedBy: '' },
      ],
    }));
  };

  const removeLdRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      learningDevelopment: prev.learningDevelopment.filter((_, i) => i !== index),
    }));
  };

  const specialChange = (index, value) => {
    setFormData((prev) => {
      const updated = [...prev.specialSkills];
      updated[index] = value;
      return { ...prev, specialSkills: updated };
    });
  };

  const addSpecial = () => {
    setFormData((prev) => ({ ...prev, specialSkills: [...prev.specialSkills, ''] }));
  };

  const removeSpecial = (index) => {
    setFormData((prev) => ({ ...prev, specialSkills: prev.specialSkills.filter((_, i) => i !== index) }));
  };

  const distinctionChange = (index, value) => {
    setFormData((prev) => {
      const updated = [...prev.distinctions];
      updated[index] = value;
      return { ...prev, distinctions: updated };
    });
  };

  const addDistinction = () => setFormData((prev) => ({ ...prev, distinctions: [...prev.distinctions, ''] }));
  const removeDistinction = (index) => setFormData((prev) => ({ ...prev, distinctions: prev.distinctions.filter((_, i) => i !== index) }));

  const membershipChange = (index, value) => {
    setFormData((prev) => {
      const updated = [...prev.memberships];
      updated[index] = value;
      return { ...prev, memberships: updated };
    });
  };

  const addMembership = () => setFormData((prev) => ({ ...prev, memberships: [...prev.memberships, ''] }));
  const removeMembership = (index) => setFormData((prev) => ({ ...prev, memberships: prev.memberships.filter((_, i) => i !== index) }));

  const handleReferenceChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.references];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, references: updated };
    });
  };

  const addReference = () => setFormData((prev) => ({ ...prev, references: [...prev.references, { name: '', address: '', contact: '' }] }));
  const removeReference = (index) => setFormData((prev) => ({ ...prev, references: prev.references.filter((_, i) => i !== index) }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedPhotoTypes.includes(file.type)) {
      setError('Upload a JPG, PNG, or WebP photo.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('The photo must be 5 MB or smaller.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Unable to read the selected photo. Please try another image.');
        return;
      }
      setFormData((prev) => ({ ...prev, photoDataUrl: reader.result }));
      setError('');
    };
    reader.onerror = () => setError('Unable to read the selected photo. Please try another image.');
    reader.readAsDataURL(file);
  };

  const handleGovIdChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      govId: {
        ...prev.govId,
        [field]: value,
      },
    }));
  };

  const handleAddressChange = (addressType, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [addressType]: {
        ...prev[addressType],
        [field]: value,
      },
      ...(addressType === 'residentialAddress' && isPermanentSameAsResidential
        ? {
            permanentAddress: {
              ...prev.residentialAddress,
              [field]: value,
            },
          }
        : {}),
    }));
  };

  const handleCitizenshipTypeChange = (type) => {
    setFormData((prev) => ({
      ...prev,
      citizenship: {
        type,
        dualCitizenshipMode: type === 'Dual Citizenship' ? prev.citizenship.dualCitizenshipMode : '',
        dualCitizenshipCountry: type === 'Dual Citizenship' ? prev.citizenship.dualCitizenshipCountry : '',
      },
    }));
  };

  const handleDualCitizenshipModeChange = (mode) => {
    setFormData((prev) => ({
      ...prev,
      citizenship: {
        ...prev.citizenship,
        dualCitizenshipMode: mode,
      },
    }));
  };

  const handleFamilyChange = (group, field, value) => {
    setFormData((prev) => ({
      ...prev,
      familyBackground: {
        ...prev.familyBackground,
        [group]: {
          ...prev.familyBackground[group],
          [field]: value,
        },
      },
    }));
  };

  const handleChildChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedChildren = [...prev.familyBackground.children];
      updatedChildren[index] = {
        ...updatedChildren[index],
        [field]: value,
      };

      return {
        ...prev,
        familyBackground: {
          ...prev.familyBackground,
          children: updatedChildren,
        },
      };
    });
  };

  const addChildRow = () => {
    setFormData((prev) => ({
      ...prev,
      familyBackground: {
        ...prev.familyBackground,
        children: [...prev.familyBackground.children, { name: '', dateOfBirth: '' }],
      },
    }));
  };

  const removeChildRow = (index) => {
    setFormData((prev) => {
      if (prev.familyBackground.children.length <= 1) {
        return prev;
      }

      return {
        ...prev,
        familyBackground: {
          ...prev.familyBackground,
          children: prev.familyBackground.children.filter((_, childIndex) => childIndex !== index),
        },
      };
    });
  };

  const handleEducationChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedEducation = [...prev.educationalBackground];
      updatedEducation[index] = {
        ...updatedEducation[index],
        [field]: value,
      };

      return {
        ...prev,
        educationalBackground: updatedEducation,
      };
    });
  };

  const handleCSEChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.civilServiceEligibilities];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return {
        ...prev,
        civilServiceEligibilities: updated,
      };
    });
  };

  const addCSERow = () => {
    setFormData((prev) => ({
      ...prev,
      civilServiceEligibilities: [
        ...prev.civilServiceEligibilities,
        {
          eligibilityType: '',
          rating: '',
          dateOfExaminationOrConferment: '',
          placeOfExaminationOrConferment: '',
          licenseNumber: '',
          licenseValidUntil: '',
        },
      ],
    }));
  };

  const removeCSERow = (index) => {
    setFormData((prev) => ({
      ...prev,
      civilServiceEligibilities: prev.civilServiceEligibilities.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate all fields before submitting
    if (!validateAllFields()) {
      return;
    }

    if (!formData.photoDataUrl) {
      setError('Upload a passport-sized photo before submitting your PDS.');
      setCurrentPage(1);
      return;
    }

    // Additional submit-time validations for conditional fields
    if ((formData.relatedThirdDegree === 'Y' || formData.relatedFourthDegree === 'Y') && !formData.relatedDetails?.trim()) {
      setError('Please provide details for consanguinity/affinity when you answered Yes.');
      setCurrentPage(8);
      return;
    }

    // If user answered Yes to administrative offense, details must be provided
    if (formData.adminOffense === 'Y' && !formData.adminOffenseDetails?.trim()) {
      setError('Please provide details for administrative offense when you answered Yes.');
      setCurrentPage(8);
      return;
    }

    // If user answered Yes to criminal charge, require details, date filed, and status
    if (formData.criminalCharge === 'Y') {
      if (!formData.criminalChargeDetails?.trim() || !formData.criminalChargeDateFiled || !formData.criminalChargeStatus?.trim()) {
        setError('Please provide details, date filed, and status for criminal charge when you answered Yes.');
        setCurrentPage(8);
        return;
      }
    }

    // If user answered Yes to convicted, require details
    if (formData.convicted === 'Y' && !formData.convictedDetails?.trim()) {
      setError('Please provide details for conviction when you answered Yes.');
      setCurrentPage(8);
      return;
    }

    // If user answered Yes to separated, require details
    if (formData.separated === 'Y' && !formData.separatedDetails?.trim()) {
      setError('Please provide details for separation from service when you answered Yes.');
      setCurrentPage(8);
      return;
    }

    // Candidate (election) details required when Yes
    if (formData.candidate === 'Y' && !formData.candidateDetails?.trim()) {
      setError('Please provide details for candidacy when you answered Yes.');
      setCurrentPage(8);
      return;
    }

    // Resigned to campaign details required when Yes
    if (formData.resignedToCampaign === 'Y' && !formData.resignedDetails?.trim()) {
      setError('Please provide details for resignation to campaign when you answered Yes.');
      setCurrentPage(8);
      return;
    }

    // If immigrant/permanent resident is Yes, require country details
    if (formData.immigrant === 'Y' && !formData.immigrantCountry?.trim()) {
      setError('Please provide country details when you indicated immigrant/permanent resident status.');
      setCurrentPage(8);
      return;
    }

    // If indigenous is Yes, require details
    if (formData.indigenous === 'Y' && !formData.indigenousDetails?.trim()) {
      setError('Please specify indigenous group when you answered Yes.');
      setCurrentPage(8);
      return;
    }

    // If PWD is Yes, require PWD ID
    if (formData.pwd === 'Y' && !formData.pwdId?.trim()) {
      setError('Please provide PWD ID number when you answered Yes.');
      setCurrentPage(8);
      return;
    }

    // If solo parent is Yes, require Solo Parent ID
    if (formData.soloParent === 'Y' && !formData.soloParentId?.trim()) {
      setError('Please provide Solo Parent ID number when you answered Yes.');
      setCurrentPage(8);
      return;
    }
    

    if (!formData.govId?.type?.trim() || !formData.govId?.number?.trim() || !formData.govId?.datePlace?.trim()) {
      setError('Please complete all Government Issued ID fields before submitting.');
      setCurrentPage(8);
      return;
    }

    // Declaration checkbox must be checked before submitting
    if (!formData.declaration) {
      setError('You must agree to the declaration before submitting the form.');
      setCurrentPage(8);
      return;
    }

    setSubmitAs('applicant');
    setSelectedPostingId('');
    setShowSubmitModal(true);
  };

  const selectedPosting = jobPostings.find((posting) => posting.postingId === selectedPostingId);
  const eligibilityOptions = normalizeEligibilityList(selectedPosting?.eligibility);
  const eligibilityIsOptional = eligibilityOptions.length === 0 || eligibilityOptions.every(isQualificationNotRequired);
  const qualificationFailures = selectedPosting
    ? evaluateJobQualifications(selectedPosting, applicantQualifications)
    : [];
  const handlePostingSelection = (event) => {
    setSelectedPostingId(event.target.value);
    setApplicantQualifications({
      eligibility: '',
      education: '',
      trainingChoice: '',
      trainingOther: '',
      workExperienceChoice: '',
      workExperienceOther: '',
    });
    setError('');
  };
  const handleApplicantQualificationChange = (event) => {
    const { name, value } = event.target;
    setApplicantQualifications((previous) => ({ ...previous, [name]: value }));
    setError('');
  };

  const handleConfirmSubmit = async () => {
    if (submitAs === 'position' && !selectedPostingId) {
      setError('Select a published position before submitting your application.');
      return;
    }
    if (submitAs === 'position' && qualificationFailures.length > 0) {
      setError('You must meet every posted qualification before submitting this application.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const sanitizedLearningDevelopment = normalizeObjectArray(
        formData.learningDevelopment,
        [{ title: '', from: '', to: '', hours: '', type: '', conductedBy: '' }],
        ['title', 'from', 'to', 'hours', 'type', 'conductedBy']
      );

      const submitPayload = {
        ...formData,
        learningDevelopment: sanitizedLearningDevelopment,
        govId: {
          ...formData.govId,
          idType: formData.govId?.idType || formData.govId?.type || '',
        },
        ...(submitAs === 'position'
          ? {
              jobApplication: {
                postingId: selectedPostingId,
                applicantQualifications,
              },
            }
          : ((!isAdminEditingPds && !isUserEditingPds) ? { jobApplication: null } : {})),
        adminCreateRecord: Boolean(location.state?.fromPdsRecord) && !isAdminEditingPds,
      };

      if (isAdminEditingPds || isUserEditingPds) {
        await personalDataSheetAPI.update(editingPdsId, submitPayload);
        const jobApplicationNotice = submitAs === 'position'
          ? ' Your job application is pending admin review.'
          : '';
        setSuccess(`${isAdminEditingPds
          ? 'Personal Data Sheet updated successfully.'
          : 'Personal Data Sheet updated and resubmitted for admin review.'}${jobApplicationNotice}`);
      } else {
        await personalDataSheetAPI.submit(submitPayload);
        setSuccess(submitAs === 'position'
          ? 'Personal Data Sheet submitted for review and your job application is pending admin review.'
          : 'Personal Data Sheet submitted successfully. It is now forwarded to admin for review.');
      }
      setShowSubmitModal(false);

      const hasActiveSession = Boolean(localStorage.getItem('token') && localStorage.getItem('user'));
      setTimeout(() => {
        if (isAdminEditingPds) {
          if (location.state?.fromPdsRecord) {
            navigate('/pds', { state: { openTab: 'records' } });
            return;
          }
          navigate('/pds', { state: { openTab: 'requests' } });
          return;
        }

        if (isUserEditingPds) {
          navigate('/pds', { state: { openTab: 'my' } });
          return;
        }

        if (location.state?.fromPdsRecord) {
          navigate('/pds', { state: { openTab: 'records' } });
          return;
        }
        navigate(hasActiveSession ? '/' : '/login');
      }, 1800);
    } catch (err) {
      setError(err.response?.data?.message || ((isAdminEditingPds || isUserEditingPds) ? 'Failed to update Personal Data Sheet.' : 'Failed to submit Personal Data Sheet.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 py-8"
      style={{
        backgroundImage: `linear-gradient(rgba(138, 219, 246, 0.48), rgba(255, 255, 255, 0.2)), url('/login.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-6xl" style={{ opacity: 0.95 }}>
        <div className="text-center mb-6">
          <img
            src="/csc.PNG"
            alt="LALA LGU Logo"
            className="w-40 h-40 mx-auto mb-3 object-contain"
          />
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Personal Data Sheet</h1> 
          <p className="text-gray-500">{isAdminEditingPds ? `Editing PDS: ${editingPdsId}` : 'Fill up the form and submit it for admin review'}</p>
          <div className="mt-3">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${formMode.style}`}>
              {formMode.label}
            </span>
          </div>
        </div>

        <div className="mb-6 bg-red-50 border border-yellow-500 rounded-lg p-4">
          <h2 className="text-sm text-red-800 font-bold mb-2">WARNING:</h2>
          <p className="text-sm text-gray-800">* Any misinterpretation made in the Personal Data Sheet shall cause the filing of administrative/criminal case/s against the person concerned.</p>
         <br></br>
          <h1 className="text-sm text-red-800 font-bold mb-2">INSTRUCTIONS:</h1>
          <p className="text-sm text-gray-800"><strong>* ALL FIELDS MUST BE FILLED.</strong> If you have no information for a field, enter "N/A".</p>
          <p className="text-sm text-gray-800">* Indicate N/A if not applicable.</p>
          <p className="text-sm text-gray-800">* DO NOT ABBREVIATE.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        <div className="mb-6">
          <p className="text-sm text-gray-600 font-medium">Page {currentPage} of 8</p>
          <div className="grid grid-cols-8 gap-2 mt-3 mb-3">
            <button
              type="button"
              onClick={() => handleStepClick(1)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              1. Personal
            </button>
            <button
              type="button"
              onClick={() => handleStepClick(2)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              2. Family
            </button>
            <button
              type="button"
              onClick={() => handleStepClick(3)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              3. Educational
            </button>
            <button
              type="button"
              onClick={() => handleStepClick(4)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 4 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              4. Civil Service
            </button>
            <button
              type="button"
              onClick={() => handleStepClick(5)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 5 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              5. Work Experience
            </button>
            <button
              type="button"
              onClick={() => handleStepClick(6)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 6 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              6. Voluntary Work
            </button>
            <button
              type="button"
              onClick={() => handleStepClick(7)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 7 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              7. L&D
            </button>
            <button
              type="button"
              onClick={() => handleStepClick(8)}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                currentPage === 8 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              8. Other Info
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(currentPage / 8) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {currentPage === 1 && (
            <PersonalStep
              formData={formData}
              loading={loading}
              handleChange={handleChange}
              handleAddressChange={handleAddressChange}
              handleCitizenshipTypeChange={handleCitizenshipTypeChange}
              handleDualCitizenshipModeChange={handleDualCitizenshipModeChange}
              SORTED_COUNTRY_OPTIONS={SORTED_COUNTRY_OPTIONS}
              isPermanentSameAsResidential={isPermanentSameAsResidential}
              setIsPermanentSameAsResidential={setIsPermanentSameAsResidential}
              setFormData={setFormData}
              handlePhotoChange={handlePhotoChange}
            />
          )}

          

          {currentPage === 2 && (
            <FamilyStep
              formData={formData}
              loading={loading}
              handleFamilyChange={handleFamilyChange}
              handleChildChange={handleChildChange}
              addChildRow={addChildRow}
              removeChildRow={removeChildRow}
            />
          )}

          {currentPage === 3 && (
            <EducationStep formData={formData} loading={loading} handleEducationChange={handleEducationChange} />
          )}

          {currentPage === 4 && (
            <CivilServiceStep
              formData={formData}
              loading={loading}
              handleCSEChange={handleCSEChange}
              addCSERow={addCSERow}
              removeCSERow={removeCSERow}
            />
          )}

          {currentPage === 5 && (
            <WorkExperienceStep
              formData={formData}
              loading={loading}
              handleWorkChange={handleWorkChange}
              addWorkRow={addWorkRow}
              removeWorkRow={removeWorkRow}
            />
          )}

          {currentPage === 6 && (
            <VoluntaryStep
              formData={formData}
              loading={loading}
              handleVolChange={handleVolChange}
              addVolRow={addVolRow}
              removeVolRow={removeVolRow}
            />
          )}

          {currentPage === 7 && (
            <LearningStep
              formData={formData}
              loading={loading}
              handleLdChange={handleLdChange}
              addLdRow={addLdRow}
              removeLdRow={removeLdRow}
            />
          )}

          {currentPage === 8 && (
            <OtherStep
              formData={formData}
              loading={loading}
              handleChange={handleChange}
              handleGovIdChange={handleGovIdChange}
              specialChange={specialChange}
              addSpecial={addSpecial}
              removeSpecial={removeSpecial}
              distinctionChange={distinctionChange}
              addDistinction={addDistinction}
              removeDistinction={removeDistinction}
              membershipChange={membershipChange}
              addMembership={addMembership}
              removeMembership={removeMembership}
              references={formData.references}
              handleReferenceChange={handleReferenceChange}
              addReference={addReference}
              removeReference={removeReference}
            />
          )}

          

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            {currentPage > 1 && (
              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={loading}
                className="flex-1 bg-gray-500 text-white py-2 rounded-lg font-medium hover:bg-gray-600 transition disabled:opacity-50"
              >
                Previous Page
              </button>
            )}

            {currentPage < 8 && (
              <button
                type="button"
                onClick={handleNextPage}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                Next Page
              </button>
            )}

            {currentPage === 8 && (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? (isAdminEditingPds ? 'Updating...' : 'Submitting...') : (isAdminEditingPds ? 'Update Personal Data Sheet' : 'Submit Personal Data Sheet')}
              </button>
            )}
            <Link
              to="/login"
              className="flex-1 text-center bg-gray-300 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-400 transition"
            >
              Back to Login
            </Link>
          </div>
        </form>

        {showSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="pds-submit-choice-title">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
              <h2 id="pds-submit-choice-title" className="text-xl font-bold text-slate-900">Submit Personal Data Sheet</h2>
              <p className="mt-1 text-sm text-slate-600">Choose whether to submit your PDS as an applicant only or apply for a published position.</p>

              <div className="mt-5 space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3">
                  <input
                    type="radio"
                    name="pdsSubmitAs"
                    value="applicant"
                    checked={submitAs === 'applicant'}
                    onChange={() => setSubmitAs('applicant')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-slate-800">Submit as Applicant</span>
                    <span className="block text-sm text-slate-600">Submit the PDS for Personal Data Sheet review without applying for a specific vacancy.</span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3">
                  <input
                    type="radio"
                    name="pdsSubmitAs"
                    value="position"
                    checked={submitAs === 'position'}
                    onChange={() => setSubmitAs('position')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-slate-800">Apply for a published position</span>
                    <span className="block text-sm text-slate-600">Your PDS will also be submitted as a job application for admin review.</span>
                  </span>
                </label>
              </div>

              {submitAs === 'position' && (
                <div className="mt-4 rounded-md border border-blue-100 bg-blue-50/60 p-4">
                  {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
                  {jobPostingsLoading ? (
                    <p className="text-sm text-blue-700">Loading published positions...</p>
                  ) : jobPostingsError ? (
                    <p role="alert" className="text-sm text-red-700">{jobPostingsError}</p>
                  ) : jobPostings.length === 0 ? (
                    <p className="text-sm text-slate-700">There are currently no published positions available.</p>
                  ) : (
                    <>
                      <label className="block text-sm font-semibold text-slate-800">
                        Published Position
                        <select
                          value={selectedPostingId}
                          onChange={handlePostingSelection}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
                        >
                          <option value="">Select a position</option>
                          {jobPostings.map((posting) => (
                            <option key={posting.postingId} value={posting.postingId}>
                              {posting.positionTitle} — {posting.placeOfAssignment}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selectedPosting && (
                        <>
                          <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                            <p><strong>Place of Assignment:</strong> {selectedPosting.placeOfAssignment}</p>
                            <p><strong>Plantilla Item Number:</strong> {selectedPosting.plantillaItemNumber}</p>
                            <p><strong>Salary / Job / Pay Grade:</strong> {selectedPosting.salaryJobPayGrade}</p>
                            <p><strong>Monthly Salary:</strong> {selectedPosting.monthlySalary}</p>
                            <p>
                              <strong>Eligibility:</strong>{' '}
                              {eligibilityOptions.map((item, index) => (
                                <React.Fragment key={`${item}-${index}`}>
                                  {index > 0 && ', '}
                                  {item}
                                </React.Fragment>
                              ))}
                            </p>
                            <p><strong>Education:</strong> {selectedPosting.education}</p>
                            <p><strong>Training:</strong> {selectedPosting.training}</p>
                            <p><strong>Work Experience:</strong> {selectedPosting.workExperience}</p>
                            <p className="sm:col-span-2"><strong>Competency:</strong> {selectedPosting.competency}</p>
                          </div>

                          <fieldset className="mt-5 space-y-4 border-t border-blue-200 pt-4">
                            <legend className="px-1 text-base font-semibold text-slate-900">Qualification Check</legend>
                            <p className="text-sm text-slate-600">Complete each item. Applications that do not meet every required qualification cannot be submitted.</p>

                            <label className="block text-sm font-medium text-slate-800">
                              Eligibility
                              <select
                                name="eligibility"
                                value={applicantQualifications.eligibility}
                                onChange={handleApplicantQualificationChange}
                                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
                              >
                                <option value="">Select your eligibility</option>
                                {eligibilityOptions.map((item, index) => (
                                  <option key={`${item}-${index}`} value={item}>{item}</option>
                                ))}
                                {!eligibilityIsOptional && <option value="__none__">I do not have a listed eligibility</option>}
                              </select>
                            </label>

                            <label className="block text-sm font-medium text-slate-800">
                              Education
                              <select
                                name="education"
                                value={applicantQualifications.education}
                                onChange={handleApplicantQualificationChange}
                                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
                              >
                                <option value="">Select your highest education level</option>
                                {EDUCATION_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                              </select>
                              <span className="mt-1 block text-xs text-slate-500">Minimum required: {selectedPosting.education}</span>
                            </label>

                            <div>
                              <label className="block text-sm font-medium text-slate-800">
                                Training
                                <select
                                  name="trainingChoice"
                                  value={applicantQualifications.trainingChoice}
                                  onChange={handleApplicantQualificationChange}
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
                                >
                                  <option value="">Select an answer</option>
                                  <option value="Yes">Yes, I meet this requirement</option>
                                  <option value="No">No</option>
                                  <option value="Other">Other</option>
                                </select>
                              </label>
                              {applicantQualifications.trainingChoice === 'Other' && (
                                <input
                                  name="trainingOther"
                                  value={applicantQualifications.trainingOther}
                                  onChange={handleApplicantQualificationChange}
                                  placeholder="Describe relevant training that meets the requirement"
                                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                              )}
                              <span className="mt-1 block text-xs text-slate-500">Required: {selectedPosting.training}</span>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-800">
                                Work Experience
                                <select
                                  name="workExperienceChoice"
                                  value={applicantQualifications.workExperienceChoice}
                                  onChange={handleApplicantQualificationChange}
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal"
                                >
                                  <option value="">Select an answer</option>
                                  <option value="Yes">Yes, I meet this requirement</option>
                                  <option value="No">No</option>
                                  <option value="Other">Other</option>
                                </select>
                              </label>
                              {applicantQualifications.workExperienceChoice === 'Other' && (
                                <input
                                  name="workExperienceOther"
                                  value={applicantQualifications.workExperienceOther}
                                  onChange={handleApplicantQualificationChange}
                                  placeholder="Describe relevant work experience that meets the requirement"
                                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                />
                              )}
                              <span className="mt-1 block text-xs text-slate-500">Required: {selectedPosting.workExperience}</span>
                            </div>

                            {qualificationFailures.length > 0 && (
                              <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                <p className="font-semibold">You do not yet meet all listed qualifications:</p>
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                  {qualificationFailures.map((failure) => <li key={failure}>{failure}</li>)}
                                </ul>
                              </div>
                            )}
                          </fieldset>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => { setShowSubmitModal(false); setError(''); }}
                  disabled={loading}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={loading || (submitAs === 'position' && (jobPostingsLoading || !selectedPosting || qualificationFailures.length > 0))}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Confirm and Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
