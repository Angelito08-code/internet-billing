const express = require('express');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const app = express();
const PORT = process.env.PORT || 3000;

const DB_FILE = path.join(__dirname, 'database.json');
const ADMIN_FILE = path.join(__dirname, 'admins.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Awtomatikong gagawa ng database para sa Invoices kung wala pa
if (!fs.existsSync(DB_FILE)) {
  const initialData = [
    { id: 1, name: "Alice Smith", plan: "50 Mbps", amount: 1200.00, status: "paid", dueDate: "2026-07-05" },
    { id: 2, name: "Bob Jones", plan: "100 Mbps", amount: 1800.00, status: "unpaid", dueDate: "2026-07-10" },
    { id: 3, name: "Charlie Brown", plan: "50 Mbps", amount: 45.00, status: "disconnected", dueDate: "2026-06-12" }
  ];
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

// Awtomatikong gagawa ng database para sa Admins kung wala pa (Default: admin / admin123)
if (!fs.existsSync(ADMIN_FILE)) {
  const initialAdmins = [
    { id: 1, username: "admin", password: "admin123" }
  ];
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(initialAdmins, null, 2));
}

// Helper functions
const getDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

const getAdmins = () => JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
const saveAdmins = (data) => fs.writeFileSync(ADMIN_FILE, JSON.stringify(data, null, 2));

// ================= LOGIN PAGE (UNANG LALABAS SA /) =================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tl">
    <head>
      <meta charset="UTF-8">
      <title>Login - RTECH Computer Center</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gradient-to-br from-blue-950 via-gray-900 to-black min-h-screen flex items-center justify-center p-4 font-sans">
      <div class="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-2xl text-white">
        <div class="text-center mb-6">
          <div class="bg-black/40 p-2 rounded-2xl w-28 h-28 mx-auto mb-3 flex items-center justify-center border-2 border-blue-500 shadow-lg overflow-hidden">
            <img src="/logo.png" alt="Logo" class="w-full h-full object-contain rounded-xl">
          </div>
          <h1 class="text-2xl font-bold tracking-wide mt-2">RTECH Billing System</h1>
          <p class="text-xs text-gray-300 mt-1">Sign in to your admin account</p>
        </div>

        <div id="errorMsg" class="hidden bg-red-500/20 border border-red-500 text-red-200 text-xs p-3 rounded mb-4 text-center"></div>

        <form onsubmit="handleLogin(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">Username</label>
            <input type="text" id="username" required class="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white">
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1">Password</label>
            <input type="password" id="password" required class="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white">
          </div>
          <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition duration-200 shadow-lg text-sm">
            Login
          </button>
        </form>
      </div>

      <script>
        async function handleLogin(e) {
          e.preventDefault();
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          const errDiv = document.getElementById('errorMsg');

          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });

          const data = await res.json();
          if (res.ok) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('adminUser', data.username);
            window.location.href = '/dashboard';
          } else {
            errDiv.textContent = data.error || 'Mali ang username o password.';
            errDiv.classList.remove('hidden');
          }
        }
      </script>
    </body>
    </html>
  `);
});

// LOGIN API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const admins = getAdmins();
  const admin = admins.find(a => a.username === username && a.password === password);
  
  if (admin) {
    res.json({ success: true, username: admin.username });
  } else {
    res.status(401).json({ error: 'Mali ang username o password.' });
  }
});

// ================= DASHBOARD (NASA /dashboard NA) =================
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tl">
    <head>
      <meta charset="UTF-8">
      <title>Internet Billing System - RTECH</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 p-6 font-sans">
      <script>
        if (localStorage.getItem('isLoggedIn') !== 'true') {
          window.location.href = '/';
        }
      </script>

      <div class="max-w-6xl mx-auto bg-white rounded-lg shadow p-6">
        <!-- Top Header with Logo -->
        <div class="flex flex-col md:flex-row justify-between items-center mb-6 border-b pb-4 gap-4">
          <div class="flex items-center gap-3">
            <div class="bg-gray-900 p-1.5 rounded-xl w-16 h-16 flex items-center justify-center border border-blue-500 shadow overflow-hidden">
              <img src="/logo.png" alt="Logo" class="w-full h-full object-contain rounded">
            </div>
            <div>
              <h1 class="text-2xl font-bold text-gray-800">Internet Billing & Payment Tracker</h1>
              <p class="text-xs text-gray-500">RTECH Computer Center Management</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <a href="/api/export-excel" class="bg-emerald-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-emerald-700 flex items-center gap-1 no-underline shadow">
              📊 Export to Excel
            </a>
            <button onclick="openAdminModal()" class="bg-gray-800 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gray-900 shadow">
              ⚙️ Manage Admins
            </button>
            <button onclick="logout()" class="bg-red-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-700 shadow">
              Logout
            </button>
          </div>
        </div>
        
        <!-- Summary Cards -->
        <div id="summary" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"></div>

        <!-- Controls, Search & Add Form -->
        <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 border-b pb-4">
          <div class="flex flex-wrap items-center gap-2">
            <div class="space-x-1 flex flex-wrap gap-1">
              <button onclick="filterStatus('all')" class="px-3 py-1 bg-gray-200 rounded text-sm font-medium hover:bg-gray-300">All</button>
              <button onclick="filterStatus('paid')" class="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200">Paid</button>
              <button onclick="filterStatus('unpaid')" class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200">Unpaid</button>
              <button onclick="filterStatus('disconnected')" class="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-medium hover:bg-yellow-200">Disconnected</button>
            </div>
            
            <!-- Search Box & Button -->
            <div class="flex items-center gap-1 ml-2">
              <input type="text" id="searchInput" placeholder="Search customer..." class="border px-3 py-1 rounded text-sm focus:outline-none focus:border-blue-500" onkeypress="handleSearchKey(event)">
              <button onclick="searchCustomer()" class="bg-gray-700 text-white px-3 py-1 rounded text-sm hover:bg-gray-800 font-medium shadow">🔍 Search</button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <input type="text" id="newId" placeholder="ID (Auto kung blangko)" class="border px-2 py-1 rounded text-sm w-32">
            <input type="text" id="newName" placeholder="Pangalan" class="border px-2 py-1 rounded text-sm">
            <input type="text" id="newPlan" placeholder="Plan (e.g. 50Mbps)" class="border px-2 py-1 rounded text-sm">
            <input type="number" id="newAmount" placeholder="Halaga (₱)" class="border px-2 py-1 rounded text-sm w-24">
            <button onclick="addSubscriber()" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 font-medium shadow">Add Customer</button>
          </div>
        </div>

        <!-- Data Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 border-b text-gray-600 text-xs uppercase">
                <th class="p-3">Customer ID</th>
                <th class="p-3">Customer Name</th>
                <th class="p-3">Plan</th>
                <th class="p-3">Due Date</th>
                <th class="p-3">Amount</th>
                <th class="p-3">Status</th>
                <th class="p-3">Actions</th>
              </tr>
            </thead>
            <tbody id="tableBody" class="text-sm"></tbody>
          </table>
        </div>
      </div>

      <!-- EDIT MODAL -->
      <div id="editModal" class="fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
          <h2 class="text-xl font-bold text-gray-800 mb-4">Edit Customer Info</h2>
          <input type="hidden" id="editId">
          
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Customer Name</label>
              <input type="text" id="editName" class="w-full border px-3 py-2 rounded text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Plan</label>
              <input type="text" id="editPlan" class="w-full border px-3 py-2 rounded text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Due Date</label>
              <input type="date" id="editDueDate" class="w-full border px-3 py-2 rounded text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Amount (₱)</label>
              <input type="number" id="editAmount" class="w-full border px-3 py-2 rounded text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Status</label>
              <select id="editStatus" class="w-full border px-3 py-2 rounded text-sm bg-white">
                <option value="paid">PAID</option>
                <option value="unpaid">UNPAID</option>
                <option value="disconnected">DISCONNECTED</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <button onclick="closeEditModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300">Cancel</button>
            <button onclick="saveEditedCustomer()" class="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">Save Changes</button>
          </div>
        </div>
      </div>

      <!-- ADMIN MANAGEMENT MODAL -->
      <div id="adminModal" class="fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
          <h2 class="text-xl font-bold text-gray-800 mb-4">Manage Admin Accounts</h2>
          
          <div class="mb-4 bg-gray-50 p-3 rounded border">
            <h3 class="text-xs font-bold text-gray-700 uppercase mb-2">Add New Admin</h3>
            <div class="space-y-2">
              <input type="text" id="newAdminUser" placeholder="New Username" class="w-full border px-3 py-1.5 rounded text-sm">
              <input type="password" id="newAdminPass" placeholder="New Password" class="w-full border px-3 py-1.5 rounded text-sm">
              <button onclick="createAdmin()" class="w-full bg-emerald-600 text-white py-1.5 rounded text-sm font-medium hover:bg-emerald-700">Create Admin Account</button>
            </div>
          </div>

          <div>
            <h3 class="text-xs font-bold text-gray-700 uppercase mb-2">Existing Admins</h3>
            <div id="adminList" class="max-h-40 overflow-y-auto border rounded divide-y text-sm"></div>
          </div>

          <div class="flex justify-end mt-6">
            <button onclick="closeAdminModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300">Close</button>
          </div>
        </div>
      </div>

      <script>
        let currentFilter = 'all';
        let searchQuery = '';

        function logout() {
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('adminUser');
          window.location.href = '/';
        }

        function searchCustomer() {
          searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
          loadData();
        }

        function handleSearchKey(e) {
          if (e.key === 'Enter') {
            searchCustomer();
          }
        }

        async function loadData() {
          const res = await fetch('/api/invoices');
          const data = await res.json();
          
          const total = data.length;
          const paidCount = data.filter(d => d.status === 'paid').length;
          const unpaidCount = data.filter(d => d.status === 'unpaid').length;
          const disconnectedCount = data.filter(d => d.status === 'disconnected').length;
          
          const totalPaidAmount = data.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0);
          const totalUnpaidAmount = data.filter(d => d.status === 'unpaid').reduce((sum, d) => sum + d.amount, 0);

          document.getElementById('summary').innerHTML = \`
            <div class="p-4 bg-gray-50 rounded border-l-4 border-blue-500 shadow-sm">
              <div class="text-gray-500 text-xs font-medium">Total Subscribers</div>
              <div class="text-xl font-bold">\${total}</div>
            </div>
            <div class="p-4 bg-gray-50 rounded border-l-4 border-green-500 shadow-sm">
              <div class="text-gray-500 text-xs font-medium">Paid Accounts (₱\${totalPaidAmount.toFixed(2)})</div>
              <div class="text-xl font-bold text-green-600">\${paidCount}</div>
            </div>
            <div class="p-4 bg-gray-50 rounded border-l-4 border-red-500 shadow-sm">
              <div class="text-gray-500 text-xs font-medium">Unpaid Accounts (₱\${totalUnpaidAmount.toFixed(2)})</div>
              <div class="text-xl font-bold text-red-600">\${unpaidCount}</div>
            </div>
            <div class="p-4 bg-gray-50 rounded border-l-4 border-yellow-500 shadow-sm">
              <div class="text-gray-500 text-xs font-medium">Disconnected Accounts</div>
              <div class="text-xl font-bold text-yellow-600">\${disconnectedCount}</div>
            </div>
          \`;

          const tbody = document.getElementById('tableBody');
          tbody.innerHTML = '';
          
          const filtered = data.filter(item => {
            const matchesStatus = (currentFilter === 'all' || item.status === currentFilter);
            const matchesSearch = item.name.toLowerCase().includes(searchQuery) || 
                                  item.plan.toLowerCase().includes(searchQuery) || 
                                  item.id.toString().includes(searchQuery);
            return matchesStatus && matchesSearch;
          });
          
          if (filtered.length === 0) {
            tbody.innerHTML = \`<tr><td colspan="7" class="p-4 text-center text-gray-400">Walang nakitang record.</td></tr>\`;
            return;
          }

          filtered.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50';
            
            let statusBadgeClass = 'bg-gray-100 text-gray-700';
            if (item.status === 'paid') statusBadgeClass = 'bg-green-100 text-green-700';
            else if (item.status === 'unpaid') statusBadgeClass = 'bg-red-100 text-red-700';
            else if (item.status === 'disconnected') statusBadgeClass = 'bg-yellow-100 text-yellow-800';

            tr.innerHTML = \`
              <td class="p-3 text-gray-600 font-mono">\${item.id}</td>
              <td class="p-3 font-medium text-gray-800">\${item.name}</td>
              <td class="p-3 text-gray-600">\${item.plan}</td>
              <td class="p-3 text-gray-600">\${item.dueDate}</td>
              <td class="p-3 text-gray-800 font-semibold">₱\${item.amount.toFixed(2)}</td>
              <td class="p-3">
                <span class="px-2.5 py-1 text-xs rounded-full font-semibold \${statusBadgeClass}">
                  \${item.status.toUpperCase()}
                </span>
              </td>
              <td class="p-3 flex items-center gap-2">
                \${item.status === 'unpaid' ? \`<button onclick="markPaid(\${item.id})" class="text-green-600 hover:underline font-medium text-xs">Mark Paid</button>\` : ''}
                <button onclick="openEditModal(\${item.id}, '\${item.name}', '\${item.plan}', '\${item.dueDate}', \${item.amount}, '\${item.status}')" class="text-blue-600 hover:underline font-medium text-xs">Edit</button>
                <button onclick="deleteCustomer(\${item.id})" class="text-red-600 hover:underline font-medium text-xs">Delete</button>
              </td>
            \`;
            tbody.appendChild(tr);
          });
        }

        function filterStatus(status) {
          currentFilter = status;
          loadData();
        }

        async function markPaid(id) {
          await fetch('/api/invoices/' + id + '/pay', { method: 'PUT' });
          loadData();
        }

        async function addSubscriber() {
          const idInput = document.getElementById('newId').value.trim();
          const name = document.getElementById('newName').value;
          const plan = document.getElementById('newPlan').value;
          const amount = parseFloat(document.getElementById('newAmount').value);
          
          if (!name || !plan || isNaN(amount)) {
            alert('Paki-punuan ang Pangalan, Plan, at Halaga nang tama.');
            return;
          }

          const res = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: idInput, name, plan, amount })
          });

          if (res.ok) {
            document.getElementById('newId').value = '';
            document.getElementById('newName').value = '';
            document.getElementById('newPlan').value = '';
            document.getElementById('newAmount').value = '';
            loadData();
          } else {
            const err = await res.json();
            alert(err.error || 'May problemang naganap.');
          }
        }

        function openEditModal(id, name, plan, dueDate, amount, status) {
          document.getElementById('editId').value = id;
          document.getElementById('editName').value = name;
          document.getElementById('editPlan').value = plan;
          document.getElementById('editDueDate').value = dueDate;
          document.getElementById('editAmount').value = amount;
          document.getElementById('editStatus').value = status;
          document.getElementById('editModal').classList.remove('hidden');
        }

        function closeEditModal() {
          document.getElementById('editModal').classList.add('hidden');
        }

        async function saveEditedCustomer() {
          const id = document.getElementById('editId').value;
          const name = document.getElementById('editName').value;
          const plan = document.getElementById('editPlan').value;
          const dueDate = document.getElementById('editDueDate').value;
          const amount = parseFloat(document.getElementById('editAmount').value);
          const status = document.getElementById('editStatus').value;

          if (!name || !plan || !dueDate || isNaN(amount)) {
            alert('Paki-punuan ang lahat ng fields nang tama.');
            return;
          }

          await fetch('/api/invoices/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, plan, dueDate, amount, status })
          });

          closeEditModal();
          loadData();
        }

        async function deleteCustomer(id) {
          if (confirm('Sigurado ka bang gusto mong burahin ang customer na ito?')) {
            await fetch('/api/invoices/' + id, { method: 'DELETE' });
            loadData();
          }
        }

        async function openAdminModal() {
          document.getElementById('adminModal').classList.remove('hidden');
          loadAdminsList();
        }

        function closeAdminModal() {
          document.getElementById('adminModal').classList.add('hidden');
        }

        async function loadAdminsList() {
          const res = await fetch('/api/admins');
          const admins = await res.json();
          const listDiv = document.getElementById('adminList');
          listDiv.innerHTML = '';
          admins.forEach(a => {
            const div = document.createElement('div');
            div.className = 'p-2 flex justify-between items-center text-xs';
            div.innerHTML = \`<span>👤 \${a.username}</span> \${admins.length > 1 ? '<button onclick="deleteAdmin(' + a.id + ')" class="text-red-600 hover:underline">Delete</button>' : '<span class="text-gray-400 italic">Default</span>'}\`;
            listDiv.appendChild(div);
          });
        }

        async function createAdmin() {
          const username = document.getElementById('newAdminUser').value;
          const password = document.getElementById('newAdminPass').value;
          if (!username || !password) {
            alert('Ilagay ang username at password.');
            return;
          }
          const res = await fetch('/api/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          if (res.ok) {
            document.getElementById('newAdminUser').value = '';
            document.getElementById('newAdminPass').value = '';
            loadAdminsList();
            alert('Tagumpay na nakagawa ng bagong admin!');
          } else {
            const err = await res.json();
            alert(err.error || 'May problema.');
          }
        }

        async function deleteAdmin(id) {
          if (confirm('Siguradong gusto mong burahin ang admin na ito?')) {
            await fetch('/api/admins/' + id, { method: 'DELETE' });
            loadAdminsList();
          }
        }

        loadData();
      </script>
    </body>
    </html>
  `);
});

// ================= ADMIN API ENDPOINTS =================
app.get('/api/admins', (req, res) => {
  res.json(getAdmins());
});

app.post('/api/admins', (req, res) => {
  const { username, password } = req.body;
  const admins = getAdmins();
  if (admins.some(a => a.username === username)) {
    return res.status(400).json({ error: 'Mayroon nang ganyang username.' });
  }
  const newAdmin = {
    id: admins.length > 0 ? admins[admins.length - 1].id + 1 : 1,
    username,
    password
  };
  admins.push(newAdmin);
  saveAdmins(admins);
  res.json(newAdmin);
});

app.delete('/api/admins/:id', (req, res) => {
  let admins = getAdmins();
  if (admins.length <= 1) {
    return res.status(400).json({ error: 'Hindi maaaring burahin ang nag-iisang admin.' });
  }
  admins = admins.filter(a => a.id != req.params.id);
  saveAdmins(admins);
  res.json({ success: true });
});

// ================= INVOICES CRUD API =================
app.get('/api/invoices', (req, res) => {
  res.json(getDB());
});

app.post('/api/invoices', (req, res) => {
  const db = getDB();
  const customId = req.body.id ? req.body.id.trim() : null;

  if (customId && db.some(inv => inv.id.toString() === customId)) {
    return res.status(400).json({ error: "Mayroon nang ganyang Customer ID." });
  }

  const generatedId = db.length > 0 ? (typeof db[db.length - 1].id === 'number' ? db[db.length - 1].id + 1 : db.length + 1) : 1;
  const finalId = customId ? (isNaN(customId) ? customId : Number(customId)) : generatedId;

  const newItem = {
    id: finalId,
    name: req.body.name,
    plan: req.body.plan,
    amount: req.body.amount,
    status: "unpaid",
    dueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]
  };
  db.push(newItem);
  saveDB(db);
  res.json(newItem);
});

app.put('/api/invoices/:id/pay', (req, res) => {
  const db = getDB();
  const item = db.find(inv => inv.id == req.params.id);
  if (!item) return res.status(404).json({ error: "Hindi nahanap ang record" });
  item.status = "paid";
  saveDB(db);
  res.json(item);
});

app.put('/api/invoices/:id', (req, res) => {
  const db = getDB();
  const item = db.find(inv => inv.id == req.params.id);
  if (!item) return res.status(404).json({ error: "Hindi nahanap ang record" });
  
  item.name = req.body.name || item.name;
  item.plan = req.body.plan || item.plan;
  item.dueDate = req.body.dueDate || item.dueDate;
  item.amount = req.body.amount !== undefined ? req.body.amount : item.amount;
  item.status = req.body.status || item.status;
  
  saveDB(db);
  res.json(item);
});

app.delete('/api/invoices/:id', (req, res) => {
  let db = getDB();
  const index = db.findIndex(inv => inv.id == req.params.id);
  if (index === -1) return res.status(404).json({ error: "Hindi nahanap ang record" });
  
  const deleted = db.splice(index, 1);
  saveDB(db);
  res.json(deleted[0]);
});

// ================= EXCEL EXPORT ROUTE =================
app.get('/api/export-excel', async (req, res) => {
  const db = getDB();
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RTECH Computer Center';
  const sheet = workbook.addWorksheet('Billing Report');

  sheet.properties.defaultRowHeight = 22;

  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'RTECH INTERNET BILLING & PAYMENT REPORT';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'center' };
  sheet.getRow(1).height = 35;

  sheet.addRow([]);

  const headerRow = sheet.addRow(['Customer ID', 'Customer Name', 'Plan', 'Due Date', 'Amount', 'Status']);
  headerRow.height = 25;
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'CCCCCC' } },
      left: { style: 'thin', color: { argb: 'CCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
      right: { style: 'thin', color: { argb: 'CCCCCC' } }
    };
  });

  let totalPaid = 0;
  let totalUnpaid = 0;

  db.forEach((item, index) => {
    if (item.status === 'paid') totalPaid += item.amount;
    else if (item.status === 'unpaid') totalUnpaid += item.amount;

    const row = sheet.addRow([
      item.id,
      item.name,
      item.plan,
      item.dueDate,
      item.amount,
      item.status.toUpperCase()
    ]);

    row.font = { name: 'Arial', size: 10 };
    
    const isEven = index % 2 === 0;
    const rowBgColor = isEven ? 'F9FAFB' : 'FFFFFF';

    row.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'E5E7EB' } },
        left: { style: 'thin', color: { argb: 'E5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
        right: { style: 'thin', color: { argb: 'E5E7EB' } }
      };

      if (colNumber === 1) cell.alignment = { horizontal: 'center' };
      if (colNumber === 4) cell.alignment = { horizontal: 'center' };
      if (colNumber === 5) {
        cell.numFmt = '"₱"#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
      if (colNumber === 6) {
        cell.alignment = { horizontal: 'center' };
        let colorCode = '047857';
        if (item.status === 'unpaid') colorCode = 'B91C1C';
        else if (item.status === 'disconnected') colorCode = 'B45309';
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: colorCode } };
      }
    });
  });

  sheet.addRow([]);

  const paidRow = sheet.addRow(['', '', '', 'TOTAL PAID', totalPaid, '']);
  paidRow.font = { name: 'Arial', size: 10, bold: true };
  paidRow.getCell(4).alignment = { horizontal: 'right' };
  paidRow.getCell(5).numFmt = '"₱"#,##0.00';
  paidRow.getCell(5).font = { name: 'Arial', size: 10, bold: true, color: { argb: '047857' } };

  const unpaidRow = sheet.addRow(['', '', '', 'TOTAL UNPAID', totalUnpaid, '']);
  unpaidRow.font = { name: 'Arial', size: 10, bold: true };
  unpaidRow.getCell(4).alignment = { horizontal: 'right' };
  unpaidRow.getCell(5).numFmt = '"₱"#,##0.00';
  unpaidRow.getCell(5).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'B91C1C' } };

  sheet.columns.forEach(column => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, cell => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = maxLength + 5;
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=rtech_billing_report.xlsx');

  await workbook.xlsx.write(res);
  res.end();
});

app.listen(PORT, () => {
  console.log("RTECH Billing Server ay tumatakbo sa http://localhost:" + PORT);
});
