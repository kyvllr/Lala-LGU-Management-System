import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { travelOrderAPI } from '../api';
import printTravelOrderShared from '../utils/printTravelOrder';

const formatDate = (value) => {
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

function MyTravelOrders({ staffId }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [travelOrders, setTravelOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [searchAttribute, setSearchAttribute] = useState('travelOrderId');
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    // Update filter status when query parameter changes
    const statusParam = searchParams.get('status');
    setFilterStatus(statusParam || '');
  }, [searchParams]);

  useEffect(() => {
    if (staffId) {
      fetchTravelOrders();
    }
  }, [staffId]);

  const fetchTravelOrders = async () => {
    try {
      setLoading(true);
      const response = await travelOrderAPI.getByStaffId(staffId);
      setTravelOrders(response.data);
    } catch (err) {
      setError('Failed to load travel orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteTravelOrder = async (id) => {
    if (window.confirm('Are you sure you want to delete this travel order?')) {
      try {
        await travelOrderAPI.delete(id);
        setTravelOrders(travelOrders.filter(t => t.travelOrderId !== id));
      } catch (err) {
        setError('Failed to delete travel order');
      }
    }
  };

  const markComplete = async (id) => {
    try {
      await travelOrderAPI.complete(id);
      fetchTravelOrders();
    } catch (err) {
      setError('Failed to mark as complete');
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
    const logoUrl = `${window.location.origin}/logo.PNG`;

    const rows = isAbroad
      ? [
          ['Date Prepared', formatDate(order.datePrepared)],
          ['Control No.', order.controlNo || 'N/A'],
          ['Region', order.region || 'N/A'],
          ['Province', order.province || 'N/A'],
          ['Municipality', order.municipality || 'N/A'],
          ['Date of Filing', formatDate(order.abroadDateOfFiling || order.dateOfFiling || order.createdAt)],
          ['Name', order.abroadName || order.staffName || 'N/A'],
          ['Office', order.office || order.permanentStation || 'N/A'],
          ['Position/Designation', order.position || (Array.isArray(order.designations) ? order.designations.join(', ') : '') || 'N/A'],
          ['Period', order.period || `${formatDate(order.dateFrom)} - ${formatDate(order.dateTo)}`],
          ['Destination', order.travelDestination || order.destination || order.venueDestination || 'N/A'],
          ['Fund Source', order.fundSource || order.fundSourcePapCode || order.fundSourceCode || 'N/A'],
          ['Attachment', order.attachment || order.attachmentName || order.attachments || 'N/A'],
          ['Remarks', order.remarks || ''],
        ]
      : [
          ['Date Prepared', formatDate(order.datePrepared || order.dateOfFiling || order.createdAt)],
          ['Control No.', order.controlNo || 'N/A'],
          ['Name', order.staffName || 'N/A'],
          ['Position/Designation', order.designations?.length ? order.designations.join(', ') : (order.position || 'N/A')],
          ['Period', `${formatDate(order.periodCoveredFrom || order.dateFrom)} - ${formatDate(order.periodCoveredTo || order.dateTo)}`],
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

    const recommender = 'WARNIE B. EDREA';
    const htmlContent = `
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
                <p class="name">${escapeHtml(recommender)}</p>
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

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const filteredOrders = travelOrders.filter((order) => {
    if (filterStatus && order.status !== filterStatus) {
      return false;
    }

    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const periodText = `${formatDate(order.periodCoveredFrom || order.dateFrom)} - ${formatDate(order.periodCoveredTo || order.dateTo)}`;

    switch (searchAttribute) {
      case 'name':
        return String(order.staffName || order.abroadName || '').toLowerCase().includes(query);
      case 'date':
        return (
          formatDate(order.datePrepared || order.dateOfFiling || order.createdAt).toLowerCase().includes(query) ||
          periodText.toLowerCase().includes(query)
        );
      case 'destination':
        return String(order.venueDestination || order.destination || order.travelDestination || '').toLowerCase().includes(query);
      case 'purpose':
        return String(order.purposeOfTravel || order.purpose || '').toLowerCase().includes(query);
      case 'controlNo':
        return String(order.controlNo || '').toLowerCase().includes(query);
      case 'travelOrderId':
      default:
        return String(order.travelOrderId || '').toLowerCase().includes(query);
    }
  });

  if (!staffId) {
    return <div className="text-center p-8 text-red-600">Please enter your Staff ID in the navigation bar</div>;
  }

  if (loading) return <div className="text-center p-8">Loading...</div>;

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold mb-6">My Travel Orders</h1>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}

      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search travel orders..."
          className="w-full sm:flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={searchAttribute}
          onChange={(e) => setSearchAttribute(e.target.value)}
          className="w-full sm:w-56 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="travelOrderId">Travel ID</option>
          <option value="name">Name</option>
          <option value="date">Date/Period</option>
          <option value="destination">Destination</option>
          <option value="purpose">Purpose</option>
          <option value="controlNo">Control No.</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="mr-4">
          <input
            type="radio"
            value=""
            checked={filterStatus === ''}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}All
        </label>
        <label className="mr-4">
          <input
            type="radio"
            value="Pending"
            checked={filterStatus === 'Pending'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Pending
        </label>
        <label className="mr-4">
          <input
            type="radio"
            value="Approved"
            checked={filterStatus === 'Approved'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Approved
        </label>
        <label className="mr-4">
          <input
            type="radio"
            value="Disapproved"
            checked={filterStatus === 'Disapproved'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}Disapproved
        </label>
        <label className="mr-4">
          <input
            type="radio"
            value="For Revision"
            checked={filterStatus === 'For Revision'}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
          {' '}For Revision
        </label>
        
      </div>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <div key={order.travelOrderId} className="bg-white p-6 rounded shadow">
            {(() => {
              const isAbroad = order.travelType === 'abroad' || Boolean(order.controlNo);

              return (
                <>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{isAbroad ? 'Travel Abroad' : 'Travel Order / Office Order'}</h3>
                <p className="text-gray-600">ID: {order.travelOrderId}</p>
                {order.controlNo && <p className="text-gray-600">Control No.: {order.controlNo}</p>}
              </div>
              <span className={`px-4 py-2 rounded text-white font-bold ${
                order.status === 'Approved' ? 'bg-green-600' :
                order.status === 'Disapproved' ? 'bg-red-600' :
                order.status === 'For Revision' ? 'bg-purple-600' :
                'bg-yellow-600'
              }`}>
                {order.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {isAbroad ? (
                <>
                  <div>
                    <p className="text-gray-600 text-sm">Date Prepared</p>
                    <p className="font-bold">{formatDate(order.datePrepared)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Control Number</p>
                    <p className="font-bold">{order.controlNo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Date of Filing</p>
                    <p className="font-bold">{formatDate(order.abroadDateOfFiling || order.dateOfFiling || order.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Period</p>
                    <p className="font-bold">{order.period || `${formatDate(order.dateFrom)} - ${formatDate(order.dateTo)}`}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Fund Source</p>
                    <p className="font-bold">{order.fundSource || order.fundSourcePapCode || order.fundSourceCode || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Attachment</p>
                    <p className="font-bold">{order.attachment || order.attachmentName || order.attachments || 'N/A'}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-gray-600 text-sm">Name/s/Designation</p>
                    <p className="font-bold">{order.designations?.length ? order.designations.join(', ') : (order.position || 'N/A')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Purpose of Travel</p>
                    <p className="font-bold">{order.purposeOfTravel || order.purpose || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Activity Organized/Sponsored By</p>
                    <p className="font-bold">{order.activitySponsoredBy || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Period Covered</p>
                    <p className="font-bold">{formatDate(order.periodCoveredFrom || order.dateFrom)} - {formatDate(order.periodCoveredTo || order.dateTo)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Venue/Destination</p>
                    <p className="font-bold">{order.venueDestination || order.destination || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Expenses Covered</p>
                    <p className="font-bold">{order.expensesCovered || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>

            {order.status !== 'Pending' && (
              <div className="border-t pt-4">
                <p className="text-gray-600 text-sm">{order.status === 'For Revision' ? 'Requested By' : 'Approved By'}</p>
                <p className="font-bold">{order.status === 'For Revision' ? (order.revisionRequestedBy || 'N/A') : (order.approvedBy || 'N/A')}</p>
                {order.remarks && (
                  <>
                    <p className="text-gray-600 text-sm mt-2">{order.status === 'For Revision' ? 'Revision Comment' : 'Remarks'}</p>
                    <p>{order.remarks}</p>
                  </>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {order.status === 'Pending' && (
                <button
                  onClick={() => deleteTravelOrder(order.travelOrderId)}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  Delete Order
                </button>
              )}
              {order.status === 'For Revision' && (
                <button
                  onClick={() => navigate(`/file-travel?edit=${order.travelOrderId}`)}
                  className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
                >
                  Edit & Resubmit
                </button>
              )}
              {(String(order.status || '').toLowerCase() === 'approved') && (
                <>
                  <button
                    onClick={() => {
                      const ok = printTravelOrderShared(order);
                      if (!ok) setError('Unable to open print window. Please allow pop-ups and try again.');
                    }}
                    className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
                  >
                    Print
                  </button>

                </>
              )}
            </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center p-8 text-gray-600">No travel orders found</div>
      )}
    </div>
  );
}

export default MyTravelOrders;
