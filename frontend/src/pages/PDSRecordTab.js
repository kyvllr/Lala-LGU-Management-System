import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { personalDataSheetAPI, staffAPI } from '../api';
import { normalizeRole, ROLES } from '../constants';

const RECORD_TABS = [
  { key: 'all', label: 'All' },
  { key: 'applicant', label: 'Applicant (no accounts yet)' },
  { key: 'job-order', label: 'Job Order' },
  { key: 'separated-retirees', label: 'Separated/Retirees' },
  { key: 'regular', label: 'Regular' },
];

const CATEGORY_OPTIONS = [
  { key: 'applicant', label: 'Applicant (no accounts yet)' },
  { key: 'job-order', label: 'Job Order' },
  { key: 'separated-retirees', label: 'Separated/Retiree' },
  { key: 'regular', label: 'Regular' },
];

const toLower = (value) => String(value || '').trim().toLowerCase();

const buildRecordKey = (record) => {
  if (record?.submittedByStaffId) return `staff:${record.submittedByStaffId}`;
  if (record?.email) return `email:${toLower(record.email)}`;

  const name = [record?.surname, record?.firstName, record?.middleName]
    .filter(Boolean)
    .map((part) => toLower(part))
    .join('|');

  if (name) return `name:${name}`;
  return `pds:${record?._id || record?.pdsId || Math.random().toString(36)}`;
};

const getFullName = (record) => {
  return [record?.surname, record?.firstName, record?.middleName, record?.nameExtension]
    .filter(Boolean)
    .join(', ') || 'N/A';
};

const getStatusBadgeClass = (status) => {
  if (status === 'Approved') return 'bg-green-100 text-green-700';
  if (status === 'Disapproved') return 'bg-red-100 text-red-700';
  if (status === 'For Revision') return 'bg-orange-100 text-orange-700';
  return 'bg-yellow-100 text-yellow-700';
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

export default function PDSRecordTab() {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = normalizeRole(storedUser?.role);
  const canAddRecords = [ROLES.SUPER_ADMIN, ROLES.ADMIN_HR].includes(userRole);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recordTab, setRecordTab] = useState('all');
  const [records, setRecords] = useState([]);
  const [activeActionRow, setActiveActionRow] = useState('');
  const [categoryOverrides, setCategoryOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pdsRecordCategoryOverrides') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('pdsRecordCategoryOverrides', JSON.stringify(categoryOverrides));
  }, [categoryOverrides]);

  const loadRecordData = async () => {
    try {
      setLoading(true);
      setError('');

      const [pdsRes, staffRes] = await Promise.all([
        personalDataSheetAPI.getAll(),
        staffAPI.getAll(),
      ]);

      const allSheets = Array.isArray(pdsRes.data) ? pdsRes.data : [];
      const allStaff = Array.isArray(staffRes.data) ? staffRes.data : [];

      const sortedSheets = [...allSheets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const latestByPerson = new Map();

      sortedSheets.forEach((sheet) => {
        const key = buildRecordKey(sheet);
        if (!latestByPerson.has(key)) {
          latestByPerson.set(key, sheet);
        }
      });

      const staffById = new Map(allStaff.map((staff) => [String(staff.id), staff]));
      const staffByEmail = new Map(allStaff.map((staff) => [toLower(staff.email), staff]));

      const categorizedRecords = Array.from(latestByPerson.values()).map((record) => {
        const matchedStaff = record.submittedByStaffId
          ? staffById.get(String(record.submittedByStaffId))
          : staffByEmail.get(toLower(record.email));

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
    return records.map((record) => {
      const recordKey = record._id || record.pdsId;
      const category = categoryOverrides[recordKey] || inferCategory(record);
      return {
        ...record,
        category,
      };
    });
  }, [records, categoryOverrides]);

  const filteredRecords = useMemo(() => {
    if (recordTab === 'all') return recordsWithCategory;
    return recordsWithCategory.filter((record) => record.category === recordTab);
  }, [recordTab, recordsWithCategory]);

  const handleCategorySelect = (record, category) => {
    const recordKey = record._id || record.pdsId;
    setCategoryOverrides((prev) => ({
      ...prev,
      [recordKey]: category,
    }));
    setActiveActionRow('');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-3xl font-bold text-gray-800">PDS Records</h2>
        {canAddRecords && (
          <button
            type="button"
            onClick={() => navigate('/submit-personal-data-sheet', { state: { fromPdsRecord: true, skipPrefill: true } })}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Add PDS Record
          </button>
        )}
      </div>

      <div className="mb-4 border-b border-gray-200">
        <nav className="flex flex-wrap gap-2 pb-3" aria-label="PDS record tabs">
          {RECORD_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRecordTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                recordTab === tab.key
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading && <p className="text-gray-600">Loading PDS records...</p>}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {!loading && !error && filteredRecords.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          No records found for this category.
        </div>
      )}

      {!loading && !error && filteredRecords.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 px-4 py-2 text-left">PDS ID</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Full Name</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Email</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Mobile</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Account Type</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Submitted</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record._id || record.pdsId} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2 font-medium">{record.pdsId}</td>
                  <td className="border border-gray-300 px-4 py-2">{getFullName(record)}</td>
                  <td className="border border-gray-300 px-4 py-2">{record.email || 'N/A'}</td>
                  <td className="border border-gray-300 px-4 py-2">{record.mobile || 'N/A'}</td>
                  <td className="border border-gray-300 px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeClass(record.status)}`}>
                      {record.status || 'Pending'}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {getCategoryLabel(record.category)}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">
                    {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-sm">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setActiveActionRow((prev) => (prev === (record._id || record.pdsId) ? '' : (record._id || record.pdsId)))}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                      >
                        Add to
                      </button>

                      {activeActionRow === (record._id || record.pdsId) && (
                        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded shadow-lg z-20">
                          {CATEGORY_OPTIONS.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => handleCategorySelect(record, option.key)}
                              className="block w-full text-left px-3 py-2 hover:bg-gray-100 transition"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
