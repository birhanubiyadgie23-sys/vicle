// --- Supabase ግንኙነት ማዋቀሪያ (የተስተካከለ - Anon Key) ---
const SUPABASE_URL = 'https://hovkdxdcfwqxhkqlfmgx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvdmtkeGRjZndxeGhrcWxmbWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NTU3NTksImV4cCI6MjEwMjUzMTc1OX0.Ljjcwo858v7zU1hTrbVSvPOXUiFplUVLJono8V3rpiA';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value.trim();

    if (!email || !password) {
        alert('እባክዎ ኢሜይል እና የይለፍ ቃል ያስገቡ!');
        return;
    }

    // መደበኛ የሱፓቤስ Auth መግቢያ
    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert('የመግቢያ ስህተት: ' + error.message);
        return;
    }

    currentUser = data.user;
    await fetchUserProfile();
    initSession();
}

async function fetchUserProfile() {
    if (!currentUser) return;
    const { data, error } = await _supabase.from('users').select('*').eq('user_id', currentUser.id).maybeSingle();
    if (data) {
        currentProfile = data;
    } else {
        currentProfile = { full_name: currentUser.email, role: 'staff', department: '' };
    }
}

async function handleLogout() {
    await _supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('mainAppContainer').style.display = 'none';
}

async function initSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainAppContainer').style.display = 'none';
        return;
    }
    currentUser = session.user;
    await fetchUserProfile();

    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainAppContainer').style.display = 'flex';
    document.getElementById('currentUserName').innerText = `${currentProfile.full_name || currentUser.email} (${currentProfile.role})`;

    applyRolePermissions();
    renderAllTables();
    populateCarDropdown();
    populateDepartmentDropdowns();
}

function applyRolePermissions() {
    const role = currentProfile ? currentProfile.role : '';
    document.getElementById('navDeptApp').style.display = (role === 'dept' || role === 'admin') ? 'flex' : 'none';
    document.getElementById('navAdminDisp').style.display = (role === 'admin') ? 'flex' : 'none';
    document.getElementById('navDriverAcc').style.display = (role === 'driver' || role === 'admin') ? 'flex' : 'none';
    document.getElementById('navFuel').style.display = (role === 'driver' || role === 'admin') ? 'flex' : 'none';
    document.getElementById('navDeptCreate').style.display = (role === 'admin') ? 'flex' : 'none';
    document.getElementById('navDeptMgmt').style.display = (role === 'admin') ? 'flex' : 'none';
    document.getElementById('navCarMgmt').style.display = (role === 'admin') ? 'flex' : 'none';
    document.getElementById('navAccMgmt').style.display = (role === 'admin') ? 'flex' : 'none';
    document.getElementById('navTechSupportAdmin').style.display = (role === 'admin') ? 'flex' : 'none';
    document.getElementById('navReports').style.display = (role === 'admin') ? 'flex' : 'none';
}

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.card').forEach(c => c.classList.remove('active-section'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active-section');
    if (btnElement) btnElement.classList.add('active');
}

// --- Database Actions with Supabase ---
async function submitVehicleRequest() {
    const dept = document.getElementById('reqDepartmentSelect').value;
    const dest = document.getElementById('reqDestination').value.trim();
    const reason = document.getElementById('reqReason').value.trim();
    const date = document.getElementById('reqDate').value;

    if (!dept || !dest || !reason || !date) { alert('እባክዎ መረጃዎችን በሙሉ ይሙሉ!'); return; }

    const { error } = await _supabase.from('vehicle_requests').insert([{
        staff_name: (currentProfile && currentProfile.full_name) ? currentProfile.full_name : currentUser.email,
        department: dept,
        destination: dest,
        reason: reason,
        date: date,
        created_at: new Date().toISOString().split('T')[0],
        dept_status: 'Pending',
        admin_status: 'Pending',
        driver_status: 'Pending'
    }]);

    if (error) { alert('ስህተት ተፈጥሯል: ' + error.message); }
    else {
        alert('ጥያቄው በተሳካ ሁኔታ ተልኳል!');
        document.getElementById('reqDestination').value = '';
        document.getElementById('reqReason').value = '';
        renderAllTables();
    }
}

async function renderAllTables() {
    await renderStaffRequests();
    await renderDeptApproval();
    await renderAdminDispatch();
    await renderDriverAccept();
    await renderAdminDepartmentListTable();
    await renderAdminCarsTable();
    await renderFuelMaintenanceTable();
    await refreshDashboardStats();
}

async function renderStaffRequests() {
    const tbody = document.getElementById('staffRequestsTable');
    if (!tbody) return;
    let query = _supabase.from('vehicle_requests').select('*');
    if (currentProfile && currentProfile.role !== 'admin') {
        query = query.eq('staff_name', currentProfile.full_name || currentUser.email);
    }
    const { data: requests } = await query;
    tbody.innerHTML = '';
    (requests || []).forEach(r => {
        tbody.innerHTML += `<tr><td><b>${r.department}</b></td><td>${r.destination}</td><td>${r.reason}</td><td>${r.date}</td><td><span class="badge ${r.dept_status === 'Approved' ? 'badge-active' : 'badge-garage'}">${r.dept_status}</span></td><td><span class="badge ${r.admin_status === 'Approved' ? 'badge-active' : 'badge-garage'}">${r.admin_status}</span></td></tr>`;
    });
}

async function renderDeptApproval() {
    const tbody = document.getElementById('deptApprovalTable');
    if (!tbody) return;
    const { data: requests } = await _supabase.from('vehicle_requests').select('*');
    tbody.innerHTML = '';
    (requests || []).forEach(r => {
        tbody.innerHTML += `<tr><td><b>${r.staff_name}</b></td><td>${r.department}</td><td>${r.destination}</td><td>${r.reason}</td><td><span class="badge">${r.dept_status}</span></td><td>${r.assigned_driver || '-'}</td><td><button class="btn-success" onclick="updateDeptApproval('${r.id}', 'Approved')">አጽድቅ</button></td></tr>`;
    });
}

async function updateDeptApproval(id, status) {
    await _supabase.from('vehicle_requests').update({ dept_status: status }).eq('id', id);
    renderAllTables();
}

async function renderAdminDispatch() {
    const tbody = document.getElementById('adminDispatchTable');
    if (!tbody) return;
    const { data: requests } = await _supabase.from('vehicle_requests').select('*');
    tbody.innerHTML = '';
    (requests || []).forEach(r => {
        tbody.innerHTML += `<tr><td><b>${r.staff_name}</b></td><td>${r.department}</td><td>${r.destination}</td><td>${r.dept_status}</td><td><button class="btn-success" onclick="updateAdminDispatch('${r.id}', 'Approved')">አጽድቅ</button></td><td>${r.assigned_driver || 'አልተመደበም'}</td></tr>`;
    });
}

async function updateAdminDispatch(id, status) {
    await _supabase.from('vehicle_requests').update({ admin_status: status }).eq('id', id);
    renderAllTables();
}

async function renderDriverAccept() {
    const tbody = document.getElementById('driverAcceptTable');
    if (!tbody) return;
    const { data: requests } = await _supabase.from('vehicle_requests').select('*').not('assigned_driver', 'is', null);
    tbody.innerHTML = '';
    (requests || []).forEach(r => {
        tbody.innerHTML += `<tr><td>${r.destination}</td><td>${r.department}</td><td>${r.assigned_driver}</td><td>${r.driver_status}</td><td>-</td></tr>`;
    });
}

async function renderFuelMaintenanceTable() {
    const tbody = document.getElementById('fmTableBody');
    if (!tbody) return;
    const { data: list } = await _supabase.from('fuel_maintenance').select('*');
    tbody.innerHTML = '';
    (list || []).forEach(item => {
        tbody.innerHTML += `<tr><td>${item.driver} (${item.car})</td><td>${item.type}</td><td>${item.value}</td><td>${item.note}</td><td>${item.status}</td></tr>`;
    });
}

async function saveFuelMaintenance() {
    const car = document.getElementById('fmCarSelect').value;
    const type = document.getElementById('fmTypeSelect').value;
    const value = document.getElementById('fmValueInput').value.trim();
    const note = document.getElementById('fmNoteInput').value.trim();
    if (!car || !value) { alert('መረጃ ይሙሉ!'); return; }

    const driverName = (currentProfile && currentProfile.full_name) ? currentProfile.full_name : (currentUser ? currentUser.email : 'Unknown Driver');

    const { error } = await _supabase.from('fuel_maintenance').insert([{
        driver: driverName,
        car,
        type,
        value,
        note,
        status: 'Pending'
    }]);

    if (error) {
        alert('ስህተት ተፈጥሯል: ' + error.message);
    } else {
        alert('ማመልከቻው በተሳካ ሁኔታ ተልኳል!');
        document.getElementById('fmValueInput').value = '';
        document.getElementById('fmNoteInput').value = '';
        renderFuelMaintenanceTable();
    }
}

async function registerNewDepartment() {
    const name = document.getElementById('newDeptNameInput').value.trim();
    if (!name) return;
    await _supabase.from('departments').insert([{ name }]);
    alert('ዳይሬክቶሬት ተፈጥሯል!');
    renderAdminDepartmentListTable();
    populateDepartmentDropdowns();
}

async function renderAdminDepartmentListTable() {
    const tbody = document.getElementById('adminDepartmentListTable');
    if (!tbody) return;
    const { data: depts } = await _supabase.from('departments').select('*');
    tbody.innerHTML = '';
    (depts || []).forEach(d => {
        tbody.innerHTML += `<tr><td><b>${d.name}</b></td><td>-</td></tr>`;
    });
}

async function populateDepartmentDropdowns() {
    const reqSelect = document.getElementById('reqDepartmentSelect');
    const configSelect = document.getElementById('adminConfigDeptName');
    const { data: depts } = await _supabase.from('departments').select('*');
    if (reqSelect) {
        reqSelect.innerHTML = `<option value="">-- ዳይሬክቶሬት ይምረጡ --</option>`;
        (depts || []).forEach(d => { reqSelect.innerHTML += `<option value="${d.name}">${d.name}</option>`; });
    }
    if (configSelect) {
        configSelect.innerHTML = `<option value="">-- ዳይሬክቶሬት ይምረጡ --</option>`;
        (depts || []).forEach(d => { configSelect.innerHTML += `<option value="${d.name}">${d.name}</option>`; });
    }
}

async function saveDepartmentConfiguration() {
    const dept_name = document.getElementById('adminConfigDeptName').value;
    const head_username = document.getElementById('adminConfigHeadUsername').value.trim();
    const staffs = document.getElementById('adminConfigStaffs').value.trim();
    if (!dept_name || !head_username) return;
    await _supabase.from('department_configs').insert([{ dept_name, head_username, staffs }]);
    alert('ተዋቅሯል!');
}

async function registerDriverAndCar() {
    const driver = document.getElementById('adminDriverName').value.trim();
    const car = document.getElementById('adminCarPlate').value.trim();
    const status = document.getElementById('adminCarStatus').value;
    if (!driver || !car) return;
    await _supabase.from('cars').insert([{ car, driver, status }]);
    alert('ተመዝግቧል!');
    renderAdminCarsTable();
    populateCarDropdown();
}

async function renderAdminCarsTable() {
    const tbody = document.getElementById('adminRegisteredCarsTable');
    if (!tbody) return;
    const { data: cars } = await _supabase.from('cars').select('*');
    tbody.innerHTML = '';
    (cars || []).forEach(c => {
        tbody.innerHTML += `<tr><td><b>${c.car}</b></td><td>${c.driver}</td><td><span class="badge">${c.status}</span></td><td>-</td></tr>`;
    });
}

async function populateCarDropdown() {
    const fmSelect = document.getElementById('fmCarSelect');
    if (!fmSelect) return;
    const { data: cars } = await _supabase.from('cars').select('*');
    fmSelect.innerHTML = `<option value="">-- መኪና ይምረጡ --</option>`;
    (cars || []).forEach(c => { fmSelect.innerHTML += `<option value="${c.car}">${c.car} (${c.driver})</option>`; });
}

async function registerSystemAccount() {
    const email = document.getElementById('newAccEmail').value.trim();
    const password = document.getElementById('newAccPassword').value.trim();
    const fullName = document.getElementById('newAccFullName').value.trim();
    const role = document.getElementById('newAccRole').value;

    if (!email || !password || !fullName) { alert('እባክዎ መረጃዎችን ይሙሉ!'); return; }

    const { data, error } = await _supabase.auth.signUp({ email, password });
    if (error) { alert('ስህተት: ' + error.message); return; }

    if (data.user) {
        await _supabase.from('users').insert([{ user_id: data.user.id, full_name: fullName, username: email, role }]);
        alert('አካውንት ተፈጥሯል!');
    }
}

async function refreshDashboardStats() {
    const { data: cars } = await _supabase.from('cars').select('*');
    const { data: requests } = await _supabase.from('vehicle_requests').select('*');
    if (cars) {
        document.getElementById('statActiveCars').innerText = cars.filter(c => c.status === 'Active').length;
        document.getElementById('statGarageCars').innerText = cars.filter(c => c.status === 'Garage').length;
    }
    if (requests) {
        document.getElementById('statPendingReq').innerText = requests.filter(r => r.admin_status === 'Pending').length;
    }
}

function openCustomModal(type) { document.getElementById('genericModal').style.display = 'flex'; }
function closeGenericModal() { document.getElementById('genericModal').style.display = 'none'; }

window.onload = function () { initSession(); };