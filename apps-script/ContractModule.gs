/**
 * ACEDB - ContractModule.gs
 */

function handleGetContracts(data, session) {
  var pc = checkPermission(session, 'contract.view');
  if (pc) return pc;

  var rows = readAllRows('Contracts');
  if (data.scheme) rows = rows.filter(function(r) { return r.Scheme === data.scheme; });
  if (data.sanctionType) rows = rows.filter(function(r) { return r.SanctionType === data.sanctionType; });

  // Add expiry status
  var today = new Date();
  var result = rows.map(function(r) {
    var s = serializeRow(r);
    if (r.ExpiryDate) {
      var exp = new Date(r.ExpiryDate);
      var daysLeft = Math.ceil((exp - today) / 86400000);
      s.daysToExpiry = daysLeft;
      s.expiryStatus = daysLeft < 0 ? 'Expired' : daysLeft <= 30 ? 'Expiring Soon' : 'Active';
    }
    return s;
  });

  result.sort(function(a, b) { return (a.daysToExpiry || 0) - (b.daysToExpiry || 0); });
  return successResponse(result, result.length + ' contracts');
}

function handleAddContract(data, session) {
  var pc = checkPermission(session, 'contract.create');
  if (pc) return pc;

  var missing = validateRequired(data, ['scheme', 'goNumber', 'startDate', 'expiryDate']);
  if (missing) return errorResponse('Missing required field: ' + missing);

  var contractId = generateId('CON');
  appendRow_('Contracts', {
    ContractID: contractId,
    Scheme: sanitize(data.scheme),
    GONumber: sanitize(data.goNumber),
    GODate: data.goDate || '',
    SanctionType: data.sanctionType || 'New',
    StartDate: data.startDate,
    ExpiryDate: data.expiryDate,
    SanctionedPosts: parseInt(data.sanctionedPosts) || 0,
    HonorariumAmount: parseFloat(data.honorariumAmount) || 0,
    Remarks: sanitize(data.remarks || ''),
    CreatedBy: session.userId,
    CreatedAt: now()
  });

  logAudit(session.userId, 'CREATE', 'Contract', contractId, 'Contract added: ' + data.scheme + ' GO:' + data.goNumber, '', '');
  return successResponse({ contractId: contractId }, 'Contract added');
}

function handleEditContract(data, session) {
  var pc = checkPermission(session, 'contract.edit');
  if (pc) return pc;
  if (!data.contractId) return errorResponse('Contract ID is required');

  var rec = findRow('Contracts', 'ContractID', data.contractId);
  if (!rec) return errorResponse('Contract not found');

  var updates = {};
  if (data.scheme) updates.Scheme = sanitize(data.scheme);
  if (data.goNumber) updates.GONumber = sanitize(data.goNumber);
  if (data.goDate) updates.GODate = data.goDate;
  if (data.sanctionType) updates.SanctionType = data.sanctionType;
  if (data.startDate) updates.StartDate = data.startDate;
  if (data.expiryDate) updates.ExpiryDate = data.expiryDate;
  if (data.sanctionedPosts !== undefined) updates.SanctionedPosts = parseInt(data.sanctionedPosts) || 0;
  if (data.honorariumAmount !== undefined) updates.HonorariumAmount = parseFloat(data.honorariumAmount) || 0;
  if (data.remarks !== undefined) updates.Remarks = sanitize(data.remarks);

  updateRow('Contracts', rec._rowIndex, updates);
  logAudit(session.userId, 'UPDATE', 'Contract', data.contractId, 'Contract updated', '', JSON.stringify(updates));
  return successResponse(null, 'Contract updated');
}

function handleGetExpiringContracts(data, session) {
  var pc = checkPermission(session, 'contract.view');
  if (pc) return pc;

  var daysAhead = parseInt(data.daysAhead) || 60;
  var today = new Date();
  var cutoff = new Date(today.getTime() + daysAhead * 86400000);
  var rows = readAllRows('Contracts');

  var expiring = rows.filter(function(r) {
    if (!r.ExpiryDate) return false;
    var exp = new Date(r.ExpiryDate);
    return exp >= today && exp <= cutoff;
  });

  return successResponse(serializeRows(expiring), expiring.length + ' contracts expiring within ' + daysAhead + ' days');
}
