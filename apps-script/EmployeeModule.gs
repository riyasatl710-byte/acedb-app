/**
 * ACEDB - EmployeeModule.gs
 */

function handleGetEmployees(data, session) {
  var pc = checkPermission(session, 'employee.view');
  if (pc) return pc;

  var rows = readAllRows('Employees');
  rows = filterByDistrictAccess(session, rows);

  // Apply filters
  if (data.scheme) rows = rows.filter(function(r) { return r.Scheme === data.scheme; });
  if (data.district) rows = rows.filter(function(r) { return r.District === data.district; });
  if (data.office) rows = rows.filter(function(r) { return r.Office === data.office; });
  if (data.status) rows = rows.filter(function(r) { return r.Status === data.status; });
  if (data.designation) rows = rows.filter(function(r) { return r.Designation === data.designation; });
  if (data.search) {
    var q = data.search.toLowerCase();
    rows = rows.filter(function(r) {
      return (r.EmployeeName && r.EmployeeName.toLowerCase().indexOf(q) !== -1) ||
             (r.EmpID && r.EmpID.toLowerCase().indexOf(q) !== -1) ||
             (r.Phone && String(r.Phone).indexOf(q) !== -1);
    });
  }

  var revisions = readAllRows('Salary_Revisions');
  // Add service duration and pending honorarium to each row
  var result = rows.map(function(r) {
    var s = serializeRow(r);
    s.serviceDuration = calculateServiceDuration(r.DateOfFirstJoining);
    s.pendingHonorarium = calculatePendingHonorariumForEmp(s, revisions);
    s.activeRate = getActiveRateForEmp(s, revisions);
    return s;
  });

  return successResponse(result, result.length + ' employees found');
}

function handleGetEmployee(data, session) {
  var pc = checkPermission(session, 'employee.view');
  if (pc) return pc;
  if (!data.empId) return errorResponse('Employee ID is required');

  var emp = findRow('Employees', 'EmpID', data.empId);
  if (!emp) return errorResponse('Employee not found');
  if (!canAccessEmployee(session, emp)) return errorResponse('Unauthorized: cannot access this employee', 403);

  var revisions = readAllRows('Salary_Revisions');
  var result = serializeRow(emp);
  result.serviceDuration = calculateServiceDuration(emp.DateOfFirstJoining);
  result.pendingHonorarium = calculatePendingHonorariumForEmp(result, revisions);
  result.activeRate = getActiveRateForEmp(result, revisions);
  return successResponse(result, 'Employee found');
}

function handleAddEmployee(data, session) {
  var pc = checkPermission(session, 'employee.create');
  if (pc) return pc;

  var missing = validateRequired(data, ['employeeName', 'district', 'office', 'designation', 'dateOfFirstJoining']);
  if (missing) return errorResponse('Missing required field: ' + missing);

  // District access check
  if (session.role === 'DistrictAdmin' && data.district !== session.district)
    return errorResponse('You can only add employees in your district');

  var empId = generateId('EMP');

  appendRow_('Employees', {
    EmpID: empId,
    Scheme: sanitize(data.scheme || ''),
    District: sanitize(data.district),
    Office: sanitize(data.office),
    EmployeeName: sanitize(data.employeeName),
    Designation: sanitize(data.designation),
    DateOfBirth: data.dateOfBirth || '',
    Qualification: sanitize(data.qualification || ''),
    DateOfFirstJoining: data.dateOfFirstJoining,
    CurrentSalary: parseFloat(data.currentSalary) || 0,
    Status: 'Active',
    SuspensionReason: '',
    SuspensionDate: '',
    Phone: sanitize(data.phone || ''),
    AadhaarLast4: sanitize(data.aadhaarLast4 || ''),
    BankAccount: sanitize(data.bankAccount || ''),
    IFSC: sanitize(data.ifsc || ''),
    PAN: sanitize(data.pan || ''),
    AdditionalOffices: sanitize(data.additionalOffices || ''),
    CreatedBy: session.userId,
    CreatedAt: now(),
    UpdatedBy: '',
    UpdatedAt: ''
  });

  logAudit(session.userId, 'CREATE', 'Employee', empId, 'Employee added: ' + data.employeeName, '', JSON.stringify(data));
  return successResponse({ empId: empId }, 'Employee added successfully');
}

function handleEditEmployee(data, session) {
  var pc = checkPermission(session, 'employee.edit');
  if (pc) return pc;
  if (!data.empId) return errorResponse('Employee ID is required');

  var emp = findRow('Employees', 'EmpID', data.empId);
  if (!emp) return errorResponse('Employee not found');
  if (!canAccessEmployee(session, emp))
    return errorResponse('Unauthorized: cannot edit this employee');

  var oldData = serializeRow(emp);
  var updates = { UpdatedBy: session.userId, UpdatedAt: now() };

  var editableFields = ['Scheme','District','Office','EmployeeName','Designation',
    'DateOfBirth','Qualification','DateOfFirstJoining','CurrentSalary',
    'Phone','AadhaarLast4','BankAccount','IFSC','PAN','AdditionalOffices'];
  var fieldMap = {
    scheme:'Scheme', district:'District', office:'Office', employeeName:'EmployeeName',
    designation:'Designation', dateOfBirth:'DateOfBirth', qualification:'Qualification',
    dateOfFirstJoining:'DateOfFirstJoining', currentSalary:'CurrentSalary',
    phone:'Phone', aadhaarLast4:'AadhaarLast4', bankAccount:'BankAccount',
    ifsc:'IFSC', pan:'PAN', additionalOffices:'AdditionalOffices'
  };

  for (var key in fieldMap) {
    if (data[key] !== undefined) {
      updates[fieldMap[key]] = (key === 'currentSalary') ? parseFloat(data[key]) || 0 : sanitize(data[key]);
    }
  }

  updateRow('Employees', emp._rowIndex, updates);
  logAudit(session.userId, 'UPDATE', 'Employee', data.empId, 'Employee updated', JSON.stringify(oldData), JSON.stringify(updates));
  return successResponse(null, 'Employee updated');
}

function handleDeleteEmployee(data, session) {
  var pc = checkPermission(session, 'employee.delete');
  if (pc) return pc;
  if (!data.empId) return errorResponse('Employee ID is required');

  var emp = findRow('Employees', 'EmpID', data.empId);
  if (!emp) return errorResponse('Employee not found');
  if (!canAccessEmployee(session, emp))
    return errorResponse('Unauthorized: cannot delete this employee');

  deleteRow_('Employees', emp._rowIndex);
  logAudit(session.userId, 'DELETE', 'Employee', data.empId, 'Employee deleted: ' + emp.EmployeeName, JSON.stringify(serializeRow(emp)), '');
  return successResponse(null, 'Employee deleted');
}

function handleSuspendEmployee(data, session) {
  var pc = checkPermission(session, 'employee.suspend');
  if (pc) return pc;
  if (!data.empId) return errorResponse('Employee ID is required');
  if (!data.reason) return errorResponse('Suspension reason is required');

  var emp = findRow('Employees', 'EmpID', data.empId);
  if (!emp) return errorResponse('Employee not found');
  if (!canAccessEmployee(session, emp))
    return errorResponse('Unauthorized');

  updateRow('Employees', emp._rowIndex, {
    Status: 'Suspended',
    SuspensionReason: sanitize(data.reason),
    SuspensionDate: now(),
    UpdatedBy: session.userId,
    UpdatedAt: now()
  });

  logAudit(session.userId, 'UPDATE', 'Employee', data.empId, 'Suspended: ' + data.reason, 'Active', 'Suspended');
  return successResponse(null, 'Employee suspended');
}

function handleRevokeSuspension(data, session) {
  var pc = checkPermission(session, 'employee.suspend');
  if (pc) return pc;
  if (!data.empId) return errorResponse('Employee ID is required');

  var emp = findRow('Employees', 'EmpID', data.empId);
  if (!emp) return errorResponse('Employee not found');
  if (!canAccessEmployee(session, emp))
    return errorResponse('Unauthorized');

  updateRow('Employees', emp._rowIndex, {
    Status: 'Active',
    SuspensionReason: '',
    SuspensionDate: '',
    UpdatedBy: session.userId,
    UpdatedAt: now()
  });

  logAudit(session.userId, 'UPDATE', 'Employee', data.empId, 'Suspension revoked', 'Suspended', 'Active');
  return successResponse(null, 'Suspension revoked');
}

function handleGetServiceReport(data, session) {
  var pc = checkPermission(session, 'report.view');
  if (pc) return pc;

  var minYears = parseInt(data.minYears) || 0;
  var maxYears = (data.maxYears !== undefined && data.maxYears !== '') ? parseInt(data.maxYears) : null;
  var rows = readAllRows('Employees');
  rows = filterByDistrictAccess(session, rows);

  if (data.status) rows = rows.filter(function(r) { return r.Status === data.status; });

  var result = [];
  rows.forEach(function(r) {
    var svc = calculateServiceDuration(r.DateOfFirstJoining);
    var matchesMin = svc.years >= minYears;
    var matchesMax = maxYears === null || svc.years <= maxYears;
    if (matchesMin && matchesMax) {
      var s = serializeRow(r);
      s.serviceDuration = svc;
      result.push(s);
    }
  });

  result.sort(function(a, b) { return b.serviceDuration.totalDays - a.serviceDuration.totalDays; });
  return successResponse(result, result.length + ' employees with service report constraints');
}


function calculatePendingHonorariumForEmp(emp, revisions) {
  if (emp.Status !== 'Active') return 0;
  if (!emp.DateOfFirstJoining) return 0;

  var joinDate = new Date(emp.DateOfFirstJoining);
  var lastPaid = emp.LastPaidDate ? new Date(emp.LastPaidDate) : null;
  if (lastPaid) {
    // Treat as fully paid up to the end of that month
    lastPaid = new Date(lastPaid.getFullYear(), lastPaid.getMonth() + 1, 0);
  }
  
  var startYear, startMonth;
  if (lastPaid) {
    startYear = lastPaid.getFullYear();
    startMonth = lastPaid.getMonth() + 1;
    if (startMonth > 11) {
      startYear++;
      startMonth = 0;
    }
  } else {
    startYear = joinDate.getFullYear();
    startMonth = joinDate.getMonth();
  }
  
  var today = new Date();
  var lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  var endYear = lastMonthEnd.getFullYear();
  var endMonth = lastMonthEnd.getMonth();

  var totalPending = 0;
  var currentY = startYear;
  var currentM = startMonth;

  var empRevs = revisions.filter(function(r) {
    return r.Scheme === emp.Scheme && r.Designation === emp.Designation;
  });

  empRevs.sort(function(a, b) {
    return new Date(a.EffectiveFrom) - new Date(b.EffectiveFrom);
  });

  while (currentY < endYear || (currentY === endYear && currentM <= endMonth)) {
    var monthStr = currentY + '-' + padLeft(currentM + 1, 2);
    
    var activeRate = parseFloat(emp.CurrentSalary) || 0;
    var monthEndDate = new Date(currentY, currentM + 1, 0);
    
    var latestRev = null;
    for (var i = 0; i < empRevs.length; i++) {
      var revDate = new Date(empRevs[i].EffectiveFrom);
      if (revDate <= monthEndDate) {
        latestRev = empRevs[i];
      }
    }
    if (latestRev) {
      activeRate = Math.max(activeRate, parseFloat(latestRev.NewAmount) || 0);
    }

    var monthlyOwed = activeRate;

    var matchesPartial = false;
    if (emp.PartialMonth) {
      var pDate = new Date(emp.PartialMonth);
      if (!isNaN(pDate.getTime())) {
        matchesPartial = (pDate.getFullYear() === currentY && pDate.getMonth() === currentM);
      } else {
        var pParts = String(emp.PartialMonth).split('-');
        if (pParts.length >= 2) {
          var pYear = parseInt(pParts[0]);
          var pMonth = parseInt(pParts[1]) - 1;
          matchesPartial = (pYear === currentY && pMonth === currentM);
        }
      }
    }

    if (matchesPartial) {
      var partialPaid = parseFloat(emp.PartialAmount) || 0;
      monthlyOwed = Math.max(0, monthlyOwed - partialPaid);
    }

    totalPending += monthlyOwed;

    currentM++;
    if (currentM > 11) {
      currentM = 0;
      currentY++;
    }
  }

  return totalPending;
}


function getActiveRateForEmp(emp, revisions) {
  var today = new Date();
  var monthEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  var activeRate = parseFloat(emp.CurrentSalary) || 0;
  
  var empRevs = revisions.filter(function(r) {
    return r.Scheme === emp.Scheme && r.Designation === emp.Designation;
  });
  
  empRevs.sort(function(a, b) {
    return new Date(a.EffectiveFrom) - new Date(b.EffectiveFrom);
  });
  
  var latestRev = null;
  for (var i = 0; i < empRevs.length; i++) {
    var revDate = new Date(empRevs[i].EffectiveFrom);
    if (revDate <= monthEndDate) {
      latestRev = empRevs[i];
    }
  }
  if (latestRev) {
    activeRate = Math.max(activeRate, parseFloat(latestRev.NewAmount) || 0);
  }
  return activeRate;
}
