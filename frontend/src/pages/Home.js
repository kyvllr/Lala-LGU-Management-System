import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBriefcase, FiCalendar, FiFileText, FiShield, FiUsers } from 'react-icons/fi';
import { jobPortalAPI } from '../api';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function Home() {
  const [positions, setPositions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [positionsError, setPositionsError] = useState('');
  const [announcementsError, setAnnouncementsError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      jobPortalAPI.getPostings('Published'),
      jobPortalAPI.getAnnouncements('Published'),
    ]).then(([postingResult, announcementResult]) => {
      if (!active) return;
      if (postingResult.status === 'fulfilled') {
        setPositions(Array.isArray(postingResult.value.data) ? postingResult.value.data : []);
      } else {
        setPositionsError(postingResult.reason.response?.data?.message || 'Job postings are temporarily unavailable.');
      }
      if (announcementResult.status === 'fulfilled') {
        setAnnouncements(Array.isArray(announcementResult.value.data) ? announcementResult.value.data : []);
      } else {
        setAnnouncementsError(announcementResult.reason.response?.data?.message || 'Announcements are temporarily unavailable.');
      }
      setLoadingPositions(false);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Municipality of Lala home">
            <img src="/logo.PNG" alt="Municipality of Lala seal" className="h-14 w-14 shrink-0 object-contain" />
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Municipality of Lala</p>
              <p className="text-lg font-bold text-blue-950 sm:text-xl">Human Resource Services</p>
            </div>
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            HR Information System <FiArrowRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-700">
        <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[36px] border-white/10" />
        <div className="absolute -bottom-44 right-1/4 h-96 w-96 rounded-full border-[46px] border-white/5" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-cyan-200">People. Service. Progress.</p>
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Welcome to Lala&apos;s Human Resource Services
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100">
              Access employee services, stay informed about career opportunities, and find the resources you need in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-bold text-blue-900 shadow-lg transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-800"
              >
                Open HR Information System <FiArrowRight aria-hidden="true" />
              </Link>
              <a
                href="#announcements"
                className="rounded-lg border border-white/50 px-5 py-3 font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
              >
                View announcements
              </a>
            </div>
          </div>
          <div className="hidden justify-center lg:flex">
            <div className="flex h-72 w-72 items-center justify-center rounded-full border border-white/30 bg-white/10 p-8 shadow-2xl backdrop-blur-sm">
              <img src="/logo.PNG" alt="" className="h-full w-full object-contain drop-shadow-lg" />
            </div>
          </div>
        </div>
      </section>

      <section id="announcements" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-700">Latest updates</p>
            <h2 className="mt-1 text-3xl font-bold text-blue-950">Announcements</h2>
          </div>
        </div>

        {announcementsError && (
          <div role="status" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {announcementsError}
          </div>
        )}

        {loadingPositions ? (
          <div className="rounded-xl border border-blue-100 bg-white p-8 text-center text-slate-600 shadow-sm" role="status">
            Loading current announcements...
          </div>
        ) : announcements.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {announcements.map((announcement) => (
              <article key={announcement.announcementId} className="flex flex-col rounded-xl border border-blue-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-50 text-cyan-800">
                  <FiFileText size={21} aria-hidden="true" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{announcement.category}</p>
                <h3 className="mt-2 text-xl font-bold break-words text-blue-950">{announcement.title}</h3>
                <p className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{announcement.content}</p>
                {announcement.createdAt && (
                  <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <FiCalendar aria-hidden="true" /> Posted {formatDate(announcement.createdAt)}
                  </p>
                )}
                {announcement.expiresAt && (
                  <p className="mt-2 text-xs text-slate-500">Through {formatDate(announcement.expiresAt)}</p>
                )}
                {announcement.linkUrl && (
                  <a
                    href={announcement.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
                  >
                    {announcement.linkLabel || 'Learn more'} <FiArrowRight aria-hidden="true" />
                  </a>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-blue-100 bg-white p-8 text-center shadow-sm">
            <FiFileText className="mx-auto text-blue-700" size={28} aria-hidden="true" />
            <h3 className="mt-3 text-lg font-bold text-blue-950">No announcements at the moment</h3>
            <p className="mt-1 text-sm text-slate-600">Please check back for news, notices, and updates from HR.</p>
          </div>
        )}
      </section>

      <section id="career-opportunities" className="border-y border-blue-100 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-blue-700">Career opportunities</p>
              <h2 className="mt-1 text-3xl font-bold text-blue-950">Open positions</h2>
            </div>
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
              {positions.length} open {positions.length === 1 ? 'position' : 'positions'}
            </span>
          </div>
          {positionsError && (
            <div role="status" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {positionsError}
            </div>
          )}
          {loadingPositions ? (
            <div className="rounded-xl border border-blue-100 bg-slate-50 p-8 text-center text-slate-600" role="status">
              Loading current job postings...
            </div>
          ) : positions.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {positions.map((position) => (
                <article key={position.postingId} className="flex flex-col rounded-xl border border-blue-100 bg-slate-50 p-6 transition hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-50 text-cyan-800">
                    <FiBriefcase size={21} aria-hidden="true" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Now accepting applications</p>
                  <h3 className="mt-2 text-xl font-bold break-words text-blue-950">{position.positionTitle}</h3>
                  <p className="mt-1 text-sm break-words text-slate-600">{position.placeOfAssignment}</p>
                  <dl className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Item number</dt>
                      <dd className="min-w-0 break-words text-right font-medium text-slate-800">{position.plantillaItemNumber || 'To be announced'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Salary grade</dt>
                      <dd className="min-w-0 break-words text-right font-medium text-slate-800">{position.salaryJobPayGrade || 'See posting details'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Monthly salary</dt>
                      <dd className="min-w-0 break-words text-right font-medium text-slate-800">{position.monthlySalary || 'See posting details'}</dd>
                    </div>
                  </dl>
                  {position.createdAt && (
                    <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <FiCalendar aria-hidden="true" /> Posted {formatDate(position.createdAt)}
                    </p>
                  )}
                  <Link
                    to="/submit-personal-data-sheet"
                    state={{ jobPosting: position }}
                    className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                  >
                    Apply for this position <FiArrowRight aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-blue-100 bg-slate-50 p-8 text-center">
              <FiBriefcase className="mx-auto text-blue-700" size={28} aria-hidden="true" />
              <h3 className="mt-3 text-lg font-bold text-blue-950">No open positions at the moment</h3>
              <p className="mt-1 text-sm text-slate-600">Please check back for future career opportunities.</p>
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-blue-100 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="mb-7">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-700">Explore</p>
            <h2 className="mt-1 text-3xl font-bold text-blue-950">More HR services</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <article className="rounded-xl bg-slate-50 p-6">
              <FiUsers className="text-blue-700" size={25} aria-hidden="true" />
              <h3 className="mt-4 font-bold text-blue-950">Employee services</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Manage your profile and access HR forms, requests, and employee records.</p>
              <Link to="/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
                Go to HRIS <FiArrowRight aria-hidden="true" />
              </Link>
            </article>
            <article className="rounded-xl bg-slate-50 p-6">
              <FiFileText className="text-blue-700" size={25} aria-hidden="true" />
              <h3 className="mt-4 font-bold text-blue-950">Career opportunities</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Review current vacancies and submit your Personal Data Sheet for an open position.</p>
              <a href="#career-opportunities" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
                Browse positions <FiArrowRight aria-hidden="true" />
              </a>
            </article>
            <article className="rounded-xl bg-slate-50 p-6">
              <FiShield className="text-blue-700" size={25} aria-hidden="true" />
              <h3 className="mt-4 font-bold text-blue-950">Secure access</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">The HR Information System provides secure access to authorized employees and administrators.</p>
              <Link to="/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
                Sign in securely <FiArrowRight aria-hidden="true" />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <footer className="bg-blue-950 text-blue-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo.PNG" alt="" className="h-10 w-10 object-contain" />
            <p><span className="font-semibold text-white">Municipality of Lala</span><br />Human Resource Services</p>
          </div>
          <p>For HRIS account assistance, please contact your department Head Officer or the HR office.</p>
        </div>
      </footer>
    </main>
  );
}
