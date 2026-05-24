/**
 * ACEDB - Setup.gs
 * Run setupDatabase() once to create all sheets, headers, and default data.
 */

function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Store spreadsheet ID for API access
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  // --- Create Sheets with Headers ---
  createSheetWithHeaders(ss, 'Employees', [
    'EmpID','Scheme','District','Office','EmployeeName','Designation',
    'DateOfBirth','Qualification','DateOfFirstJoining','CurrentSalary',
    'Status','SuspensionReason','SuspensionDate','Phone','AadhaarLast4',
    'BankAccount','IFSC','PAN','CreatedBy','CreatedAt','UpdatedBy','UpdatedAt'
  ]);

  createSheetWithHeaders(ss, 'Users', [
    'UserID','PasswordHash','Salt','FullName','Role','District','Email',
    'Phone','IsActive','LastLogin','CreatedBy','CreatedAt','UpdatedAt'
  ]);

  createSheetWithHeaders(ss, 'Salary_History', [
    'RecordID','EmpID','Month','BasicSalary','MaternityPay','FestivalAllowance',
    'ELSurrender','TotalPaid','PaymentStatus','PaidDate','Remarks',
    'CreatedBy','CreatedAt'
  ]);

  createSheetWithHeaders(ss, 'Leave_Records', [
    'LeaveID','EmpID','Year','Month','LeaveType','DaysAvailed','DaysBalance',
    'FromDate','ToDate','Status','ApprovedBy','Remarks','CreatedBy','CreatedAt'
  ]);

  createSheetWithHeaders(ss, 'Contracts', [
    'ContractID','Scheme','GONumber','GODate','SanctionType','StartDate',
    'ExpiryDate','SanctionedPosts','HonorariumAmount','Remarks',
    'CreatedBy','CreatedAt'
  ]);

  createSheetWithHeaders(ss, 'Salary_Revisions', [
    'RevisionID','Scheme','Designation','OldAmount','NewAmount',
    'EffectiveFrom','GONumber','CreatedBy','CreatedAt'
  ]);

  createSheetWithHeaders(ss, 'Notifications', [
    'NotifID','Title','Content','Type','AttachmentURL','Priority',
    'VisibleTo','IsActive','CreatedBy','CreatedAt','ExpiresAt'
  ]);

  createSheetWithHeaders(ss, 'Audit_Log', [
    'LogID','Timestamp','UserID','Action','Module','RecordID',
    'Description','OldValue','NewValue'
  ]);

  createSheetWithHeaders(ss, 'Config', ['Key','Value','Description']);

  // --- Insert Default Config ---
  var configSheet = ss.getSheetByName('Config');
  var configData = [
    ['DISTRICTS', 'Thiruvananthapuram,Kollam,Pathanamthitta,Alappuzha,Kottayam,Idukki,Ernakulam,Thrissur,Palakkad,Malappuram,Kozhikode,Wayanad,Kannur,Kasaragod,State HQ', 'Kerala districts plus State HQ'],
    ['SCHEMES', '', 'Comma-separated scheme names (add dynamically)'],
    ['CL_PER_YEAR', '12', 'Casual Leave quota per year'],
    ['EL_PER_YEAR', '15', 'Earned Leave quota per year'],
    ['FINANCIAL_YEAR_START', 'April', 'Financial year start month'],
    ['APP_NAME', 'ACEDB', 'Application name'],
    ['APP_FULL_NAME', 'Agricultural Contract Employee DataBase', 'Full application name'],
    ['DEFAULT_PASSWORD', 'Acedb@2025', 'Default password for new users'],
    ['EL_ENCASH_LIMIT', '1', 'Times EL can be encashed per year']
  ];
  for (var i = 0; i < configData.length; i++) {
    configSheet.appendRow(configData[i]);
  }

  // --- Create Default Super Admin ---
  var usersSheet = ss.getSheetByName('Users');
  var salt = generateSalt();
  var hash = hashPassword('Acedb@2025', salt);
  usersSheet.appendRow([
    'superadmin', hash, salt, 'Super Administrator', 'SuperAdmin',
    '', 'admin@acedb.gov.in', '', true, '', 'SYSTEM',
    new Date().toISOString(), ''
  ]);

  // Delete default Sheet1 if exists
  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }

  SpreadsheetApp.getUi().alert(
    'ACEDB Setup Complete!\n\n' +
    'Super Admin Login:\n' +
    'User ID: superadmin\n' +
    'Password: Acedb@2025\n\n' +
    'Please change the password after first login.'
  );
}

function createSheetWithHeaders(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  // Set headers in row 1
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    // Format header row
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#7E57C2');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
