import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobPortalAPI, personalDataSheetAPI, staffAPI } from '../api';
import { DEPARTMENTS, isDepartmentStaffManager, normalizeRole, ROLES } from '../constants';
import printPersonalDataSheet from '../utils/printPersonalDataSheet';
import { openSeparationOrder, renderSeparationOrder } from '../utils/printSeparationOrder';

const RECORD_TABS = [
  { key: 'all', label: 'All' },
  { key: 'applicant', label: 'Applicant (no accounts yet)' },
  { key: 'job-order', label: 'Job Order' },
  { key: 'regular', label: 'Regular' },
  { key: 'awardee', label: 'Awardee' },
  { key: 'job-portal', label: 'Job Portal' },
  { key: 'separated-retirees', label: 'Separated/Retirees' },
];

const SEPARATION_TABS = [
  { key: 'all', label: 'All' },
  { key: 'retirement', label: 'Retirement' },
  { key: 'death', label: 'Death' },
  { key: 'resignation', label: 'Resignation' },
  { key: 'termination', label: 'Termination' },
  { key: 'drop-from-roles', label: 'Drop from the Roles' },
  { key: 'transfer-to-other-agency', label: 'Transfer to other agency' },
];

const CATEGORY_OPTIONS = [
  { key: 'applicant', label: 'Applicant (no accounts yet)' },
  { key: 'job-order', label: 'Job Order' },
  { key: 'separated-retirees', label: 'Separated/Retiree' },
  { key: 'regular', label: 'Regular' },
  { key: 'awardee', label: 'Awardee' },
];

const SEARCH_ATTRIBUTE_OPTIONS = [
  { key: 'all', label: 'All Fields' },
  { key: 'pdsId', label: 'PDS ID' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'department', label: 'Department' },
  { key: 'accountType', label: 'Account Type' },
];

const BULK_PERMISSION_DURATION_OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'other', label: 'Other (set number of days)' },
  { value: 'permanent', label: 'No expiry (until manually revoked)' },
];

const PDS_PERMISSION_ACTION_OPTIONS = [
  { value: 'revoke', label: 'Revoke permission' },
  { value: 'allow', label: 'Allow all user to update PDS' },
];

const toLower = (value) => String(value || '').trim().toLowerCase();
const normalizeStatus = (value) => toLower(value);

const hasActivePermission = (record) => {
  if (!record?.updatePermissionGranted) return false;
  if (!record?.updatePermissionExpiresAt) return true;

  const expiresAt = new Date(record.updatePermissionExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() > Date.now();
};

const getFullName = (record) => {
  return [record?.surname, record?.firstName, record?.middleName, record?.nameExtension]
    .filter(Boolean)
    .join(', ') || 'N/A';
};

const getRecordDepartment = (record) => (
  record?.matchedStaff?.department
  || record?.matchedStaff?.office
  || record?.department
  || record?.officeDepartment
  || record?.jobApplication?.office
  || ''
);

const getSeparationReason = (record) => {
  const detail = toLower([
    record?.separatedDetails,
    record?.matchedStaff?.employmentStatus,
    record?.matchedStaff?.position,
  ].filter(Boolean).join(' '));

  if (/\b(death|deceased|died|passed away)\b/.test(detail)) return 'death';
  if (/\b(retir(?:e|ed|ement|ing))\b/.test(detail)) return 'retirement';
  if (/\b(resign(?:ed|ation|ing)?)\b/.test(detail)) return 'resignation';
  if (/\b(drop(?:ped)? from the roles?|dropped from the roles?)\b/.test(detail)) return 'drop-from-roles';
  if (/\btransfer(?:red|ring)?\s+(?:to|into)\s+(?:another|other)\s+agenc(?:y|ies)\b/.test(detail)) {
    return 'transfer-to-other-agency';
  }
  if (/\b(terminat(?:e|ed|ion)|dismiss(?:ed|al)|end of term|finished contract|phased out|abolition)\b/.test(detail)) return 'termination';
  return '';
};

const inferCategory = (record) => {
  if (!record.hasAccount) return 'applicant';
  if (record.isJobOrder) return 'job-order';
  if (record.isSeparatedRetiree) return 'separated-retirees';
  return 'regular';
};

const getCategoryLabel = (categoryKey) => {
  const option = CATEGORY_OPTIONS.find((item) => item.key === categoryKey);
  return option ? option.label : 'Applicant (no accounts yet)';
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
};

const formatAddress = (address) => {
  if (!address) return 'N/A';
  if (typeof address === 'string') return address || 'N/A';

  const parts = [
    address.houseBlockLotNo,
    address.street,
    address.subdivisionVillage,
    address.barangay,
    address.cityMunicipality,
    address.province,
    address.zipCode ? `ZIP ${address.zipCode}` : '',
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : 'N/A';
};

const formatName = (parts = []) => {
  const normalized = parts.filter(Boolean);
  return normalized.length ? normalized.join(', ') : 'N/A';
};

export default function PDSRecordTab() {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = normalizeRole(storedUser?.role);
  const canAddRecords = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole);
  const canManagePdsRecords = isDepartmentStaffManager(userRole);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recordTab, setRecordTab] = useState('all');
  const [separationTab, setSeparationTab] = useState('all');
  const [records, setRecords] = useState([]);
  const [awardees, setAwardees] = useState([]);
  const [jobApplications, setJobApplications] = useState([]);
  const [activeActionRow, setActiveActionRow] = useState('');
  const [activeSeparationRow, setActiveSeparationRow] = useState('');
  const [separationDetailsTarget, setSeparationDetailsTarget] = useState(null);
  const [separationEffectivityDate, setSeparationEffectivityDate] = useState('');
  const [savingSeparationDetails, setSavingSeparationDetails] = useState(false);
  const [separationModalError, setSeparationModalError] = useState('');
  const [awardeeTarget, setAwardeeTarget] = useState(null);
  const [awardType, setAwardType] = useState('');
  const [savingAwardee, setSavingAwardee] = useState(false);
  const [awardeeModalError, setAwardeeModalError] = useState('');
  const [actionMenuPosition, setActionMenuPosition] = useState({ top: 0, left: 0 });
  const [viewRecord, setViewRecord] = useState(null);
  const [permissionActioningId, setPermissionActioningId] = useState('');
  const [deleteActioningId, setDeleteActioningId] = useState('');
  const [applicationActioningId, setApplicationActioningId] = useState('');
  const [bulkPermissionActioning, setBulkPermissionActioning] = useState(false);
  const [showBulkPermissionModal, setShowBulkPermissionModal] = useState(false);
  const [bulkPermissionAction, setBulkPermissionAction] = useState('revoke');
  const [bulkPermissionDuration, setBulkPermissionDuration] = useState('7');
  const [bulkPermissionCustomDays, setBulkPermissionCustomDays] = useState('');
  const [searchAttribute, setSearchAttribute] = useState('all');
  const [attributeSearchValue, setAttributeSearchValue] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [awardTypeFilter, setAwardTypeFilter] = useState('');
  const [categoryOverrides, setCategoryOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pdsRecordCategoryOverrides') || '{}');
    } catch {
      return {};
    }
  });
  const [separationReasonOverrides, setSeparationReasonOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pdsRecordSeparationReasonOverrides') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('pdsRecordCategoryOverrides', JSON.stringify(categoryOverrides));
  }, [categoryOverrides]);

  useEffect(() => {
    localStorage.setItem('pdsRecordSeparationReasonOverrides', JSON.stringify(separationReasonOverrides));
  }, [separationReasonOverrides]);

  const loadRecordData = async () => {
    try {
      setLoading(true);
      setError('');

      const [pdsRes, staffRes, applicationsRes, awardeesRes] = await Promise.all([
        personalDataSheetAPI.getAll(),
        staffAPI.getAll(),
        canAddRecords ? jobPortalAPI.getApplications() : Promise.resolve({ data: [] }),
        canManagePdsRecords ? personalDataSheetAPI.getAwardees() : Promise.resolve({ data: [] }),
      ]);

      const allSheets = Array.isArray(pdsRes.data) ? pdsRes.data : [];
      const approvedSheets = allSheets.filter((sheet) => normalizeStatus(sheet?.status) === 'approved');
      const allStaff = Array.isArray(staffRes.data) ? staffRes.data : [];

      const sortedSheets = [...approvedSheets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const staffById = new Map(allStaff.map((staff) => [String(staff.id), staff]));
      const staffByEmail = new Map(allStaff.map((staff) => [toLower(staff.email), staff]));

      const categorizedRecords = sortedSheets.map((record) => {
        const matchedStaff = (
          (record.ownerStaffId ? staffById.get(String(record.ownerStaffId)) : null)
          || staffByEmail.get(toLower(record.ownerEmail || record.email))
        );

        const hasAccount = Boolean(matchedStaff);
        const role = normalizeRole(matchedStaff?.role);
        const positionText = toLower(matchedStaff?.position);
        const separatedFlag = String(record?.separated || '').toUpperCase() === 'Y';

        const isJobOrder = role === ROLES.JOB_ORDER_OFFICER || positionText.includes('job order');
        const isSeparatedRetiree = separatedFlag || positionText.includes('retire') || positionText.includes('separat');
        const isRegular = hasAccount && !isJobOrder && !isSeparatedRetiree;

        return {
          ...record,
          matchedStaff,
          hasAccount,
          isJobOrder,
          isSeparatedRetiree,
          isRegular,
        };
      });

      setRecords(categorizedRecords);
      setJobApplications(Array.isArray(applicationsRes.data) ? applicationsRes.data : []);
      setAwardees(Array.isArray(awardeesRes.data) ? awardeesRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load PDS records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordData();
  }, []);

  const recordsWithCategory = useMemo(() => {
    const categorizedRecords = records.map((record) => {
      const recordKey = record._id || record.pdsId;
      const category = categoryOverrides[recordKey] || record.recordCategory || inferCategory(record);
      const separationReason = separationReasonOverrides[recordKey] || record.separationReason || getSeparationReason(record);
      return {
        ...record,
        category,
        separationReason,
      };
    });
    const awardeeCopies = awardees.map((awardee) => {
      const sourceRecord = records.find((record) => record.pdsId === awardee.sourcePdsId);
      return {
        ...awardee.pdsSnapshot,
        _id: awardee.awardeeId,
        pdsId: awardee.sourcePdsId,
        awardeeId: awardee.awardeeId,
        awardType: awardee.awardType,
        isAwardeeCopy: true,
        category: 'awardee',
        matchedStaff: sourceRecord?.matchedStaff,
        department: sourceRecord?.department || awardee.pdsSnapshot?.department,
        officeDepartment: sourceRecord?.officeDepartment || awardee.pdsSnapshot?.officeDepartment,
        createdAt: awardee.createdAt,
      };
    });

    return [...categorizedRecords, ...awardeeCopies];
  }, [records, awardees, categoryOverrides, separationReasonOverrides]);

  const departmentOptions = useMemo(() => {
    const recordDepartments = recordsWithCategory
      .map(getRecordDepartment)
      .filter((department) => department && toLower(department) !== 'n/a');
    return [...new Set([...DEPARTMENTS, ...recordDepartments])]
      .sort((a, b) => a.localeCompare(b));
  }, [recordsWithCategory]);

  const awardTypeOptions = useMemo(() => (
    [...new Set(recordsWithCategory
      .map((record) => String(record.awardType || '').trim())
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  ), [recordsWithCategory]);

  const filteredRecords = useMemo(() => {
    let baseRecords = recordTab === 'all'
      ? recordsWithCategory
      : recordsWithCategory.filter((record) => record.category === recordTab);

    if (recordTab === 'separated-retirees' && separationTab !== 'all') {
      baseRecords = baseRecords.filter((record) => record.separationReason === separationTab);
    }

    if (departmentFilter) {
      baseRecords = baseRecords.filter((record) => (
        toLower(getRecordDepartment(record)) === toLower(departmentFilter)
      ));
    }

    if (recordTab === 'awardee' && awardTypeFilter) {
      baseRecords = baseRecords.filter((record) => (
        toLower(record.awardType) === toLower(awardTypeFilter)
      ));
    }

    const needle = toLower(attributeSearchValue);
    if (!needle) return baseRecords;

    return baseRecords.filter((record) => {
      const departmentText = toLower(getRecordDepartment(record));

      const searchTextByAttribute = {
        pdsId: toLower(record.pdsId),
        fullName: toLower(getFullName(record)),
        email: toLower(record.email),
        mobile: toLower(record.mobile),
        department: departmentText,
        accountType: toLower(getCategoryLabel(record.category)),
      };

      if (searchAttribute !== 'all') {
        return (searchTextByAttribute[searchAttribute] || '').includes(needle);
      }

      const searchableText = [
        record.pdsId,
        getFullName(record),
        record.email,
        record.mobile,
        record.awardType,
        departmentText,
        getCategoryLabel(record.category),
      ].map(toLower).join(' ');

      return searchableText.includes(needle);
    });
  }, [
    recordTab,
    separationTab,
    recordsWithCategory,
    searchAttribute,
    attributeSearchValue,
    departmentFilter,
    awardTypeFilter,
  ]);

  const handleCategorySelect = (record, category, separationReason = '') => {
    const recordKey = record._id || record.pdsId;
    if (category === 'awardee') {
      setAwardeeTarget(record);
      setAwardType('');
      setAwardeeModalError('');
      setActiveActionRow('');
      setActiveSeparationRow('');
      return;
    }

    if (category === 'separated-retirees' && !separationReason) {
      const submenuHeight = (SEPARATION_TABS.length + 1) * 40;
      setActionMenuPosition((position) => ({
        ...position,
        top: Math.max(8, Math.min(position.top, window.innerHeight - submenuHeight - 8)),
      }));
      setActiveSeparationRow(recordKey);
      return;
    }

    if (category === 'separated-retirees') {
      setSeparationDetailsTarget({ record, separationReason });
      setSeparationEffectivityDate(
        record.effectivityDate ? new Date(record.effectivityDate).toISOString().slice(0, 10) : ''
      );
      setActiveActionRow('');
      setActiveSeparationRow('');
      return;
    }

    setCategoryOverrides((prev) => ({
      ...prev,
      [recordKey]: category,
    }));
    setSeparationReasonOverrides((prev) => {
      const next = { ...prev };
      delete next[recordKey];
      return next;
    });
    setActiveActionRow('');
    setActiveSeparationRow('');
  };

  const handleSaveAwardee = async (event) => {
    event.preventDefault();
    const sourcePdsId = awardeeTarget?.pdsId;
    const normalizedAwardType = awardType.trim();
    if (!sourcePdsId || !normalizedAwardType) {
      setAwardeeModalError('Enter the type of award.');
      return;
    }

    try {
      setSavingAwardee(true);
      setAwardeeModalError('');
      await personalDataSheetAPI.addAwardee(sourcePdsId, normalizedAwardType);
      setAwardeeTarget(null);
      setAwardType('');
      setRecordTab('awardee');
      await loadRecordData();
    } catch (requestError) {
      setAwardeeModalError(requestError.response?.data?.message || 'Failed to add this record to Awardee.');
    } finally {
      setSavingAwardee(false);
    }
  };

  const handleRemoveAwardee = async (record) => {
    if (!record?.awardeeId) return;
    if (!window.confirm(`Remove ${getFullName(record)} from the Awardee tab? The original PDS record will remain unchanged.`)) {
      return;
    }

    try {
      setDeleteActioningId(record.awardeeId);
      setError('');
      await personalDataSheetAPI.removeAwardee(record.awardeeId);
      if (viewRecord?.awardeeId === record.awardeeId) setViewRecord(null);
      await loadRecordData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to remove Awardee copy.');
    } finally {
      setDeleteActioningId('');
    }
  };

  const handleSaveSeparationDetails = async (event) => {
    event.preventDefault();
    if (!separationDetailsTarget?.record?.pdsId) return;
    if (!separationEffectivityDate) {
      setSeparationModalError('Enter the effectivity date to continue.');
      return;
    }

    const orderWindow = window.open('', '_blank');
    try {
      setSavingSeparationDetails(true);
      setSeparationModalError('');
      setError('');
      const { record, separationReason } = separationDetailsTarget;
      const response = await personalDataSheetAPI.saveSeparationDetails(record.pdsId, {
        separationReason,
        effectivityDate: separationEffectivityDate,
      });
      const updatedRecord = response.data?.pds;
      if (!updatedRecord) {
        throw new Error('The saved separated/retiree details were not returned by the server.');
      }

      const recordKey = record._id || record.pdsId;
      setRecords((items) => items.map((item) => (
        item.pdsId === updatedRecord.pdsId ? { ...item, ...updatedRecord } : item
      )));
      setCategoryOverrides((overrides) => ({ ...overrides, [recordKey]: 'separated-retirees' }));
      setSeparationReasonOverrides((overrides) => ({ ...overrides, [recordKey]: separationReason }));
      setSeparationDetailsTarget(null);
      setSeparationEffectivityDate('');
      if (orderWindow) {
        renderSeparationOrder(orderWindow, { ...updatedRecord, matchedStaff: record.matchedStaff });
      } else {
        setError('Separation details were saved and the order was generated. Allow pop-ups, then use Print Order to open it.');
      }
    } catch (requestError) {
      if (orderWindow && !orderWindow.closed) orderWindow.close();
      setSeparationModalError(requestError.response?.data?.message || requestError.message || 'Failed to save separated/retiree details.');
    } finally {
      setSavingSeparationDetails(false);
    }
  };

  const handlePrintSeparationOrder = (record) => {
    if (!openSeparationOrder(record)) {
      setError('Allow pop-ups to print the generated Separation Order.');
      return;
    }
    setError('');
  };

  const handleUpdatePds = (record) => {
    if (!record?.pdsId) return;

    navigate('/submit-personal-data-sheet', {
      state: {
        adminEdit: true,
        pdsId: record.pdsId,
        editPds: record,
        skipPrefill: true,
        fromPdsRecord: true,
      },
    });
  };

  const handleToggleActionMenu = (event, rowKey) => {
    const trigger = event?.currentTarget;
    if (!trigger) {
      setActiveActionRow((prev) => (prev === rowKey ? '' : rowKey));
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 224;
    const menuHeight = CATEGORY_OPTIONS.length * 40;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < menuHeight + 8;

    const top = showAbove
      ? Math.max(8, rect.top - menuHeight - 4)
      : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 4);
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));

    setActionMenuPosition({ top, left });
    setActiveActionRow((prev) => (prev === rowKey ? '' : rowKey));
    setActiveSeparationRow('');
  };

  const handleSetUpdatePermission = async (record, allowUpdate) => {
    if (!record?.pdsId) return;

    try {
      setPermissionActioningId(record.pdsId);
      setError('');

      const response = await personalDataSheetAPI.setUpdatePermission(record.pdsId, allowUpdate);
      const updatedRecord = response.data?.pds;

      if (updatedRecord) {
        setRecords((prev) => prev.map((item) => (item.pdsId === updatedRecord.pdsId ? { ...item, ...updatedRecord } : item)));
        setViewRecord((prev) => (prev?.pdsId === updatedRecord.pdsId ? { ...prev, ...updatedRecord } : prev));
      }

      await loadRecordData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update permission for this PDS record.');
    } finally {
      setPermissionActioningId('');
    }
  };

  const handleDeletePdsRecord = async (record) => {
    if (!record?.pdsId) return;

    const confirmed = window.confirm(`Are you sure you want to delete PDS ${record.pdsId}?`);
    if (!confirmed) return;

    try {
      setDeleteActioningId(record.pdsId);
      setError('');
      await personalDataSheetAPI.delete(record.pdsId);

      if (viewRecord?.pdsId === record.pdsId) {
        setViewRecord(null);
      }

      await loadRecordData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete this PDS record.');
    } finally {
      setDeleteActioningId('');
    }
  };

  const handleOpenPdsPermissionModal = async () => {
    setShowBulkPermissionModal(true);
  };

  const handleConfirmPdsPermissionAction = async () => {
    const isAllowAction = bulkPermissionAction === 'allow';
    let selectedDurationDays;

    if (!isAllowAction || bulkPermissionDuration === 'permanent') {
      selectedDurationDays = undefined;
    } else if (bulkPermissionDuration === 'other') {
      selectedDurationDays = Number(bulkPermissionCustomDays);
      if (!Number.isFinite(selectedDurationDays) || selectedDurationDays <= 0) {
        setError('Please enter a valid number of days greater than 0.');
        return;
      }
    } else {
      selectedDurationDays = Number(bulkPermissionDuration);
    }

    try {
      setBulkPermissionActioning(true);
      setError('');

      try {
        const response = await personalDataSheetAPI.setAllEmployeesUpdatePermission(isAllowAction, selectedDurationDays);
        const modifiedCount = Number(response.data?.modifiedCount || 0);
        const matchedCount = Number(response.data?.matchedCount || 0);

        await loadRecordData();
        setShowBulkPermissionModal(false);

        const statusMessage = modifiedCount > 0
          ? `PDS permission updated for ${modifiedCount} employee record(s).`
          : (isAllowAction
            ? `No changes applied. ${matchedCount} record(s) matched but were already allowed.`
            : `No changes applied. ${matchedCount} record(s) matched but were already revoked.`);
        setError(statusMessage);
      } catch (bulkErr) {
        // Compatibility fallback: older backend may not have bulk endpoint yet.
        if (bulkErr.response?.status !== 404) {
          throw bulkErr;
        }

        const targets = records
          .filter((record) => {
            if (!record?.hasAccount || normalizeStatus(record?.status) !== 'approved') return false;
            return isAllowAction ? !hasActivePermission(record) : Boolean(record?.updatePermissionGranted);
          })
          .map((record) => record.pdsId)
          .filter(Boolean);

        if (targets.length === 0) {
          setError(
            isAllowAction
              ? 'No changes applied. All employee records are already allowed.'
              : 'No changes applied. All employee records are already revoked.'
          );
          return;
        }

        let successCount = 0;
        for (const pdsId of targets) {
          try {
            await personalDataSheetAPI.setUpdatePermission(pdsId, isAllowAction, selectedDurationDays);
            successCount += 1;
          } catch (singleErr) {
            // Continue remaining records even if one update fails.
            console.error('Failed to grant permission for PDS:', pdsId, singleErr?.response?.data || singleErr.message);
          }
        }

        await loadRecordData();
        if (successCount > 0) {
          setShowBulkPermissionModal(false);
        }

        if (successCount === 0) {
          setError('Failed to grant update permission to employee records.');
          return;
        }

        if (successCount < targets.length) {
          setError(`PDS permission updated for ${successCount} of ${targets.length} employee record(s).`);
          return;
        }

        setError(`PDS permission updated for ${successCount} employee record(s).`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to grant update permission to all employee records.');
    } finally {
      setBulkPermissionActioning(false);
    }
  };

  const handlePrintPdsRecord = async (record) => {
    const printed = await printPersonalDataSheet(record);
    if (!printed) {
      setError('Unable to open print window. Please allow pop-ups and try again.');
      return;
    }

    setError('');
  };

  const handleReviewJobApplication = async (application, status) => {
    try {
      setApplicationActioningId(application.pdsId);
      setError('');
      await jobPortalAPI.reviewApplication(application.pdsId, status);
      await loadRecordData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to review job application.');
    } finally {
      setApplicationActioningId('');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-blue-100 shadow-sm p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-3xl font-bold tracking-tight text-blue-950">PDS Records</h2>
        {canAddRecords && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenPdsPermissionModal}
              disabled={bulkPermissionActioning || loading}
              className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition text-sm font-semibold shadow-sm disabled:opacity-60"
            >
              {bulkPermissionActioning ? 'Applying...' : 'PDS Permission'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/submit-personal-data-sheet', { state: { fromPdsRecord: true, skipPrefill: true } })}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm font-semibold shadow-sm"
            >
              Add PDS Record
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 border-b border-blue-100">
        <nav className="flex flex-wrap gap-2 pb-3" aria-label="PDS record tabs">
          {RECORD_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setRecordTab(tab.key);
                if (tab.key !== 'awardee') setAwardTypeFilter('');
                if (tab.key !== 'separated-retirees') setSeparationTab('all');
              }}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                recordTab === tab.key
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {recordTab === 'separated-retirees' && (
          <nav className="flex flex-wrap gap-2 border-t border-blue-100 py-3" aria-label="Separation categories">
            {SEPARATION_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSeparationTab(tab.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  separationTab === tab.key
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="mb-4 space-y-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={searchAttribute}
            onChange={(event) => setSearchAttribute(event.target.value)}
            className="border border-blue-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
            aria-label="Search attribute"
          >
            {SEARCH_ATTRIBUTE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>

          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="border border-blue-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {departmentOptions.map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>

          {recordTab === 'awardee' && (
            <select
              value={awardTypeFilter}
              onChange={(event) => setAwardTypeFilter(event.target.value)}
              className="border border-blue-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
              aria-label="Filter by type of award"
            >
              <option value="">All Types of Award</option>
              {awardTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          )}

          <input
            type="text"
            value={attributeSearchValue}
            onChange={(event) => setAttributeSearchValue(event.target.value)}
            placeholder="Search selected attribute..."
            className="border border-blue-200 rounded-md px-3 py-2 text-sm w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
            aria-label="Search attribute records"
          />
        </div>
      </div>

      {loading && <p className="text-blue-700 font-medium">Loading PDS records...</p>}

      {!loading && error && (
        <div className={`px-4 py-3 rounded-lg border ${error.toLowerCase().startsWith('pds permission updated') || error.toLowerCase().startsWith('no changes applied')
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-red-50 border-red-200 text-red-700'}`}>
          {error}
        </div>
      )}

      {!loading && !error && recordTab === 'job-portal' && jobApplications.length === 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-yellow-700">
          No job applications have been submitted.
        </div>
      )}

      {!loading && !error && recordTab === 'job-portal' && jobApplications.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-blue-100">
          <table className="w-full min-w-[850px] border-collapse text-sm text-slate-700">
            <thead>
              <tr className="bg-blue-100/80 text-left text-blue-900">
                <th scope="col" className="border border-blue-200 px-3 py-2">PDS ID</th>
                <th scope="col" className="border border-blue-200 px-3 py-2">Applicant</th>
                <th scope="col" className="border border-blue-200 px-3 py-2">Position</th>
                <th scope="col" className="border border-blue-200 px-3 py-2">Place of Assignment</th>
                <th scope="col" className="border border-blue-200 px-3 py-2">PDS Status</th>
                <th scope="col" className="border border-blue-200 px-3 py-2">Application Status</th>
                <th scope="col" className="border border-blue-200 px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobApplications.map((application) => (
                <tr key={application.pdsId} className="hover:bg-blue-50/50">
                  <td className="border border-blue-100 px-3 py-2 font-medium">{application.pdsId}</td>
                  <td className="border border-blue-100 px-3 py-2">
                    {getFullName(application)}
                    <div className="text-xs text-slate-500">{application.email || 'N/A'}</div>
                  </td>
                  <td className="border border-blue-100 px-3 py-2">{application.jobApplication?.positionTitle || 'N/A'}</td>
                  <td className="border border-blue-100 px-3 py-2">{application.jobApplication?.placeOfAssignment || 'N/A'}</td>
                  <td className="border border-blue-100 px-3 py-2">{application.status || 'Pending'}</td>
                  <td className="border border-blue-100 px-3 py-2">
                    {application.jobApplication?.status || 'Pending'}
                  </td>
                  <td className="border border-blue-100 px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setViewRecord(application)}
                        className="rounded bg-slate-600 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                      >
                        View
                      </button>
                      {application.jobApplication?.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReviewJobApplication(application, 'Approved')}
                            disabled={applicationActioningId === application.pdsId}
                            className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewJobApplication(application, 'Disapproved')}
                            disabled={applicationActioningId === application.pdsId}
                            className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Disapprove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && recordTab !== 'job-portal' && filteredRecords.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          No records found for this category.
        </div>
      )}

      {!loading && !error && recordTab !== 'job-portal' && filteredRecords.length > 0 && (
        <div className="overflow-x-auto overflow-y-visible relative rounded-lg border border-blue-100">
          <table className="w-full border-collapse text-[13px] text-slate-700">
            <thead>
              <tr className="bg-blue-100/80 text-blue-900">
                <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">PDS ID</th>
                <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Full Name</th>
                <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Email</th>
                <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Mobile</th>
                <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Account Type</th>
                {recordTab === 'awardee' && (
                  <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Type of Award</th>
                )}
                {recordTab === 'separated-retirees' && (
                  <>
                    <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Special Order Number</th>
                    <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Effectivity Date</th>
                  </>
                )}
                <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Submitted</th>
                <th scope="col" className="border border-blue-200 px-3 py-2 text-left text-xs font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record._id || record.pdsId} className="hover:bg-blue-50/50">
                  <td className="border border-blue-100 px-3 py-1.5 font-medium">{record.pdsId}</td>
                  <td className="border border-blue-100 px-3 py-1.5">{getFullName(record)}</td>
                  <td className="border border-blue-100 px-3 py-1.5">{record.email || 'N/A'}</td>
                  <td className="border border-blue-100 px-3 py-1.5">{record.mobile || 'N/A'}</td>
                  <td className="border border-blue-100 px-3 py-1.5">
                    {getCategoryLabel(record.category)}
                  </td>
                  {recordTab === 'awardee' && (
                    <td className="border border-blue-100 px-3 py-1.5">{record.awardType || 'N/A'}</td>
                  )}
                  {recordTab === 'separated-retirees' && (
                    <>
                      <td className="border border-blue-100 px-3 py-1.5">
                        {record.separationOrder?.orderNumber ? (
                          <button
                            type="button"
                            onClick={() => handlePrintSeparationOrder(record)}
                            className="font-semibold text-blue-700 underline hover:text-blue-900"
                          >
                            {record.separationOrder.orderNumber} s. {record.separationOrder.year}
                          </button>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="border border-blue-100 px-3 py-1.5">
                        {formatDate(record.effectivityDate)}
                      </td>
                    </>
                  )}
                  <td className="border border-blue-100 px-3 py-1.5 text-sm">
                    {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="border border-blue-100 px-3 py-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewRecord(record)}
                        className="bg-slate-600 text-white px-3 py-1 rounded-md hover:bg-slate-700 transition text-xs font-semibold"
                      >
                        View
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrintPdsRecord(record)}
                        className="bg-indigo-500 text-white px-3 py-1 rounded-md hover:bg-indigo-600 transition text-xs font-semibold"
                      >
                        Print
                      </button>

                      {canManagePdsRecords && !record.isAwardeeCopy && (
                        <button
                          type="button"
                          onClick={() => handleUpdatePds(record)}
                          className="bg-emerald-500 text-white px-3 py-1 rounded-md hover:bg-emerald-600 transition text-xs font-semibold"
                        >
                          Update
                        </button>
                      )}

                      {canManagePdsRecords && (
                        <button
                          type="button"
                          onClick={() => record.isAwardeeCopy ? handleRemoveAwardee(record) : handleDeletePdsRecord(record)}
                          disabled={deleteActioningId === (record.awardeeId || record.pdsId)}
                          className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 transition disabled:opacity-50 text-xs font-semibold"
                        >
                          {deleteActioningId === (record.awardeeId || record.pdsId)
                            ? 'Removing...'
                            : (record.isAwardeeCopy ? 'Remove' : 'Delete')}
                        </button>
                      )}

                      {!record.isAwardeeCopy && <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(event) => handleToggleActionMenu(event, record._id || record.pdsId)}
                        className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition text-xs font-semibold"
                      >
                        Add to
                      </button>

                      {activeActionRow === (record._id || record.pdsId) && (
                        <div
                          className="fixed w-56 bg-white border border-gray-200 rounded shadow-lg z-[70]"
                          style={{ top: `${actionMenuPosition.top}px`, left: `${actionMenuPosition.left}px` }}
                        >
                          {activeSeparationRow === (record._id || record.pdsId) ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setActiveSeparationRow('')}
                                className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50 transition"
                              >
                                Back to categories
                              </button>
                              {SEPARATION_TABS.filter((tab) => tab.key !== 'all').map((tab) => (
                                <button
                                  key={tab.key}
                                  type="button"
                                  onClick={() => handleCategorySelect(record, 'separated-retirees', tab.key)}
                                  className="block w-full text-left px-3 py-2 hover:bg-gray-100 transition"
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </>
                          ) : (
                            CATEGORY_OPTIONS.map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => handleCategorySelect(record, option.key)}
                                className="block w-full text-left px-3 py-2 hover:bg-gray-100 transition"
                              >
                                {option.label}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      </div>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {awardeeTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="awardee-modal-title"
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white p-4 sm:p-6 shadow-2xl"
          >
            <h3 id="awardee-modal-title" className="text-xl font-bold text-gray-900">Add PDS Record to Awardee</h3>
            <p className="mt-1 text-sm text-gray-600">
              This creates a separate copy for {getFullName(awardeeTarget)}. The current record will remain in its tab.
            </p>
            {awardeeModalError && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {awardeeModalError}
              </div>
            )}
            <form onSubmit={handleSaveAwardee} className="mt-5 space-y-4">
              <div>
                <label htmlFor="award-type" className="mb-1 block text-sm font-semibold text-gray-700">
                  Type of Award *
                </label>
                <input
                  id="award-type"
                  type="text"
                  value={awardType}
                  required
                  disabled={savingAwardee}
                  onChange={(event) => setAwardType(event.target.value)}
                  placeholder="Enter award type"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingAwardee}
                  onClick={() => {
                    setAwardeeTarget(null);
                    setAwardeeModalError('');
                  }}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAwardee}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingAwardee ? 'Saving...' : 'Add to Awardee'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {separationDetailsTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            if (savingSeparationDetails) return;
            setSeparationDetailsTarget(null);
            setSeparationModalError('');
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="separation-details-title"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-4 sm:p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="separation-details-title" className="text-xl font-bold text-gray-900">
              Separated/Retiree Details
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {SEPARATION_TABS.find((tab) => tab.key === separationDetailsTarget.separationReason)?.label}
            </p>

            {separationModalError && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {separationModalError}
              </div>
            )}

            <form onSubmit={handleSaveSeparationDetails} className="mt-5 space-y-4">
              <div>
                <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  A numbered Separation Order will be generated automatically when you save.
                </p>
              </div>

              <div>
                <label htmlFor="separation-effectivity-date" className="mb-1 block text-sm font-semibold text-gray-700">
                  Effectivity Date *
                </label>
                <input
                  id="separation-effectivity-date"
                  type="date"
                  value={separationEffectivityDate}
                  required
                  disabled={savingSeparationDetails}
                  onChange={(event) => setSeparationEffectivityDate(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingSeparationDetails}
                  onClick={() => {
                    setSeparationDetailsTarget(null);
                    setSeparationModalError('');
                  }}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSeparationDetails}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingSeparationDetails ? 'Generating...' : 'Generate and Assign'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {viewRecord && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="pds-details-title" className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <h3 id="pds-details-title" className="text-xl font-bold text-gray-800 min-w-0 break-words">PDS Details</h3>
              <button
                type="button"
                onClick={() => setViewRecord(null)}
                className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6 text-sm text-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <p><span className="font-semibold">PDS ID:</span> {viewRecord.pdsId || 'N/A'}</p>
                <p><span className="font-semibold">Status:</span> {viewRecord.status || 'Pending'}</p>
                <p><span className="font-semibold">Submitted:</span> {formatDate(viewRecord.createdAt)}</p>
                <p><span className="font-semibold">Reviewed:</span> {formatDate(viewRecord.reviewedAt)}</p>
                <p><span className="font-semibold">Reviewed By:</span> {viewRecord.reviewedBy || 'N/A'}</p>
                <p><span className="font-semibold">Category:</span> {getCategoryLabel(viewRecord.category || inferCategory(viewRecord))}</p>
                {viewRecord.isAwardeeCopy && (
                  <p><span className="font-semibold">Type of Award:</span> {viewRecord.awardType}</p>
                )}
                <p>
                  <span className="font-semibold">Update Permission:</span>{' '}
                  {viewRecord.updatePermissionGranted ? 'Allowed' : 'Locked'}
                </p>
                <p>
                  <span className="font-semibold">Permission Granted By:</span>{' '}
                  {viewRecord.updatePermissionGrantedBy || 'N/A'}
                </p>
                <p>
                  <span className="font-semibold">Permission Granted At:</span>{' '}
                  {formatDate(viewRecord.updatePermissionGrantedAt)}
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold mb-2">Personal Information</h4>
                {viewRecord.photoDataUrl && (
                  <img
                    src={viewRecord.photoDataUrl}
                    alt={`${viewRecord.firstName || 'PDS'} photo`}
                    className="mb-3 h-40 w-32 object-cover border border-gray-300"
                  />
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <p><span className="font-semibold">Name:</span> {formatName([viewRecord.surname, viewRecord.firstName, viewRecord.middleName, viewRecord.nameExtension])}</p>
                  <p><span className="font-semibold">Date of Birth:</span> {formatDate(viewRecord.dateOfBirth)}</p>
                  <p><span className="font-semibold">Place of Birth:</span> {viewRecord.placeOfBirth || 'N/A'}</p>
                  <p><span className="font-semibold">Sex:</span> {viewRecord.sexAtBirth || 'N/A'}</p>
                  <p><span className="font-semibold">Civil Status:</span> {viewRecord.civilStatus || 'N/A'}</p>
                  <p><span className="font-semibold">Citizenship:</span> {viewRecord.citizenship?.type || 'N/A'}</p>
                  <p><span className="font-semibold">Height (m):</span> {viewRecord.height || 'N/A'}</p>
                  <p><span className="font-semibold">Weight (kg):</span> {viewRecord.weight || 'N/A'}</p>
                  <p><span className="font-semibold">Blood Type:</span> {viewRecord.bloodType || 'N/A'}</p>
                  <p><span className="font-semibold">UMID ID No.:</span> {viewRecord.gsisNo || 'N/A'}</p>
                  <p><span className="font-semibold">PAG-IBIG ID No.:</span> {viewRecord.pagibigNo || 'N/A'}</p>
                  <p><span className="font-semibold">PhilHealth No.:</span> {viewRecord.philhealthNo || 'N/A'}</p>
                  <p><span className="font-semibold">PhilSys Number (PSN):</span> {viewRecord.sssNo || 'N/A'}</p>
                  <p><span className="font-semibold">TIN No.:</span> {viewRecord.tinNo || 'N/A'}</p>
                  <p><span className="font-semibold">Agency Employee No.:</span> {viewRecord.agencyEmployeeNo || 'N/A'}</p>
                  <p><span className="font-semibold">Email:</span> {viewRecord.email || 'N/A'}</p>
                  <p><span className="font-semibold">Mobile:</span> {viewRecord.mobile || 'N/A'}</p>
                  <p><span className="font-semibold">Telephone:</span> {viewRecord.telephone || 'N/A'}</p>
                  <p><span className="font-semibold">Residential Address:</span> {formatAddress(viewRecord.residentialAddress)}</p>
                  <p><span className="font-semibold">Permanent Address:</span> {formatAddress(viewRecord.permanentAddress)}</p>
                </div>
              </div>

              {viewRecord.jobApplication?.postingId && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-base font-semibold mb-2">Job Portal Application</h4>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <p><span className="font-semibold">Application Status:</span> {viewRecord.jobApplication.status || 'Pending'}</p>
                    <p><span className="font-semibold">Position Title:</span> {viewRecord.jobApplication.positionTitle || 'N/A'}</p>
                    <p><span className="font-semibold">Place of Assignment:</span> {viewRecord.jobApplication.placeOfAssignment || 'N/A'}</p>
                    <p><span className="font-semibold">Plantilla Item Number:</span> {viewRecord.jobApplication.plantillaItemNumber || 'N/A'}</p>
                    <p><span className="font-semibold">Salary / Job / Pay Grade:</span> {viewRecord.jobApplication.salaryJobPayGrade || 'N/A'}</p>
                    <p><span className="font-semibold">Monthly Salary:</span> {viewRecord.jobApplication.monthlySalary || 'N/A'}</p>
                    <p><span className="font-semibold">Eligibility:</span> {Array.isArray(viewRecord.jobApplication.eligibility) ? viewRecord.jobApplication.eligibility.join(', ') : (viewRecord.jobApplication.eligibility || 'N/A')}</p>
                    <p><span className="font-semibold">Education:</span> {viewRecord.jobApplication.education || 'N/A'}</p>
                    <p><span className="font-semibold">Training:</span> {viewRecord.jobApplication.training || 'N/A'}</p>
                    <p><span className="font-semibold">Work Experience:</span> {viewRecord.jobApplication.workExperience || 'N/A'}</p>
                    <p><span className="font-semibold">Competency:</span> {viewRecord.jobApplication.competency || 'N/A'}</p>
                    <p><span className="font-semibold">Application Reviewed By:</span> {viewRecord.jobApplication.reviewedBy || 'N/A'}</p>
                    <p><span className="font-semibold">Application Reviewed At:</span> {formatDate(viewRecord.jobApplication.reviewedAt)}</p>
                    <p className="md:col-span-2"><span className="font-semibold">Application Remarks:</span> {viewRecord.jobApplication.remarks || 'N/A'}</p>
                    <p><span className="font-semibold">Applicant Eligibility:</span> {viewRecord.jobApplication.applicantQualifications?.eligibility || 'N/A'}</p>
                    <p><span className="font-semibold">Applicant Education:</span> {viewRecord.jobApplication.applicantQualifications?.education || 'N/A'}</p>
                    <p><span className="font-semibold">Applicant Training:</span> {viewRecord.jobApplication.applicantQualifications?.trainingChoice || 'N/A'}{viewRecord.jobApplication.applicantQualifications?.trainingOther ? ` — ${viewRecord.jobApplication.applicantQualifications.trainingOther}` : ''}</p>
                    <p><span className="font-semibold">Applicant Work Experience:</span> {viewRecord.jobApplication.applicantQualifications?.workExperienceChoice || 'N/A'}{viewRecord.jobApplication.applicantQualifications?.workExperienceOther ? ` — ${viewRecord.jobApplication.applicantQualifications.workExperienceOther}` : ''}</p>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold mb-2">Family Background</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <p><span className="font-semibold">Spouse:</span> {formatName([viewRecord.familyBackground?.spouse?.surname, viewRecord.familyBackground?.spouse?.firstName, viewRecord.familyBackground?.spouse?.middleName, viewRecord.familyBackground?.spouse?.nameExtension])}</p>
                  <p><span className="font-semibold">Spouse Occupation:</span> {viewRecord.familyBackground?.spouse?.occupation || 'N/A'}</p>
                  <p><span className="font-semibold">Spouse Employer:</span> {viewRecord.familyBackground?.spouse?.employerBusinessName || 'N/A'}</p>
                  <p><span className="font-semibold">Spouse Business Address:</span> {viewRecord.familyBackground?.spouse?.businessAddress || 'N/A'}</p>
                  <p><span className="font-semibold">Father:</span> {formatName([viewRecord.familyBackground?.father?.surname, viewRecord.familyBackground?.father?.firstName, viewRecord.familyBackground?.father?.middleName, viewRecord.familyBackground?.father?.nameExtension])}</p>
                  <p><span className="font-semibold">Mother:</span> {formatName([viewRecord.familyBackground?.mother?.surname, viewRecord.familyBackground?.mother?.firstName, viewRecord.familyBackground?.mother?.middleName])}</p>
                </div>

                <div>
                  <p className="font-semibold mb-1">Children</p>
                  {viewRecord.familyBackground?.children?.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {viewRecord.familyBackground.children.map((child, index) => (
                        <li key={`${child.name || 'child'}-${index}`}>
                          {child.name || 'N/A'} {child.dateOfBirth ? `(${formatDate(child.dateOfBirth)})` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold mb-2">Educational Background</h4>
                {viewRecord.educationalBackground?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Level</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">School</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Degree/Course</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Period</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Units Earned</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Year Graduated</th>
                          <th scope="col" className="border border-gray-300 px-2 py-1 text-left">Honors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewRecord.educationalBackground.map((row, index) => (
                          <tr key={`${row.level || 'level'}-${index}`}>
                            <td className="border border-gray-300 px-2 py-1">{row.level || 'N/A'}</td>
                            <td className="border border-gray-300 px-2 py-1">{row.schoolName || 'N/A'}</td>
                            <td className="border border-gray-300 px-2 py-1">{row.basicEducationDegreeCourse || 'N/A'}</td>
                            <td className="border border-gray-300 px-2 py-1">{[row.periodFrom, row.periodTo].filter(Boolean).join(' - ') || 'N/A'}</td>
                            <td className="border border-gray-300 px-2 py-1">{row.highestLevelUnitsEarned || 'N/A'}</td>
                            <td className="border border-gray-300 px-2 py-1">{row.yearGraduated || 'N/A'}</td>
                            <td className="border border-gray-300 px-2 py-1">{row.scholarshipAcademicHonorsReceived || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>N/A</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold mb-2">Work Experience</h4>
                {viewRecord.workExperience?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {viewRecord.workExperience.map((item, index) => (
                      <li key={`work-${index}`}>
                        {item.positionTitle || 'N/A'} at {item.company || 'N/A'} ({item.from || 'N/A'} - {item.to || 'N/A'}) {item.duties ? `- ${item.duties}` : ''}
                        <div className="text-sm text-slate-600">
                          Monthly Salary: {item.monthlySalary || 'N/A'} · Salary / Job / Pay Grade &amp; Step: {item.salaryJobPayGrade || 'N/A'}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>N/A</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold mb-2">Voluntary Work</h4>
                {viewRecord.voluntaryWork?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {viewRecord.voluntaryWork.map((item, index) => (
                      <li key={`vol-${index}`}>
                        {item.organization || 'N/A'} ({item.from || 'N/A'} - {item.to || 'N/A'}) - {item.hours || 'N/A'} hrs - {item.position || 'N/A'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>N/A</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold mb-2">Learning and Development</h4>
                {viewRecord.learningDevelopment?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {viewRecord.learningDevelopment.map((item, index) => (
                      <li key={`learn-${index}`}>
                        {item.title || 'N/A'} ({item.from || 'N/A'} - {item.to || 'N/A'}) - {item.hours || 'N/A'} hrs - {item.conductedBy || 'N/A'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>N/A</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold mb-2">Skills, Distinctions, Memberships</h4>
                <p><span className="font-semibold">Hobbies / Special Skills:</span> {viewRecord.specialSkills?.filter(Boolean).join(', ') || 'N/A'}</p>
                <p><span className="font-semibold">Distinctions:</span> {viewRecord.distinctions?.filter(Boolean).join(', ') || 'N/A'}</p>
                <p><span className="font-semibold">Memberships:</span> {viewRecord.memberships?.filter(Boolean).join(', ') || 'N/A'}</p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold mb-2">Other Declarations</h4>
                <p><span className="font-semibold">Related (3rd degree):</span> {viewRecord.relatedThirdDegree || 'N/A'}</p>
                <p><span className="font-semibold">Related (4th degree):</span> {viewRecord.relatedFourthDegree || 'N/A'}</p>
                <p><span className="font-semibold">Related details:</span> {viewRecord.relatedDetails || 'N/A'}</p>
                <p><span className="font-semibold">Administrative offense:</span> {viewRecord.adminOffense || 'N/A'} {viewRecord.adminOffenseDetails ? `- ${viewRecord.adminOffenseDetails}` : ''}</p>
                <p><span className="font-semibold">Criminal charge:</span> {viewRecord.criminalCharge || 'N/A'} {viewRecord.criminalChargeDetails ? `- ${viewRecord.criminalChargeDetails}` : ''} {viewRecord.criminalChargeDateFiled ? `(${formatDate(viewRecord.criminalChargeDateFiled)})` : ''} {viewRecord.criminalChargeStatus ? `- ${viewRecord.criminalChargeStatus}` : ''}</p>
                <p><span className="font-semibold">Convicted:</span> {viewRecord.convicted || 'N/A'} {viewRecord.convictedDetails ? `- ${viewRecord.convictedDetails}` : ''}</p>
                <p><span className="font-semibold">Separated:</span> {viewRecord.separated || 'N/A'} {viewRecord.separatedDetails ? `- ${viewRecord.separatedDetails}` : ''}</p>
                <p><span className="font-semibold">Candidate:</span> {viewRecord.candidate || 'N/A'} {viewRecord.candidateDetails ? `- ${viewRecord.candidateDetails}` : ''}</p>
                <p><span className="font-semibold">Resigned to campaign:</span> {viewRecord.resignedToCampaign || 'N/A'} {viewRecord.resignedDetails ? `- ${viewRecord.resignedDetails}` : ''}</p>
                <p><span className="font-semibold">Immigrant:</span> {viewRecord.immigrant || 'N/A'} {viewRecord.immigrantCountry ? `- ${viewRecord.immigrantCountry}` : ''}</p>
                <p><span className="font-semibold">Indigenous:</span> {viewRecord.indigenous || 'N/A'} {viewRecord.indigenousDetails ? `- ${viewRecord.indigenousDetails}` : ''}</p>
                <p><span className="font-semibold">PWD:</span> {viewRecord.pwd || 'N/A'} {viewRecord.pwdId ? `- ${viewRecord.pwdId}` : ''}</p>
                <p><span className="font-semibold">Solo Parent:</span> {viewRecord.soloParent || 'N/A'} {viewRecord.soloParentId ? `- ${viewRecord.soloParentId}` : ''}</p>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold mb-2">References</h4>
                {viewRecord.references?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {viewRecord.references.map((item, index) => (
                      <li key={`ref-${index}`}>{item.name || 'N/A'} - {item.address || 'N/A'} - {item.contact || 'N/A'}</li>
                    ))}
                  </ul>
                ) : (
                  <p>N/A</p>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold mb-2">Government IDs</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <p><span className="font-semibold">GSIS ID:</span> {viewRecord.gsisIdNo || 'N/A'}</p>
                  <p><span className="font-semibold">PAG-IBIG ID:</span> {viewRecord.pagibigIdNo || 'N/A'}</p>
                  <p><span className="font-semibold">PhilHealth:</span> {viewRecord.philhealthNo || 'N/A'}</p>
                  <p><span className="font-semibold">SSS:</span> {viewRecord.sssNo || 'N/A'}</p>
                  <p><span className="font-semibold">TIN:</span> {viewRecord.tinNo || 'N/A'}</p>
                  <p><span className="font-semibold">Agency Employee No:</span> {viewRecord.agencyEmployeeNo || 'N/A'}</p>
                </div>
                <p className="mt-2"><span className="font-semibold">Other Government ID:</span> {viewRecord.govId?.idType || 'N/A'} {viewRecord.govId?.number ? `- ${viewRecord.govId.number}` : ''} {viewRecord.govId?.datePlace ? `- ${viewRecord.govId.datePlace}` : ''}</p>
              </div>

              <div className="border-t border-gray-200 pt-4 mt-6 flex items-center justify-end gap-2">
                {canManagePdsRecords && (
                  <button
                    type="button"
                    onClick={() => handleDeletePdsRecord(viewRecord)}
                    disabled={deleteActioningId === viewRecord.pdsId}
                    className="px-4 py-2 rounded text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {deleteActioningId === viewRecord.pdsId ? 'Deleting...' : 'Delete Record'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSetUpdatePermission(viewRecord, !Boolean(viewRecord.updatePermissionGranted))}
                  disabled={permissionActioningId === viewRecord.pdsId || normalizeStatus(viewRecord.status) !== 'approved'}
                  className={`px-4 py-2 rounded text-white transition disabled:opacity-50 ${viewRecord.updatePermissionGranted ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {permissionActioningId === viewRecord.pdsId
                    ? 'Saving...'
                    : (viewRecord.updatePermissionGranted ? 'Revoke Update Permission' : 'Allow User to Update PDS')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewRecord(null)}
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkPermissionModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="pds-permission-title" className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h3 id="pds-permission-title" className="text-lg font-bold text-gray-800">PDS Permission</h3>
              <p className="text-sm text-gray-600 mt-1">
                Select a permission action for all approved employee PDS records.
              </p>
            </div>

            <div className="px-6 py-4 space-y-3">
              <label htmlFor="bulk-permission-action" className="block text-sm font-medium text-gray-700">
                Action
              </label>
              <select
                id="bulk-permission-action"
                value={bulkPermissionAction}
                onChange={(event) => setBulkPermissionAction(event.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                disabled={bulkPermissionActioning}
              >
                {PDS_PERMISSION_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <label htmlFor="bulk-permission-duration" className="block text-sm font-medium text-gray-700">
                Permission Duration
              </label>
              <select
                id="bulk-permission-duration"
                value={bulkPermissionDuration}
                onChange={(event) => setBulkPermissionDuration(event.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                disabled={bulkPermissionActioning || bulkPermissionAction !== 'allow'}
              >
                {BULK_PERMISSION_DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              {bulkPermissionAction === 'allow' && bulkPermissionDuration === 'other' && (
                <div>
                  <label htmlFor="bulk-permission-custom-days" className="block text-sm font-medium text-gray-700 mb-1">
                    Number of days
                  </label>
                  <input
                    id="bulk-permission-custom-days"
                    type="number"
                    min="1"
                    step="1"
                    value={bulkPermissionCustomDays}
                    onChange={(event) => setBulkPermissionCustomDays(event.target.value)}
                    placeholder="Enter days (e.g., 14)"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    disabled={bulkPermissionActioning}
                  />
                </div>
              )}

              {bulkPermissionAction !== 'allow' && (
                <p className="text-xs text-gray-500">Duration is only used when the action is Allow.</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkPermissionModal(false)}
                disabled={bulkPermissionActioning}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPdsPermissionAction}
                disabled={bulkPermissionActioning}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50"
              >
                {bulkPermissionActioning ? 'Applying...' : 'Confirm Permission'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
