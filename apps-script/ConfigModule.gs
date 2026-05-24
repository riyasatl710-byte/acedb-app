/**
 * ACEDB - ConfigModule.gs
 */

function handleGetConfig(data, session) {
  var pc = checkPermission(session, 'config.view');
  if (pc) return pc;
  var rows = readAllRows('Config');
  var config = {};
  rows.forEach(function(r) { if (r.Key) config[r.Key] = r.Value; });
  return successResponse(config, 'Config retrieved');
}

function handleUpdateConfig(data, session) {
  var pc = checkPermission(session, 'config.edit');
  if (pc) return pc;
  if (!data.key || data.value === undefined) return errorResponse('Key and Value required');

  var rows = readAllRows('Config');
  var found = false;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].Key === data.key) {
      var oldVal = rows[i].Value;
      updateRow('Config', rows[i]._rowIndex, { Value: data.value });
      logAudit(session.userId, 'UPDATE', 'Config', data.key, 'Config updated', String(oldVal), String(data.value));
      found = true;
      break;
    }
  }
  if (!found) {
    appendRow_('Config', { Key: data.key, Value: data.value, Description: data.description || '' });
    logAudit(session.userId, 'CREATE', 'Config', data.key, 'Config added', '', String(data.value));
  }
  return successResponse(null, 'Config updated');
}

function getConfigValue(key) {
  var row = findRow('Config', 'Key', key);
  return row ? row.Value : null;
}

function handleGetDistricts(data, session) {
  var val = getConfigValue('DISTRICTS');
  var districts = val ? val.split(',').map(function(d){return d.trim();}) : [];
  return successResponse(districts, 'Districts retrieved');
}

function handleGetSchemes(data, session) {
  var val = getConfigValue('SCHEMES');
  var schemes = val ? val.split(',').map(function(s){return s.trim();}).filter(function(s){return s!=='';}) : [];
  return successResponse(schemes, 'Schemes retrieved');
}

function handleAddScheme(data, session) {
  var pc = checkPermission(session, 'scheme.create');
  if (pc) return pc;
  if (!data.scheme) return errorResponse('Scheme name is required');

  var val = getConfigValue('SCHEMES') || '';
  var schemes = val ? val.split(',').map(function(s){return s.trim();}) : [];
  if (schemes.indexOf(data.scheme.trim()) !== -1) return errorResponse('Scheme already exists');

  schemes.push(data.scheme.trim());
  var row = findRow('Config', 'Key', 'SCHEMES');
  if (row) updateRow('Config', row._rowIndex, { Value: schemes.join(',') });
  else appendRow_('Config', { Key: 'SCHEMES', Value: schemes.join(','), Description: 'Scheme list' });

  logAudit(session.userId, 'CREATE', 'Config', 'SCHEMES', 'Scheme added: ' + data.scheme, '', '');
  return successResponse(schemes, 'Scheme added');
}

function handleDeleteScheme(data, session) {
  var pc = checkPermission(session, 'scheme.edit');
  if (pc) return pc;
  if (!data.scheme) return errorResponse('Scheme name is required');

  var val = getConfigValue('SCHEMES') || '';
  var schemes = val.split(',').map(function(s){return s.trim();}).filter(function(s){return s !== data.scheme.trim();});
  var row = findRow('Config', 'Key', 'SCHEMES');
  if (row) updateRow('Config', row._rowIndex, { Value: schemes.join(',') });

  logAudit(session.userId, 'DELETE', 'Config', 'SCHEMES', 'Scheme removed: ' + data.scheme, '', '');
  return successResponse(schemes, 'Scheme removed');
}


function handleGetFeatureLocks(data, session) {
  var locks = {
    LOCK_HONORARIUM: String(getConfigValue('LOCK_HONORARIUM')).toLowerCase() === 'true',
    LOCK_MATERNITY_PAY: String(getConfigValue('LOCK_MATERNITY_PAY')).toLowerCase() === 'true',
    LOCK_FESTIVAL_ALLOWANCE: String(getConfigValue('LOCK_FESTIVAL_ALLOWANCE')).toLowerCase() === 'true',
    LOCK_EL_SURRENDER: String(getConfigValue('LOCK_EL_SURRENDER')).toLowerCase() === 'true',
    LOCK_EMOLUMENTS: String(getConfigValue('LOCK_EMOLUMENTS')).toLowerCase() === 'true',
    LOCK_LEAVE: String(getConfigValue('LOCK_LEAVE')).toLowerCase() === 'true',
    LOCK_CONTRACT: String(getConfigValue('LOCK_CONTRACT')).toLowerCase() === 'true',
    LOCKED_FINANCIAL_YEARS: getConfigValue('LOCKED_FINANCIAL_YEARS') || ''
  };
  return successResponse(locks, 'Feature locks retrieved');
}
