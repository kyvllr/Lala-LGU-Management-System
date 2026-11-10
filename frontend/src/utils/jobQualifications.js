export const EDUCATION_LEVELS = [
  'Elementary level',
  'Elementary graduate',
  'High School level',
  'High School graduate',
  'Senior High School level',
  'Senior High School graduate',
  'Vocational / Trade Course',
  'College level',
  "Bachelor's degree",
  "Master's degree",
  'Doctorate degree',
];

const EDUCATION_RANKS = new Map(EDUCATION_LEVELS.map((level, index) => [level.toLowerCase(), index]));

export const normalizeEligibilityList = (value) => {
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
};

const normalizeText = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const isQualificationNotRequired = (value) => (
  /^(n\/?a|none|not required|not applicable)$/i.test(String(value || '').trim())
);

const matchesTextRequirement = (answer, requirement) => {
  const normalizedAnswer = normalizeText(answer);
  const normalizedRequirement = normalizeText(requirement);
  return Boolean(normalizedAnswer && normalizedRequirement && (
    normalizedAnswer.includes(normalizedRequirement)
  ));
};

export const evaluateJobQualifications = (posting, answers) => {
  const failures = [];
  const eligibilityRequirements = normalizeEligibilityList(posting?.eligibility);

  if (!String(answers?.eligibility || '').trim()) {
    failures.push('Select your eligibility.');
  }
  if (eligibilityRequirements.length > 0 && !eligibilityRequirements.some((item) => normalizeText(item) === normalizeText(answers?.eligibility))) {
    failures.push('Select an eligibility listed for this position.');
  }

  const educationRequirement = String(posting?.education || '').trim();
  const requiredEducationRank = EDUCATION_RANKS.get(normalizeText(educationRequirement));
  const applicantEducationRank = EDUCATION_RANKS.get(normalizeText(answers?.education));
  if (requiredEducationRank === undefined || applicantEducationRank === undefined || applicantEducationRank < requiredEducationRank) {
    failures.push(`Education must meet or exceed ${educationRequirement || 'the posted requirement'}.`);
  }

  const trainingRequirement = String(posting?.training || '').trim();
  const trainingIsOptional = isQualificationNotRequired(trainingRequirement);
  if (!['Yes', 'No', 'Other'].includes(answers?.trainingChoice)) {
    failures.push('Select whether you meet the training requirement.');
  } else if (answers?.trainingChoice === 'Other' && !String(answers?.trainingOther || '').trim()) {
    failures.push('Enter details for your other training.');
  } else if (!trainingIsOptional) {
    if (answers?.trainingChoice === 'No') {
      failures.push('You indicated that you do not meet the training requirement.');
    } else if (answers?.trainingChoice === 'Other' && !matchesTextRequirement(answers?.trainingOther, trainingRequirement)) {
      failures.push('The training entered does not match the posted requirement.');
    }
  }

  const workExperienceRequirement = String(posting?.workExperience || '').trim();
  const workExperienceIsOptional = isQualificationNotRequired(workExperienceRequirement);
  if (!['Yes', 'No', 'Other'].includes(answers?.workExperienceChoice)) {
    failures.push('Select whether you meet the work experience requirement.');
  } else if (answers?.workExperienceChoice === 'Other' && !String(answers?.workExperienceOther || '').trim()) {
    failures.push('Enter details for your other work experience.');
  } else if (!workExperienceIsOptional) {
    if (answers?.workExperienceChoice === 'No') {
      failures.push('You indicated that you do not meet the work experience requirement.');
    } else if (answers?.workExperienceChoice === 'Other' && !matchesTextRequirement(answers?.workExperienceOther, workExperienceRequirement)) {
      failures.push('The work experience entered does not match the posted requirement.');
    }
  }

  return failures;
};
