/**
 * ACEDB - ReportModule.gs
 */

function handleGetPublicDashboard(data) {
  var employees = readAllRows('Employees');
  var active = employees.filter(function(r) { return r.Status === 'Active'; });

  // Total by scheme
  var byScheme = {};
  active.forEach(function(r) {
    var s = r.Scheme || 'Unassigned';
    byScheme[s] = (byScheme[s] || 0) + 1;
  });

  // Total by district
  var byDistrict = {};
  active.forEach(function(r) {
    var d = r.District || 'Unknown';
    byDistrict[d] = (byDistrict[d] || 0) + 1;
  });

  // Total by office
  var byOffice = {};
  active.forEach(function(r) {
    var o = r.Office || 'Unknown';
    byOffice[o] = (byOffice[o] || 0) + 1;
  });

  return successResponse({
    totalEmployees: active.length,
    totalSuspended: employees.length - active.length,
    byScheme: byScheme,
    byDistrict: byDistrict,
    byOffice: byOffice
  }, 'Public dashboard data');
}

function handleGetInternalDashboard(data, session) {
  var employees = readAllRows('Employees');
  employees = filterByDistrictAccess(session, employees);
  var active = employees.filter(function(r) { return r.Status === 'Active'; });
  var suspended = employees.filter(function(r) { return r.Status === 'Suspended'; });

  // Salary summary for current FY
  var salaries = readAllRows('Salary_History');
  if (['SuperAdmin','ITAdmin','Viewer'].indexOf(session.role) === -1) {
    var myEmpIds = {};
    employees.forEach(function(e) { myEmpIds[e.EmpID] = true; });
    salaries = salaries.filter(function(r) { return myEmpIds[r.EmpID]; });
  }

  var totalPaid = 0;
  salaries.forEach(function(r) {
    if (r.PaymentStatus === 'Paid') totalPaid += parseFloat(r.TotalPaid) || 0;
  });

  var totalPending = 0;
  var revisions = readAllRows('Salary_Revisions');
  employees.forEach(function(e) {
    totalPending += calculatePendingHonorariumForEmp(e, revisions);
  });

  // By scheme
  var byScheme = {};
  active.forEach(function(r) {
    var s = r.Scheme || 'Unassigned';
    byScheme[s] = (byScheme[s] || 0) + 1;
  });

  // By district  
  var byDistrict = {};
  active.forEach(function(r) {
    var d = r.District || 'Unknown';
    byDistrict[d] = (byDistrict[d] || 0) + 1;
  });

  // Expiring contracts
  var contracts = readAllRows('Contracts');
  var today = new Date();
  var cutoff = new Date(today.getTime() + 60 * 86400000);
  var expiring = contracts.filter(function(r) {
    if (!r.ExpiryDate) return false;
    var exp = new Date(r.ExpiryDate);
    return exp >= today && exp <= cutoff;
  }).length;

  // Recent notifications
  var notifications = readAllRows('Notifications').filter(function(r) {
    return (String(r.IsActive) === 'TRUE' || String(r.IsActive) === 'true' || r.IsActive === true);
  }).slice(0, 5);

  return successResponse({
    totalActive: active.length,
    totalSuspended: suspended.length,
    totalEmployees: employees.length,
    salaryPaid: totalPaid,
    salaryPending: totalPending,
    byScheme: byScheme,
    byDistrict: byDistrict,
    expiringContracts: expiring,
    recentNotifications: serializeRows(notifications)
  }, 'Internal dashboard data');
}

function handleGenerateReport(data, session) {
  var pc = checkPermission(session, 'report.view');
  if (pc) return pc;

  var reportType = data.reportType;
  switch(reportType) {
    case 'employeeCount':
      return generateEmployeeCountReport(data, session);
    case 'salaryExpenditure':
      return generateSalaryReport(data, session);
    case 'pendingPayments':
      return generatePendingPaymentsReport(data, session);
    case 'serviceExperience':
      return handleGetServiceReport(data, session);
    case 'leaveReport':
      return generateLeaveReport(data, session);
    default:
      return errorResponse('Invalid report type');
  }
}

function generateEmployeeCountReport(data, session) {
  var rows = readAllRows('Employees');
  rows = filterByDistrictAccess(session, rows);
  if (data.status) rows = rows.filter(function(r) { return r.Status === data.status; });

  var report = {};
  rows.forEach(function(r) {
    var scheme = r.Scheme || 'Unassigned';
    var district = r.District || 'Unknown';
    if (!report[scheme]) report[scheme] = {};
    if (!report[scheme][district]) report[scheme][district] = 0;
    report[scheme][district]++;
  });

  // Flatten for table format
  var tableData = [];
  for (var scheme in report) {
    for (var district in report[scheme]) {
      tableData.push({ Scheme: scheme, District: district, Count: report[scheme][district] });
    }
  }

  return successResponse({ summary: report, table: tableData, total: rows.length }, 'Employee count report');
}

function generateSalaryReport(data, session) {
  var salaries = readAllRows('Salary_History');
  if (data.fromMonth) salaries = salaries.filter(function(r) { return r.Month >= data.fromMonth; });
  if (data.toMonth) salaries = salaries.filter(function(r) { return r.Month <= data.toMonth; });

  if (['SuperAdmin','ITAdmin','Viewer'].indexOf(session.role) === -1) {
    var empRows = readAllRows('Employees');
    var myEmpIds = {};
    empRows.forEach(function(e) { if (canAccessEmployee(session, e)) myEmpIds[e.EmpID] = true; });
    salaries = salaries.filter(function(r) { return myEmpIds[r.EmpID]; });
  }

  var totalBasic = 0, totalMaternity = 0, totalFestival = 0, totalEL = 0, totalAll = 0;
  var byMonth = {};
  salaries.forEach(function(r) {
    totalBasic += parseFloat(r.BasicSalary) || 0;
    totalMaternity += parseFloat(r.MaternityPay) || 0;
    totalFestival += parseFloat(r.FestivalAllowance) || 0;
    totalEL += parseFloat(r.ELSurrender) || 0;
    totalAll += parseFloat(r.TotalPaid) || 0;

    var m = r.Month || 'Unknown';
    if (!byMonth[m]) byMonth[m] = { basic:0, maternity:0, festival:0, el:0, total:0, count:0 };
    byMonth[m].basic += parseFloat(r.BasicSalary) || 0;
    byMonth[m].maternity += parseFloat(r.MaternityPay) || 0;
    byMonth[m].festival += parseFloat(r.FestivalAllowance) || 0;
    byMonth[m].el += parseFloat(r.ELSurrender) || 0;
    byMonth[m].total += parseFloat(r.TotalPaid) || 0;
    byMonth[m].count++;
  });

  return successResponse({
    totalBasic: totalBasic, totalMaternity: totalMaternity,
    totalFestival: totalFestival, totalEL: totalEL, grandTotal: totalAll,
    byMonth: byMonth, recordCount: salaries.length
  }, 'Honorarium expenditure report');
}

function generatePendingPaymentsReport(data, session) {
  var employees = readAllRows('Employees');
  employees = filterByDistrictAccess(session, employees);
  var revisions = readAllRows('Salary_Revisions');
  
  var totalPending = 0;
  var records = [];

  employees.forEach(function(e) {
    if (e.Status === 'Active') {
      var pending = calculatePendingHonorariumForEmp(e, revisions);
      if (pending > 0) {
        totalPending += pending;
        records.push({
          RecordID: e.EmpID,
          EmpID: e.EmpID,
          EmployeeName: e.EmployeeName,
          Month: e.LastPaidDate ? 'Since ' + e.LastPaidDate.substring(0, 7) : 'Since Joining',
          TotalPaid: pending,
          Remarks: e.PartialMonth ? 'Partial paid ' + e.PartialAmount + ' in ' + e.PartialMonth : 'Unpaid'
        });
      }
    }
  });

  return successResponse({ records: records, totalPending: totalPending, count: records.length }, 'Pending honorarium report generated');
}

function generateLeaveReport(data, session) {
  var year = data.year || new Date().getFullYear();
  var employees = readAllRows('Employees');
  employees = filterByDistrictAccess(session, employees);
  if (data.status) employees = employees.filter(function(r) { return r.Status === data.status; });

  var leaves = readAllRows('Leave_Records').filter(function(r) { return String(r.Year) === String(year); });
  var clQuota = parseInt(getConfigValue('CL_PER_YEAR')) || 12;
  var elQuota = parseInt(getConfigValue('EL_PER_YEAR')) || 15;

  var report = employees.map(function(emp) {
    var empLeaves = leaves.filter(function(l) { return l.EmpID === emp.EmpID; });
    var clUsed = 0, elUsed = 0;
    empLeaves.forEach(function(l) {
      if (l.LeaveType === 'CL') clUsed += parseFloat(l.DaysAvailed) || 0;
      if (l.LeaveType === 'EL') elUsed += parseFloat(l.DaysAvailed) || 0;
    });
    return {
      EmpID: emp.EmpID, EmployeeName: emp.EmployeeName, District: emp.District,
      CLUsed: clUsed, CLBalance: clQuota - clUsed,
      ELUsed: elUsed, ELBalance: elQuota - elUsed
    };
  });

  return successResponse({ year: year, report: report }, 'Leave report');
}

function handleExportReport(data, session) {
  // Generate CSV content for export
  var reportResult = handleGenerateReport(data, session);
  var parsed = JSON.parse(reportResult.getContent());
  if (!parsed.success) return reportResult;

  var csvData = parsed.data.table || parsed.data.records || parsed.data.report || [];
  if (csvData.length === 0) return errorResponse('No data to export');

  var headers = Object.keys(csvData[0]);
  var csv = headers.join(',') + '\n';
  csvData.forEach(function(row) {
    var vals = headers.map(function(h) {
      var v = String(row[h] || '');
      return v.indexOf(',') !== -1 ? '"' + v + '"' : v;
    });
    csv += vals.join(',') + '\n';
  });

  return successResponse({ csv: csv, filename: data.reportType + '_' + now().split('T')[0] + '.csv' }, 'Export ready');
}
