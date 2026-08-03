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
  const initialData = [];
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  console.log('📁 Gumawa ng bagong database.json dahil wala pa ito.');
} else {
  console.log('✅ Nahanap ang umiiral na database.json. Hindi ito ginalaw.');
}

// Awtomatikong gagawa ng database para sa Admins kung wala pa (Default: admin / admin123)
if (!fs.existsSync(ADMIN_FILE)) {
  const initialAdmins = [
    { id: 1, username: "admin", password: "admin123" }
  ];
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(initialAdmins, null, 2));
}

// Helper functions
const getDB = () => {
  let db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  let updated = false;
  const today = new Date();

  db.forEach(item => {
    const due = new Date(item.dueDate);
    if (today.getFullYear() > due.getFullYear() || 
       (today.getFullYear() === due.getFullYear() && today.getMonth() > due.getMonth())) {
      
      if (item.status === 'paid') {
        item.previousBalance = 0;
        item.previousBalanceMonths = 0;
        item.status = 'unpaid';
      } else if (item.status === 'unpaid' || item.status === 'reconnected') {
        item.previousBalance = (item.previousBalance || 0) + item.amount;
        item.previousBalanceMonths = (item.previousBalanceMonths || 0) + 1;
        item.status = 'unpaid';
      }

      due.setMonth(due.getMonth() + 1);
      item.dueDate = due.toISOString().split('T')[0];
      updated = true;
    }
  });

  if (updated) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
  return db;
};

const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
const getAdmins = () => JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
const saveAdmins = (data) => fs.writeFileSync(ADMIN_FILE, JSON.stringify(data, null, 2));

// ================= LOGIN PAGE (ADMIN) =================
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
          <div class="bg-white p-2 rounded-full w-28 h-28 mx-auto mb-3 flex items-center justify-center border-2 border-blue-500 shadow-lg overflow-hidden">
            <img src="/logo.png" alt="Logo" class="w-full h-full object-contain rounded-full">
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
            Login as Admin
          </button>
        </form>

        <div class="mt-6 text-center border-t border-white/10 pt-4">
          <a href="/customer" class="text-xs text-blue-400 hover:underline">🔍 Customer Portal (Tingnan ang Bill gamit ang ID)</a>
        </div>
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

// ================= CUSTOMER PORTAL =================
app.get('/customer', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tl">
    <head>
      <meta charset="UTF-8">
      <title>Customer Portal - RTECH Billing</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gradient-to-br from-blue-950 via-gray-900 to-black min-h-screen flex items-center justify-center p-4 font-sans">
      <div class="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-lg w-full shadow-2xl text-white">
        <div class="text-center mb-6">
          <div class="bg-white p-2 rounded-full w-20 h-20 mx-auto mb-3 flex items-center justify-center border-2 border-blue-500 shadow-lg overflow-hidden">
            <img src="/logo.png" alt="Logo" class="w-full h-full object-contain rounded-full">
          </div>
          <h1 class="text-xl font-bold tracking-wide">Customer Billing Portal</h1>
          <p class="text-xs text-gray-300 mt-1">Ilagay ang iyong Customer ID para makita ang iyong account status.</p>
        </div>

        <div class="flex gap-2 mb-6">
          <input type="text" id="customerId" placeholder="Halimbawa: 1 o CUST-01" class="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white">
          <button onclick="checkBill()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition shadow-lg">Tingnan</button>
        </div>

        <div id="reminderBox" class="hidden text-xs p-3 rounded mb-4 text-center font-medium shadow"></div>

        <div id="resultArea" class="hidden bg-black/40 border border-gray-700 rounded-xl p-5 space-y-3 text-sm">
          <div class="flex justify-between border-b border-gray-700 pb-2">
            <span class="text-gray-400">Customer ID:</span>
            <span id="resId" class="font-mono font-bold text-blue-400"></span>
          </div>
          <div class="flex justify-between border-b border-gray-700 pb-2">
            <span class="text-gray-400">Pangalan:</span>
            <span id="resName" class="font-semibold"></span>
          </div>
          <div class="flex justify-between border-b border-gray-700 pb-2">
            <span class="text-gray-400">Address:</span>
            <span id="resAddress" class="text-gray-200"></span>
          </div>
          <div class="flex justify-between border-b border-gray-700 pb-2">
            <span class="text-gray-400">Internet Plan:</span>
            <span id="resPlan"></span>
          </div>
          <div class="flex justify-between border-b border-gray-700 pb-2">
            <span class="text-gray-400">Due Date:</span>
            <span id="resDueDate"></span>
          </div>
          <div class="flex justify-between border-b border-gray-700 pb-2">
            <span class="text-gray-400">Monthly Plan Amount:</span>
            <span id="resAmount"></span>
          </div>
          <div class="flex justify-between border-b border-gray-700 pb-2">
            <span class="text-gray-400">Previous Balance (Utang):</span>
            <span id="resPrevBalance" class="text-red-400 font-semibold"></span>
          </div>
          <div class="flex justify-between border-b border-gray-700 pb-2 bg-white/5 p-2 rounded">
            <span class="text-gray-200 font-bold">Total Amount Due:</span>
            <span id="resTotalDue" class="font-bold text-emerald-400 text-base"></span>
          </div>
          <div class="flex justify-between items-center pt-1">
            <span class="text-gray-400">Status:</span>
            <span id="resStatus" class="px-3 py-1 text-xs rounded-full font-bold uppercase"></span>
          </div>
        </div>

        <div id="errorMsg" class="hidden bg-red-500/20 border border-red-500 text-red-200 text-xs p-3 rounded mb-4 text-center"></div>

        <div class="mt-6 text-center border-t border-white/10 pt-4">
          <a href="/" class="text-xs text-gray-300 hover:underline">← Bumalik sa Admin Login</a>
        </div>
      </div>

      <script>
        async function checkBill() {
          const id = document.getElementById('customerId').value.trim();
          const errDiv = document.getElementById('errorMsg');
          const resultArea = document.getElementById('resultArea');
          const reminderBox = document.getElementById('reminderBox');

          if (!id) {
            errDiv.textContent = 'Mangyaring maglagay ng Customer ID.';
            errDiv.classList.remove('hidden');
            resultArea.classList.add('hidden');
            reminderBox.classList.add('hidden');
            return;
          }

          const res = await fetch('/api/customer/' + encodeURIComponent(id));
          const data = await res.json();

          if (res.ok) {
            errDiv.classList.add('hidden');
            document.getElementById('resId').textContent = data.id;
            document.getElementById('resName').textContent = data.name;
            document.getElementById('resAddress').textContent = data.address || 'Walang address';
            document.getElementById('resPlan').textContent = data.plan;
            document.getElementById('resDueDate').textContent = data.dueDate;
            document.getElementById('resAmount').textContent = '₱' + data.amount.toFixed(2);
            
            const prevMos = data.previousBalanceMonths || 0;
            document.getElementById('resPrevBalance').textContent = '₱' + (data.previousBalance || 0).toFixed(2) + ' (' + prevMos + ' buwan)';
            
            const totalDue = data.amount + (data.previousBalance || 0);
            document.getElementById('resTotalDue').textContent = '₱' + totalDue.toFixed(2);
            
            const statusEl = document.getElementById('resStatus');
            statusEl.textContent = data.status === 'pullout' ? 'PULL OUT' : data.status;
            statusEl.className = 'px-3 py-1 text-xs rounded-full font-bold uppercase ';
            
            if (data.status === 'paid') {
              statusEl.className += 'bg-green-500/20 text-green-400 border border-green-500';
            } else if (data.status === 'unpaid') {
              statusEl.className += 'bg-red-500/20 text-red-400 border border-red-500';
            } else if (data.status === 'reconnected') {
              statusEl.className += 'bg-blue-500/20 text-blue-400 border border-blue-500';
            } else if (data.status === 'pullout') {
              statusEl.className += 'bg-purple-500/20 text-purple-400 border border-purple-500';
            } else {
              statusEl.className += 'bg-yellow-500/20 text-yellow-400 border border-yellow-500';
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const due = new Date(data.dueDate);
            due.setHours(0, 0, 0, 0);
            const diffTime = due - today;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (data.status !== 'paid') {
              if (diffDays === 0) {
                reminderBox.textContent = '🚨 BABALA: Ngayon na ang iyong Due Date! Mangyaring bayaran na ang kabuuang halaga.';
                reminderBox.className = 'bg-red-500/30 border border-red-500 text-red-200 text-xs p-3 rounded mb-4 text-center font-bold shadow';
                reminderBox.classList.remove('hidden');
              } else if (diffDays > 0 && diffDays <= 3) {
                reminderBox.textContent = \`⚠️ Paalala: Mayroon nalang \${diffDays} araw bago ang iyong due date (\${data.dueDate}).\`;
                reminderBox.className = 'bg-yellow-500/20 border border-yellow-500 text-yellow-200 text-xs p-3 rounded mb-4 text-center font-medium shadow';
                reminderBox.classList.remove('hidden');
              } else if (diffDays < 0) {
                reminderBox.textContent = \`❌ OVERDUE: Lumipas na ang iyong due date noong \${data.dueDate}.\`;
                reminderBox.className = 'bg-red-500/30 border border-red-500 text-red-200 text-xs p-3 rounded mb-4 text-center font-bold shadow';
                reminderBox.classList.remove('hidden');
              } else {
                reminderBox.classList.add('hidden');
              }
            } else {
              reminderBox.classList.add('hidden');
            }

            resultArea.classList.remove('hidden');
          } else {
            errDiv.textContent = data.error || 'Hindi nahanap ang Customer ID na ito.';
            errDiv.classList.remove('hidden');
            resultArea.classList.add('hidden');
            reminderBox.classList.add('hidden');
          }
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/api/customer/:id', (req, res) => {
  const db = getDB();
  const customer = db.find(inv => inv.id.toString() === req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Walang nahanap na record para sa Customer ID na ito.' });
  }
  res.json(customer);
});

// ================= ADMIN DASHBOARD =================
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

      <div class="max-w-7xl mx-auto bg-white rounded-lg shadow p-6">
        <div class="flex flex-col md:flex-row justify-between items-center mb-6 border-b pb-4 gap-4">
          <div class="flex items-center gap-3">
            <div class="bg-white p-1.5 rounded-full w-16 h-16 flex items-center justify-center border border-blue-500 shadow overflow-hidden">
              <img src="/logo.png" alt="Logo" class="w-full h-full object-contain rounded-full">
            </div>
            <div>
              <h1 class="text-2xl font-bold text-gray-800">Internet Billing & Payment Tracker</h1>
              <p class="text-xs text-gray-500">RTECH Computer Center Management</p>
            </div>
          </div>

          <!-- EXPORT BUTTONS & CONTROL SECTION -->
          <div class="flex items-center gap-2 flex-wrap">
            <a href="/api/export-excel?collector=jefford" class="bg-emerald-600 text-white px-3 py-2 rounded text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1 no-underline shadow">
              📊 Export Jefford (30th)
            </a>
            <a href="/api/export-excel?collector=jake" class="bg-indigo-600 text-white px-3 py-2 rounded text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1 no-underline shadow">
              📊 Export Jake (15th)
            </a>
            <a href="/api/export-excel" class="bg-gray-600 text-white px-2.5 py-2 rounded text-xs font-medium hover:bg-gray-700 flex items-center gap-1 no-underline shadow">
              📊 Export All
            </a>
            <button onclick="openAdminModal()" class="bg-gray-800 text-white px-3 py-2 rounded text-xs font-medium hover:bg-gray-900 shadow">
              ⚙️ Manage Admins
            </button>
            <button onclick="logout()" class="bg-red-600 text-white px-3 py-2 rounded text-xs font-medium hover:bg-red-700 shadow">
              Logout
            </button>
          </div>
        </div>
        
        <div id="summary" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"></div>

        <!-- Controls, Search & Add Form -->
        <div class="flex flex-col lg:flex-row justify-between items-center gap-4 mb-6 border-b pb-4">
          <div class="flex flex-wrap items-center gap-2">
            <div class="space-x-1 flex flex-wrap gap-1">
              <button onclick="filterStatus('all')" class="px-3 py-1 bg-gray-200 rounded text-sm font-medium hover:bg-gray-300">All</button>
              <button onclick="filterStatus('paid')" class="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200">Paid</button>
              <button onclick="filterStatus('unpaid')" class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200">Unpaid</button>
              <button onclick="filterStatus('disconnected')" class="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-medium hover:bg-yellow-200">Disconnected</button>
              <button onclick="filterStatus('reconnected')" class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200">Reconnected</button>
              <button onclick="filterStatus('pullout')" class="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium hover:bg-purple-200">Pull Out</button>
            </div>
            
            <div class="flex items-center gap-1 ml-2">
              <input type="text" id="searchInput" placeholder="Search customer..." class="border px-3 py-1 rounded text-sm focus:outline-none focus:border-blue-500" onkeypress="handleSearchKey(event)">
              <button onclick="searchCustomer()" class="bg-gray-700 text-white px-3 py-1 rounded text-sm hover:bg-gray-800 font-medium shadow">🔍 Search</button>
            </div>
          </div>

          <!-- Add Customer Form -->
          <div class="flex flex-wrap gap-2 items-center">
            <input type="text" id="newId" placeholder="ID (Auto)" class="border px-2 py-1 rounded text-sm w-20">
            <input type="text" id="newName" placeholder="Pangalan" class="border px-2 py-1 rounded text-sm w-28">
            
            <!-- ADDRESS DROPDOWN -->
            <select id="newAddress" class="border px-2 py-1 rounded text-sm bg-white">
              <option value="">-- Address --</option>
              <option value="SAN AGUSTIN">SAN AGUSTIN</option>
              <option value="LIBERTAD">LIBERTAD</option>
              <option value="BANGUIAN">BANGUIAN</option>
              <option value="DUGO">DUGO</option>
              <option value="ALINUNU">ALINUNU</option>
              <option value="SAN ISIDRO">SAN ISIDRO</option>
              <option value="AYAGA">AYAGA</option>
              <option value="STA ROSA">STA ROSA</option>
              <option value="MAQUIRIT">MAQUIRIT</option>
              <option value="PINARON">PINARON</option>
              <option value="LUCBAN">LUCBAN</option>
              <option value="GUIDDAM">GUIDDAM</option>
              <option value="BANNAG">BANNAG</option>
              <option value="MACUGAY">MACUGAY</option>
              <option value="BUNNONG">BUNNONG</option>
              <option value="BATAL">BATAL</option>
            </select>

            <!-- PLAN DROPDOWN (SPEED) -->
            <select id="newPlan" class="border px-2 py-1 rounded text-sm bg-white">
              <option value="">-- Plan --</option>
              <option value="50Mbps">50Mbps</option>
              <option value="75Mbps">75Mbps</option>
              <option value="100Mbps">100Mbps</option>
            </select>

            <!-- MONTHLY DROPDOWN (AMOUNT) -->
            <select id="newAmount" class="border px-2 py-1 rounded text-sm bg-white">
              <option value="">-- Monthly --</option>
              <option value="800">₱800</option>
              <option value="1000">₱1000</option>
              <option value="1200">₱1200</option>
              <option value="1500">₱1500</option>
              <option value="2000">₱2000</option>
            </select>

            <input type="date" id="newDueDate" class="border px-2 py-1 rounded text-sm w-36">
            <button onclick="addSubscriber()" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 font-medium shadow">Add Customer</button>
          </div>
        </div>

        <!-- Data Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 border-b text-gray-600 text-xs uppercase">
                <th class="p-3">ID</th>
                <th class="p-3">Customer Name</th>
                <th class="p-3">Address</th>
                <th class="p-3">Plan</th>
                <th class="p-3">Due Date</th>
                <th class="p-3">Monthly</th>
                <th class="p-3">Prev. Balance</th>
                <th class="p-3">Prev. Mos</th>
                <th class="p-3">Total Due</th>
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
          
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Customer Name</label>
              <input type="text" id="editName" class="w-full border px-3 py-1.5 rounded text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Address</label>
              <select id="editAddress" class="w-full border px-3 py-1.5 rounded text-sm bg-white">
                <option value="">-- Pumili ng Address --</option>
                <option value="SAN AGUSTIN">SAN AGUSTIN</option>
                <option value="LIBERTAD">LIBERTAD</option>
                <option value="BANGUIAN">BANGUIAN</option>
                <option value="DUGO">DUGO</option>
                <option value="ALINUNU">ALINUNU</option>
                <option value="SAN ISIDRO">SAN ISIDRO</option>
                <option value="AYAGA">AYAGA</option>
                <option value="STA ROSA">STA ROSA</option>
                <option value="MAQUIRIT">MAQUIRIT</option>
                <option value="PINARON">PINARON</option>
                <option value="LUCBAN">LUCBAN</option>
                <option value="GUIDDAM">GUIDDAM</option>
                <option value="BANNAG">BANNAG</option>
                <option value="MACUGAY">MACUGAY</option>
                <option value="BUNNONG">BUNNONG</option>
                <option value="BATAL">BATAL</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Plan</label>
              <select id="editPlan" class="w-full border px-3 py-1.5 rounded text-sm bg-white">
                <option value="">-- Pumili ng Plan --</option>
                <option value="50Mbps">50Mbps</option>
                <option value="75Mbps">75Mbps</option>
                <option value="100Mbps">100Mbps</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Monthly Amount</label>
              <select id="editAmount" class="w-full border px-3 py-1.5 rounded text-sm bg-white">
                <option value="">-- Pumili ng Monthly --</option>
                <option value="800">₱800</option>
                <option value="1000">₱1000</option>
                <option value="1200">₱1200</option>
                <option value="1500">₱1500</option>
                <option value="2000">₱2000</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Due Date</label>
              <input type="date" id="editDueDate" class="w-full border px-3 py-1.5 rounded text-sm">
            </div>
            
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Prev. Balance (₱)</label>
                <input type="number" id="editPrevBalance" class="w-full border px-3 py-1.5 rounded text-sm">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Prev. Mos (Buwan)</label>
                <input type="number" id="editPrevBalanceMonths" class="w-full border px-3 py-1.5 rounded text-sm" placeholder="e.g. 1, 2">
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Status</label>
              <select id="editStatus" class="w-full border px-3 py-1.5 rounded text-sm bg-white font-semibold">
                <option value="paid">PAID</option>
                <option value="unpaid">UNPAID</option>
                <option value="disconnected">DISCONNECTED</option>
                <option value="reconnected">RECONNECTED</option>
                <option value="pullout">PULL OUT</option>
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
          
          const totalPaidAmount = data.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount + (d.previousBalance || 0), 0);
          const totalUnpaidAmount = data.filter(d => d.status === 'unpaid').reduce((sum, d) => sum + d.amount + (d.previousBalance || 0), 0);

          document.getElementById('summary').innerHTML = \`
            <div class="p-4 bg-gray-50 rounded border-l-4 border-blue-500 shadow-sm">
              <div class="text-gray-500 text-xs font-medium">Total Subscribers</div>
              <div class="text-xl font-bold">\${total}</div>
            </div>
            <div class="p-4 bg-gray-50 rounded border-l-4 border-green-500 shadow-sm">
              <div class="text-gray-500 text-xs font-medium">Paid (Total Collected)</div>
              <div class="text-xl font-bold text-green-600">₱\${totalPaidAmount.toFixed(2)}</div>
            </div>
            <div class="p-4 bg-gray-50 rounded border-l-4 border-red-500 shadow-sm">
              <div class="text-gray-500 text-xs font-medium">Unpaid (Total Receivables)</div>
              <div class="text-xl font-bold text-red-600">₱\${totalUnpaidAmount.toFixed(2)}</div>
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
                                  (item.address && item.address.toLowerCase().includes(searchQuery)) ||
                                  item.plan.toString().toLowerCase().includes(searchQuery) || 
                                  item.id.toString().includes(searchQuery);
            return matchesStatus && matchesSearch;
          });
          
          if (filtered.length === 0) {
            tbody.innerHTML = \`<tr><td colspan="11" class="p-4 text-center text-gray-400">Walang nakitang record.</td></tr>\`;
            return;
          }

          filtered.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'border-b hover:bg-gray-50';
            
            let statusBadgeClass = 'bg-gray-100 text-gray-700';
            if (item.status === 'paid') statusBadgeClass = 'bg-green-100 text-green-700';
            else if (item.status === 'unpaid') statusBadgeClass = 'bg-red-100 text-red-700';
            else if (item.status === 'disconnected') statusBadgeClass = 'bg-yellow-100 text-yellow-800';
            else if (item.status === 'reconnected') statusBadgeClass = 'bg-blue-100 text-blue-700';
            else if (item.status === 'pullout') statusBadgeClass = 'bg-purple-100 text-purple-800';

            const totalDue = item.amount + (item.previousBalance || 0);
            const prevMos = item.previousBalanceMonths || 0;

            tr.innerHTML = \`
              <td class="p-3 text-gray-600 font-mono">\${item.id}</td>
              <td class="p-3 font-medium text-gray-800">\${item.name}</td>
              <td class="p-3 text-gray-600">\${item.address || ''}</td>
              <td class="p-3 text-gray-600">\${item.plan}</td>
              <td class="p-3 text-gray-600">\${item.dueDate}</td>
              <td class="p-3 text-gray-800">₱\${item.amount.toFixed(2)}</td>
              <td class="p-3 text-red-600 font-medium">₱\${(item.previousBalance || 0).toFixed(2)}</td>
              <td class="p-3 text-gray-600 font-medium">\${prevMos} mos</td>
              <td class="p-3 text-emerald-600 font-bold">₱\${totalDue.toFixed(2)}</td>
              <td class="p-3">
                <span class="px-2.5 py-1 text-xs rounded-full font-semibold \${statusBadgeClass}">
                  \${item.status === 'pullout' ? 'PULL OUT' : item.status.toUpperCase()}
                </span>
              </td>
              <td class="p-3 flex items-center gap-2">
                \${item.status !== 'paid' ? \`<button onclick="markPaid('\${item.id}')" class="text-green-600 hover:underline font-medium text-xs">Mark Paid</button>\` : ''}
                <button onclick="openEditModal('\${item.id}', '\${item.name}', '\${item.address || ''}', '\${item.plan}', '\${item.dueDate}', \${item.amount}, \${item.previousBalance || 0}, \${prevMos}, '\${item.status}')" class="text-blue-600 hover:underline font-medium text-xs">Edit</button>
                <button onclick="deleteCustomer('\${item.id}')" class="text-red-600 hover:underline font-medium text-xs">Delete</button>
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
          const address = document.getElementById('newAddress').value;
          const plan = document.getElementById('newPlan').value;
          const amount = parseFloat(document.getElementById('newAmount').value);
          const dueDate = document.getElementById('newDueDate').value;

          if (!name || !address || !plan || isNaN(amount)) {
            alert('Paki-punuan ang Pangalan, Address, Plan, at Monthly Amount nang tama.');
            return;
          }

          const res = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: idInput, name, address, plan, amount, dueDate })
          });

          if (res.ok) {
            document.getElementById('newId').value = '';
            document.getElementById('newName').value = '';
            document.getElementById('newAddress').value = '';
            document.getElementById('newPlan').value = '';
            document.getElementById('newAmount').value = '';
            document.getElementById('newDueDate').value = '';
            loadData();
          } else {
            const err = await res.json();
            alert(err.error || 'May problemang naganap.');
          }
        }

        function openEditModal(id, name, address, plan, dueDate, amount, previousBalance, previousBalanceMonths, status) {
          document.getElementById('editId').value = id;
          document.getElementById('editName').value = name;
          document.getElementById('editAddress').value = address;
          document.getElementById('editPlan').value = plan;
          document.getElementById('editDueDate').value = dueDate;
          document.getElementById('editAmount').value = amount;
          document.getElementById('editPrevBalance').value = previousBalance;
          document.getElementById('editPrevBalanceMonths').value = previousBalanceMonths || 0;
          document.getElementById('editStatus').value = status;
          document.getElementById('editModal').classList.remove('hidden');
        }

        function closeEditModal() {
          document.getElementById('editModal').classList.add('hidden');
        }

        async function saveEditedCustomer() {
          const id = document.getElementById('editId').value;
          const name = document.getElementById('editName').value;
          const address = document.getElementById('editAddress').value;
          const plan = document.getElementById('editPlan').value;
          const dueDate = document.getElementById('editDueDate').value;
          const amount = parseFloat(document.getElementById('editAmount').value);
          const previousBalance = parseFloat(document.getElementById('editPrevBalance').value);
          const previousBalanceMonths = parseInt(document.getElementById('editPrevBalanceMonths').value, 10);
          const status = document.getElementById('editStatus').value;

          if (!name || !address || !plan || !dueDate || isNaN(amount) || isNaN(previousBalance)) {
            alert('Paki-punuan ang lahat ng fields nang tama.');
            return;
          }

          await fetch('/api/invoices/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, address, plan, dueDate, amount, previousBalance, previousBalanceMonths, status })
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

  const defaultDueDate = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];

  const newItem = {
    id: finalId,
    name: req.body.name,
    address: req.body.address || "",
    plan: req.body.plan,
    amount: parseFloat(req.body.amount),
    previousBalance: 0.00,
    previousBalanceMonths: 0,
    status: "unpaid",
    dueDate: req.body.dueDate || defaultDueDate
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
  item.previousBalance = 0.00;
  item.previousBalanceMonths = 0;
  saveDB(db);
  res.json(item);
});

app.put('/api/invoices/:id', (req, res) => {
  const db = getDB();
  const item = db.find(inv => inv.id == req.params.id);
  if (!item) return res.status(404).json({ error: "Hindi nahanap ang record" });
  
  item.name = req.body.name || item.name;
  item.address = req.body.address !== undefined ? req.body.address : item.address;
  item.plan = req.body.plan || item.plan;
  item.dueDate = req.body.dueDate || item.dueDate;
  item.amount = req.body.amount !== undefined ? parseFloat(req.body.amount) : item.amount;
  item.previousBalance = req.body.previousBalance !== undefined ? parseFloat(req.body.previousBalance) : (item.previousBalance || 0);
  item.previousBalanceMonths = req.body.previousBalanceMonths !== undefined ? parseInt(req.body.previousBalanceMonths, 10) : (item.previousBalanceMonths || 0);
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
  let db = getDB();
  const collector = req.query.collector;

  let reportTitle = 'RTECH INTERNET BILLING & PAYMENT REPORT';
  let exportFilename = 'rtech_billing_report.xlsx';

  if (collector === 'jefford') {
    db = db.filter(item => {
      if (!item.dueDate) return false;
      const day = parseInt(item.dueDate.split('-')[2], 10);
      return day === 30;
    });
    reportTitle = 'COLLECTION REPORT - JEFFORD (EVERY 30TH OF THE MONTH)';
    exportFilename = 'jefford_collection_30th.xlsx';
  } else if (collector === 'jake') {
    db = db.filter(item => {
      if (!item.dueDate) return false;
      const day = parseInt(item.dueDate.split('-')[2], 10);
      return day === 15;
    });
    reportTitle = 'COLLECTION REPORT - JAKE (EVERY 15TH OF THE MONTH)';
    exportFilename = 'jake_collection_15th.xlsx';
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RTECH Computer Center';
  const sheet = workbook.addWorksheet('Billing Report');

  sheet.properties.defaultRowHeight = 22;

  sheet.mergeCells('A1:J1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = reportTitle;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'center' };
  sheet.getRow(1).height = 35;

  sheet.addRow([]);

  const headerRow = sheet.addRow(['Customer ID', 'Customer Name', 'Address', 'Plan', 'Due Date', 'Monthly', 'Prev. Balance', 'Prev. Mos', 'Total Due', 'Status']);
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

  let totalCollected = 0;
  let totalReceivables = 0;

  db.forEach((item, index) => {
    const totalDue = item.amount + (item.previousBalance || 0);
    if (item.status === 'paid') totalCollected += totalDue;
    else if (item.status === 'unpaid') totalReceivables += totalDue;

    const row = sheet.addRow([
      item.id,
      item.name,
      item.address || '',
      item.plan,
      item.dueDate,
      item.amount,
      item.previousBalance || 0,
      (item.previousBalanceMonths || 0) + ' mos',
      totalDue,
      item.status === 'pullout' ? 'PULL OUT' : item.status.toUpperCase()
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

      if (colNumber === 1 || colNumber === 5 || colNumber === 8) cell.alignment = { horizontal: 'center' };
      if (colNumber === 6 || colNumber === 7 || colNumber === 9) {
        cell.numFmt = '"₱"#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
      if (colNumber === 10) {
        cell.alignment = { horizontal: 'center' };
        let colorCode = '047857';
        if (item.status === 'unpaid') colorCode = 'B91C1C';
        else if (item.status === 'disconnected') colorCode = 'B45309';
        else if (item.status === 'reconnected') colorCode = '1D4ED8';
        else if (item.status === 'pullout') colorCode = '6B21A8';
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: colorCode } };
      }
    });
  });

  sheet.addRow([]);

  const paidRow = sheet.addRow(['', '', '', '', '', '', '', 'TOTAL COLLECTED', totalCollected, '']);
  paidRow.font = { name: 'Arial', size: 10, bold: true };
  paidRow.getCell(8).alignment = { horizontal: 'right' };
  paidRow.getCell(9).numFmt = '"₱"#,##0.00';
  paidRow.getCell(9).font = { name: 'Arial', size: 10, bold: true, color: { argb: '047857' } };

  const unpaidRow = sheet.addRow(['', '', '', '', '', '', '', 'TOTAL RECEIVABLES', totalReceivables, '']);
  unpaidRow.font = { name: 'Arial', size: 10, bold: true };
  unpaidRow.getCell(8).alignment = { horizontal: 'right' };
  unpaidRow.getCell(9).numFmt = '"₱"#,##0.00';
  unpaidRow.getCell(9).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'B91C1C' } };

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
  res.setHeader('Content-Disposition', `attachment; filename=${exportFilename}`);

  await workbook.xlsx.write(res);
  res.end();
});

app.listen(PORT, () => {
  console.log("RTECH Billing Server ay tumatakbo sa http://localhost:" + PORT);
});
