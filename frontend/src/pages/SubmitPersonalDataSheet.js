import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { personalDataSheetAPI } from '../api';
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
  console.log('Loaded steps:', {
    PersonalStep: typeof PersonalStep,
    FamilyStep: typeof FamilyStep,
    EducationStep: typeof EducationStep,
    CivilServiceStep: typeof CivilServiceStep,
    WorkExperienceStep: typeof WorkExperienceStep,
    VoluntaryStep: typeof VoluntaryStep,
    LearningStep: typeof LearningStep,
    OtherStep: typeof OtherStep,
  });
  const [formData, setFormData] = useState({
    surname: '',
    firstName: '',
    middleName: '',
    nameExtension: '',
    dateOfBirth: '',
    placeOfBirth: '',
    sexAtBirth: '',
    civilStatus: '',
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
  const [isPermanentSameAsResidential, setIsPermanentSameAsResidential] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminEditingPds = Boolean(location.state?.adminEdit && location.state?.pdsId);
  const editingPdsId = location.state?.pdsId;

  const applyPrefillFromPds = React.useCallback((latest) => {
    if (!latest) return;

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
        workExperience: ensureArrayWithFallback(latest.workExperience, prev.workExperience),
        voluntaryWork: ensureArrayWithFallback(latest.voluntaryWork, prev.voluntaryWork),
        learningDevelopment: ensureArrayWithFallback(latest.learningDevelopment, prev.learningDevelopment),
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

  React.useEffect(() => {
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

        if (location.state?.skipPrefill) return;

        const response = await personalDataSheetAPI.getMy();
        const latest = response.data?.latestSubmission;
        if (!latest) return;

        const shouldPrefill = Boolean(location.state?.prefill) || ['For Revision', 'Disapproved'].includes(latest.status);
        if (!shouldPrefill) return;
        applyPrefillFromPds(latest);
      } catch (prefillError) {
        console.error('Failed to prefill PDS data for update:', prefillError);
      }
    };

    prefillLatestSubmission();
  }, [applyPrefillFromPds, isAdminEditingPds, location.state]);

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

    try {
      setLoading(true);
      const submitPayload = {
        ...formData,
        govId: {
          ...formData.govId,
          idType: formData.govId?.idType || formData.govId?.type || '',
        },
        adminCreateRecord: Boolean(location.state?.fromPdsRecord) && !isAdminEditingPds,
      };

      if (isAdminEditingPds) {
        await personalDataSheetAPI.update(editingPdsId, submitPayload);
        setSuccess('Personal Data Sheet updated successfully.');
      } else {
        await personalDataSheetAPI.submit(submitPayload);
        setSuccess('Personal Data Sheet submitted successfully. It is now forwarded to admin for review.');
      }

      const hasActiveSession = Boolean(localStorage.getItem('token') && localStorage.getItem('user'));
      setTimeout(() => {
        if (isAdminEditingPds) {
          navigate('/pds', { state: { openTab: 'requests' } });
          return;
        }

        if (location.state?.fromPdsRecord) {
          navigate('/pds', { state: { openTab: 'records' } });
          return;
        }
        navigate(hasActiveSession ? '/' : '/login');
      }, 1800);
    } catch (err) {
      setError(err.response?.data?.message || (isAdminEditingPds ? 'Failed to update Personal Data Sheet.' : 'Failed to submit Personal Data Sheet.'));
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
      </div>
    </div>
  );
}
