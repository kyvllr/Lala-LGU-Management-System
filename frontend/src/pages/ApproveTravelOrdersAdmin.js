import React, { useState, useEffect } from 'react';
import { travelOrderAPI } from '../api';
import { MdExpandMore, MdExpandLess } from 'react-icons/md';
import { FiSearch } from 'react-icons/fi';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString();
};

const formatLongDate = (value) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'N/A'
    : parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const getApproverName = () => {
  try {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return '';
    const user = JSON.parse(rawUser);
    return (
      user?.name ||
      user?.fullName ||
      [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ') ||
      ''
    );
  } catch (error) {
    return '';
  }
};

function ApproveTravelOrdersAdmin({ forcedStatus = 'Pending' }) {
  const [travelOrders, setTravelOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [approvalData, setApprovalData] = useState({
    approvedBy: getApproverName(),
    remarks: '',
  });
  const [showDisapproveModal, setShowDisapproveModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [disapproveComment, setDisapproveComment] = useState('');
  const [revisionComment, setRevisionComment] = useState('');
  const [filters, setFilters] = useState({
    staffName: '',
    transportMode: '',
    dateFrom: '',
    dateTo: '',
    minDays: '',
    maxDays: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filterAttribute, setFilterAttribute] = useState('staffName');
  const [searchValue, setSearchValue] = useState('');
  const [viewStatus, setViewStatus] = useState(forcedStatus ?? 'Pending');

  useEffect(() => {
    const approverName = getApproverName();
    if (approverName) {
      setApprovalData((prev) => ({
        ...prev,
        approvedBy: approverName,
      }));
    }
  }, []);

  useEffect(() => {
    setViewStatus(forcedStatus ?? 'Pending');
  }, [forcedStatus]);

  useEffect(() => {
    fetchOrdersByStatus(viewStatus);
  }, [viewStatus]);

  const fetchOrdersByStatus = async (status) => {
    try {
      setLoading(true);
      const response = await travelOrderAPI.getAll(status || undefined);

      const adminOrders = (response.data || []).filter((order) => {
        const isAdminPending = order.approvalStage === 'Admin' && order.status === 'Pending';

        if (status === 'Pending') return isAdminPending;
        if (status === 'Approved') return order.status === 'Approved';
        if (status === 'Disapproved') return order.status === 'Disapproved';

        return isAdminPending || ['Approved', 'Disapproved'].includes(order.status);
      });

      setTravelOrders(adminOrders);
      setSelectedOrder(null);
    } catch (err) {
      setError('Failed to load travel orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvalData.approvedBy) {
      setError('Approver name is required');
      return;
    }

    try {
      await travelOrderAPI.approve(selectedOrder.travelOrderId, {
        approvedBy: approvalData.approvedBy,
        remarks: approvalData.remarks,
      });

      setTravelOrders(travelOrders.filter(t => t.travelOrderId !== selectedOrder.travelOrderId));
      setSelectedOrder(null);
      setApprovalData({ approvedBy: getApproverName(), remarks: '' });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process travel order');
    }
  };

  const handleDisapprove = async () => {
    if (!approvalData.approvedBy) {
      setError('Approver name is required');
      return;
    }

    if (!disapproveComment.trim()) {
      setError('Disapprove comment is required');
      return;
    }

    try {
      await travelOrderAPI.disapprove(selectedOrder.travelOrderId, {
        approvedBy: approvalData.approvedBy,
        remarks: disapproveComment,
      });

      setTravelOrders(travelOrders.filter(t => t.travelOrderId !== selectedOrder.travelOrderId));
      setSelectedOrder(null);
      setApprovalData({ approvedBy: getApproverName(), remarks: '' });
      setDisapproveComment('');
      setShowDisapproveModal(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disapprove travel order');
    }
  };

  const handleApproveWithRevision = async () => {
    if (!approvalData.approvedBy) {
      setError('Approver name is required');
      return;
    }

    if (!revisionComment.trim()) {
      setError('Revision comment is required');
      return;
    }

    try {
      await travelOrderAPI.revise(selectedOrder.travelOrderId, {
        approvedBy: approvalData.approvedBy,
        remarks: revisionComment,
      });

      setTravelOrders(travelOrders.filter(t => t.travelOrderId !== selectedOrder.travelOrderId));
      setSelectedOrder(null);
      setApprovalData({ approvedBy: getApproverName(), remarks: '' });
      setRevisionComment('');
      setShowRevisionModal(false);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to return travel order for revision');
    }
  };

  const printTravelOrder = (order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Unable to open print window. Please allow pop-ups and try again.');
      return;
    }

    const isAbroad = order.travelType === 'abroad' || Boolean(order.controlNo);
    const headerTitle = isAbroad ? 'AUTHORITY TO TRAVEL ABROAD' : 'TRAVEL ORDER / OFFICE ORDER';
    const logoUrl = `${window.location.origin}/logo.png`;
    const bagongUrl = `${window.location.origin}/${encodeURIComponent('Bagong Pilipinas.png')}`;

    const rows = isAbroad
      ? [
          ['Date Prepared', formatLongDate(order.datePrepared)],
          ['Control No.', order.controlNo || 'N/A'],
          ['Region', order.region || 'N/A'],
          ['Province', order.province || 'N/A'],
          ['Municipality', order.municipality || 'N/A'],
          ['Date of Filing', formatLongDate(order.abroadDateOfFiling || order.dateOfFiling || order.createdAt)],
          ['Name', order.abroadName || order.staffName || 'N/A'],
          ['Office', order.office || order.permanentStation || 'N/A'],
          ['Position/Designation', order.position || (Array.isArray(order.designations) ? order.designations.join(', ') : '') || 'N/A'],
          ['Period', order.period || `${formatLongDate(order.dateFrom)} - ${formatLongDate(order.dateTo)}`],
          ['Destination', order.travelDestination || order.destination || order.venueDestination || 'N/A'],
          ['Fund Source', order.fundSource || order.fundSourcePapCode || order.fundSourceCode || 'N/A'],
          ['Attachment', order.attachment || order.attachmentName || order.attachments || 'N/A'],
          ['Remarks', order.remarks || ''],
        ]
      : [
          ['Date Prepared', formatLongDate(order.datePrepared || order.dateOfFiling || order.createdAt)],
          ['Control No.', order.controlNo || 'N/A'],
          ['Name', order.staffName || 'N/A'],
          ['Position/Designation', order.designations?.length ? order.designations.join(', ') : (order.position || 'N/A')],
          ['Period', `${formatLongDate(order.periodCoveredFrom || order.dateFrom)} - ${formatLongDate(order.periodCoveredTo || order.dateTo)}`],
          ['Destination', order.venueDestination || order.destination || 'N/A'],
          ['Fund Source', order.fundSourcePapCode || order.fundSource || order.fundSourceCode || 'N/A'],
          ['Attachment', order.attachment || order.attachmentName || order.attachments || 'N/A'],
          ['Purpose of Travel', order.purposeOfTravel || order.purpose || 'N/A'],
          ['Activity Organized/Sponsored By', order.activitySponsoredBy || 'N/A'],
          ['Expenses Covered', order.expensesCovered || 'N/A'],
          ['Remarks', order.remarks || ''],
        ];

    const rowsHtml = rows
      .map(([label, value]) => `
        <tr>
          <td class="label">${escapeHtml(label)}</td>
          <td class="value">${escapeHtml(value)}</td>
        </tr>
      `)
      .join('');

    let htmlContent = '';

    if (!isAbroad) {
      const currentDate = formatLongDate(new Date());
      // Travel Order / Office Order — layout matches provided reference and uses half A4 height
      htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${escapeHtml(headerTitle)}</title>
          <style>
            @page { size: A4 portrait; margin: 6mm 10mm 6mm 10mm; }
            body { font-family: 'Times New Roman', Times, serif; color: #111; margin: 0; font-size:13px }
            /* half page (approx) */
            .sheet { width: 100%; height: 140mm; box-sizing: border-box; padding: 6mm 10mm; }
            .logos { display:flex; align-items:center; justify-content:center; margin-bottom:6px; }
            .logos .left, .logos .right { width: 100px; }
            .logos .left { visibility: hidden; }
            .logos .right { display:flex; justify-content:flex-start; }
            .logo-bagong { width: 120px; height: 56px; object-fit: contain; display:block; }
            .logo-main { width: 60px; height: 60px; object-fit: contain; display:block; margin-bottom: 4px; }
            .header-text { text-align: center; margin: 0; }
            .header-text p { margin: 0; line-height: 1; }
            .province { font-weight: 700; font-size: 15px; }
            .title { text-align: center; margin-top: 6px; font-size: 16px; font-weight: 700; }
            .divider { border: 0; border-top: 4px solid #64b6ec; margin: 8px 0; }
            .grid { width: 100%; border-collapse: collapse; font-size: 14px; border: 2px solid #222; }
            /* remove cell borders; we'll draw selective separators */
            .grid td { border: none; padding: 4px 6px; vertical-align: top; line-height:1; }
            /* row separator for most rows */
            .grid tr.sep td { border-bottom: 1px solid #222; }
            /* inner vertical divider for selected rows */
            .grid tr.inner td:first-child { border-right: 1px solid #222; }
            .grid tr.inner td:last-child { border-left: 1px solid #222; }
            /* stronger separator for the area before signature */
            .grid tr.strong-sep td { border-bottom: 2px solid #222; }
            /* top block (region/province/municipality) has no inner separators */
            .grid tr.top-block td { border-bottom: none; }
            .grid .fw { font-weight: 700; font-size:11px }
            .two-cols { display: flex; gap: 8px; }
            .col { flex: 1; }
            .sign-box { height: 40px; }
            .small { font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="sheet">

            <div class="logos">
              <div class="left"></div>
              <div class="center"><img class="logo-main" src="${logoUrl}" alt="logo" /></div>
              <div class="right"><img class="logo-bagong" src="${bagongUrl}" alt="Bagong Pilipinas" /></div>
            </div>

            <div class="header-text">
              <p class="small">Republic of the Philippines</p>
              <p class="province">PROVINCE OF LANAO DEL NORTE</p>
              <p class="small">Municipality of Lala</p>
              <p class="small">Lanipao, Lala, Lanao del Norte</p>
            </div>
            <br/> 
            <div class="divider" style="color:blue;"></div>

            <table class="grid" style="margin-top:8px; width:100%">
              <tbody>
                <tr class="top-block">
                  <td colspan="2" style="text-align:center; font-weight:700; font-size:14px; padding:6px 0">${escapeHtml(headerTitle)}</td>
                </tr>
                <tr class="top-block">
                  <td style="width:50%; vertical-align:top; font-weight:700">REGION: X</td>
                  <td style="vertical-align:top">${escapeHtml(order.region || order.regionName || '')}</td>
                </tr>
                <tr class="top-block">
                  <td style="font-weight:700">PROVINCE: LANAO DEL NORTE</td>
                  <td>${escapeHtml(order.province || '')}</td>
                </tr>
                <tr class="sep">
                  <td style="font-weight:700">MUNICIPALITY: LALA</td>
                  <td>${escapeHtml(order.municipality || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">DATE OF FILING:</td>
                  <td>${escapeHtml(formatLongDate(order.datePrepared || order.dateOfFiling || order.createdAt))}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">NAME/S / DESIGNATION</td>
                  <td>${escapeHtml((order.designations && order.designations.length) ? order.designations.join(', ') : (Array.isArray(order.staffName) ? order.staffName.join(', ') : (order.staffName || '')))}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">PERMANENT STATION</td>
                  <td>${escapeHtml(order.permanentStation || order.office || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">ACTIVITY ORGANIZED/SPONSORED BY</td>
                  <td>${escapeHtml(order.activitySponsoredBy || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">PERIOD COVERED</td>
                  <td>${escapeHtml(`${formatLongDate(order.dateFrom)} - ${formatLongDate(order.dateTo)}`)}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">PLEASE CHECK</td>
                  <td>${escapeHtml([order.officialBusiness ? 'Official Business' : null, order.officialTime ? 'Official Time' : null].filter(Boolean).join(', '))}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">VENUE / DESTINATION</td>
                  <td>${escapeHtml(order.venueDestination || order.destination || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">EXPENSES COVERED</td>
                  <td>${escapeHtml(order.expensesCovered || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">FUND SOURCE (Pap Code)</td>
                  <td>${escapeHtml(order.fundSourcePapCode || order.fundSource || '')}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">Recommending Approval:</td>
                  <td style="font-weight:700">Approved:</td>
                </tr>
                <tr class="sep inner">
                  <td style="height:45px; vertical-align:top"></td>
                  <td style="vertical-align:bottom; text-align:center">
                  <br/>
                    <div class="fw">ANGEL L. YAP</div>
                    <div class="small">Municipal Mayor</div>
                  </td>
                </tr>
                <tr class="sep">
                  <td colspan="2" style="text-align:center; font-weight:700; vertical-align:middle; height:15px">Date: ${escapeHtml(currentDate)}</td>
                </tr>
                <tr class="sep inner">
                  <td style="font-weight:700">Title of Training Attended</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </body>
      </html>
      `;
    } else {
      // keep existing abroad template (rowsHtml based)
      htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${escapeHtml(headerTitle)}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm 20mm 20mm 20mm; }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #111;
              margin: 0;
              line-height: 1.2;
              font-size: 16px;
            }
            .container { max-width: 760px; margin: 0 auto; }
            .header { text-align: center; }
            .logo { width: 80px; height: 80px; object-fit: contain; margin: 0 auto 6px; display: block; }
            .gov-line { margin: 0; }
            .province { margin: 0; font-weight: 700; }
            .office-line { margin: 4px 0 0; }
            .rule { border: none; border-top: 2px solid #222; margin: 18px 0; }
            .title {
              text-align: center;
              margin: 0 0 14px;
              font-size: 21px;
              font-weight: 700;
              line-height: 1.15;
              white-space: nowrap;
            }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            td { border: 1px solid #222; padding: 7px 10px; font-size: 16px; vertical-align: top; }
            td.label { width: 30%; }
            td.value { width: 70%; }
            .footer { margin-top: 8px; }
            .recommend { margin-bottom: 20px; }
            .name { font-size: 18px; margin: 0; font-weight: 700; }
            .role, .contact { margin: 0; font-size: 14px; }
            .approved { text-align: right; margin-top: 8px; }
            .approved .name { text-decoration: underline; }
            .date-line { margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img class="logo" src="${logoUrl}" alt="LGU Logo" />
              <p class="gov-line">Republic of the Philippines</p>
              <p class="province">PROVINCE OF LANAO DEL NORTE</p>
              <p class="gov-line">Municipality of Lala</p>
              <p class="office-line">OFFICE OF THE MUNICIPAL MAYOR</p>
            </div>

            <hr class="rule" />
            <h1 class="title">${escapeHtml(headerTitle)}</h1>

            <table>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="footer">
              <div class="recommend">
                <p>Recommending Approval:</p>
                <p class="name">WARNIE B. EDREA</p>
                <p class="role">Human Resource Management Officer IV</p>
                <p class="contact">Contact Number: 0921-932-0448</p>
              </div>

              <div class="approved">
                <p>Approved:</p>
                <p class="name">ANGEL L. YAP</p>
                <p class="role">Municipal Mayor</p>
                <p class="date-line">Date: ____________________</p>
              </div>
            </div>
          </div>
        </body>
      </html>
      `;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (loading) return <div className="text-center p-8">Loading...</div>;

  // Apply filters
  const filteredOrders = travelOrders.filter((order) => {
    let matches = true;

    switch (filterAttribute) {
      case 'staffName':
        matches = (order.staffName || '').toLowerCase().includes(searchValue.toLowerCase());
        break;
      case 'destination':
        matches = (order.destination || order.travelDestination || order.venueDestination || '').toLowerCase().includes(searchValue.toLowerCase());
        break;
      case 'transportMode':
        matches = (order.transportMode || '').toLowerCase().includes(searchValue.toLowerCase());
        break;
      case 'numberOfDays':
        matches = (order.numberOfDays || '').toString().includes(searchValue);
        break;
      default:
        matches = true;
    }

    return matches;
  });

  // Get unique transport modes for dropdown
  const uniqueModes = [...new Set(travelOrders.map(t => t.transportMode))];

  const resetFilters = () => {
    setFilters({
      staffName: '',
      transportMode: '',
      dateFrom: '',
      dateTo: '',
      minDays: '',
      maxDays: '',
    });
  };

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold mb-2">Approve Travel Orders</h1>
      <p className="text-gray-600 mb-6 text-sm">Admin - Final Approval Level - These travel orders have been approved by the Head Officer</p>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      {/* Search and Filter Bar */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders List */}
        <div className="lg:col-span-1">

            {/* Search and Filter Bar */}
            <div className="mb-6 flex flex-col sm:flex-row gap-2 w-full">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search travel orders..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterAttribute}
                onChange={(e) => {
                  setFilterAttribute(e.target.value);
                  setSearchValue('');
                }}
                className="w-full sm:w-40 sm:shrink-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white cursor-pointer"
              >
                <option value="staffName">Staff Name</option>
                <option value="destination">Destination</option>
                <option value="transportMode">Transport Mode</option>
                <option value="numberOfDays">Days</option>
              </select>
            </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Showing <span className="font-bold">{filteredOrders.length}</span> of <span className="font-bold">{travelOrders.length}</span> travel orders
            </p>
          </div>

          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.travelOrderId}
                onClick={() => setSelectedOrder(order)}
                className={`bg-white p-4 rounded shadow cursor-pointer transition ${
                  selectedOrder?.travelOrderId === order.travelOrderId ? 'border-2 border-blue-600' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold">{order.staffName}</h3>
                    <p className="text-gray-600 text-sm">{order.destination || order.travelDestination || order.venueDestination || 'N/A'}</p>
                    <p className="text-gray-600 text-sm">
                      {formatDate(order.dateFrom)} - {formatDate(order.dateTo)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded text-sm block ${
                      order.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {order.status === 'Approved' ? 'Approved' : `${order.numberOfDays} days`}
                    </span>
                    {order.status === 'Approved' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          printTravelOrder(order);
                        }}
                        className="mt-2 w-full bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-800"
                      >
                        Print
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center p-8 text-gray-600">
              {travelOrders.length === 0
                ? 'No travel orders awaiting final admin approval'
                : 'No travel orders match your search'}
            </div>
          )}
        </div>

        {/* Approval Panel */}
        {selectedOrder && (
          <div className="bg-white p-6 rounded shadow lg:col-span-1">
            <h2 className="text-xl font-bold mb-4">Travel Order Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <div>
                <p className="text-gray-600 text-sm">Staff</p>
                <p className="font-bold">{selectedOrder.staffName}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Travel Type</p>
                <p className="font-bold">{selectedOrder.travelType === 'abroad' || selectedOrder.controlNo ? 'Travel Abroad' : 'Travel Order / Office Order'}</p>
              </div>
              {(selectedOrder.travelType === 'abroad' || selectedOrder.controlNo) ? (
                <>
                  <div>
                    <p className="text-gray-600 text-sm">Date Prepared</p>
                    <p className="font-bold">{formatDate(selectedOrder.datePrepared)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Control Number</p>
                    <p className="font-bold">{selectedOrder.controlNo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Date of Filing</p>
                    <p className="font-bold">{formatDate(selectedOrder.abroadDateOfFiling || selectedOrder.dateOfFiling || selectedOrder.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Period</p>
                    <p className="font-bold">{selectedOrder.period || `${formatDate(selectedOrder.dateFrom)} - ${formatDate(selectedOrder.dateTo)}`}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Fund Source</p>
                    <p className="font-bold">{selectedOrder.fundSource || selectedOrder.fundSourcePapCode || selectedOrder.fundSourceCode || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Attachment</p>
                    <p className="font-bold">{selectedOrder.attachment || selectedOrder.attachmentName || selectedOrder.attachments || 'N/A'}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-gray-600 text-sm">Name/s/Designation</p>
                    <p className="font-bold">{selectedOrder.designations?.length ? selectedOrder.designations.join(', ') : (selectedOrder.position || 'N/A')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Purpose of Travel</p>
                    <p className="font-bold">{selectedOrder.purposeOfTravel || selectedOrder.purpose || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Activity Organized/Sponsored By</p>
                    <p className="font-bold">{selectedOrder.activitySponsoredBy || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Period Covered</p>
                    <p className="font-bold">{formatDate(selectedOrder.periodCoveredFrom || selectedOrder.dateFrom)} - {formatDate(selectedOrder.periodCoveredTo || selectedOrder.dateTo)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Venue/Destination</p>
                    <p className="font-bold">{selectedOrder.venueDestination || selectedOrder.destination || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Expenses Covered</p>
                    <p className="font-bold">{selectedOrder.expensesCovered || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>

            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleApprove(); }}>
              <div>
                <label className="block font-bold mb-2">Approval Remarks (Optional)</label>
                <textarea
                  value={approvalData.remarks}
                  onChange={(e) => setApprovalData({...approvalData, remarks: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
                ></textarea>
              </div>

              {selectedOrder.status === 'Approved' ? (
                <button
                  type="button"
                  onClick={() => printTravelOrder(selectedOrder)}
                  className="w-full py-2 rounded text-white font-bold bg-gray-700 hover:bg-gray-800"
                >
                  Print
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleApprove}
                    className="w-full py-2 rounded text-white font-bold bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDisapproveComment('');
                      setShowDisapproveModal(true);
                    }}
                    className="w-full py-2 rounded text-white font-bold bg-red-600 hover:bg-red-700"
                  >
                    Disapprove
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRevisionComment('');
                      setShowRevisionModal(true);
                    }}
                    className="w-full py-2 rounded text-white font-bold bg-amber-600 hover:bg-amber-700"
                  >
                    Approve with Revision
                  </button>
                </div>
              )}
            </form>
          </div>
        )}
      </div>

      {showDisapproveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow-lg p-6">
            <h3 className="text-lg font-bold mb-3">Disapprove Travel Order</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide a comment. This will be visible to the staff.</p>
            <textarea
              value={disapproveComment}
              onChange={(e) => setDisapproveComment(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
              placeholder="Reason for disapproval"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDisapproveModal(false)}
                className="px-4 py-2 rounded bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisapprove}
                className="px-4 py-2 rounded bg-red-600 text-white"
              >
                Confirm Disapprove
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevisionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded shadow-lg p-6">
            <h3 className="text-lg font-bold mb-3">Approve with Revision</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide revision notes. This will be visible to the staff.</p>
            <textarea
              value={revisionComment}
              onChange={(e) => setRevisionComment(e.target.value)}
              rows="4"
              className="w-full px-4 py-2 border rounded focus:outline-none focus:border-blue-500"
              placeholder="Required revisions"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 rounded bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveWithRevision}
                className="px-4 py-2 rounded bg-amber-600 text-white"
              >
                Send for Revision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApproveTravelOrdersAdmin;
