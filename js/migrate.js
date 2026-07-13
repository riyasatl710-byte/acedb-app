const OLD_API_URL = 'https://script.google.com/macros/s/AKfycbxO5aacZsOpii7ZjmoJmba1heT1kI9Eau-HjnIazwETOhktbcanMF7xCt4d9ekPQId0/exec';

function log(msg, type = 'info') {
  const w = document.getElementById('logWindow');
  const d = document.createElement('div');
  d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  if (type === 'error') d.className = 'error';
  if (type === 'success') d.className = 'success';
  w.appendChild(d);
  w.scrollTop = w.scrollHeight;
}

async function callGas(action, data = {}, token = null) {
  const body = { action, data };
  if (token) body.token = token;
  const res = await fetch(OLD_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
    redirect: 'follow'
  });
  return await res.json();
}

function fdb() { return window.acedbFirebase.db; }

async function startMigration() {
  const userId = document.getElementById('adminId').value;
  const password = document.getElementById('adminPwd').value;
  if (!userId || !password) { log('Please enter credentials', 'error'); return; }

  log('Authenticating with Google Apps Script backend...');
  const authRes = await callGas('login', { userId, password });
  if (!authRes.success) { log('Auth failed: ' + authRes.error, 'error'); return; }
  
  const token = authRes.data.token;
  log('Authentication successful. Token acquired.', 'success');

  const { doc, setDoc } = window.acedbFirebase.firestoreFns;

  async function pushCollection(colName, items, idField) {
    log(`Pushing ${items.length} records to ${colName}...`);
    let count = 0;
    for (const item of items) {
      const docId = idField ? String(item[idField]) : String(count);
      try {
        await setDoc(doc(fdb(), colName, docId), item);
        count++;
      } catch (err) {
        log(`Failed to write ${colName}/${docId}: ${err.message}`, 'error');
      }
    }
    log(`Finished ${colName}: ${count} records written.`, 'success');
  }

  try {
    // 1. Config
    log('Fetching config...');
    const cfgRes = await callGas('getConfig', {}, token);
    if (cfgRes.success) {
      const configItems = Object.keys(cfgRes.data).map(key => ({ Key: key, Value: String(cfgRes.data[key]) }));
      await pushCollection('config', configItems, 'Key');
    }

    // 2. Schemes
    log('Fetching schemes...');
    const schRes = await callGas('getSchemes', {}, token);
    if (schRes.success && Array.isArray(schRes.data)) {
      const schemeItems = schRes.data.map((name, i) => ({ Name: name, id: 'SCH_'+i }));
      await pushCollection('schemes', schemeItems, 'id');
    }

    // 3. Users
    log('Fetching users...');
    const userRes = await callGas('getUsers', {}, token);
    if (userRes.success) {
      log('Creating Firebase Auth accounts for users (this uses a cloud function workaround locally)...');
      // For migration, we will use the Identity Toolkit API directly since we have the apiKey
      const apiKey = window.acedbFirebase.apiKey;
      for (const u of userRes.data) {
        // If password hash is returned, we can't migrate passwords easily via client SDK. 
        // We will assign a default password (e.g. Acedb@2026) for migration, OR use their UserID as password if we don't know it.
        // It's safer to just set password to their UserID for migration purposes.
        const defaultPwd = u.UserID + '2026!'; 
        const email = u.UserID.toLowerCase() + '@acedb.internal';
        
        try {
          const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: defaultPwd, returnSecureToken: false })
          });
          const data = await resp.json();
          if (!resp.ok && data.error.message !== 'EMAIL_EXISTS') {
            log(`Failed to create auth for ${u.UserID}: ${data.error.message}`, 'error');
          }
        } catch(e) {
          log(`Auth error for ${u.UserID}: ${e.message}`, 'error');
        }
      }
      await pushCollection('users', userRes.data, 'UserID');
    }

    // 4. Employees
    log('Fetching employees...');
    const empRes = await callGas('getEmployees', {}, token);
    if (empRes.success) {
      await pushCollection('employees', empRes.data, 'EmpID');
    }

    // 5. Salary History
    log('Fetching salary history (this might take a moment)...');
    const salRes = await callGas('getSalaryHistory', {}, token);
    if (salRes.success) {
      await pushCollection('salary_history', salRes.data, 'RecordID');
    }

    // 6. Salary Revisions
    log('Fetching salary revisions...');
    const revRes = await callGas('getSalaryRevisions', {}, token);
    if (revRes.success) {
      await pushCollection('salary_revisions', revRes.data, 'RevisionID');
    }

    log('=====================================', 'success');
    log('MIGRATION COMPLETE!', 'success');
    log('All default passwords have been set to [UserID]2026! (e.g., ADM0012026!)', 'info');

  } catch (err) {
    log('Migration failed critically: ' + err.message, 'error');
  }
}

window.startMigration = startMigration;
