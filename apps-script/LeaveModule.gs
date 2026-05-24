/**
 * ACEDB - LeaveModule.gs
 */

function handleGetLeaveRecords(data, session) {
  var pc = checkPermission(session, 'leave.view');
  if (pc) return pc;

  var rows = readAllRows('Leave_Records');
  if (data.empId) rows = rows.filter(function(r) { return r.EmpID === data.empId; });
  if (data.year) rows = rows.filter(function(r) { return String(r.Year) === String(data.year); });
  if (data.leaveType) rows = rows.filter(function(r) { return r.LeaveType === data.leaveType; });

  if (session.role === 'DistrictAdmin') {
    var empRows = readAllRows('Employees');
    var myEmpIds = {};
    empRows.forEach(function(e) { if (e.District === session.district) myEmpIds[e.EmpID] = true; });
    rows = rows.filter(function(r) { return myEmpIds[r.EmpID]; });
  }

  return successResponse(serializeRows(rows), rows.length + ' leave records');
}

function handleAddLeave(data, session) {
  var pc = checkPermission(session, 'leave.create');
  if (pc) return pc;

  var missing = validateRequired(data, ['empId', 'year', 'month', 'leaveType', 'daysAvailed']);
  if (missing) return errorResponse('Missing required field: ' + missing);

  if (['CL', 'EL'].indexOf(data.leaveType) === -1) return errorResponse('Leave type must be CL or EL');

  var emp = findRow('Employees', 'EmpID', data.empId);
  if (!emp) return errorResponse('Employee not found');
  if (session.role === 'DistrictAdmin' && emp.District !== session.district)
    return errorResponse('Unauthorized');

  // Calculate balance
  var yearlyQuota = data.leaveType === 'CL' 
    ? parseInt(getConfigValue('CL_PER_YEAR')) || 12 
    : parseInt(getConfigValue('EL_PER_YEAR')) || 15;

  var usedLeaves = readAllRows('Leave_Records').filter(function(r) {
    return r.EmpID === data.empId && String(r.Year) === String(data.year) && 
           r.LeaveType === data.leaveType && r.Status !== 'Rejected';
  });
  var totalUsed = 0;
  usedLeaves.forEach(function(r) { totalUsed += parseFloat(r.DaysAvailed) || 0; });
  var balance = yearlyQuota - totalUsed - (parseFloat(data.daysAvailed) || 0);

  if (balance < 0) return errorResponse('Insufficient ' + data.leaveType + ' balance. Available: ' + (yearlyQuota - totalUsed));

  var leaveId = generateId('LEV');
  appendRow_('Leave_Records', {
    LeaveID: leaveId,
    EmpID: data.empId,
    Year: parseInt(data.year),
    Month: parseInt(data.month),
    LeaveType: data.leaveType,
    DaysAvailed: parseFloat(data.daysAvailed),
    DaysBalance: balance,
    FromDate: data.fromDate || '',
    ToDate: data.toDate || '',
    Status: 'Approved',
    ApprovedBy: session.userId,
    Remarks: sanitize(data.remarks || ''),
    CreatedBy: session.userId,
    CreatedAt: now()
  });

  logAudit(session.userId, 'CREATE', 'Leave', leaveId, data.leaveType + ' leave: ' + data.daysAvailed + ' days for ' + data.empId, '', '');
  return successResponse({ leaveId: leaveId, balance: balance }, 'Leave recorded. Remaining balance: ' + balance);
}

function handleEditLeave(data, session) {
  var pc = checkPermission(session, 'leave.edit');
  if (pc) return pc;
  if (!data.leaveId) return errorResponse('Leave ID is required');

  var rec = findRow('Leave_Records', 'LeaveID', data.leaveId);
  if (!rec) return errorResponse('Leave record not found');

  var updates = {};
  if (data.daysAvailed !== undefined) updates.DaysAvailed = parseFloat(data.daysAvailed);
  if (data.fromDate) updates.FromDate = data.fromDate;
  if (data.toDate) updates.ToDate = data.toDate;
  if (data.status) updates.Status = data.status;
  if (data.remarks !== undefined) updates.Remarks = sanitize(data.remarks);

  updateRow('Leave_Records', rec._rowIndex, updates);
  logAudit(session.userId, 'UPDATE', 'Leave', data.leaveId, 'Leave record updated', '', JSON.stringify(updates));
  return successResponse(null, 'Leave record updated');
}

function handleGetLeaveBalance(data, session) {
  var pc = checkPermission(session, 'leave.view');
  if (pc) return pc;
  if (!data.empId) return errorResponse('Employee ID is required');

  var year = data.year || new Date().getFullYear();
  var clQuota = parseInt(getConfigValue('CL_PER_YEAR')) || 12;
  var elQuota = parseInt(getConfigValue('EL_PER_YEAR')) || 15;

  var records = readAllRows('Leave_Records').filter(function(r) {
    return r.EmpID === data.empId && String(r.Year) === String(year) && r.Status !== 'Rejected';
  });

  var clUsed = 0, elUsed = 0;
  records.forEach(function(r) {
    if (r.LeaveType === 'CL') clUsed += parseFloat(r.DaysAvailed) || 0;
    if (r.LeaveType === 'EL') elUsed += parseFloat(r.DaysAvailed) || 0;
  });

  // Check EL encashment
  var encashRows = readAllRows('Salary_History').filter(function(r) {
    return r.EmpID === data.empId && r.Month && r.Month.startsWith(String(year)) && parseFloat(r.ELSurrender) > 0;
  });

  return successResponse({
    year: year,
    cl: { quota: clQuota, used: clUsed, balance: clQuota - clUsed },
    el: { quota: elQuota, used: elUsed, balance: elQuota - elUsed },
    elEncashed: encashRows.length > 0,
    records: serializeRows(records)
  }, 'Leave balance retrieved');
}

function handleGetLeaveMonthly(data, session) {
  var pc = checkPermission(session, 'leave.view');
  if (pc) return pc;
  if (!data.empId || !data.year) return errorResponse('Employee ID and Year required');

  var records = readAllRows('Leave_Records').filter(function(r) {
    return r.EmpID === data.empId && String(r.Year) === String(data.year);
  });

  var monthly = {};
  for (var m = 1; m <= 12; m++) {
    monthly[m] = { CL: 0, EL: 0 };
  }
  records.forEach(function(r) {
    if (monthly[r.Month]) {
      monthly[r.Month][r.LeaveType] = (monthly[r.Month][r.LeaveType] || 0) + (parseFloat(r.DaysAvailed) || 0);
    }
  });

  return successResponse(monthly, 'Monthly leave breakdown');
}
