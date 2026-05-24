/**
 * ACEDB - Utils.gs
 * Core utility functions used across all modules.
 */

function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}

function readAllRows(sheetName) {
  var sheet = getSheet(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    row._rowIndex = i + 1;
    rows.push(row);
  }
  return rows;
}

function findRow(sheetName, key, value) {
  var rows = readAllRows(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][key]) === String(value)) return rows[i];
  }
  return null;
}

function findRows(sheetName, key, value) {
  var rows = readAllRows(sheetName);
  return rows.filter(function(r) { return String(r[key]) === String(value); });
}

function appendRow_(sheetName, rowData) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    row.push(rowData[headers[i]] !== undefined ? rowData[headers[i]] : '');
  }
  sheet.appendRow(row);
}

function updateRow(sheetName, rowIndex, updates) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var key in updates) {
    var colIndex = headers.indexOf(key);
    if (colIndex !== -1) sheet.getRange(rowIndex, colIndex + 1).setValue(updates[key]);
  }
}

function deleteRow_(sheetName, rowIndex) {
  getSheet(sheetName).deleteRow(rowIndex);
}

function generateId(prefix) {
  var sheet = getSheet('Config');
  var rows = sheet.getDataRange().getValues();
  var key = prefix + '_COUNTER';
  var cRow = -1, cVal = 0;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) { cRow = i + 1; cVal = parseInt(rows[i][1]) || 0; break; }
  }
  cVal++;
  if (cRow > 0) sheet.getRange(cRow, 2).setValue(cVal);
  else sheet.appendRow([key, cVal, 'Auto counter for ' + prefix]);
  return prefix + '-' + padLeft(cVal, 4);
}

function padLeft(num, size) {
  var s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

function generateUUID() {
  var c = '0123456789abcdef', u = '';
  for (var i = 0; i < 36; i++) {
    if (i===8||i===13||i===18||i===23) u+='-';
    else if (i===14) u+='4';
    else if (i===19) u+=c.charAt((Math.random()*4)|8);
    else u+=c.charAt(Math.random()*16|0);
  }
  return u;
}

function generateSalt() {
  var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = '';
  for (var i = 0; i < 32; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

function hashPassword(password, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + ':' + salt);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = raw[i]; if (b < 0) b += 256;
    var h = b.toString(16); if (h.length === 1) h = '0' + h;
    hex += h;
  }
  return hex;
}

function now() { return new Date().toISOString(); }

function formatDateISO(date) {
  if (!date) return '';
  if (typeof date === 'string') date = new Date(date);
  if (isNaN(date.getTime())) return '';
  return date.getFullYear() + '-' + padLeft(date.getMonth()+1,2) + '-' + padLeft(date.getDate(),2);
}

function calculateServiceDuration(joiningDate) {
  if (!joiningDate) return { years:0, months:0, days:0, totalDays:0 };
  var s = (joiningDate instanceof Date) ? joiningDate : new Date(joiningDate);
  var e = new Date();
  var td = Math.floor((e-s)/86400000);
  var y=e.getFullYear()-s.getFullYear(), m=e.getMonth()-s.getMonth(), d=e.getDate()-s.getDate();
  if (d<0) { m--; d += new Date(e.getFullYear(),e.getMonth(),0).getDate(); }
  if (m<0) { y--; m+=12; }
  return { years:y, months:m, days:d, totalDays:td };
}

function getCurrentFinancialYear() {
  var d=new Date(), y=d.getFullYear();
  if (d.getMonth()<3) return (y-1)+'-'+String(y).slice(2);
  return y+'-'+String(y+1).slice(2);
}

function successResponse(data, message) {
  return ContentService.createTextOutput(JSON.stringify({
    success:true, data:data||null, message:message||'OK', timestamp:now()
  })).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message, code) {
  return ContentService.createTextOutput(JSON.stringify({
    success:false, error:message||'Unknown error', code:code||400, timestamp:now()
  })).setMimeType(ContentService.MimeType.JSON);
}

function sanitize(str) {
  if (str===null||str===undefined) return '';
  return String(str).replace(/[<>]/g, '');
}

function sanitizeObject(obj) {
  var c = {};
  for (var k in obj) c[k] = (typeof obj[k]==='string') ? sanitize(obj[k]) : obj[k];
  return c;
}

function validateRequired(data, fields) {
  for (var i=0; i<fields.length; i++) {
    if (data[fields[i]]===undefined||data[fields[i]]===null||data[fields[i]]==='') return fields[i];
  }
  return null;
}

function serializeRow(row) {
  var r = {};
  for (var k in row) {
    if (k==='_rowIndex') continue;
    r[k] = (row[k] instanceof Date) ? formatDateISO(row[k]) : row[k];
  }
  return r;
}

function serializeRows(rows) {
  return rows.map(function(r) { return serializeRow(r); });
}

function checkAndUpgradeEmployeesHeaders() {
  var sheet = getSheet('Employees');
  if (!sheet) return;
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var required = ['LastPaidDate', 'PartialMonth', 'PartialAmount'];
  var missing = [];
  required.forEach(function(h) {
    if (headers.indexOf(h) === -1) {
      missing.push(h);
    }
  });
  if (missing.length > 0) {
    var newHeaders = headers.concat(missing);
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    var headerRange = sheet.getRange(1, 1, 1, newHeaders.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#7E57C2');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setHorizontalAlignment('center');
  }
}
