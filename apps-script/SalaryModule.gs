/**
 * ACEDB - SalaryModule.gs
 */

function handleGetSalaryHistory(data, session) {
  var pc = checkPermission(session, 'salary.view');
  if (pc) return pc;

  var rows = readAllRows('Salary_History');
  if (data.empId) rows = rows.filter(function(r) { return r.EmpID === data.empId; });
  if (data.month) rows = rows.filter(function(r) { return r.Month === data.month; });
  if (data.status) rows = rows.filter(function(r) { return r.PaymentStatus === data.status; });

  // Scope filtering via employee lookup
  if (['SuperAdmin','ITAdmin','Viewer'].indexOf(session.role) === -1) {
    var empRows = readAllRows('Employees');
    var myEmpIds = {};
    empRows.forEach(function(e) { if (canAccessEmployee(session, e)) myEmpIds[e.EmpID] = true; });
    rows = rows.filter(function(r) { return myEmpIds[r.EmpID]; });
  }

  rows.sort(function(a, b) { return (b.Month || '').localeCompare(a.Month || ''); });
  return successResponse(serializeRows(rows), rows.length + ' honorarium records');
}

function handleAddSalary(data, session) {
  var pc = checkPermission(session, 'salary.create');
  if (pc) return pc;

  var missing = validateRequired(data, ['empId', 'month', 'basicSalary']);
  if (missing) return errorResponse('Missing required field: ' + missing);

  // Check employee exists and access
  var emp = findRow('Employees', 'EmpID', data.empId);
  if (!emp) return errorResponse('Employee not found');
  if (!canAccessEmployee(session, emp))
    return errorResponse('Unauthorized');
  if (emp.Status === 'Suspended') return errorResponse('Employee is suspended from payment');

  var isSuper = (session.role === 'SuperAdmin');
  if (!isSuper) {
    var lockEmoluments = String(getConfigValue('LOCK_EMOLUMENTS')).toLowerCase() === 'true';
    if (lockEmoluments) return errorResponse('Other Emoluments updates are currently locked.');

    var lockFestival = String(getConfigValue('LOCK_FESTIVAL_ALLOWANCE')).toLowerCase() === 'true';
    var lockMaternity = String(getConfigValue('LOCK_MATERNITY_PAY')).toLowerCase() === 'true';
    var lockEL = String(getConfigValue('LOCK_EL_SURRENDER')).toLowerCase() === 'true';
    if (lockFestival && parseFloat(data.festivalAllowance) > 0) return errorResponse('Festival Allowance updates are currently locked.');
    if (lockMaternity && parseFloat(data.maternityPay) > 0) return errorResponse('Maternity Pay updates are currently locked.');
    if (lockEL && parseFloat(data.elSurrender) > 0) return errorResponse('EL Surrender updates are currently locked.');
  }

  // Check duplicate
  var existing = readAllRows('Salary_History').filter(function(r) {
    return r.EmpID === data.empId && r.Month === data.month;
  });
  if (existing.length > 0) return errorResponse('Honorarium record already exists for this month');

  var basic = parseFloat(data.basicSalary) || 0;
  var maternity = parseFloat(data.maternityPay) || 0;
  var festival = parseFloat(data.festivalAllowance) || 0;
  var elSurr = parseFloat(data.elSurrender) || 0;
  var total = basic + maternity + festival + elSurr;

  var recId = generateId('SAL');
  appendRow_('Salary_History', {
    RecordID: recId,
    EmpID: data.empId,
    Month: data.month,
    BasicSalary: basic,
    MaternityPay: maternity,
    FestivalAllowance: festival,
    ELSurrender: elSurr,
    TotalPaid: total,
    PaymentStatus: data.paymentStatus || 'Pending',
    PaidDate: data.paidDate || '',
    Remarks: sanitize(data.remarks || ''),
    CreatedBy: session.userId,
    CreatedAt: now()
  });

  logAudit(session.userId, 'CREATE', 'Salary', recId, 'Honorarium added for ' + data.empId + ' (' + data.month + '): Rs.' + total, '', '');
  return successResponse({ recordId: recId }, 'Honorarium record added');
}

function handleUpdateSalary(data, session) {
  var pc = checkPermission(session, 'salary.edit');
  if (pc) return pc;
  if (!data.recordId) return errorResponse('Record ID is required');

  var rec = findRow('Salary_History', 'RecordID', data.recordId);
  if (!rec) return errorResponse('Honorarium record not found');

  var emp = findRow('Employees', 'EmpID', rec.EmpID);
  if (!emp || !canAccessEmployee(session, emp)) return errorResponse('Unauthorized');

  var isSuper = (session.role === 'SuperAdmin');
  if (!isSuper) {
    var lockEmoluments = String(getConfigValue('LOCK_EMOLUMENTS')).toLowerCase() === 'true';
    if (lockEmoluments) return errorResponse('Other Emoluments updates are currently locked.');
  }

  var updates = {};
  if (data.basicSalary !== undefined) updates.BasicSalary = parseFloat(data.basicSalary) || 0;
  if (data.maternityPay !== undefined) updates.MaternityPay = parseFloat(data.maternityPay) || 0;
  if (data.festivalAllowance !== undefined) updates.FestivalAllowance = parseFloat(data.festivalAllowance) || 0;
  if (data.elSurrender !== undefined) updates.ELSurrender = parseFloat(data.elSurrender) || 0;
  if (data.paymentStatus) updates.PaymentStatus = data.paymentStatus;
  if (data.paidDate) updates.PaidDate = data.paidDate;
  if (data.remarks !== undefined) updates.Remarks = sanitize(data.remarks);

  // Recalculate total
  var basic = updates.BasicSalary !== undefined ? updates.BasicSalary : rec.BasicSalary;
  var mat = updates.MaternityPay !== undefined ? updates.MaternityPay : rec.MaternityPay;
  var fest = updates.FestivalAllowance !== undefined ? updates.FestivalAllowance : rec.FestivalAllowance;
  var els = updates.ELSurrender !== undefined ? updates.ELSurrender : rec.ELSurrender;
  updates.TotalPaid = (parseFloat(basic)||0) + (parseFloat(mat)||0) + (parseFloat(fest)||0) + (parseFloat(els)||0);

  updateRow('Salary_History', rec._rowIndex, updates);
  logAudit(session.userId, 'UPDATE', 'Salary', data.recordId, 'Honorarium updated', '', JSON.stringify(updates));
  return successResponse(null, 'Honorarium record updated');
}

function handleAddSalaryRevision(data, session) {
  var pc = checkPermission(session, 'contract.create');
  if (pc) return pc;

  var missing = validateRequired(data, ['scheme', 'designation', 'newAmount', 'effectiveFrom']);
  if (missing) return errorResponse('Missing required field: ' + missing);

  var revId = generateId('REV');
  appendRow_('Salary_Revisions', {
    RevisionID: revId,
    Scheme: sanitize(data.scheme),
    Designation: sanitize(data.designation),
    OldAmount: parseFloat(data.oldAmount) || 0,
    NewAmount: parseFloat(data.newAmount) || 0,
    EffectiveFrom: data.effectiveFrom,
    GONumber: sanitize(data.goNumber || ''),
    CreatedBy: session.userId,
    CreatedAt: now()
  });

  logAudit(session.userId, 'CREATE', 'Salary', revId, 'Honorarium revision: ' + data.scheme + ' ' + data.designation, '', '');
  return successResponse({ revisionId: revId }, 'Honorarium revision added');
}

function handleGetSalaryRevisions(data, session) {
  var pc = checkPermission(session, 'salary.view');
  if (pc) return pc;
  var rows = readAllRows('Salary_Revisions');
  if (data.scheme) rows = rows.filter(function(r) { return r.Scheme === data.scheme; });
  return successResponse(serializeRows(rows), rows.length + ' revisions');
}

function handleUpdateEmployeeHonorariumStatus(data, session) {
  var pc = checkPermission(session, 'salary.edit');
  if (pc) return pc;

  var missing = validateRequired(data, ['empId', 'lastPaidDate']);
  if (missing) return errorResponse('Missing required field: ' + missing);

  var emp = findRow('Employees', 'EmpID', data.empId);
  if (!emp) return errorResponse('Employee not found');

  if (!canAccessEmployee(session, emp)) {
    return errorResponse('Unauthorized: cannot edit employee.');
  }

  var isSuper = (session.role === 'SuperAdmin');
  var lockHonorarium = String(getConfigValue('LOCK_HONORARIUM')).toLowerCase() === 'true';
  if (lockHonorarium && !isSuper) {
    return errorResponse('Honorarium updates are currently locked.');
  }

  // Snap the date to the last day of its month timezone-agnostically
  var parts = data.lastPaidDate.split('-');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var daysInMonth = [31, ((y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var lastDay = daysInMonth[m - 1];
  var lastPaidDateSnapped = y + '-' + padLeft(m, 2) + '-' + padLeft(lastDay, 2);

  var updates = {
    LastPaidDate: lastPaidDateSnapped,
    PartialMonth: data.partialMonth || '',
    PartialAmount: parseFloat(data.partialAmount) || 0,
    UpdatedBy: session.userId,
    UpdatedAt: now()
  };

  updateRow('Employees', emp._rowIndex, updates);
  
  logAudit(session.userId, 'UPDATE', 'Salary', data.empId, 'Updated honorarium status: paid up to ' + lastPaidDateSnapped + (data.partialMonth ? ' (Partial: ' + data.partialMonth + ' - ' + data.partialAmount + ')' : ''));
  return successResponse(null, 'Honorarium status updated');
}
