import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TbEye, TbEdit, TbTrash, TbPrinter } from 'react-icons/tb';
import { staffAPI, serviceRecordAPI } from '../api';

function ServiceRecord() {
  const [user, setUser] = useState(null);
  const [staffs, setStaffs] = useState([]);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recordsToShow, setRecordsToShow] = useState(10);
  const [viewingStaffId, setViewingStaffId] = useState(null);
  const [viewingStaffName, setViewingStaffName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(false);

  const [formData, setFormData] = useState({
    staffId: '',
    staffName: '',
    designation: '',
    status: '',
    salary: '',
    station: '',
    branch: '',
    serviceFrom: '',
    serviceTo: '',
    leaveWithoutPayFrom: '',
    leaveWithoutPayTo: '',
    remarks: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    setUser(storedUser);
    fetchData();
  }, []);



  const fetchData = async () => {
    try {
      setLoading(true);
      const storedUser = JSON.parse(localStorage.getItem('user'));

      if (storedUser.role === 'admin') {
        // Admin sees staff list
        const staffRes = await staffAPI.getAll();
        setStaffs(staffRes.data.filter(s => s.isApproved));
        // Fetch all service records
        const recordsRes = await serviceRecordAPI.getAll();
        setServiceRecords(recordsRes.data);
      } else {
        // Staff sees only their own records
        const recordsRes = await serviceRecordAPI.getByStaffId(storedUser.staffId);
        setServiceRecords(recordsRes.data);
      }
      setError('');
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewStaff = async (staffId, staffName) => {
    try {
      setViewingStaffId(staffId);
      setViewingStaffName(staffName);
      const recordsRes = await serviceRecordAPI.getByStaffId(staffId);
      setServiceRecords(recordsRes.data);
    } catch (err) {
      setError('Failed to load staff service records');
      console.error(err);
    }
  };

  const handleBackToList = async () => {
    setViewingStaffId(null);
    setViewingStaffName('');
    try {
      const recordsRes = await serviceRecordAPI.getAll();
      setServiceRecords(recordsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRecord = () => {
    setFormData({
      staffId: viewingStaffId || '',
      staffName: viewingStaffName || '',
      designation: '',
      status: '',
      salary: '',
      station: '',
      branch: '',
      serviceFrom: '',
      serviceTo: '',
      leaveWithoutPayFrom: '',
      leaveWithoutPayTo: '',
      remarks: '',
    });
    setEditingRecordId(null);
    setShowAddForm(true);
  };

  const handleCancelAddForm = () => {
    setShowAddForm(false);
    setFormData({
      staffId: viewingStaffId || '',
      staffName: viewingStaffName || '',
      designation: '',
      status: '',
      salary: '',
      station: '',
      branch: '',
      serviceFrom: '',
      serviceTo: '',
      leaveWithoutPayFrom: '',
      leaveWithoutPayTo: '',
      remarks: '',
    });
  };

  const handleEditRecord = (record) => {
    setFormData({
      staffId: record.staffId,
      staffName: record.staffName,
      designation: record.designation || '',
      status: record.status || '',
      salary: record.salary || '',
      station: record.station || '',
      branch: record.branch || '',
      serviceFrom: record.serviceFrom ? record.serviceFrom.split('T')[0] : '',
      serviceTo: record.serviceTo ? record.serviceTo.split('T')[0] : '',
      leaveWithoutPayFrom: record.leaveWithoutPayFrom || '',
      leaveWithoutPayTo: record.leaveWithoutPayTo || '',
      remarks: record.remarks || '',
    });
    setEditingRecordId(record.recordId);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStaffSelect = (e) => {
    const selectedStaffId = e.target.value;
    const selectedStaff = staffs.find(s => s.id === selectedStaffId);
    setFormData(prev => ({
      ...prev,
      staffId: selectedStaffId,
      staffName: selectedStaff?.name || ''
    }));
  };

  const handleSaveRecord = async () => {
    if (!formData.staffId || !formData.serviceFrom) {
      setError('Staff and Service From date are required');
      return;
    }

    try {
      if (editingRecordId) {
        // Update existing record
        await serviceRecordAPI.update(editingRecordId, formData);
        setServiceRecords(serviceRecords.map(r =>
          r.recordId === editingRecordId ? { ...r, ...formData } : r
        ));
        setEditingRecordId(null);
      } else {
        // Create new record
        const newRecordRes = await serviceRecordAPI.create(formData);
        setServiceRecords([...serviceRecords, newRecordRes.data.record]);
        setShowAddForm(false);
      }
      setError('');
    } catch (err) {
      console.error('Save error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to save service record');
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (window.confirm('Are you sure you want to delete this service record?')) {
      try {
        await serviceRecordAPI.delete(recordId);
        setServiceRecords(serviceRecords.filter(r => r.recordId !== recordId));
      } catch (err) {
        setError('Failed to delete service record');
        console.error(err);
      }
    }
  };



  const handlePrint = () => {
    // Admin gets modal option
    setShowSignatureModal(true);
  };

  const handlePrintStaffRecord = async (staffId, staffName) => {
    // Admin printing staff record - automatically includes signature
    const printWindow = window.open('', '_blank');
    
    // Fetch full staff details to get birthdate and TIN
    let staffDetails = null;
    try {
      const res = await staffAPI.getById(staffId);
      staffDetails = res.data;
    } catch (err) {
      console.error('Error fetching staff details:', err);
    }
    
    // Parse name into components (Last name, First name, Middle name)
    const nameComponents = staffName ? staffName.trim().split(' ') : [];
    let surname = '';
    let givenName = '';
    let middleName = '';
    
    if (nameComponents.length === 1) {
      givenName = nameComponents[0];
    } else if (nameComponents.length === 2) {
      givenName = nameComponents[0];
      surname = nameComponents[1];
    } else if (nameComponents.length >= 3) {
      givenName = nameComponents[0];
      middleName = nameComponents.slice(1, -1).join(' ');
      surname = nameComponents[nameComponents.length - 1];
    }
    
    // Format dates
    const birthDate = staffDetails?.dateOfBirth 
      ? new Date(staffDetails.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const placeOfBirth = staffDetails?.placeOfBirth || '';
    const tinNumber = staffDetails?.tinNumber || '';
    
    try {
      const recordsRes = await serviceRecordAPI.getByStaffId(staffId);
      const staffRecords = recordsRes.data;
      
      // Admin printing staff record always includes signature
      const htmlContent = generatePrintHTML(surname, givenName, middleName, birthDate, placeOfBirth, tinNumber, staffRecords, staffRecords.length, true);
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (err) {
      console.error('Error fetching staff records:', err);
    }
  };

  const generatePrintHTML = (surname, givenName, middleName, birthDate, placeOfBirth, tinNumber, serviceRecordsData, recordsToShowCount, includeSignature) => {
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SERVICE RECORD</title>
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            margin: 20px;
            color: #000;
            line-height: 1;
          }
          .title {
            text-align: center;
            margin-bottom: 3px;
          }
          .title h1 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 2px;
          }
          .subtitle {
            text-align: center;
            font-size: 12px;
            margin-bottom: 10px;
            font-style: italic;
          }
          .form-section {
            margin-bottom: 6px;
            display: flex;
            align-items: flex-start;
          }
          .form-label {
            font-weight: bold;
            width: 80px;
            padding-top: 2px;
          }
          .form-content {
            flex: 1;
            border-bottom: 1px solid #000;
            padding: 2px 5px;
            min-height: 15px;
            font-size: 14px;
          }
          .form-sublabel {
            font-size: 10px;
            color: #666;
            margin-top: 1px;
          }
          .certification {
            margin: 10px 0 8px 0;
            font-size: 11px;
            text-align: justify;
            line-height: 1.5;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
            font-size: 11px;
          }
          table th {
            background-color: #fff;
            border: 1px solid #000;
            padding: 6px;
            text-align: center;
            font-weight: bold;
            font-size: 10px;
          }
          table td {
            border: 1px solid #000;
            padding: 6px;
            text-align: left;
            font-size: 9px;
            height: 15px;
          }
          .table-header-main {
            border: 1px solid #000;
            background-color: #fff;
            padding: 8px;
            text-align: center;
            font-weight: bold;
            font-size: 10px;
          }
          .footer-section {
            margin-top: 20px;
            text-align: center;
            font-size: 10px;
          }
          .footer-text {
            margin: 5px 0;
            line-height: 1.4;
          }
          .signature-line {
            margin-top: 15px;
            display: flex;
            justify-content: space-around;
          }
          .signature-block {
            text-align: center;
            width: 150px;
          }
          .signature-space {
            border-bottom: 1px solid #000;
            height: 40px;
            margin-bottom: 5px;
          }
          .signature-title {
            font-weight: bold;
            font-size: 11px;
          }
          .no-records {
            text-align: center;
            padding: 20px;
            color: #999;
            font-size: 12px;
          }
          @media print {
            body {
              margin: 20px;
            }
            table {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="title">
          <h1>SERVICE RECORD</h1>
        </div>
        <div class="subtitle">
          (To be Accomplished by Employer)
        </div>

        <div class="form-section">
          <div class="form-label">NAME&nbsp;&nbsp;:</div>
          <div style="flex: 1;">
            <div class="form-content" style="min-height: 25px;">${surname}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${givenName}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${middleName}</div>
            <div class="form-sublabel"><i>(Surname)</i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>(Given Name)</i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>(Middle Name)</i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>(If married woman, give also full maiden name)</i></div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-label">BIRTH&nbsp;&nbsp;:</div>
          <div style="flex: 1;">
            <div class="form-content" style="min-height: 25px;">${birthDate}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${placeOfBirth}</div>
            <div class="form-sublabel"><i>(Date of Birth)</i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>(Place of Birth)</i>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>(Date herein should be checked from birth or baptismal<br/>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;certificates or some other reliable documents).</i></div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-label">TIN&nbsp;&nbsp;:</div>
          <div class="form-content">${tinNumber}</div>
        </div>

        <div class="certification">
          <p style="margin: 0; font-style: italic;">This is to certify that the employee herein-above actually rendered service in this office as shown by the service record below, each line of which is supported by appointment and other papers actually issued by office and approved by the authorities concerned.</p>
        </div>

        ${serviceRecordsData.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th colspan="2" class="table-header-main">SERVICE<br/>(Inclusive Date)</th>
                <th colspan="3" class="table-header-main">RECORD OF APPOINTMENT</th>
                <th colspan="1" class="table-header-main">OFFICE ENTITY / DIVISION</th>
                <th colspan="2" class="table-header-main">LEAVE WITHOUT PAY</th>
                <th class="table-header-main">REMARKS</th>
              </tr>
              <tr>
                <th style="width: 9%;">From</th>
                <th style="width: 9%;">To</th>
                <th style="width: 10%;">Designation</th>
                <th style="width: 10%;">Status</th>
                <th style="width: 10%;">Salary</th>
                <th style="width: 28%;">Status / Place of Assignment&nbsp; |&nbsp; Branch</th>
                <th style="width: 9%;">From</th>
                <th style="width: 9%;">To</th>
                <th style="width: 15%;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${serviceRecordsData.slice(0, recordsToShowCount).map(record => `
                <tr>
                  <td>${record.serviceFrom ? new Date(record.serviceFrom).toLocaleDateString('en-GB') : ''}</td>
                  <td>${record.serviceTo ? new Date(record.serviceTo).toLocaleDateString('en-GB') : ''}</td>
                  <td>${record.designation || ''}</td>
                  <td>${record.status || ''}</td>
                  <td>${record.salary ? parseFloat(record.salary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</td>
                  <td>${record.station || ''}</td>
                  <td>${record.leaveWithoutPayFrom || ''}</td>
                  <td>${record.leaveWithoutPayTo || ''}</td>
                  <td>${record.remarks || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="no-records">
            No service records to display.
          </div>
        `}

        <div class="footer-section">
          <div class="footer-text" style="font-style: italic;">
            Issued in compliance with Executive Order No. 54, dated August 10, 1954, in accordance with Circular No. 58 dated August 10, 1954<br/>
            Of the system.
          </div>
          
          <div style="margin-top: 10px; display: flex; justify-content: flex-end; margin-right: 125px; margin-left: 60px;">
            <div style="text-align: center;">
              ${includeSignature ? `<img src="/sign.png" style="max-width: 120px; height: auto; margin-bottom: -20px; position: relative; z-index: 1;">` : ''}
              <div style="font-weight: bold; font-size: 11px; margin-bottom: 2px; position: relative; z-index: 2;">ANGEL L. YAP</div>
              <div style="border-bottom: 1px solid #000; width: 120px; margin: 0 auto 3px;"></div>
              <div style="font-size: 10px; margin-bottom: 15px;">Municipal Mayor</div>
              <div style="font-size: 10px; ">04/02/2026</div>
              <div style="border-bottom: 1px solid #000; width: 120px; margin: 0 auto 3px;"></div>
              <div style="font-size: 10px;">Date</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return htmlContent;
  };

  const handlePrintWithSignature = async (withSignature) => {
    setIncludeSignature(withSignature);
    setShowSignatureModal(false);
    
    const printWindow = window.open('', '_blank');
    const staffId = user?.role === 'staff' ? user?.staffId : viewingStaffId;
    const staffName = user?.role === 'staff' ? user?.name : viewingStaffName;
    
    // Fetch full staff details to get birthdate and TIN
    let staffDetails = null;
    try {
      const res = await staffAPI.getById(staffId);
      staffDetails = res.data;
    } catch (err) {
      console.error('Error fetching staff details:', err);
    }
    
    // Parse name into components (Last name, First name, Middle name)
    const nameComponents = staffName ? staffName.trim().split(' ') : [];
    let surname = '';
    let givenName = '';
    let middleName = '';
    
    if (nameComponents.length === 1) {
      givenName = nameComponents[0];
    } else if (nameComponents.length === 2) {
      givenName = nameComponents[0];
      surname = nameComponents[1];
    } else if (nameComponents.length >= 3) {
      givenName = nameComponents[0];
      middleName = nameComponents.slice(1, -1).join(' ');
      surname = nameComponents[nameComponents.length - 1];
    }
    
    // Format dates
    const birthDate = staffDetails?.dateOfBirth 
      ? new Date(staffDetails.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const placeOfBirth = staffDetails?.placeOfBirth || '';
    const tinNumber = staffDetails?.tinNumber || '';
    
    try {
      const recordsRes = await serviceRecordAPI.getByStaffId(staffId);
      const staffRecords = recordsRes.data;
      
      const htmlContent = generatePrintHTML(surname, givenName, middleName, birthDate, placeOfBirth, tinNumber, staffRecords, recordsToShow, withSignature);
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (err) {
      console.error('Error fetching staff records:', err);
    }
  };

  if (loading) return <div className="text-center p-8">Loading...</div>;

  return (
    <div className="mt-6">
      <h1 className="text-3xl font-bold mb-6">Service Records</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Admin view: Staff list */}
      {user?.role === 'admin' && !viewingStaffId && (
        <div>
          <div className="mb-6 bg-white p-4 rounded shadow">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Search Staff</label>
                <input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Staff ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Position</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {staffs
                  .filter(staff =>
                    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    staff.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    staff.email.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(staff => (
                    <tr key={staff.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-3">{staff.name}</td>
                      <td className="px-6 py-3">{staff.id}</td>
                      <td className="px-6 py-3">{staff.email}</td>
                      <td className="px-6 py-3">{staff.position}</td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewStaff(staff.id, staff.name)}
                            className="p-2 text-blue-500 hover:bg-blue-100 rounded transition"
                            title="View records"
                          >
                            <TbEye size={20} />
                          </button>
                          <button
                            onClick={() => handlePrintStaffRecord(staff.id, staff.name)}
                            className="p-2 text-green-500 hover:bg-green-100 rounded transition"
                            title="Print service record"
                          >
                            <TbPrinter size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail view: Service records for selected staff (Admin) or own records (Staff) */}
      {(viewingStaffId || user?.role === 'staff') && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            {user?.role === 'admin' && viewingStaffId && (
              <button
                onClick={handleBackToList}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
              >
                ← Back to Staff List
              </button>
            )}
            <h2 className="text-2xl font-bold">
              {user?.role === 'staff' ? 'My Service Records' : `${viewingStaffName}'s Service Records`}
            </h2>
            <button
              onClick={handlePrint}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              title="Print service record"
            >
              <TbPrinter size={20} />
              Print
            </button>
          </div>

          <div className="mb-6 bg-white p-4 rounded shadow">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">Show:</label>
                <input 
                  type="number" 
                  value={recordsToShow} 
                  onChange={(e) => setRecordsToShow(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max={serviceRecords.length}
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500 w-16 text-center"
                />
                <label className="text-sm font-semibold text-gray-700">records (Total: {serviceRecords.length})</label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-200">
                <tr className="border-b-2 border-gray-400">
                  <th colSpan="2" className="px-4 py-3 text-center font-semibold border-r border-gray-400">SERVICE<br/>(Inclusive Date)</th>
                  <th colSpan="3" className="px-4 py-3 text-center font-semibold border-r border-gray-400">RECORD OF APPOINTMENT</th>
                  <th colSpan="2" className="px-4 py-3 text-center font-semibold border-r border-gray-400">OFFICIAL / DIVISION</th>
                  <th colSpan="2" className="px-4 py-3 text-center font-semibold border-r border-gray-400">LEAVE WITHOUT PAY</th>
                  <th className="px-4 py-3 text-center font-semibold border-r border-gray-400">Remarks</th>
                  {user?.role === 'admin' && (
                    <th className="px-4 py-3 text-center font-semibold">Action</th>
                  )}
                </tr>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold border-r border-gray-400">From</th>
                  <th className="px-4 py-3 text-left font-semibold border-r border-gray-400">To</th>
                  <th className="px-4 py-3 text-left font-semibold border-r border-gray-400">Designation</th>
                  <th className="px-4 py-3 text-left font-semibold border-r border-gray-400">Status</th>
                  <th className="px-4 py-3 text-left font-semibold border-r border-gray-400">Salary</th>
                  <th className="px-4 py-3 text-left font-semibold border-r ">Station / Place of Assignment | Branch</th>
                  <th className="px-4 py-3 text-left font-semibold border-r border-gray-400"></th>
                  <th className="px-4 py-3 text-left font-semibold border-r border-gray-400">From</th>
                  <th className="px-4 py-3 text-left font-semibold border-r border-gray-400">To</th>
                  <th className="px-4 py-3 text-left font-semibold border-r border-gray-400"></th>
                  {user?.role === 'admin' && (
                    <th className="px-4 py-3 text-center font-semibold"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {serviceRecords.length === 0 && !showAddForm ? (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 11 : 10} className="px-4 py-8 text-center text-gray-500">
                      No service records found
                    </td>
                  </tr>
                ) : (
                  <>
                    {serviceRecords.slice(0, recordsToShow).map(record => (
                      editingRecordId === record.recordId ? (
                        // Edit Row for this specific record
                        <tr key={record.recordId} className="border-t bg-yellow-50">
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              name="serviceFrom"
                              value={formData.serviceFrom}
                              onChange={handleFormChange}
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                              required
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              name="serviceTo"
                              value={formData.serviceTo}
                              onChange={handleFormChange}
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              name="designation"
                              value={formData.designation}
                              onChange={handleFormChange}
                              placeholder="Designation"
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              name="status"
                              value={formData.status}
                              onChange={handleFormChange}
                              placeholder="Status"
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              name="salary"
                              value={formData.salary}
                              onChange={handleFormChange}
                              placeholder="Salary"
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              name="station"
                              value={formData.station}
                              onChange={handleFormChange}
                              placeholder="Station"
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              name="branch"
                              value={formData.branch}
                              onChange={handleFormChange}
                              placeholder=""
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                              disabled
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              name="leaveWithoutPayFrom"
                              value={formData.leaveWithoutPayFrom}
                              onChange={handleFormChange}
                              placeholder="mm/dd/yyyy"
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              name="leaveWithoutPayTo"
                              value={formData.leaveWithoutPayTo}
                              onChange={handleFormChange}
                              placeholder="mm/dd/yyyy"
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <textarea
                              name="remarks"
                              value={formData.remarks}
                              onChange={handleFormChange}
                              placeholder="Remarks"
                              rows="1"
                              className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                            ></textarea>
                          </td>
                          <td className="px-4 py-3 text-center space-x-2">
                            <button
                              onClick={handleSaveRecord}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition text-xs"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRecordId(null)}
                              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition text-xs"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ) : (
                        // Display Row
                        <tr key={record.recordId} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3">
                            {record.serviceFrom ? new Date(record.serviceFrom).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {record.serviceTo ? new Date(record.serviceTo).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3">{record.designation || '-'}</td>
                          <td className="px-4 py-3">{record.status || '-'}</td>
                          <td className="px-4 py-3">{record.salary || '-'}</td>
                          <td className="px-4 py-3">{record.station || '-'}</td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3">{record.leaveWithoutPayFrom || '-'}</td>
                          <td className="px-4 py-3">{record.leaveWithoutPayTo || '-'}</td>
                          <td className="px-4 py-3 max-w-xs">{record.remarks || '-'}</td>
                          {user?.role === 'admin' && (
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleEditRecord(record)}
                                className="p-2 text-yellow-500 hover:bg-yellow-100 rounded transition"
                                title="Edit record"
                              >
                                <TbEdit size={20} />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(record.recordId)}
                                className="p-2 text-red-500 hover:bg-red-100 rounded transition"
                                title="Delete record"
                              >
                                <TbTrash size={20} />
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    ))}
                    
                    {showAddForm && user?.role === 'admin' && (
                      <tr className="border-t bg-blue-50">
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            name="serviceFrom"
                            value={formData.serviceFrom}
                            onChange={handleFormChange}
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500"
                            required
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            name="serviceTo"
                            value={formData.serviceTo}
                            onChange={handleFormChange}
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            name="designation"
                            value={formData.designation}
                            onChange={handleFormChange}
                            placeholder="Designation"
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            name="status"
                            value={formData.status}
                            onChange={handleFormChange}
                            placeholder="Status"
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            name="salary"
                            value={formData.salary}
                            onChange={handleFormChange}
                            placeholder="Salary"
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            name="station"
                            value={formData.station}
                            onChange={handleFormChange}
                            placeholder="Station"
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            name="branch"
                            value={formData.branch}
                            onChange={handleFormChange}
                            placeholder=""
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                            disabled
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            name="leaveWithoutPayFrom"
                            value={formData.leaveWithoutPayFrom}
                            onChange={handleFormChange}
                            placeholder="mm/dd/yyyy"
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            name="leaveWithoutPayTo"
                            value={formData.leaveWithoutPayTo}
                            onChange={handleFormChange}
                            placeholder="mm/dd/yyyy"
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <textarea
                            name="remarks"
                            value={formData.remarks}
                            onChange={handleFormChange}
                            placeholder="Remarks"
                            rows="1"
                            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 text-xs"
                          ></textarea>
                        </td>
                        <td className="px-4 py-3 text-center space-x-2">
                          <button
                            onClick={handleSaveRecord}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelAddForm}
                            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition text-xs"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {user?.role === 'admin' && !showAddForm && (
            <button
              onClick={handleAddRecord}
              className="mt-6 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
            >
              + Add Record
            </button>
          )}
        </div>
      )}

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-xl font-bold mb-4">E-Signature Option</h2>
            <p className="text-gray-700 mb-6">Do you want to include Municipal Mayor's e-signature?</p>
            <div className="flex gap-4">
              <button
                onClick={() => handlePrintWithSignature(true)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                Yes
              </button>
              <button
                onClick={() => handlePrintWithSignature(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editing indicator - modal will be removed */}
    </div>
  );
}

export default ServiceRecord;
