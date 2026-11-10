import React, { useEffect, useMemo, useState } from 'react';
import { dpcrfAPI, staffAPI } from '../api';
import { DEPARTMENTS, ROLE_DISPLAY_NAMES, isAdmin, isDepartmentStaffManager, normalizeRole, ROLES } from '../constants';

const canUpdateDpcrfPart = (permission, submission, part) => {
  const submitted = part === 'partI'
    ? submission?.partISubmitted ?? submission?.isSubmitted
    : submission?.partIISubmitted;
  if (!submitted) return true;
  if (!permission?.allowUpdate) return false;
  if (!permission.expiresAt) return true;

  const expiresAt = new Date(permission.expiresAt).getTime();

  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

const ADMIN_VIEW_MODES = {
  MY_FORM: 'my_form',
  DEPARTMENT: 'department',
};
const MY_FORM_OPTION = '__my_form__';

const TAB_CONFIG = [
  {
    key: 'part1',
    label: 'Part I. IPCRF',
    fullLabel: 'Part I. INDIVIDUAL PERFORMANCE COMMITMENT AND REVIEW FORM (IPCRF)',
  },
  {
    key: 'part2',
    label: 'Part II. Competencies',
    fullLabel: 'PART II. COMPETENCIES',
  },
  {
    key: 'part34',
    label: 'Part III & IV',
    fullLabel: 'PART III & IV. SUMMARY OF RATINGS FOR DISCUSSION / INDIVIDUAL DEVELOPMENT PLANS (IDP)',
  },
  {
    key: 'calendar',
    label: 'SPMS Calendar',
    fullLabel: 'SPMS CALENDAR',
  },
];

const SECTION_CONFIG = [
  {
    title: "I. CORE FUNCTIONS: Functions that are the essential duties that directly fulfill an organization's mandate or mission.",
    rowBlocks: 1,
  },
  {
    title: "II. STRATEGIC FUNCTIONS: functions that guide an organization's direction, ensure alignment with its mission, and respond to internal and external changes.",
    rowBlocks: 1,
  },
  {
    title: "III. SUPPORT FUNCTIONS: Functions that are internal services that enable an organization's core and strategic functions to operate effectively.",
    rowBlocks: 1,
  },
];

const PART_II_GROUPS = [
  {
    title: 'CORE BEHAVIORAL COMPETENCIES',
    type: 'coreBehavioral',
    columns: [
      {
        competencies: [
          {
            key: 'self_management',
            title: 'Self-Management',
            items: [
              'Sets clear personal and work goals aligned with LGU mandates',
              'Demonstrates discipline and integrity',
              'Displays maturity, resilience, and readiness under pressure',
              'Plans and organizes work using schedules/checklists',
              'Strives for continuous improvement',
            ],
          },
          {
            key: 'professionalism_ethics',
            title: 'Professionalism and Ethics',
            items: [
              'Demonstrates honesty, fairness, and integrity',
              'Makes decisions aligned with public interest',
              'Observes punctuality, proper attire, and courtesy',
              'Shows dedication to public service over personal convenience',
              'Acts with accountability and supports ethical behavior',
            ],
          },
          {
            key: 'result_focus',
            title: 'Result Focus',
            items: [
              'Uses time and resources efficiently',
              'Avoids delays and errors by following LGU processes',
              'Produces quality outputs with minimal supervision',
              'Shows initiative to achieve LGU goals',
              'Improves processes to enhance service delivery',
            ],
          },
        ],
      },
      {
        competencies: [
          {
            key: 'service_orientation',
            title: 'Service Orientation',
            items: [
              'Explains LGU programs and processes clearly',
              'Takes responsibility for resolving client concerns',
              'Promotes citizen welfare and inclusion',
              'Helps update LGU vision and strategies',
              'Proposes improvements to strengthen frontline services',
            ],
          },
          {
            key: 'innovation',
            title: 'Innovation',
            items: [
              'Identifies root causes of problems',
              'Demonstrates creativity and openness to new ideas',
              'Encourages a creative work environment',
              'Converts ideas into practical solutions',
              'Uses resourcefulness despite limited resources',
            ],
          },
          {
            key: 'teamwork',
            title: 'Teamwork',
            items: [
              'Contributes willingly to team tasks and LGU projects',
              'Promotes cooperation among units',
              'Uses communication and negotiation for win-win results',
              'Encourages team participation',
              'Works harmoniously with others',
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'CORE SKILLS',
    type: 'coreSkills',
    columns: [
      {
        competencies: [
          {
            key: 'oral_communication',
            title: 'Oral Communication',
            items: [
              'Follows instructions accurately',
              'Speaks clearly when explaining LGU processes',
              'Uses appropriate communication channels',
              'Adjusts communication to audience',
              'Facilitates meetings or community activities',
            ],
          },
          {
            key: 'written_communication',
            title: 'Written Communication',
            items: [
              'Uses correct LGU formats',
              'Prepares clear memos, reports, and letters',
              'Gathers reliable information for LGU work',
              'Self-edits for accuracy and clarity',
              'Writes concise and understandable messages',
            ],
          },
        ],
      },
      {
        competencies: [
          {
            key: 'computer_ict_skills',
            title: 'Computer / ICT Skills',
            items: [
              'Prepares documents and reports using MS Office',
              'Operates computers and peripherals safely',
              'Creates simple presentations',
              'Uses ICT tools (email, portals, databases)',
              'Recommends technology to improve LGU productivity',
            ],
          },
        ],
      },
    ],
  },
];

const PART_II_ITEMS = PART_II_GROUPS.flatMap((group) =>
  group.columns.flatMap((column) =>
    column.competencies.flatMap((competency) =>
      competency.items.map((item, index) => ({
        id: `${competency.key}_${index + 1}`,
        text: item,
        groupType: group.type,
      }))
    )
  )
);

const SCALE_VALUES = [5, 4, 3, 2, 1];
const MAX_DEPARTMENT_PEOPLE_ROWS = 5;

const SPMS_MONTHS = [
  { key: 'january', label: 'Jan' },
  { key: 'february', label: 'Feb' },
  { key: 'march', label: 'Mar' },
  { key: 'april', label: 'Apr' },
  { key: 'may', label: 'May' },
  { key: 'june', label: 'Jun' },
  { key: 'july', label: 'Jul' },
  { key: 'august', label: 'Aug' },
  { key: 'september', label: 'Sep' },
  { key: 'october', label: 'Oct' },
  { key: 'november', label: 'Nov' },
  { key: 'december', label: 'Dec' },
];

const calculateAverageRating = (q, e, t) => {
  const values = [q, e, t]
    .map((value) => Number.parseFloat(String(value || '').trim()))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) return '';

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return average.toFixed(2).replace(/\.00$/, '');
};

const calculateItemAverage = (values) => {
  const normalized = values
    .map((value) => Number.parseFloat(String(value || '').trim()))
    .filter((value) => Number.isFinite(value));

  if (normalized.length === 0) return '0';
  const average = normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
  return average.toFixed(2).replace(/\.00$/, '');
};

const parseNumericValue = (value) => {
  const parsed = Number.parseFloat(String(value || '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const formatRatingValue = (value) => {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(2).replace(/\.00$/, '');
};

const getAdjectivalRating = (value) => {
  if (!Number.isFinite(value)) return '';
  if (value >= 4.5) return 'Outstanding';
  if (value >= 3.5) return 'Very Satisfactory';
  if (value >= 2.5) return 'Satisfactory';
  if (value >= 1.5) return 'Unsatisfactory';
  return 'Poor';
};

const createInitialPartIIRatings = () => {
  return PART_II_ITEMS.reduce((acc, item) => {
    acc[item.id] = { sr: '', ar: '' };
    return acc;
  }, {});
};

const normalizePartIIRatings = (ratings = {}) => {
  const initial = createInitialPartIIRatings();
  Object.keys(initial).forEach((id) => {
    const current = ratings[id] || {};
    initial[id] = {
      sr: String(current.sr || ''),
      ar: String(current.ar || ''),
    };
  });
  return initial;
};

const createInitialPart34Data = () => ({
  agreement: {
    employeeSignature: '',
    employeeDate: '',
    raterName: '',
    raterSignature: '',
    raterDate: '',
  },
  ddpRows: Array.from({ length: 5 }, () => ({
    strengths: '',
    weaknesses: '',
    opportunities: '',
    challenges: '',
    resourcesNeeded: '',
  })),
  recommendations: Array.from({ length: 5 }, () => ''),
  footer: {
    ratee: '',
    rater: '',
    approvingOfficer: '',
  },
});

const createEmptySpmsRow = (order) => ({
  order,
  activity: '',
  january: '',
  february: '',
  march: '',
  april: '',
  may: '',
  june: '',
  july: '',
  august: '',
  september: '',
  october: '',
  november: '',
  december: '',
  responsibleOfficeActors: '',
});

const createInitialSpmsCalendar = () => ({
  rows: Array.from({ length: 6 }, (_, index) => createEmptySpmsRow(index + 1)),
  preparedByName: 'WARNIE B. EDREA',
  preparedByTitle: 'Human Resource Management Officer IV',
  approvedByName: 'ANGEL L. YAP',
  approvedByTitle: 'Municipal Mayor',
});

const normalizeSpmsCalendar = (calendar = {}) => {
  const fallback = createInitialSpmsCalendar();
  const inputRows = Array.isArray(calendar?.rows) && calendar.rows.length > 0 ? calendar.rows : fallback.rows;

  return {
    rows: inputRows.map((row, index) => ({
      order: Number.isFinite(Number(row?.order)) ? Number(row.order) : index + 1,
      activity: String(row?.activity || ''),
      january: normalizeSpmsMonthCell(row?.january),
      february: normalizeSpmsMonthCell(row?.february),
      march: normalizeSpmsMonthCell(row?.march),
      april: normalizeSpmsMonthCell(row?.april),
      may: normalizeSpmsMonthCell(row?.may),
      june: normalizeSpmsMonthCell(row?.june),
      july: normalizeSpmsMonthCell(row?.july),
      august: normalizeSpmsMonthCell(row?.august),
      september: normalizeSpmsMonthCell(row?.september),
      october: normalizeSpmsMonthCell(row?.october),
      november: normalizeSpmsMonthCell(row?.november),
      december: normalizeSpmsMonthCell(row?.december),
      responsibleOfficeActors: String(row?.responsibleOfficeActors || ''),
    })),
    preparedByName: String(calendar?.preparedByName || fallback.preparedByName),
    preparedByTitle: String(calendar?.preparedByTitle || fallback.preparedByTitle),
    approvedByName: String(calendar?.approvedByName || fallback.approvedByName),
    approvedByTitle: String(calendar?.approvedByTitle || fallback.approvedByTitle),
  };
};

const SPMS_CHECK_MARK = '✓';

const isSpmsMonthChecked = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return ['1', 'true', 'yes', 'y', 'check', 'checked', 'x', 'v', SPMS_CHECK_MARK].includes(normalized);
};

const normalizeSpmsMonthCell = (value) => (isSpmsMonthChecked(value) ? SPMS_CHECK_MARK : '');

const createEmptyBlock = () => ({
  mfo: '',
  kra: '',
  objective: '',
  timeLine: '',
  weightKra: '',
  rows: SCALE_VALUES.map((scale) => ({
    scale,
    quality: '',
    efficiency: '',
    timeliness: '',
  })),
  actualResults: {
    q: '',
    e: '',
    t: '',
    average: '',
  },
  meansOfVerification: {
    imageDataUrl: '',
    imageName: '',
    mimeType: '',
  },
});

const createInitialSections = () => (
  SECTION_CONFIG.map((section) => ({
    title: section.title,
    blocks: Array.from({ length: section.rowBlocks }, () => createEmptyBlock()),
  }))
);

const normalizeBlock = (block = {}) => ({
  mfo: block.mfo || '',
  kra: block.kra || '',
  objective: block.objective || '',
  timeLine: block.timeLine || '',
  weightKra: block.weightKra || '',
  rows: SCALE_VALUES.map((scale) => {
    const row = (block.rows || []).find((entry) => Number(entry?.scale) === scale) || {};
    return {
      scale,
      quality: row.quality || '',
      efficiency: row.efficiency || '',
      timeliness: row.timeliness || '',
    };
  }),
  actualResults: {
    q: block.actualResults?.q || '',
    e: block.actualResults?.e || '',
    t: block.actualResults?.t || '',
    average: calculateAverageRating(block.actualResults?.q, block.actualResults?.e, block.actualResults?.t),
  },
  meansOfVerification: {
    imageDataUrl: block.meansOfVerification?.imageDataUrl || '',
    imageName: block.meansOfVerification?.imageName || '',
    mimeType: block.meansOfVerification?.mimeType || '',
  },
});

const normalizeSections = (sections = []) => (
  SECTION_CONFIG.map((config, index) => {
    const input = sections[index] || {};
    const blocks = Array.isArray(input.blocks) && input.blocks.length > 0
      ? input.blocks.map((block) => normalizeBlock(block))
      : Array.from({ length: config.rowBlocks }, () => createEmptyBlock());

    return {
      title: config.title,
      blocks,
    };
  })
);

function EditableCell({ value, onChange, readOnly, className = '', multiline = false, fillCell = false }) {
  const baseClass = `w-full text-[11px] p-1 outline-none ${readOnly ? 'cursor-default bg-transparent' : 'bg-blue-50/60 focus:bg-white'} ${className}`;

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        rows={2}
        className={`${baseClass} resize-none ${fillCell ? 'h-full min-h-[260px]' : 'min-h-[50px]'}`}
      />
    );
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      readOnly={readOnly}
      className={baseClass}
    />
  );
}

function RowBlock({ sectionIndex, blockIndex, block, readOnly, onBlockChange, onScaleRowChange, onActualChange, onMovImageChange }) {
  const scaleRows = SCALE_VALUES;

  return scaleRows.map((scale, scaleIndex) => (
    <tr key={`section-${sectionIndex}-block-${blockIndex}-scale-${scale}`} className="bg-blue-50/20">
      {scaleIndex === 0 && (
        <>
          <td rowSpan={5} className="border border-blue-300 h-10 align-top p-0">
            <EditableCell value={block.mfo} onChange={(next) => onBlockChange('mfo', next)} readOnly={readOnly} multiline fillCell />
          </td>
          <td rowSpan={5} className="border border-blue-300 align-top p-0">
            <EditableCell value={block.kra} onChange={(next) => onBlockChange('kra', next)} readOnly={readOnly} multiline fillCell />
          </td>
          <td rowSpan={5} className="border border-blue-300 align-top p-0">
            <EditableCell value={block.objective} onChange={(next) => onBlockChange('objective', next)} readOnly={readOnly} multiline fillCell />
          </td>
          <td rowSpan={5} className="border border-blue-300 align-top p-0">
            <EditableCell value={block.timeLine} onChange={(next) => onBlockChange('timeLine', next)} readOnly={readOnly} multiline fillCell />
          </td>
          <td rowSpan={5} className="border border-blue-300 align-top p-0">
            <EditableCell value={block.weightKra} onChange={(next) => onBlockChange('weightKra', next)} readOnly={readOnly} multiline fillCell />
          </td>
        </>
      )}
      <td className="border border-blue-300 text-center font-semibold text-blue-900">{scale}</td>
      <td className="border border-blue-300">
        <EditableCell
          value={block.rows[scaleIndex]?.quality || ''}
          onChange={(next) => onScaleRowChange(scaleIndex, 'quality', next)}
          readOnly={readOnly}
          multiline
        />
      </td>
      <td className="border border-blue-300">
        <EditableCell
          value={block.rows[scaleIndex]?.efficiency || ''}
          onChange={(next) => onScaleRowChange(scaleIndex, 'efficiency', next)}
          readOnly={readOnly}
          multiline
        />
      </td>
      <td className="border border-blue-300">
        <EditableCell
          value={block.rows[scaleIndex]?.timeliness || ''}
          onChange={(next) => onScaleRowChange(scaleIndex, 'timeliness', next)}
          readOnly={readOnly}
          multiline
        />
      </td>
      {scaleIndex === 0 && (
        <>
          <td rowSpan={5} className="border border-blue-300 align-top p-0">
            <EditableCell value={block.actualResults.q} onChange={(next) => onActualChange('q', next)} readOnly={readOnly} multiline fillCell />
          </td>
          <td rowSpan={5} className="border border-blue-300 align-top p-0">
            <EditableCell value={block.actualResults.e} onChange={(next) => onActualChange('e', next)} readOnly={readOnly} multiline fillCell />
          </td>
          <td rowSpan={5} className="border border-blue-300 align-top p-0">
            <EditableCell value={block.actualResults.t} onChange={(next) => onActualChange('t', next)} readOnly={readOnly} multiline fillCell />
          </td>
          <td rowSpan={5} className="border border-blue-300 align-top p-0">
            <EditableCell value={block.actualResults.average} onChange={() => {}} readOnly multiline fillCell />
          </td>
          <td rowSpan={5} className="border border-blue-300 align-top p-2">
            {block.meansOfVerification?.imageDataUrl ? (
              <div className="space-y-2">
                <img
                  src={block.meansOfVerification.imageDataUrl}
                  alt="Means of verification"
                  className="h-24 w-full rounded border border-blue-200 object-cover"
                />
                <a
                  href={block.meansOfVerification.imageDataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-[11px] font-semibold text-blue-700 underline"
                >
                  {block.meansOfVerification.imageName || 'View proof image'}
                </a>
              </div>
            ) : (
              <p className="text-[11px] text-blue-600">No proof uploaded</p>
            )}

            {!readOnly && (
              <div className="mt-2 space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onMovImageChange(file);
                    event.target.value = '';
                  }}
                  className="block w-full text-[11px] text-blue-800"
                />
                {block.meansOfVerification?.imageDataUrl && (
                  <button
                    type="button"
                    onClick={() => onMovImageChange(null)}
                    className="rounded bg-red-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </td>
        </>
      )}
    </tr>
  ));
}

function PartIContent({
  currentYear,
  sections,
  setSections,
  readOnly,
  submitLocked,
  submitDisabled,
  submitHint,
  onSubmit,
  submitLoading,
  formInfo,
}) {
  const addRowBlock = (sectionIndex) => {
    if (readOnly) return;
    setSections((prev) => prev.map((section, index) => {
      if (index !== sectionIndex) return section;
      return {
        ...section,
        blocks: [...section.blocks, createEmptyBlock()],
      };
    }));
  };

  const updateBlock = (sectionIndex, blockIndex, updateFn) => {
    setSections((prev) => prev.map((section, secIndex) => {
      if (secIndex !== sectionIndex) return section;

      return {
        ...section,
        blocks: section.blocks.map((block, blkIndex) => {
          if (blkIndex !== blockIndex) return block;
          return updateFn(block);
        }),
      };
    }));
  };

  const handleMovImageChange = (sectionIndex, blockIndex, file) => {
    if (readOnly) return;

    if (!file) {
      updateBlock(sectionIndex, blockIndex, (current) => ({
        ...current,
        meansOfVerification: {
          imageDataUrl: '',
          imageName: '',
          mimeType: '',
        },
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      updateBlock(sectionIndex, blockIndex, (current) => ({
        ...current,
        meansOfVerification: {
          imageDataUrl: dataUrl,
          imageName: file.name,
          mimeType: file.type || '',
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 text-sm">
          <div className="space-y-1 text-blue-900 min-w-0">
            <p><span className="font-semibold">Name:</span> {formInfo?.name || '______________________________'}</p>
            <p><span className="font-semibold">Position:</span> {formInfo?.position || '___________________________'}</p>
            <p><span className="font-semibold">Office:</span> {formInfo?.office || '_____________________________'}</p>
            <p><span className="font-semibold">Rating Period:</span> CY/{currentYear}</p>
          </div>
          <div className="border border-blue-300 rounded-md p-3 w-full md:w-auto bg-blue-100/70 text-blue-900">
            <p className="font-bold">RATING SCALE</p>
            <p>5 Outstanding</p>
            <p>4 Very Satisfactory</p>
            <p>3 Satisfactory</p>
            <p>2 Unsatisfactory</p>
            <p>1 Poor</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-blue-200 rounded-lg shadow-sm">
        <table className="min-w-[1300px] w-full border-collapse text-xs text-blue-950">
          <thead>
            <tr className="bg-blue-200 text-center">
              <th rowSpan={2} className="border border-blue-400 p-2 font-bold">MFO</th>
              <th rowSpan={2} className="border border-blue-400 p-2 font-bold">KRA</th>
              <th rowSpan={2} className="border border-blue-400 p-2 font-bold">Objective</th>
              <th rowSpan={2} className="border border-blue-400 p-2 font-bold">Time Line</th>
              <th rowSpan={2} className="border border-blue-400 p-2 font-bold">Weight /KRA</th>
              <th rowSpan={2} className="border border-blue-400 p-2 font-bold">Scale</th>
              <th colSpan={3} className="border border-blue-400 p-2 font-bold">Performance Indicators</th>
              <th colSpan={3} className="border border-blue-400 p-2 font-bold">Actual Results</th>
              <th rowSpan={2} className="border border-blue-400 p-2 font-bold">Ave. Rating</th>
              <th rowSpan={2} className="border border-blue-400 p-2 font-bold">MOV</th>
            </tr>
            <tr className="bg-blue-200 text-center">
              <th className="border border-blue-400 p-2 font-bold">Quality</th>
              <th className="border border-blue-400 p-2 font-bold">Efficiency</th>
              <th className="border border-blue-400 p-2 font-bold">Timeliness</th>
              <th className="border border-blue-400 p-2 font-bold">Q</th>
              <th className="border border-blue-400 p-2 font-bold">E</th>
              <th className="border border-blue-400 p-2 font-bold">T</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section, sectionIndex) => (
              <React.Fragment key={`section-${sectionIndex}-${section.title}`}>
                <tr className="bg-blue-100">
                  <td colSpan={14} className="border border-blue-400 p-2 font-bold italic text-blue-900">
                    {section.title}
                  </td>
                </tr>
                {section.blocks.map((block, blockIndex) => (
                  <React.Fragment key={`section-${sectionIndex}-block-${blockIndex}`}>
                    <RowBlock
                      sectionIndex={sectionIndex}
                      blockIndex={blockIndex}
                      block={block}
                      readOnly={readOnly}
                      onBlockChange={(field, nextValue) => {
                        updateBlock(sectionIndex, blockIndex, (current) => ({ ...current, [field]: nextValue }));
                      }}
                      onScaleRowChange={(rowIndex, field, nextValue) => {
                        updateBlock(sectionIndex, blockIndex, (current) => ({
                          ...current,
                          rows: current.rows.map((row, index) => (index === rowIndex ? { ...row, [field]: nextValue } : row)),
                        }));
                      }}
                      onActualChange={(field, nextValue) => {
                        updateBlock(sectionIndex, blockIndex, (current) => ({
                          ...current,
                          actualResults: {
                            ...current.actualResults,
                            [field]: nextValue,
                            average: calculateAverageRating(
                              field === 'q' ? nextValue : current.actualResults.q,
                              field === 'e' ? nextValue : current.actualResults.e,
                              field === 't' ? nextValue : current.actualResults.t
                            ),
                          },
                        }));
                      }}
                      onMovImageChange={(file) => handleMovImageChange(sectionIndex, blockIndex, file)}
                    />
                  </React.Fragment>
                ))}
                {!readOnly && (
                  <tr>
                    <td colSpan={14} className="border border-blue-300 bg-blue-50 p-2 text-right">
                      <button
                        type="button"
                        onClick={() => addRowBlock(sectionIndex)}
                        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        + Add More
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitLoading || submitLocked || submitDisabled}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLoading ? 'Submitting...' : 'Submit Part I'}
          </button>
        </div>
      )}

      {!readOnly && (
        <p className="text-xs text-amber-700">
          You can edit and resubmit this form while DPCRF updates are enabled. It becomes read-only when the administrator locks updates or the allowed period expires.
        </p>
      )}

      {!readOnly && submitHint && (
        <p className="text-xs text-blue-700">{submitHint}</p>
      )}

    </div>
  );
}

function PartIICompetencyTable({ competency, ratings, setRatings, readOnlySR, readOnlyAR }) {
  const itemIds = competency.items.map((_, index) => `${competency.key}_${index + 1}`);

  const subtotalSR = calculateItemAverage(itemIds.map((id) => ratings[id]?.sr));
  const subtotalAR = calculateItemAverage(itemIds.map((id) => ratings[id]?.ar));

  const updateRating = (id, field, value) => {
    setRatings((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || { sr: '', ar: '' }),
        [field]: value,
      },
    }));
  };

  return (
    <div className="overflow-x-auto rounded border border-blue-300 bg-white">
      <table className="min-w-full border-collapse text-xs text-blue-950">
        <thead>
          <tr className="bg-blue-100">
            <th className="border border-blue-300 p-2 text-left text-base font-bold" colSpan={2}>{competency.title}</th>
            <th className="border border-blue-300 p-2 font-bold">SR</th>
            <th className="border border-blue-300 p-2 font-bold">AR</th>
          </tr>
        </thead>
        <tbody>
          {competency.items.map((text, index) => {
            const id = `${competency.key}_${index + 1}`;
            return (
              <tr key={id}>
                <td className="border border-blue-200 p-2 text-center w-8 font-semibold">{index + 1}</td>
                <td className="border border-blue-200 p-2">{text}</td>
                <td className="border border-blue-200 p-0 w-16">
                  <EditableCell
                    value={ratings[id]?.sr || ''}
                    onChange={(next) => updateRating(id, 'sr', next)}
                    readOnly={readOnlySR}
                  />
                </td>
                <td className="border border-blue-200 p-0 w-16">
                  <EditableCell
                    value={ratings[id]?.ar || ''}
                    onChange={(next) => {
                      if (readOnlyAR) return;
                      updateRating(id, 'ar', next);
                    }}
                    readOnly={readOnlyAR}
                  />
                </td>
              </tr>
            );
          })}
          <tr className="bg-blue-50 font-semibold">
            <td className="border border-blue-300 p-2 text-right italic" colSpan={2}>Sub-Total</td>
            <td className="border border-blue-300 p-2 text-center">{subtotalSR}</td>
            <td className="border border-blue-300 p-2 text-center">{subtotalAR}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PartIIContent({ ratings, setRatings, readOnlySR, readOnlyAR, showSaveButton, onSave, saveLoading, srHint, arHint, showSubmitButton, onSubmitPartII, submitPartIILoading }) {
  const coreBehavioralIds = PART_II_ITEMS.filter((item) => item.groupType === 'coreBehavioral').map((item) => item.id);
  const coreSkillsIds = PART_II_ITEMS.filter((item) => item.groupType === 'coreSkills').map((item) => item.id);

  const calculateCombinedRating = (ids) => {
    const combinedValues = ids.flatMap((id) => [ratings[id]?.sr, ratings[id]?.ar]);
    return calculateItemAverage(combinedValues);
  };

  const overallCoreBehavioral = calculateCombinedRating(coreBehavioralIds);
  const overallCoreSkills = calculateCombinedRating(coreSkillsIds);
  const overallRating = calculateItemAverage([overallCoreBehavioral, overallCoreSkills]);
  const finalRating = calculateItemAverage([overallRating]);

  return (
    <div className="space-y-4">
      <div className="bg-orange-500 text-white text-center font-bold text-2xl py-2 rounded">PART II: COMPETENCIES</div>

      {(srHint || arHint) && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          {srHint && <div>{srHint}</div>}
          {arHint && <div>{arHint}</div>}
        </div>
      )}

      {PART_II_GROUPS.map((group) => (
        <div key={group.title} className="space-y-3">
          <div className="bg-amber-200 border border-amber-300 px-3 py-2 font-bold text-lg text-gray-900">{group.title}</div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {group.columns.map((column, colIndex) => (
              <div key={`${group.title}-col-${colIndex}`} className="space-y-3">
                {column.competencies.map((competency) => (
                  <PartIICompetencyTable
                    key={competency.key}
                    competency={competency}
                    ratings={ratings}
                    setRatings={setRatings}
                    readOnlySR={readOnlySR}
                    readOnlyAR={readOnlyAR}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded border border-gray-300 bg-white">
          <div className="p-3 text-red-700 text-3xl font-bold">Rating Scale:</div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-lime-200">
                <th className="border border-gray-400 p-2">Description</th>
                <th className="border border-gray-400 p-2 w-20">Scale</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border border-gray-300 p-2"><span className="font-bold">Role Model</span> - Exceeds all standards; serves as an example for others to follow at all times.</td><td className="border border-gray-300 p-2 text-center font-bold">5</td></tr>
              <tr><td className="border border-gray-300 p-2"><span className="font-bold">Consistently Demonstrates</span> = Meets and often exceeds standards with minimal supervision.</td><td className="border border-gray-300 p-2 text-center font-bold">4</td></tr>
              <tr><td className="border border-gray-300 p-2"><span className="font-bold">Most of the Time</span> = Meets standards in most situations but with occasional lapses.</td><td className="border border-gray-300 p-2 text-center font-bold">3</td></tr>
              <tr><td className="border border-gray-300 p-2"><span className="font-bold">Sometimes</span> = Partially meets standards; performance is inconsistent and needs improvement.</td><td className="border border-gray-300 p-2 text-center font-bold">2</td></tr>
              <tr><td className="border border-gray-300 p-2"><span className="font-bold">Rarely</span> = Does not meet standards; performance is consistently below expectations.</td><td className="border border-gray-300 p-2 text-center font-bold">1</td></tr>
            </tbody>
          </table>
        </div>

        <div className="rounded border border-gray-300 bg-white">
          <div className="bg-lime-400 p-3 text-5xl font-bold">Overall Rating:</div>
          <table className="w-full border-collapse text-lg">
            <tbody>
              <tr>
                <td className="border border-gray-300 p-3 font-bold text-blue-900">Core Behavioral Competencies</td>
                <td className="border border-gray-300 p-3 w-24 text-center">{overallCoreBehavioral}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-3 font-bold text-blue-900">Core Skills</td>
                <td className="border border-gray-300 p-3 text-center">{overallCoreSkills}</td>
              </tr>
              
              <tr className="bg-blue-100">
                <td className="border border-gray-300 p-3 text-center text-4xl font-bold">Final Rating</td>
                <td className="border border-gray-300 p-3 text-center text-3xl font-bold">{finalRating}</td>
              </tr>
            </tbody>
          </table>
          <div className="p-3 text-xl italic font-semibold">
            where:
            <div>SR = Self Rate</div>
            <div>AR = Actual Rate</div>
          </div>
        </div>
      </div>

      {showSaveButton && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSave}
            disabled={saveLoading}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveLoading ? 'Saving...' : 'Save AR Ratings'}
          </button>
        </div>
      )}

      {showSubmitButton && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSubmitPartII}
              disabled={submitPartIILoading}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitPartIILoading ? 'Submitting...' : 'Submit Part II'}
            </button>
          </div>
          <p className="text-xs text-amber-700">
            You can edit and resubmit this form while DPCRF updates are enabled. It becomes read-only when the administrator locks updates or the allowed period expires.
          </p>
        </>
      )}
    </div>
  );
}

function PartIIIIVContent({ sections, ratings, formInfo, readOnly, part34Data, setPart34Data }) {
  const partIAverages = sections
    .flatMap((section) => section.blocks || [])
    .map((block) => parseNumericValue(block?.actualResults?.average))
    .filter((value) => Number.isFinite(value));

  const partIRating = partIAverages.length > 0
    ? partIAverages.reduce((sum, value) => sum + value, 0) / partIAverages.length
    : 0;

  // Keep Part III Part II rating in sync with Part II tab's grouped final-rating formula.
  const coreBehavioralIds = PART_II_ITEMS
    .filter((item) => item.groupType === 'coreBehavioral')
    .map((item) => item.id);
  const coreSkillsIds = PART_II_ITEMS
    .filter((item) => item.groupType === 'coreSkills')
    .map((item) => item.id);

  const calculateCombinedRating = (ids) => {
    const combinedValues = ids.flatMap((id) => [ratings[id]?.sr, ratings[id]?.ar]);
    return calculateItemAverage(combinedValues);
  };

  const overallCoreBehavioral = calculateCombinedRating(coreBehavioralIds);
  const overallCoreSkills = calculateCombinedRating(coreSkillsIds);
  const partIIRating = parseNumericValue(calculateItemAverage([overallCoreBehavioral, overallCoreSkills])) || 0;

  const finalPerformance = [partIRating, partIIRating].filter((value) => Number.isFinite(value));
  const finalRating = finalPerformance.length > 0
    ? finalPerformance.reduce((sum, value) => sum + value, 0) / finalPerformance.length
    : 0;

  const readOnlyCellClass = readOnly ? 'bg-transparent cursor-default' : 'bg-white/80 focus:bg-white';

  const updateAgreement = (field, value) => {
    setPart34Data((prev) => ({
      ...prev,
      agreement: {
        ...prev.agreement,
        [field]: value,
      },
    }));
  };

  const updateDdpRow = (index, field, value) => {
    setPart34Data((prev) => ({
      ...prev,
      ddpRows: prev.ddpRows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    }));
  };

  const updateRecommendation = (index, value) => {
    setPart34Data((prev) => ({
      ...prev,
      recommendations: prev.recommendations.map((row, rowIndex) => (rowIndex === index ? value : row)),
    }));
  };

  const updateFooter = (field, value) => {
    setPart34Data((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        [field]: value,
      },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded border border-cyan-300 bg-white">
        <table className="min-w-[1200px] w-full border-collapse text-sm text-slate-900">
          <thead>
            <tr className="bg-cyan-200 text-center">
              <th colSpan={5} className="border border-cyan-400 px-3 py-3 text-3xl font-black text-slate-900">
                PART III: SUMMARY OF RATINGS FOR DISCUSSION
              </th>
            </tr>
            <tr className="bg-slate-100 text-lg">
              <th className="border border-slate-300 p-2 font-bold text-left" colSpan={3}>Final Performance Results</th>
              <th className="border border-slate-300 p-2 font-bold text-center text-amber-800">Rating</th>
              <th className="border border-slate-300 p-2 font-bold text-center text-amber-800">Adjectival Rating</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 p-2 font-semibold" colSpan={3}>Accomplishments of KRAs and Objectives (Part I)</td>
              <td className="border border-slate-300 p-2 text-right">{formatRatingValue(partIRating)}</td>
              <td className="border border-slate-300 p-2 text-center">{getAdjectivalRating(partIRating)}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2 font-semibold" colSpan={3}>Core Competencies (Part II)</td>
              <td className="border border-slate-300 p-2 text-right">{formatRatingValue(partIIRating)}</td>
              <td className="border border-slate-300 p-2 text-center">{getAdjectivalRating(partIIRating)}</td>
            </tr>
            <tr className="bg-cyan-50 font-bold">
              <td className="border border-slate-300 p-2" colSpan={3}>Final Performance Results</td>
              <td className="border border-slate-300 p-2 text-right">{formatRatingValue(finalRating)}</td>
              <td className="border border-slate-300 p-2 text-center">{getAdjectivalRating(finalRating)}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2 font-bold bg-amber-50" colSpan={5}>Employee-Superior Agreement</td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2 text-xs font-semibold" colSpan={5}>
                The signatures below confirm that the employee and his/her superior have agreed to the contents of the performance as captured in this form.
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2 font-semibold">Name of Employee:</td>
              <td className="border border-slate-300 p-2">{formInfo?.name || '_________________________'}</td>
              <td className="border border-slate-300 p-2 font-semibold">Name of Rater:</td>
              <td className="border border-slate-300 p-0" colSpan={2}>
                <input
                  value={part34Data.agreement.raterName}
                  onChange={(event) => updateAgreement('raterName', event.target.value)}
                  readOnly={readOnly}
                  className={`w-full p-2 outline-none ${readOnlyCellClass}`}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2 font-semibold">Signature:</td>
              <td className="border border-slate-300 p-0">
                <input
                  value={part34Data.agreement.employeeSignature}
                  onChange={(event) => updateAgreement('employeeSignature', event.target.value)}
                  readOnly={readOnly}
                  className={`w-full p-2 outline-none ${readOnlyCellClass}`}
                />
              </td>
              <td className="border border-slate-300 p-2 font-semibold">Signature:</td>
              <td className="border border-slate-300 p-0" colSpan={2}>
                <input
                  value={part34Data.agreement.raterSignature}
                  onChange={(event) => updateAgreement('raterSignature', event.target.value)}
                  readOnly={readOnly}
                  className={`w-full p-2 outline-none ${readOnlyCellClass}`}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2 font-semibold">Date:</td>
              <td className="border border-slate-300 p-0">
                <input
                  type="date"
                  value={part34Data.agreement.employeeDate}
                  onChange={(event) => updateAgreement('employeeDate', event.target.value)}
                  readOnly={readOnly}
                  className={`w-full p-2 outline-none ${readOnlyCellClass}`}
                />
              </td>
              <td className="border border-slate-300 p-2 font-semibold">Date:</td>
              <td className="border border-slate-300 p-0" colSpan={2}>
                <input
                  type="date"
                  value={part34Data.agreement.raterDate}
                  onChange={(event) => updateAgreement('raterDate', event.target.value)}
                  readOnly={readOnly}
                  className={`w-full p-2 outline-none ${readOnlyCellClass}`}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded border border-cyan-300 bg-white">
        <table className="min-w-[1200px] w-full border-collapse text-sm text-slate-900">
          <thead>
            <tr className="bg-cyan-200 text-center">
              <th colSpan={5} className="border border-cyan-400 px-3 py-3 text-3xl font-black text-slate-900">
                PART IV: DEPARTMENT DEVELOPMENT PLANS (DDP)
              </th>
            </tr>
            <tr className="text-center text-2xl font-black">
              <th className="border border-slate-400 bg-blue-100 p-2 text-rose-900">Strengths</th>
              <th className="border border-slate-400 bg-lime-100 p-2 text-rose-900">Weaknesses</th>
              <th className="border border-slate-400 bg-orange-100 p-2 text-rose-900">Opportunities</th>
              <th className="border border-slate-400 bg-yellow-100 p-2 text-rose-900">Challenges</th>
              <th className="border border-slate-400 bg-slate-200 p-2 text-rose-900">Resources Needed</th>
            </tr>
          </thead>
          <tbody>
            {part34Data.ddpRows.map((row, rowIndex) => (
              <tr key={`ddp-row-${rowIndex}`}>
                <td className="border border-slate-300 p-0 align-top">
                  <textarea
                    value={row.strengths}
                    onChange={(event) => updateDdpRow(rowIndex, 'strengths', event.target.value)}
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full resize-none p-2 outline-none ${readOnlyCellClass}`}
                  />
                </td>
                <td className="border border-slate-300 p-0 align-top">
                  <textarea
                    value={row.weaknesses}
                    onChange={(event) => updateDdpRow(rowIndex, 'weaknesses', event.target.value)}
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full resize-none p-2 outline-none ${readOnlyCellClass}`}
                  />
                </td>
                <td className="border border-slate-300 p-0 align-top">
                  <textarea
                    value={row.opportunities}
                    onChange={(event) => updateDdpRow(rowIndex, 'opportunities', event.target.value)}
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full resize-none p-2 outline-none ${readOnlyCellClass}`}
                  />
                </td>
                <td className="border border-slate-300 p-0 align-top">
                  <textarea
                    value={row.challenges}
                    onChange={(event) => updateDdpRow(rowIndex, 'challenges', event.target.value)}
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full resize-none p-2 outline-none ${readOnlyCellClass}`}
                  />
                </td>
                <td className="border border-slate-300 p-0 align-top">
                  <textarea
                    value={row.resourcesNeeded}
                    onChange={(event) => updateDdpRow(rowIndex, 'resourcesNeeded', event.target.value)}
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full resize-none p-2 outline-none ${readOnlyCellClass}`}
                  />
                </td>
              </tr>
            ))}

            <tr>
              <td colSpan={5} className="border border-slate-400 p-2 font-black text-xl">RECOMMENDATIONS/SUGGESTIONS</td>
            </tr>
            {part34Data.recommendations.map((row, rowIndex) => (
              <tr key={`recommendation-${rowIndex}`}>
                <td colSpan={5} className="border border-slate-300 p-0">
                  <input
                    value={row}
                    onChange={(event) => updateRecommendation(rowIndex, event.target.value)}
                    readOnly={readOnly}
                    className={`w-full p-2 outline-none ${readOnlyCellClass}`}
                  />
                </td>
              </tr>
            ))}

            <tr>
              <td className="border border-slate-300 p-2 text-center">Ratee:</td>
              <td className="border border-slate-300 p-0" colSpan={2}>
                <input
                  value={part34Data.footer.ratee || formInfo?.name || ''}
                  onChange={(event) => updateFooter('ratee', event.target.value)}
                  readOnly={readOnly}
                  className={`w-full p-2 outline-none ${readOnlyCellClass}`}
                />
              </td>
              <td className="border border-slate-300 p-2 text-center">Rater:</td>
              <td className="border border-slate-300 p-0">
                <input
                  value={part34Data.footer.rater}
                  onChange={(event) => updateFooter('rater', event.target.value)}
                  readOnly={readOnly}
                  className={`w-full p-2 outline-none ${readOnlyCellClass}`}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2 text-center">Immediate Head</td>
              <td className="border border-slate-300 p-0" colSpan={2}>
                <input
                  value={part34Data.footer.approvingOfficer}
                  onChange={(event) => updateFooter('approvingOfficer', event.target.value)}
                  readOnly={readOnly}
                  className={`w-full p-2 outline-none ${readOnlyCellClass}`}
                />
              </td>
              <td className="border border-slate-300 p-2 text-center" colSpan={2}>Human Resource Management Officer IV</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SPMSCalendarContent({ spmsCalendar, setSpmsCalendar, isAdminUser, onSave, saveLoading }) {
  const readOnly = !isAdminUser;
  const readOnlyCellClass = readOnly ? 'bg-transparent cursor-default' : 'bg-white/80 focus:bg-white';
  const spmsTotalColumns = 2 + SPMS_MONTHS.length + 1 + (isAdminUser ? 1 : 0);

  const updateRow = (index, field, value) => {
    if (readOnly) return;
    setSpmsCalendar((prev) => ({
      ...prev,
      rows: prev.rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    }));
  };

  const addRow = () => {
    if (readOnly) return;
    setSpmsCalendar((prev) => ({
      ...prev,
      rows: [...prev.rows, createEmptySpmsRow(prev.rows.length + 1)],
    }));
  };

  const deleteRow = (index) => {
    if (readOnly) return;
    setSpmsCalendar((prev) => ({
      ...prev,
      rows: prev.rows
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row, rowIndex) => ({ ...row, order: rowIndex + 1 })),
    }));
  };

  const updateMeta = (field, value) => {
    if (readOnly) return;
    setSpmsCalendar((prev) => ({ ...prev, [field]: value }));
  };

  const toggleMonth = (rowIndex, monthKey, checked) => {
    updateRow(rowIndex, monthKey, checked ? SPMS_CHECK_MARK : '');
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded border border-blue-300 bg-white">
        <table className="min-w-[1450px] w-full border-collapse text-[12px] text-slate-900">
          <thead>
            <tr className="bg-blue-100 text-center">
              <th colSpan={spmsTotalColumns} className="border border-blue-300 p-3 text-4xl font-black">
                Strategic Performance Management System Calendar
              </th>
            </tr>
            <tr className="bg-slate-100 text-center text-[12px] font-bold">
              <th className="border border-slate-300 p-2 w-12">No.</th>
              <th className="border border-slate-300 p-2 w-56">Activity</th>
              {SPMS_MONTHS.map((month) => (
                <th key={month.key} className="border border-slate-300 p-2 w-20">{month.label}</th>
              ))}
              <th className="border border-slate-300 p-2 w-40">Responsible Office/Actors</th>
              {isAdminUser && <th className="border border-slate-300 p-2 w-16">Action</th>}
            </tr>
          </thead>
          <tbody>
            {spmsCalendar.rows.map((row, rowIndex) => (
              <tr key={`spms-row-${rowIndex}`}>
                <td className="border border-slate-300 p-2 text-center font-semibold">{rowIndex + 1}</td>
                <td className="border border-slate-300 p-0">
                  <textarea
                    value={row.activity}
                    onChange={(event) => updateRow(rowIndex, 'activity', event.target.value)}
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full resize-none p-2 outline-none ${readOnlyCellClass}`}
                  />
                </td>
                {SPMS_MONTHS.map((month) => (
                  <td key={`${month.key}-${rowIndex}`} className="border border-slate-300 p-0">
                    {readOnly ? (
                      <div className="flex h-full min-h-[52px] items-center justify-center text-3xl font-black text-slate-900">
                        {isSpmsMonthChecked(row[month.key]) ? SPMS_CHECK_MARK : ''}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[52px] items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSpmsMonthChecked(row[month.key])}
                          onChange={(event) => toggleMonth(rowIndex, month.key, event.target.checked)}
                          className="h-5 w-5 cursor-pointer accent-blue-700"
                        />
                      </div>
                    )}
                  </td>
                ))}
                <td className="border border-slate-300 p-0">
                  <textarea
                    value={row.responsibleOfficeActors}
                    onChange={(event) => updateRow(rowIndex, 'responsibleOfficeActors', event.target.value)}
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full resize-none p-2 outline-none ${readOnlyCellClass}`}
                  />
                </td>
                {isAdminUser && (
                  <td className="border border-slate-300 p-2 text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(rowIndex)}
                      className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded border border-blue-200 bg-blue-50 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xl font-bold text-slate-900">Prepared by:</p>
          <input
            value={spmsCalendar.preparedByName}
            onChange={(event) => updateMeta('preparedByName', event.target.value)}
            readOnly={readOnly}
            className={`w-full border border-blue-200 p-2 text-lg font-bold outline-none ${readOnlyCellClass}`}
          />
          <input
            value={spmsCalendar.preparedByTitle}
            onChange={(event) => updateMeta('preparedByTitle', event.target.value)}
            readOnly={readOnly}
            className={`w-full border border-blue-200 p-2 text-lg outline-none ${readOnlyCellClass}`}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xl font-bold text-slate-900">Approved by:</p>
          <input
            value={spmsCalendar.approvedByName}
            onChange={(event) => updateMeta('approvedByName', event.target.value)}
            readOnly={readOnly}
            className={`w-full border border-blue-200 p-2 text-lg font-bold outline-none ${readOnlyCellClass}`}
          />
          <input
            value={spmsCalendar.approvedByTitle}
            onChange={(event) => updateMeta('approvedByTitle', event.target.value)}
            readOnly={readOnly}
            className={`w-full border border-blue-200 p-2 text-lg outline-none ${readOnlyCellClass}`}
          />
        </div>
      </div>

      {isAdminUser && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={addRow}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Add Row
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saveLoading}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveLoading ? 'Saving...' : 'Save SPMS Calendar'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DPCRFTarget() {
  const [activeTab, setActiveTab] = useState('part1');
  const baseYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState(baseYear);
  const yearOptions = useMemo(() => {
    const list = [];
    for (let year = baseYear; year >= baseYear - 5; year -= 1) {
      list.push(year);
    }
    return list;
  }, [baseYear]);
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdminUser = isAdmin(normalizeRole(storedUser?.role));
  const isDepartmentManager = isDepartmentStaffManager(storedUser?.role);
  const isHeadOfficer = normalizeRole(storedUser?.role) === ROLES.HEAD_OFFICER;

  const [sections, setSections] = useState(createInitialSections);
  const [partIIRatings, setPartIIRatings] = useState(createInitialPartIIRatings);
  const [mySubmission, setMySubmission] = useState(null);
  const [adminSubmissions, setAdminSubmissions] = useState([]);
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [adminViewMode, setAdminViewMode] = useState(ADMIN_VIEW_MODES.MY_FORM);
  const [nameSearch, setNameSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [viewInfo, setViewInfo] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(MY_FORM_OPTION);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitPartIILoading, setSubmitPartIILoading] = useState(false);
  const [arSaveLoading, setArSaveLoading] = useState(false);
  const [part34Data, setPart34Data] = useState(createInitialPart34Data);
  const [spmsCalendar, setSpmsCalendar] = useState(createInitialSpmsCalendar);
  const [spmsSaveLoading, setSpmsSaveLoading] = useState(false);
  const [dpcrfPermission, setDpcrfPermission] = useState({
    allowUpdate: false,
    lockMode: 'manual',
    durationValue: null,
    expiresAt: null,
    updatedBy: '',
    updatedAt: null,
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionSaveLoading, setPermissionSaveLoading] = useState(false);
  const [permissionLockMode, setPermissionLockMode] = useState('manual');
  const [permissionDurationValue, setPermissionDurationValue] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedAdminSubmission = useMemo(
    () => adminSubmissions.find((submission) => submission.submissionId === selectedSubmissionId) || null,
    [adminSubmissions, selectedSubmissionId]
  );

  const submissionsByStaffId = useMemo(
    () => new Map(adminSubmissions.map((submission) => [String(submission.ownerStaffId || '').trim(), submission])),
    [adminSubmissions]
  );

  const uniqueDepartments = useMemo(
    () => (isHeadOfficer ? [String(storedUser?.department || '').trim()].filter(Boolean) : DEPARTMENTS),
    [isHeadOfficer, storedUser?.department]
  );

  const departmentPeople = useMemo(() => {
    if (!selectedDepartment) return [];

    const nameNeedle = nameSearch.trim().toLowerCase();

    return staffDirectory
      .filter((staff) => String(staff.department || '').trim() === selectedDepartment)
      .map((staff) => {
        const ownerStaffId = String(staff.id || '').trim();
        const submission = submissionsByStaffId.get(ownerStaffId) || null;
        const normalizedRole = normalizeRole(staff.role);
        return {
          staff,
          submission,
          roleLabel: ROLE_DISPLAY_NAMES[normalizedRole] || staff.role || 'N/A',
        };
      })
      .filter((person) => {
        if (!nameNeedle) return true;
        return String(person.staff?.name || '').toLowerCase().includes(nameNeedle);
      })
      .sort((a, b) => String(a.staff?.name || '').localeCompare(String(b.staff?.name || '')))
      .slice(0, MAX_DEPARTMENT_PEOPLE_ROWS);
  }, [selectedDepartment, staffDirectory, submissionsByStaffId, nameSearch]);

  const isViewingMyForm = !isDepartmentManager || adminViewMode === ADMIN_VIEW_MODES.MY_FORM;

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        if (isDepartmentManager) {
          const [allResponse, myResponse, staffResponse, spmsResponse, permissionResponse] = await Promise.all([
            dpcrfAPI.getAll(selectedYear),
            dpcrfAPI.getMy(selectedYear),
            staffAPI.getAll(),
            dpcrfAPI.getSpmsCalendar(selectedYear),
            dpcrfAPI.getPermission(selectedYear),
          ]);
          const submissions = allResponse.data?.submissions || [];
          const ownSubmission = myResponse.data?.submission || null;
          const staffs = staffResponse.data || [];
          const fetchedSpmsCalendar = spmsResponse.data?.calendar || null;
          const fetchedPermission = permissionResponse.data || {};
          if (!isMounted) return;

          setAdminSubmissions(submissions);
          setStaffDirectory(Array.isArray(staffs) ? staffs : []);
          setMySubmission(ownSubmission);
          setAdminViewMode(ADMIN_VIEW_MODES.MY_FORM);
          setSelectedSubmissionId(MY_FORM_OPTION);
          setSelectedDepartment('');
          setNameSearch('');
          setSelectedPerson(null);
          setViewInfo('');

          if (ownSubmission) {
            setSections(normalizeSections(ownSubmission.partI?.sections));
            setPartIIRatings(normalizePartIIRatings(ownSubmission.partII?.ratings || {}));
          } else {
            setSections(createInitialSections());
            setPartIIRatings(createInitialPartIIRatings());
          }
          setSpmsCalendar(normalizeSpmsCalendar(fetchedSpmsCalendar || {}));
          setDpcrfPermission(fetchedPermission);
          return;
        }

        const [response, spmsResponse, permissionResponse] = await Promise.all([
          dpcrfAPI.getMy(selectedYear),
          dpcrfAPI.getSpmsCalendar(selectedYear),
          dpcrfAPI.getPermission(selectedYear),
        ]);
        const submission = response.data?.submission || null;
        const fetchedSpmsCalendar = spmsResponse.data?.calendar || null;
        const fetchedPermission = permissionResponse.data || {};
        if (!isMounted) return;

        setMySubmission(submission);
        if (submission) {
          setSections(normalizeSections(submission.partI?.sections));
          setPartIIRatings(normalizePartIIRatings(submission.partII?.ratings || {}));
        } else {
          setSections(createInitialSections());
          setPartIIRatings(createInitialPartIIRatings());
        }
        setSpmsCalendar(normalizeSpmsCalendar(fetchedSpmsCalendar || {}));
        setDpcrfPermission(fetchedPermission);
      } catch (err) {
        if (!isMounted) return;
        setError(err.response?.data?.message || 'Failed to load DPCRF data.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [selectedYear, isDepartmentManager]);

  useEffect(() => {
    if (!isDepartmentManager) return;

    if (adminViewMode === ADMIN_VIEW_MODES.MY_FORM) {
      if (mySubmission) {
        setSections(normalizeSections(mySubmission.partI?.sections));
        setPartIIRatings(normalizePartIIRatings(mySubmission.partII?.ratings || {}));
      } else {
        setSections(createInitialSections());
        setPartIIRatings(createInitialPartIIRatings());
      }
      return;
    }

    if (selectedAdminSubmission) {
      setSections(normalizeSections(selectedAdminSubmission.partI?.sections));
      setPartIIRatings(normalizePartIIRatings(selectedAdminSubmission.partII?.ratings || {}));
    }
  }, [isDepartmentManager, adminViewMode, selectedSubmissionId, selectedAdminSubmission, mySubmission]);

  useEffect(() => {
    if (!isDepartmentManager || adminViewMode !== ADMIN_VIEW_MODES.DEPARTMENT) return;
    if (selectedDepartment) return;
    if (uniqueDepartments.length > 0) {
      setSelectedDepartment(uniqueDepartments[0]);
    }
  }, [isDepartmentManager, adminViewMode, uniqueDepartments, selectedDepartment]);

  const handleSubmitPartI = async () => {
    if (missingProofCount > 0) {
      setError(`Attach proof images for all rows before submitting (${missingProofCount} row${missingProofCount > 1 ? 's' : ''} missing).`);
      return;
    }

    setSubmitLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        year: selectedYear,
        partI: {
          sections,
        },
        partII: {
          ratings: partIIRatings,
        },
      };

      const response = await dpcrfAPI.submit(payload);
      const submitted = response.data?.submission;
      setMySubmission(submitted || { year: selectedYear, partI: { sections }, partII: { ratings: partIIRatings }, isSubmitted: true });
      setSections(normalizeSections(submitted?.partI?.sections || sections));
      setPartIIRatings(normalizePartIIRatings(submitted?.partII?.ratings || partIIRatings));
      if (submitted && isDepartmentManager) {
        setAdminSubmissions((prev) => {
          const withoutOwn = prev.filter((item) => item.submissionId !== submitted.submissionId);
          return [submitted, ...withoutOwn];
        });
      }
      setSuccess(response.data?.message || 'DPCRF submitted successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit DPCRF.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const canUpdateMyPartI = canUpdateDpcrfPart(dpcrfPermission, mySubmission, 'partI');
  const canUpdateMyPartII = canUpdateDpcrfPart(dpcrfPermission, mySubmission, 'partII');
  const showReadOnlyPartI = !isViewingMyForm
    || (Boolean(mySubmission?.isSubmitted) && !canUpdateMyPartI);
  const submitLocked = !isViewingMyForm
    || (Boolean(mySubmission?.isSubmitted) && !canUpdateMyPartI);

  const missingProofCount = useMemo(() => {
    return sections.reduce((total, section) => {
      const sectionMissing = section.blocks.filter((block) => !String(block?.meansOfVerification?.imageDataUrl || '').trim()).length;
      return total + sectionMissing;
    }, 0);
  }, [sections]);

  const submitDisabledByProof = !showReadOnlyPartI && missingProofCount > 0;
  const handleAdminViewPerson = (person) => {
    if (!person) return;
    setSelectedPerson(person.staff || null);

    const submission = person.submission;
    if (submission) {
      setSelectedSubmissionId(submission.submissionId);
      setSections(normalizeSections(submission.partI?.sections));
      setViewInfo(`Viewing submission of ${person.staff?.name || 'selected staff'}.`);
      return;
    }

    setSelectedSubmissionId('');
    setSections(createInitialSections());
    setPartIIRatings(createInitialPartIIRatings());
    setViewInfo(`No submission yet for ${person.staff?.name || 'selected staff'}. Showing blank template.`);
  };

  const submitHint = submitDisabledByProof
    ? `Attach proof images for all rows before submitting (${missingProofCount} row${missingProofCount > 1 ? 's' : ''} missing).`
    : '';

  const formInfo = useMemo(() => {
    if (isViewingMyForm) {
      return {
        name: mySubmission?.ownerName || storedUser?.name || '',
        position: storedUser?.position || '',
        office: mySubmission?.ownerDepartment || storedUser?.department || '',
      };
    }

    return {
      name: selectedPerson?.name || selectedAdminSubmission?.ownerName || '',
      position: selectedPerson?.position || '',
      office: selectedPerson?.department || selectedAdminSubmission?.ownerDepartment || '',
    };
  }, [isViewingMyForm, mySubmission, storedUser, selectedPerson, selectedAdminSubmission]);

  const canAdminRateStaffPartII = isDepartmentManager
    && adminViewMode === ADMIN_VIEW_MODES.DEPARTMENT
    && Boolean(selectedAdminSubmission)
    && Boolean(selectedAdminSubmission?.partIISubmitted);

  const canEditPartIISR = !isDepartmentManager && canUpdateMyPartII;
  const canEditPartIIAR = canAdminRateStaffPartII;
  const canSubmitPartII = !isDepartmentManager && canUpdateMyPartII;

  const partIISRHint = !isDepartmentManager
    ? (mySubmission?.partIISubmitted
      ? (canUpdateMyPartII
        ? 'The administrator has enabled updates, so you can revise SR for this year.'
        : 'Part II is submitted and updates are locked until the administrator re-enables them.')
      : 'You can type in SR (Self Rate) while your DPCRF is not yet submitted.')
    : 'SR is staff-only and cannot be edited from the department view.';

  const partIIARHint = isDepartmentManager
    ? (canAdminRateStaffPartII
      ? 'You can rate AR for this submitted staff form.'
      : 'AR is editable only in DEPARTMENT view after selecting a staff Part II submission.')
    : 'AR is reserved for admin rating after staff submits Part II.';

  const handleSubmitPartII = async () => {
    setSubmitPartIILoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        year: selectedYear,
        partII: {
          ratings: partIIRatings,
        },
      };

      const response = await dpcrfAPI.submitPartII(payload);
      const submitted = response.data?.submission;

      if (submitted) {
        setMySubmission(submitted);
        setPartIIRatings(normalizePartIIRatings(submitted.partII?.ratings || partIIRatings));
      }
      setSuccess(response.data?.message || 'Part II submitted successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit Part II.');
    } finally {
      setSubmitPartIILoading(false);
    }
  };

  const adminFormsPanel = isDepartmentManager && (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-sm font-semibold text-blue-900">DPCRF Forms (CY/{selectedYear})</h2>
        <select
          value={adminViewMode}
          onChange={(event) => {
            const mode = event.target.value;
            setAdminViewMode(mode);
            setViewInfo('');
            if (mode === ADMIN_VIEW_MODES.MY_FORM) {
              setSelectedSubmissionId(MY_FORM_OPTION);
              setSelectedPerson(null);
            }
          }}
          className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900"
        >
          <option value={ADMIN_VIEW_MODES.MY_FORM}>My Form</option>
          <option value={ADMIN_VIEW_MODES.DEPARTMENT}>DEPARTMENT</option>
        </select>
      </div>
      {adminViewMode === ADMIN_VIEW_MODES.DEPARTMENT && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-blue-900">Search Name</label>
            <input
              type="text"
              value={nameSearch}
              onChange={(event) => setNameSearch(event.target.value)}
              placeholder="Type staff name"
              className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-blue-900">Department</label>
            <select
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
              className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900"
            >
              {uniqueDepartments.length === 0 && <option value="">No department found</option>}
              {uniqueDepartments.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 overflow-x-auto rounded-md border border-blue-200 bg-white">
            <table className="min-w-full text-left text-xs text-blue-900">
              <thead className="bg-blue-100">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Department</th>
                  <th className="px-3 py-2 font-semibold">Submission</th>
                  <th className="px-3 py-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {departmentPeople.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-blue-700">No staff found for this department.</td>
                  </tr>
                )}
                {departmentPeople.map((person) => (
                  <tr key={person.staff._id || person.staff.id} className="border-t border-blue-100">
                    <td className="px-3 py-2">{person.staff.name || 'N/A'}</td>
                    <td className="px-3 py-2">{person.roleLabel}</td>
                    <td className="px-3 py-2">{person.staff.department || 'N/A'}</td>
                    <td className="px-3 py-2">
                      {person.submission ? `Submitted (${new Date(person.submission.submittedAt || person.submission.createdAt).toLocaleDateString()})` : 'No Submission'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleAdminViewPerson(person)}
                        className="rounded-md bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-blue-700">
        {showReadOnlyPartI
          ? (isViewingMyForm
            ? (dpcrfPermission.allowUpdate
              ? 'Mode: Read-only. You already submitted during this update window; other staff can still update their forms.'
              : 'Mode: Read-only. DPCRF updates are locked by the administrator.')
            : 'Mode: Read-only. This record belongs to another user.')
          : 'Mode: Editable. You can type entries and submit your form.'}
      </p>
    </div>
  );

  const handleSavePartIIArRatings = async () => {
    if (!selectedAdminSubmission?.submissionId) return;

    setArSaveLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await dpcrfAPI.updatePartIIActualRates(selectedAdminSubmission.submissionId, partIIRatings);
      const updated = response.data?.submission;

      if (updated) {
        setAdminSubmissions((prev) => prev.map((entry) => (
          entry.submissionId === updated.submissionId ? updated : entry
        )));
        setPartIIRatings(normalizePartIIRatings(updated.partII?.ratings || partIIRatings));
      }

      setSuccess('Part II AR ratings saved successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save Part II AR ratings.');
    } finally {
      setArSaveLoading(false);
    }
  };

  const handleSaveSpmsCalendar = async () => {
    if (!isAdminUser) return;

    setSpmsSaveLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        year: selectedYear,
        rows: spmsCalendar.rows,
        preparedByName: spmsCalendar.preparedByName,
        preparedByTitle: spmsCalendar.preparedByTitle,
        approvedByName: spmsCalendar.approvedByName,
        approvedByTitle: spmsCalendar.approvedByTitle,
      };

      const response = await dpcrfAPI.saveSpmsCalendar(payload);
      const saved = response.data?.calendar;
      if (saved) {
        setSpmsCalendar(normalizeSpmsCalendar(saved));
      }
      setSuccess('SPMS Calendar saved successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save SPMS Calendar.');
    } finally {
      setSpmsSaveLoading(false);
    }
  };

  const handleSetDpcrfPermission = async (allowUpdate) => {
    setPermissionSaveLoading(true);
    setError('');
    setSuccess('');

    try {
      const nextLockMode = allowUpdate ? 'manual' : permissionLockMode;

      const response = await dpcrfAPI.setPermission(selectedYear, allowUpdate, nextLockMode, permissionDurationValue);
      const permission = response.data?.permission || {
        allowUpdate,
        lockMode: nextLockMode,
        durationValue: allowUpdate ? null : permissionDurationValue || null,
        expiresAt: null,
        updatedBy: '',
        updatedAt: null,
      };
      setDpcrfPermission(permission);
      setPermissionLockMode(permission.lockMode || 'manual');
      setPermissionDurationValue(permission.durationValue != null ? String(permission.durationValue) : '');
      setSuccess(response.data?.message || 'DPCRF permission updated successfully.');
      setShowPermissionModal(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update DPCRF permission.');
    } finally {
      setPermissionSaveLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-100 to-blue-50 p-4 shadow md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-900 md:text-3xl">DPCRF-{selectedYear}-TARGET</h1>
          <p className="mt-1 text-sm text-blue-700">
            Department Performance Commitment and Review Form target-setting workspace.
          </p>
        </div>
        {isAdminUser && (
          <button
            type="button"
            onClick={() => {
              setPermissionLockMode(dpcrfPermission.lockMode || 'manual');
              setPermissionDurationValue(dpcrfPermission.durationValue != null ? String(dpcrfPermission.durationValue) : '');
              setShowPermissionModal(true);
            }}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            DPCRF Permission
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {viewInfo && isDepartmentManager && adminViewMode === ADMIN_VIEW_MODES.DEPARTMENT && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {viewInfo}
        </div>
      )}

      {isViewingMyForm && mySubmission?.isSubmitted && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Submitted on {new Date(mySubmission.submittedAt || mySubmission.createdAt || Date.now()).toLocaleString()}.
          {canUpdateMyPartI || canUpdateMyPartII
            ? ' Updates are enabled. You can continue editing and resubmitting during the allowed period.'
            : dpcrfPermission.allowUpdate
              ? ' The allowed update period has expired; ask the administrator to re-enable updates.'
            : ' Updates are locked by the administrator.'}
        </div>
      )}

      <div className="bg-white border border-blue-200 rounded-lg shadow p-4 md:p-6">
        <div className="mb-4 flex items-center justify-start">
          <div className="w-full sm:w-64">
            <label className="mb-1 block text-xs font-semibold text-blue-900">Year</label>
            <select
              value={selectedYear}
              onChange={(event) => {
                const nextYear = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(nextYear)) {
                  setSelectedYear(nextYear);
                  setError('');
                  setSuccess('');
                  setViewInfo('');
                }
              }}
              className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-blue-100 pb-3">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === 'part1' && (
            <>
              {adminFormsPanel}

              {loading ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Loading DPCRF data...
                </div>
              ) : (
                <PartIContent
                  currentYear={selectedYear}
                  sections={sections}
                  setSections={setSections}
                  readOnly={showReadOnlyPartI}
                  submitLocked={submitLocked}
                  submitDisabled={submitDisabledByProof}
                  submitHint={submitHint}
                  onSubmit={handleSubmitPartI}
                  submitLoading={submitLoading}
                  formInfo={formInfo}
                />
              )}
            </>
          )}

          {activeTab === 'part2' && (
            <>
              {adminFormsPanel}
              {loading ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Loading DPCRF data...
                </div>
              ) : (
                <PartIIContent
                  ratings={partIIRatings}
                  setRatings={setPartIIRatings}
                  readOnlySR={!canEditPartIISR}
                  readOnlyAR={!canEditPartIIAR}
                  showSaveButton={canAdminRateStaffPartII}
                  onSave={handleSavePartIIArRatings}
                  saveLoading={arSaveLoading}
                  srHint={partIISRHint}
                  arHint={partIIARHint}
                  showSubmitButton={canSubmitPartII}
                  onSubmitPartII={handleSubmitPartII}
                  submitPartIILoading={submitPartIILoading}
                />
              )}
            </>
          )}

          {activeTab === 'part34' && (
            <>
              {adminFormsPanel}
              <PartIIIIVContent
                sections={sections}
                ratings={partIIRatings}
                formInfo={formInfo}
                readOnly={isDepartmentManager && adminViewMode === ADMIN_VIEW_MODES.DEPARTMENT}
                part34Data={part34Data}
                setPart34Data={setPart34Data}
              />
            </>
          )}

          {activeTab === 'calendar' && (
            <SPMSCalendarContent
              spmsCalendar={spmsCalendar}
              setSpmsCalendar={setSpmsCalendar}
              isAdminUser={isAdminUser}
              onSave={handleSaveSpmsCalendar}
              saveLoading={spmsSaveLoading}
            />
          )}
        </div>
      </div>

      {showPermissionModal && isAdminUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dpcrf-permission-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="dpcrf-permission-title" className="text-xl font-bold text-blue-950">
              DPCRF Permission - {selectedYear}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose whether staff can update their submitted Part I and Part II forms for {selectedYear}.
              This setting remains in effect until an administrator changes it.
            </p>
            <div className={`mt-4 rounded-md px-3 py-2 text-sm font-semibold ${
              dpcrfPermission.allowUpdate
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-amber-50 text-amber-800'
            }`}>
              Updates are currently {dpcrfPermission.allowUpdate ? 'enabled' : 'locked'}.
            </div>
            {dpcrfPermission.updatedBy && (
              <p className="mt-2 text-xs text-slate-500">Last changed by {dpcrfPermission.updatedBy}.</p>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">Lock mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'manual', label: 'Manual' },
                    { value: 'days', label: 'Days' },
                    { value: 'weeks', label: 'Weeks' },
                    { value: 'months', label: 'Months' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPermissionLockMode(option.value)}
                      className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                        permissionLockMode === option.value
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {permissionLockMode !== 'manual' && (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Duration ({permissionLockMode})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={permissionDurationValue}
                    onChange={(event) => setPermissionDurationValue(event.target.value)}
                    placeholder={permissionLockMode === 'days' ? '7' : permissionLockMode === 'weeks' ? '2' : '1'}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-0 focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                disabled={permissionSaveLoading}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSetDpcrfPermission(false)}
                disabled={permissionSaveLoading || !dpcrfPermission.allowUpdate}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {permissionSaveLoading && dpcrfPermission.allowUpdate ? 'Saving...' : 'Lock Updates'}
              </button>
              <button
                type="button"
                onClick={() => handleSetDpcrfPermission(true)}
                disabled={permissionSaveLoading || dpcrfPermission.allowUpdate}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {permissionSaveLoading && !dpcrfPermission.allowUpdate ? 'Saving...' : 'Allow Updates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}