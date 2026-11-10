import React, { useEffect, useState } from 'react';
import { jobPortalAPI } from '../api';
import { EDUCATION_LEVELS, normalizeEligibilityList } from '../utils/jobQualifications';
import { FiBell, FiTrash2 } from 'react-icons/fi';

const POSITION_TITLES = [
  { title: 'Municipal Government Department Head I (Municipal Accountant)', level: 1 },
  { title: 'Supervising Administrative Officer (Management and Audit Analyst IV)', level: 1 },
  { title: 'Administrative Officer V (Management and Audit Analyst III)', level: 1 },
  { title: 'Administrative Officer IV (Management and Audit Analyst II)', level: 1 },
  { title: 'Administrative Officer II (Management and Audit Analyst I)', level: 1 },
  { title: 'Administrative Assistant IV (Bookbinder IV)', level: 1 },
  { title: 'Administrative Assistant II (Accounting Clerk III)', level: 2 },
  { title: 'Administrative Aide IV (Accounting Clerk I)', level: 2 },
  { title: 'Administrative Aide IV (Bookbinder II)', level: 2 },
  { title: 'Municipal Administrator' },
  { title: 'Bookbinder II', level: 2 },
  { title: 'Municipal Government Department Head I (Municipal Agriculturist)', level: 1 },
  { title: 'Agriculturist II' },
  { title: 'Senior Administrative Assistant II (Computer Operator IV)', level: 1 },
  { title: 'Agricultural Technologist', level: 1 },
  { title: 'Farm Supervisor', level: 1 },
  { title: 'Farm Worker II', level: 2 },
  { title: 'Municipal Government Department Head I (Municipal Assessor)', level: 1 },
  { title: 'Local Assessment Operations Officer III', level: 1 },
  { title: 'Local Assessment Operations Officer II' },
  { title: 'Assessment Clerk III', level: 2 },
  { title: 'Municipal Government Department Head I (Municipal Budget Officer)', level: 1 },
  { title: 'Administrative Officer II (Budget Officer I)', level: 1 },
  { title: 'Administrative Aide IV (Budgeting Aide)' },
  { title: 'Municipal Government Department Head I (Municipal Civil Registrar)', level: 1 },
  { title: 'Registration Officer II', level: 1 },
  { title: 'Administrative Aide IV (Clerk)' },
  { title: 'Municipal Government Department Head I (Municipal Economic Enterprise Officer)', level: 1 },
  { title: 'Market Supervisor II', level: 1 },
  { title: 'Meat Inspector II' },
  { title: 'Livestock Inspector II' },
  { title: 'Labor General Foreman' },
  { title: 'Administrative Aide III (Utility Worker II)', level: 2 },
  { title: 'Administrative Aide I (Utility Worker I)', level: 2 },
  { title: 'Municipal Government Department Head I (Municipal Engineer)', level: 1 },
  { title: 'Engineer II', level: 1 },
  { title: 'Engineer I', level: 1 },
  { title: 'Draftsman III', level: 1 },
  { title: 'Electrical Inspector II', level: 2 },
  { title: 'Administrative Assistant I (Bookbinder III)', level: 2 },
  { title: 'Draftsman I', level: 1 },
  { title: 'Heavy Equipment Operator II', level: 1 },
  { title: 'Heavy Equipment Operator I', level: 2 },
  { title: 'Administrative Aide III (Laborer II)', level: 2 },
  { title: 'Administrative Aide I (Laborer II)', level: 2 },
  { title: 'Municipal Government Department Head I (Municipal General Services Officer)', level: 1 },
  { title: 'Supervising Administrative Officer (Supply Officer IV)', level: 1 },
  { title: 'Administrative Officer V (Supply Officer III)', level: 1 },
  { title: 'Administrative Aide II (Bookbinder III)', level: 1 },
  { title: 'Administrative Aide VI (Utility Foreman)', level: 2 },
  { title: 'Administrative Aide IV (Reproduction Machine Operator II)', level: 2 },
  { title: 'Administrative Aide IV (Driver II)', level: 2 },
  { title: 'Administrative Aide III (Driver I)', level: 2 },
  { title: 'Administrative Aide III (Messenger)', level: 2 },
  { title: 'Cemetery Caretaker', level: 2 },
  { title: 'Municipal Government Department Head I (Municipal Health Officer)', level: 1 },
  { title: 'Nurse III', level: 1 },
  { title: 'Nurse II', level: 1 },
  { title: 'Nurse I', level: 1 },
  { title: 'Medical Technologist II', level: 1 },
  { title: 'Midwife III', level: 1 },
  { title: 'Midwife II', level: 1 },
  { title: 'Medical Technologist I', level: 1 },
  { title: 'Laboratory Technician II', level: 2 },
  { title: 'Sanitation Inspector I', level: 2 },
  { title: 'Barangay Health Aide', level: 2 },
  { title: 'Municipal Mayor', level: 1 },
  { title: 'Licensing Officer IV', level: 1 },
  { title: 'Community Affairs Officer IV', level: 1 },
  { title: 'Supervising Administrative Officer (Human Resource Management Officer III)', level: 1 },
  { title: 'Engineer III (Agricultural and Biosystems)' },
  { title: 'Municipal Government Department Head I (Municipal Disaster Risk Reduction and Management Officer)', level: 1 },
  { title: 'Local Disaster Risk Reduction and Management Officer III', level: 1 },
  { title: 'Internal Auditor III', level: 1 },
  { title: 'Senior Administrative Assistant V', level: 1 },
  { title: 'Administrative Officer V (Human Resource Management Officer III)', level: 1 },
  { title: 'Senior Administrative Assistant II (Private Secretary II)', level: 1 },
  { title: 'Local Disaster Risk Reduction and Management Officer I' },
  { title: 'Administrative Assistant VI (Computer Operator III)', level: 1 },
  { title: 'Administrative Assistant V (Data Entry Machine Operator III)', level: 1 },
  { title: 'Municipal Government Department Head I (Municipal Tourism Officer)' },
  { title: 'Tourism Operations Officer I', level: 1 },
  { title: 'Cooperative Development Specialist I', level: 1 },
  { title: 'Labor and Employment Officer I', level: 1 },
  { title: 'Security Agent II' },
  { title: 'Youth Development Officer I' },
  { title: 'Administrative Aide IV (Clerk II)', level: 2 },
  { title: 'Administrative Aide IV (Human Resource Management Aide)', level: 2 },
  { title: 'Municipal Government Department Head I (Municipal Planning and Development Coordinator)', level: 1 },
  { title: 'Project Development Officer III' },
  { title: 'Project Development Officer II', level: 1 },
  { title: 'Planning Officer I' },
  { title: 'Administrative Assistant II (Data Entry Machine Operator II)', level: 2 },
  { title: 'Municipal Government Department Head I (Municipal Social Welfare & Disability Affairs Officer IV)', level: 1 },
  { title: 'Social Welfare Officer II', level: 1 },
  { title: 'Social Welfare Officer I', level: 1 },
  { title: 'Social Citizen Affairs Head' },
  { title: 'Social Welfare Assistant', level: 2 },
  { title: 'Day Care Worker II', level: 2 },
  { title: 'Day Care Worker I', level: 2 },
  { title: 'House Parent II', level: 2 },
  { title: 'Municipal Government Department Head I (Municipal Treasurer)' },
  { title: 'Local Revenue Collection Officer III', level: 1 },
  { title: 'Local Revenue Collection Officer II', level: 1 },
  { title: 'Administrative Officer III (Cashier II)', level: 1 },
  { title: 'Administrative Officer II (Administrative Officer I)' },
  { title: 'Local Revenue Collection Officer I' },
  { title: 'Revenue Collection Clerk II', level: 2 },
  { title: 'Ticket Checker', level: 2 },
  { title: 'Municipal Vice Mayor I', level: 1 },
  { title: 'Sangguniang Member I', level: 1 },
  { title: 'SB Secretary', level: 1 },
  { title: 'Local Legislative Staff Officer III', level: 1 },
  { title: 'Administrative Officer III (Records Officer III)', level: 1 },
  { title: 'Administrative Assistant V (Stenographic Reporter III)', level: 1 },
  { title: 'Administrative Officer I (Records Officer I)', level: 1 },
  { title: 'Senior Administrative Assistant I (Stenographic Reporter IV)', level: 1 },
  { title: 'Administrative Aide II (Messenger)', level: 2 },
  { title: 'Local Legislative Staff Employee II', level: 2 },
  { title: 'Local Legislative Staff Employee I', level: 2 },
  { title: 'Other' },
];

const getPositionLabel = ({ title, level }) => (
  level ? `${title} - Level ${level}` : title
);

const EMPTY_FORM = {
  placeOfAssignment: '',
  positionTitle: '',
  plantillaItemNumber: '',
  salaryJobPayGrade: '',
  monthlySalary: '',
  eligibility: [''],
  education: '',
  training: '',
  workExperience: '',
  competency: '',
};

const EMPTY_ANNOUNCEMENT = {
  title: '',
  category: 'General',
  content: '',
  linkUrl: '',
  linkLabel: '',
  expiresAt: '',
};

const FIELD_LABELS = {
  placeOfAssignment: 'Place of Assignment',
  plantillaItemNumber: 'Plantilla Item Number',
  salaryJobPayGrade: 'Salary / Job / Pay Grade',
  monthlySalary: 'Monthly Salary',
  education: 'Education',
  training: 'Training',
  workExperience: 'Work Experience',
  competency: 'Competency',
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
};

export default function JobPortal() {
  const [postings, setPostings] = useState([]);
  const [applications, setApplications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [announcementForm, setAnnouncementForm] = useState(EMPTY_ANNOUNCEMENT);
  const [customPositionTitle, setCustomPositionTitle] = useState('');
  const [activeTab, setActiveTab] = useState('postings');
  const [postingSearch, setPostingSearch] = useState('');
  const [postingStatusFilter, setPostingStatusFilter] = useState('');
  const [applicationSearch, setApplicationSearch] = useState('');
  const [pdsStatusFilter, setPdsStatusFilter] = useState('');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [viewApplication, setViewApplication] = useState(null);

  const loadPostings = async () => {
    try {
      setLoading(true);
      setError('');
      const [postingResponse, applicationResponse, announcementResponse] = await Promise.all([
        jobPortalAPI.getPostings(''),
        jobPortalAPI.getApplications(),
        jobPortalAPI.getAnnouncements(''),
      ]);
      setPostings(Array.isArray(postingResponse.data) ? postingResponse.data : []);
      setApplications(Array.isArray(applicationResponse.data) ? applicationResponse.data : []);
      setAnnouncements(Array.isArray(announcementResponse.data) ? announcementResponse.data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load Job Portal data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPostings();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleAnnouncementChange = (event) => {
    const { name, value } = event.target;
    setAnnouncementForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    try {
      setSaving(true);
      await jobPortalAPI.createAnnouncement(announcementForm);
      setAnnouncementForm(EMPTY_ANNOUNCEMENT);
      setNotice('Announcement published on the public home page.');
      await loadPostings();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to publish announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleAnnouncementStatus = async (announcement) => {
    const status = announcement.status === 'Published' ? 'Archived' : 'Published';
    try {
      setUpdatingId(announcement.announcementId);
      setError('');
      await jobPortalAPI.updateAnnouncementStatus(announcement.announcementId, status);
      await loadPostings();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update announcement status.');
    } finally {
      setUpdatingId('');
    }
  };

  const handleDeleteAnnouncement = async (announcement) => {
    if (!window.confirm(`Delete "${announcement.title}"? This will remove it from the home page.`)) return;
    try {
      setUpdatingId(announcement.announcementId);
      setError('');
      await jobPortalAPI.deleteAnnouncement(announcement.announcementId);
      setNotice('Announcement deleted.');
      await loadPostings();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to delete announcement.');
    } finally {
      setUpdatingId('');
    }
  };

  const handleEligibilityChange = (index, value) => {
    setFormData((previous) => ({
      ...previous,
      eligibility: previous.eligibility.map((entry, entryIndex) => entryIndex === index ? value : entry),
    }));
  };

  const addEligibility = () => {
    setFormData((previous) => ({ ...previous, eligibility: [...previous.eligibility, ''] }));
  };

  const removeEligibility = (index) => {
    setFormData((previous) => ({
      ...previous,
      eligibility: previous.eligibility.length > 1
        ? previous.eligibility.filter((_, entryIndex) => entryIndex !== index)
        : previous.eligibility,
    }));
  };

  const handleCreatePosting = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const positionTitle = formData.positionTitle === 'Other'
      ? customPositionTitle.trim()
      : formData.positionTitle.trim();
    if (!positionTitle) {
      setError('Select a position title or enter a custom position title.');
      return;
    }
    if (!normalizeEligibilityList(formData.eligibility).length) {
      setError('Enter at least one eligibility requirement.');
      return;
    }

    try {
      setSaving(true);
      await jobPortalAPI.createPosting({ ...formData, positionTitle });
      setFormData(EMPTY_FORM);
      setCustomPositionTitle('');
      setNotice('Position published and is now available in the PDS form.');
      await loadPostings();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to publish position.');
    } finally {
      setSaving(false);
    }
  };

  const handlePostingStatus = async (posting) => {
    const nextStatus = posting.status === 'Published' ? 'Closed' : 'Published';
    try {
      setUpdatingId(posting.postingId);
      setError('');
      await jobPortalAPI.updatePostingStatus(posting.postingId, nextStatus);
      await loadPostings();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update position status.');
    } finally {
      setUpdatingId('');
    }
  };

  const handleApplicationReview = async (application, status) => {
    try {
      setUpdatingId(application.pdsId);
      setError('');
      await jobPortalAPI.reviewApplication(application.pdsId, status);
      await loadPostings();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update application status.');
    } finally {
      setUpdatingId('');
    }
  };

  const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
  const normalizedSearch = (value) => String(value || '').trim().toLowerCase();
  const filteredPostings = postings.filter((posting) => {
    const query = normalizedSearch(postingSearch);
    const matchesText = !query
      || normalizedSearch(posting.positionTitle).includes(query)
      || normalizedSearch(posting.placeOfAssignment).includes(query);
    return matchesText && (!postingStatusFilter || posting.status === postingStatusFilter);
  });
  const filteredApplications = applications.filter((application) => {
    const query = normalizedSearch(applicationSearch);
    const applicantName = [
      application.firstName,
      application.middleName,
      application.surname,
      application.nameExtension,
    ].filter(Boolean).join(' ');
    const matchesText = !query
      || normalizedSearch(applicantName).includes(query)
      || normalizedSearch(application.email).includes(query)
      || normalizedSearch(application.jobApplication?.positionTitle).includes(query)
      || normalizedSearch(application.jobApplication?.placeOfAssignment).includes(query);
    const pdsStatus = application.status || 'Pending';
    const jobStatus = application.jobApplication?.status || 'Pending';
    return matchesText
      && (!pdsStatusFilter || pdsStatus === pdsStatusFilter)
      && (!applicationStatusFilter || jobStatus === applicationStatusFilter);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-blue-950">Announcements</h1>
          <p className="mt-1 text-sm text-slate-600">Manage job opportunities, review applications, and publish updates to the public home page.</p>
        </div>
        <button
          type="button"
          onClick={loadPostings}
          disabled={loading}
          className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-blue-100 pb-3" aria-label="Announcements sections">
        {[
          { key: 'postings', label: 'Positions' },
          { key: 'applications', label: `Applications (${applications.length})` },
          { key: 'announcements', label: `Announcements (${announcements.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {loading && <p className="text-sm font-medium text-blue-700">Loading announcements...</p>}

      {!loading && activeTab === 'announcements' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-xl font-bold text-slate-800">Published &amp; Archived Announcements</h2>
            <p className="mb-4 text-sm text-slate-600">Published items appear on the public HR services home page.</p>
            {announcements.length === 0 ? (
              <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">No announcements have been created yet.</p>
            ) : (
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <article key={announcement.announcementId} className="rounded-md border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-blue-950">{announcement.title}</h3>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{announcement.category}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${announcement.status === 'Published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {announcement.status}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{announcement.content}</p>
                        {announcement.linkUrl && (
                          <a href={announcement.linkUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">
                            {announcement.linkLabel || announcement.linkUrl}
                          </a>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          Posted {formatDate(announcement.createdAt)}
                          {announcement.expiresAt ? ` · Expires ${formatDate(announcement.expiresAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleAnnouncementStatus(announcement)}
                          disabled={updatingId === announcement.announcementId}
                          className={`rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${announcement.status === 'Published' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                          {updatingId === announcement.announcementId ? 'Updating...' : announcement.status === 'Published' ? 'Archive' : 'Republish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(announcement)}
                          disabled={updatingId === announcement.announcementId}
                          aria-label={`Delete ${announcement.title}`}
                          className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <FiTrash2 aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FiBell className="text-blue-700" aria-hidden="true" />
              <h2 className="text-xl font-bold text-slate-800">Create an Announcement</h2>
            </div>
            <form onSubmit={handleCreateAnnouncement} className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Title
                <input name="title" value={announcementForm.title} onChange={handleAnnouncementChange} maxLength={160} required className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Category
                <select name="category" value={announcementForm.category} onChange={handleAnnouncementChange} required className={`${inputClass} mt-1`}>
                  {['General', 'Advisory', 'Event', 'Opportunity', 'HR Notice'].map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Content
                <textarea name="content" value={announcementForm.content} onChange={handleAnnouncementChange} maxLength={10000} required rows={7} className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Link URL <span className="font-normal text-slate-500">(optional)</span>
                <input name="linkUrl" type="url" value={announcementForm.linkUrl} onChange={handleAnnouncementChange} placeholder="https://example.com" className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Link label <span className="font-normal text-slate-500">(optional)</span>
                <input name="linkLabel" value={announcementForm.linkLabel} onChange={handleAnnouncementChange} maxLength={80} placeholder="Read more" className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Expiration date <span className="font-normal text-slate-500">(optional)</span>
                <input name="expiresAt" type="date" value={announcementForm.expiresAt} onChange={handleAnnouncementChange} className={`${inputClass} mt-1`} />
              </label>
              <p className="text-xs text-slate-500">The announcement will be published immediately and hidden from the home page after its expiration date.</p>
              <button type="submit" disabled={saving} className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Publishing...' : 'Publish Announcement'}
              </button>
            </form>
          </section>
        </div>
      )}

      {!loading && activeTab === 'postings' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-slate-800">Positions</h2>
            <div className="mb-4 grid gap-3 rounded-md border border-blue-100 bg-blue-50/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
              <label className="block text-xs font-semibold uppercase tracking-wide text-blue-800">
                Search position or assignment
                <input
                  type="search"
                  value={postingSearch}
                  onChange={(event) => setPostingSearch(event.target.value)}
                  placeholder="Search positions..."
                  className={`${inputClass} mt-1 bg-white normal-case tracking-normal`}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-blue-800">
                Status
                <select
                  value={postingStatusFilter}
                  onChange={(event) => setPostingStatusFilter(event.target.value)}
                  className={`${inputClass} mt-1 bg-white normal-case tracking-normal`}
                >
                  <option value="">All statuses</option>
                  <option value="Published">Published</option>
                  <option value="Closed">Closed</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setPostingSearch('');
                  setPostingStatusFilter('');
                }}
                className="rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Clear filters
              </button>
            </div>
            {postings.length === 0 ? (
              <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">No positions have been published yet.</p>
            ) : filteredPostings.length === 0 ? (
              <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">No positions match the selected filters.</p>
            ) : (
              <div className="space-y-3">
                {filteredPostings.map((posting) => (
                  <article key={posting.postingId} className="rounded-md border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-blue-950">{posting.positionTitle}</h3>
                        <p className="text-sm text-slate-600">{posting.placeOfAssignment}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Item {posting.plantillaItemNumber} · Grade {posting.salaryJobPayGrade} · {posting.monthlySalary}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {posting.status} · Published {formatDate(posting.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePostingStatus(posting)}
                        disabled={updatingId === posting.postingId}
                        className={`rounded px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${posting.status === 'Published' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                      >
                        {updatingId === posting.postingId ? 'Updating...' : posting.status === 'Published' ? 'Close position' : 'Republish'}
                      </button>
                    </div>
                    <details className="mt-3 text-sm text-slate-700">
                      <summary className="cursor-pointer font-medium text-blue-700">View qualifications</summary>
                      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                        {['eligibility', 'education', 'training', 'workExperience', 'competency'].map((field) => (
                          <div key={field}>
                            <dt className="font-semibold">{FIELD_LABELS[field]}</dt>
                            <dd className="whitespace-pre-wrap">
                              {field === 'eligibility'
                                ? normalizeEligibilityList(posting.eligibility).join(', ') || 'N/A'
                                : posting[field] || 'N/A'}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-slate-800">Publish a Position</h2>
            <form onSubmit={handleCreatePosting} className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Position Title
                <select name="positionTitle" value={formData.positionTitle} onChange={handleChange} required className={`${inputClass} mt-1`}>
                  <option value="">Select position title</option>
                  {POSITION_TITLES.map((position) => (
                    <option key={position.title} value={position.title}>{getPositionLabel(position)}</option>
                  ))}
                </select>
              </label>
              {formData.positionTitle === 'Other' && (
                <label className="block text-sm font-medium text-slate-700">
                  Other Position Title
                  <input value={customPositionTitle} onChange={(event) => setCustomPositionTitle(event.target.value)} required className={`${inputClass} mt-1`} />
                </label>
              )}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">Eligibility Requirements</legend>
                <p className="text-xs text-slate-500">Add each eligible license or qualification. Applicants must select one listed eligibility.</p>
                {formData.eligibility.map((eligibility, index) => (
                  <div key={`eligibility-${index}`} className="flex items-center gap-2">
                    <input
                      value={eligibility}
                      onChange={(event) => handleEligibilityChange(index, event.target.value)}
                      required={index === 0}
                      aria-label={`Eligibility requirement ${index + 1}`}
                      placeholder="e.g. Civil Service Professional"
                      className={inputClass}
                    />
                    {formData.eligibility.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEligibility(index)}
                        aria-label={`Remove eligibility requirement ${index + 1}`}
                        className="rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEligibility}
                  className="rounded border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Add Eligibility
                </button>
              </fieldset>
              {Object.entries(FIELD_LABELS).map(([field, label]) => (
                <label key={field} className="block text-sm font-medium text-slate-700">
                  {label}
                  {field === 'education' ? (
                    <select name={field} value={formData[field]} onChange={handleChange} required className={`${inputClass} mt-1`}>
                      <option value="">Select education requirement</option>
                      {EDUCATION_LEVELS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <textarea
                      name={field}
                      value={formData[field]}
                      onChange={handleChange}
                      required
                      rows={field === 'training' || field === 'workExperience' || field === 'competency' ? 2 : 1}
                      className={`${inputClass} mt-1`}
                    />
                  )}
                </label>
              ))}
              <button type="submit" disabled={saving} className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Publishing...' : 'Publish Position'}
              </button>
            </form>
          </section>
        </div>
      )}

      {!loading && activeTab === 'applications' && (
        <section className="overflow-x-auto rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-800">PDS Applications</h2>
          <div className="mb-4 grid gap-3 rounded-md border border-blue-100 bg-blue-50/60 p-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-end">
            <label className="block text-xs font-semibold uppercase tracking-wide text-blue-800">
              Search applicant, position, or assignment
              <input
                type="search"
                value={applicationSearch}
                onChange={(event) => setApplicationSearch(event.target.value)}
                placeholder="Search applications..."
                className={`${inputClass} mt-1 bg-white normal-case tracking-normal`}
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-blue-800">
              PDS Review
              <select
                value={pdsStatusFilter}
                onChange={(event) => setPdsStatusFilter(event.target.value)}
                className={`${inputClass} mt-1 bg-white normal-case tracking-normal`}
              >
                <option value="">All statuses</option>
                {['Pending', 'Approved', 'Disapproved', 'For Revision'].map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-blue-800">
              Application Status
              <select
                value={applicationStatusFilter}
                onChange={(event) => setApplicationStatusFilter(event.target.value)}
                className={`${inputClass} mt-1 bg-white normal-case tracking-normal`}
              >
                <option value="">All statuses</option>
                {['Pending', 'Approved', 'Disapproved'].map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setApplicationSearch('');
                setPdsStatusFilter('');
                setApplicationStatusFilter('');
              }}
              className="rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              Clear filters
            </button>
          </div>
          {applications.length === 0 ? (
            <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">No job applications have been submitted.</p>
          ) : filteredApplications.length === 0 ? (
            <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">No applications match the selected filters.</p>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-blue-50 text-left text-blue-950">
                  <th className="border border-blue-100 px-3 py-2">Applicant</th>
                  <th className="border border-blue-100 px-3 py-2">Position</th>
                  <th className="border border-blue-100 px-3 py-2">Place of Assignment</th>
                  <th className="border border-blue-100 px-3 py-2">PDS Review</th>
                  <th className="border border-blue-100 px-3 py-2">Application Status</th>
                  <th className="border border-blue-100 px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((application) => (
                  <tr key={application.pdsId}>
                    <td className="border border-blue-100 px-3 py-2">
                      {[application.firstName, application.middleName, application.surname, application.nameExtension].filter(Boolean).join(' ')}
                      <div className="text-xs text-slate-500">{application.email}</div>
                    </td>
                    <td className="border border-blue-100 px-3 py-2">{application.jobApplication?.positionTitle || 'N/A'}</td>
                    <td className="border border-blue-100 px-3 py-2">{application.jobApplication?.placeOfAssignment || 'N/A'}</td>
                    <td className="border border-blue-100 px-3 py-2">{application.status || 'Pending'}</td>
                    <td className="border border-blue-100 px-3 py-2">{application.jobApplication?.status || 'Pending'}</td>
                    <td className="border border-blue-100 px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setViewApplication(application)}
                          className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          View Application
                        </button>
                        <button type="button" onClick={() => setSelectedApplication(application)} className="rounded bg-slate-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700">View PDS</button>
                        {application.jobApplication?.status === 'Pending' ? (
                          <>
                          <button type="button" onClick={() => handleApplicationReview(application, 'Approved')} disabled={updatingId === application.pdsId} className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                          <button type="button" onClick={() => handleApplicationReview(application, 'Disapproved')} disabled={updatingId === application.pdsId} className="rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">Disapprove</button>
                          </>
                        ) : <span className="self-center text-xs text-slate-500">Reviewed</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-blue-950">Job Application Details</h2>
                <p className="text-sm text-slate-500">PDS ID: {selectedApplication.pdsId}</p>
              </div>
              <button type="button" onClick={() => setSelectedApplication(null)} className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
            </div>
            <div className="grid gap-2 border-b border-slate-200 pb-4 text-sm sm:grid-cols-2">
              <p><strong>Applicant:</strong> {[selectedApplication.firstName, selectedApplication.middleName, selectedApplication.surname, selectedApplication.nameExtension].filter(Boolean).join(' ')}</p>
              <p><strong>Email:</strong> {selectedApplication.email || 'N/A'}</p>
              <p><strong>Mobile:</strong> {selectedApplication.mobile || 'N/A'}</p>
              <p><strong>PDS Review Status:</strong> {selectedApplication.status || 'Pending'}</p>
            </div>
            <h3 className="mb-2 mt-4 font-semibold text-slate-800">Position and Application</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                ['Position Title', 'positionTitle'],
                ['Place of Assignment', 'placeOfAssignment'],
                ['Plantilla Item Number', 'plantillaItemNumber'],
                ['Salary / Job / Pay Grade', 'salaryJobPayGrade'],
                ['Monthly Salary', 'monthlySalary'],
                ['Eligibility', 'eligibility'],
                ['Education', 'education'],
                ['Training', 'training'],
                ['Work Experience', 'workExperience'],
                ['Competency', 'competency'],
              ].map(([label, field]) => (
                <p key={field}>
                  <strong>{label}:</strong>{' '}
                  {field === 'eligibility'
                    ? normalizeEligibilityList(selectedApplication.jobApplication?.[field]).join(', ') || 'N/A'
                    : selectedApplication.jobApplication?.[field] || 'N/A'}
                </p>
              ))}
            </div>
            <h3 className="mb-2 mt-4 font-semibold text-slate-800">Applicant Qualification Responses</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><strong>Eligibility selected:</strong> {selectedApplication.jobApplication?.applicantQualifications?.eligibility || 'N/A'}</p>
              <p><strong>Education:</strong> {selectedApplication.jobApplication?.applicantQualifications?.education || 'N/A'}</p>
              <p><strong>Training:</strong> {selectedApplication.jobApplication?.applicantQualifications?.trainingChoice || 'N/A'}{selectedApplication.jobApplication?.applicantQualifications?.trainingOther ? ` — ${selectedApplication.jobApplication.applicantQualifications.trainingOther}` : ''}</p>
              <p><strong>Work Experience:</strong> {selectedApplication.jobApplication?.applicantQualifications?.workExperienceChoice || 'N/A'}{selectedApplication.jobApplication?.applicantQualifications?.workExperienceOther ? ` — ${selectedApplication.jobApplication.applicantQualifications.workExperienceOther}` : ''}</p>
            </div>
            <h3 className="mb-2 mt-4 font-semibold text-slate-800">PDS Qualifications</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Education:</strong> {(selectedApplication.educationalBackground || []).map((entry) => [entry.level, entry.basicEducationDegreeCourse, entry.schoolName].filter(Boolean).join(' — ')).filter(Boolean).join('; ') || 'N/A'}</p>
              <p><strong>Eligibility:</strong> {(selectedApplication.civilServiceEligibilities || []).map((entry) => [entry.eligibilityType, entry.rating].filter(Boolean).join(' — ')).filter(Boolean).join('; ') || 'N/A'}</p>
              <p><strong>Work Experience:</strong> {(selectedApplication.workExperience || []).map((entry) => [entry.positionTitle, entry.company, entry.from, entry.to].filter(Boolean).join(' — ')).filter(Boolean).join('; ') || 'N/A'}</p>
              <p><strong>Training:</strong> {(selectedApplication.learningDevelopment || []).map((entry) => entry.title).filter(Boolean).join('; ') || 'N/A'}</p>
            </div>
          </section>
        </div>
      )}

      {viewApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="job-application-details-title">
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 id="job-application-details-title" className="text-xl font-bold text-blue-950">Job Application</h2>
                <p className="text-sm text-slate-500">PDS ID: {viewApplication.pdsId}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewApplication(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 border-b border-slate-200 pb-4 text-sm sm:grid-cols-2">
              <p><strong>Applicant:</strong> {[viewApplication.firstName, viewApplication.middleName, viewApplication.surname, viewApplication.nameExtension].filter(Boolean).join(' ')}</p>
              <p><strong>Email:</strong> {viewApplication.email || 'N/A'}</p>
              <p><strong>Position:</strong> {viewApplication.jobApplication?.positionTitle || 'N/A'}</p>
              <p><strong>Place of Assignment:</strong> {viewApplication.jobApplication?.placeOfAssignment || 'N/A'}</p>
              <p><strong>Plantilla Item Number:</strong> {viewApplication.jobApplication?.plantillaItemNumber || 'N/A'}</p>
              <p><strong>Application Status:</strong> {viewApplication.jobApplication?.status || 'Pending'}</p>
            </div>

            <h3 className="mb-3 mt-4 font-semibold text-slate-800">Qualifications Submitted</h3>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold">Eligibility</dt>
                <dd>{viewApplication.jobApplication?.applicantQualifications?.eligibility || 'N/A'}</dd>
                <dd className="mt-1 text-xs text-slate-500">
                  Posted requirement: {normalizeEligibilityList(viewApplication.jobApplication?.eligibility).join(', ') || 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Education</dt>
                <dd>{viewApplication.jobApplication?.applicantQualifications?.education || 'N/A'}</dd>
                <dd className="mt-1 text-xs text-slate-500">Required: {viewApplication.jobApplication?.education || 'N/A'}</dd>
              </div>
              <div>
                <dt className="font-semibold">Training</dt>
                <dd>
                  {viewApplication.jobApplication?.applicantQualifications?.trainingChoice || 'N/A'}
                  {viewApplication.jobApplication?.applicantQualifications?.trainingOther
                    ? ` — ${viewApplication.jobApplication.applicantQualifications.trainingOther}`
                    : ''}
                </dd>
                <dd className="mt-1 text-xs text-slate-500">Required: {viewApplication.jobApplication?.training || 'N/A'}</dd>
              </div>
              <div>
                <dt className="font-semibold">Work Experience</dt>
                <dd>
                  {viewApplication.jobApplication?.applicantQualifications?.workExperienceChoice || 'N/A'}
                  {viewApplication.jobApplication?.applicantQualifications?.workExperienceOther
                    ? ` — ${viewApplication.jobApplication.applicantQualifications.workExperienceOther}`
                    : ''}
                </dd>
                <dd className="mt-1 text-xs text-slate-500">Required: {viewApplication.jobApplication?.workExperience || 'N/A'}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
