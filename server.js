const express = require('express');
const path = require('path');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= SUPABASE CONFIGURATION =================[cite: 1]
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cytckucqmcyubwbhyhsx.supabase.co';[cite: 1]
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGNrdWNxbWN5dWJ3Ymh5aHN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTczODA0MiwiZXhwIjoyMTAxMzE0MDQyfQ.UdwBWO_XaSaFC2J2z-I7GB_5DEy__Q-lo-f_U_jNvnY';[cite: 1]
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);[cite: 1]

const ADMIN_FILE = path.join(__dirname, 'admins.json');[cite: 1]
const fs = require('fs');[cite: 1]

app.use(express.json());[cite: 1]
app.use(express.urlencoded({ extended: true }));[cite: 1]
app.use(express.static(__dirname));[cite: 1]

if (!fs.existsSync(ADMIN_FILE)) {[cite: 1]
  const initialAdmins = [{ id: 1, username: "admin", password: "admin123" }];[cite: 1]
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(initialAdmins, null, 2));[cite: 1]
}

const getAdmins = () => JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));[cite: 1]
const saveAdmins = (data) => fs.writeFileSync(ADMIN_FILE, JSON.stringify(data, null, 2));[cite: 1]

const getDB = async () => {[cite: 1]
  try {[cite: 1]
    const { data, error } = await supabase.from('invoices').select('*').order('id', { ascending: true });[cite: 1]
    if (error) throw error;[cite: 1]
    let db = data || [];[cite: 1]
    
    // Sinisigurong naka-ascending order ang mga ID (gumagana sa numero at alphanumeric)[cite: 1]
    db.sort((a, b) => {[cite: 1]
      let idA = a.id;[cite: 1]
      let idB = b.id;[cite: 1]
      let numA = Number(idA);[cite: 1]
      let numB = Number(idB);[cite: 1]
      if (!isNaN(numA) && !isNaN(numB)) {[cite: 1]
        return numA - numB;[cite: 1]
      }[cite: 1]
      return String(idA).localeCompare(String(idB), undefined, { numeric: true, sensitivity: 'base' });[cite: 1]
    });[cite: 1]
    
    let updated = false;[cite: 1]
    const today = new Date();[cite: 1]

    for (let item of db) {[cite: 1]
      if (!item || !item.dueDate) continue;[cite: 1]
      const due = new Date(item.dueDate);[cite: 1]
      if (isNaN(due.getTime())) continue;[cite: 1]

      if (today.getFullYear() > due.getFullYear() || [cite: 1]
         (today.getFullYear() === due.getFullYear() && today.getMonth() > due.getMonth())) {[cite: 1]
        
        let newStatus = item.status;[cite: 1]
        let newPrevBalance = Number(item.previousBalance) || 0;[cite: 1]
        let newPrevMonths = Number(item.previousBalanceMonths) || 0;[cite: 1]

        if (item.status === 'paid') {[cite: 1]
          newPrevBalance = 0;[cite: 1]
          newPrevMonths = 0;[cite: 1]
          newStatus = 'unpaid';[cite: 1]
        } else if (item.status === 'unpaid' || item.status === 'reconnected') {[cite: 1]
          newPrevBalance = newPrevBalance + (Number(item.amount) || 0);[cite: 1]
          newPrevMonths = newPrevMonths + 1;[cite: 1]
          newStatus = 'unpaid';[cite: 1]
        }

        due.setMonth(due.getMonth() + 1);[cite: 1]
        const newDueDate = due.toISOString().split('T')[0];[cite: 1]

        await supabase.from('invoices').update({[cite: 1]
          status: newStatus,[cite: 1]
          previousBalance: newPrevBalance,[cite: 1]
          previousBalanceMonths: newPrevMonths,[cite: 1]
          dueDate: newDueDate[cite: 1]
        }).eq('id', item.id);[cite: 1]

        item.status = newStatus;[cite: 1]
        item.previousBalance = newPrevBalance;[cite: 1]
        item.previousBalanceMonths = newPrevMonths;[cite: 1]
        item.dueDate = newDueDate;[cite: 1]
        updated = true;[cite: 1]
      }
    }
    return db;[cite: 1]
  } catch (err) {[cite: 1]
    console.error("Error sa pagbasa ng DB mula Supabase:", err);[cite: 1]
    return [];[cite: 1]
  }
};

// ================= LOGIN PAGE =================[cite: 1]
app.get('/', (req, res) => {[cite: 1]
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
            <img src="/logo.png" alt="Logo" class="w-full h-full object-contain rounded-full" onerror="this.src='https://via.placeholder.com/100?text=RTECH'">
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

          try {
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
          } catch (err) {
            errDiv.textContent = 'Hindi makakonekta sa server.';
            errDiv.classList.remove('hidden');
          }
        }
      </script>
    </body>
    </html>
  `);
});

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

// ================= CUSTOMER PORTAL =================[cite: 1]
app.get('/customer', (req, res) => {[cite: 1]
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
            <img src="/logo.png" alt="Logo" class="w-full h-full object-contain rounded-full" onerror="this.src='https://via.placeholder.com/100?text=RTECH'">
          </div>
          <h1 class="text-xl font-bold tracking-wide">Customer Billing Portal</h1>
          <p class="text-xs text-gray-300 mt-1">Ilagay ang iyong Customer ID para makita ang iyong account status.</p>
        </div>

        <div class="flex gap-2 mb-6">
          <input type="text" id="customerId" placeholder="Halimbawa: 1 o CUST-01" class="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white">
          <button onclick="checkBill()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition shadow-lg">Tingnan</button>
        </div>

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
            <span class="text-gray-400">Assigned Collector:</span>
            <span id="resCollector" class="font-semibold text-amber-400"></span>
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

          if (!id) {
            errDiv.textContent = 'Mangyaring maglagay ng Customer ID.';
            errDiv.classList.remove('hidden');
            resultArea.classList.add('hidden');
            return;
          }

          try {
            const res = await fetch('/api/customer/' + encodeURIComponent(id));
            const data = await res.json();

            if (res.ok) {
              errDiv.classList.add('hidden');
              document.getElementById('resId').textContent = data.id;
              document.getElementById('resName').textContent = data.name;
              document.getElementById('resAddress').textContent = data.address || 'SAN AGUSTIN';
              document.getElementById('resPlan').textContent = data.plan;
              document.getElementById('resCollector').textContent = data.collector || 'Jefford';
              document.getElementById('resDueDate').textContent = data.dueDate;
              document.getElementById('resAmount').textContent = '₱' + (Number(data.amount) || 0).toFixed(2);
              
              const prevMos = data.previousBalanceMonths || 0;
              document.getElementById('resPrevBalance').textContent = '₱' + (Number(data.previousBalance) || 0).toFixed(2) + ' (' + prevMos + ' buwan)';
              
              const totalDue = (Number(data.amount) || 0) + (Number(data.previousBalance) || 0);
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

              resultArea.classList.remove('hidden');
            } else {
              errDiv.textContent = data.error || 'Hindi nahanap ang Customer ID na ito.';
              errDiv.classList.remove('hidden');
              resultArea.classList.add('hidden');
            }
          } catch (err) {
            errDiv.textContent = 'May problemang naganap sa koneksyon.';
            errDiv.classList.remove('hidden');
          }
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/api/customer/:id', async (req, res) => {
  const db = await getDB();
  const customer = db.find(inv => String(inv.id).toLowerCase() === String(req.params.id).toLowerCase());
  if (!customer) {
    return res.status(404).json({ error: 'Walang nahanap na record para sa Customer ID na ito.' });
  }
  res.json(customer);
});

// ================= ADMIN DASHBOARD =================[cite: 1]
app.get('/dashboard', (req, res) => {[cite: 1]
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
              <img src="/logo.png" alt="Logo" class="w-full h-full object-contain rounded-full" onerror="this.src='https://via.placeholder.com/100?text=RTECH'">
            </div>
            <div>
              <h1 class="text-2xl font-bold text-gray-800">Internet Billing & Payment Tracker</h1>
              <p class="text-xs text-gray-500">RTECH Computer Center Management</p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <a href="/api/export-excel?collector=jefford" class="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1 no-underline shadow">
              📊 Export Jefford
            </a>
            <a href="/api/export-excel?collector=jake" class="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1 no-underline shadow">
              📊 Export Jake
            </a>
            <a href="/api/export-excel" class="bg-gray-700 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-800 flex items-center gap-1 no-underline shadow">
              📊 Export All
            </a>
            <button onclick="openAdminModal()" class="bg-gray-800 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-900 shadow">
              ⚙️ Admins
            </button>
            <button onclick="logout()" class="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-red-700 shadow">
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
              <input type="text" id="searchInput" placeholder="Search customer..." class="border px-3 py-1 rounded text-sm focus:outline-none focus:border-blue-500" oninput="searchCustomer()" onkeypress="handleSearchKey(event)">
              <button onclick="searchCustomer()" class="bg-gray-700 text-white px-3 py-1 rounded text-sm hover:bg-gray-800 font-medium shadow">🔍 Search</button>
            </div>
          </div>

          <!-- Add Customer Form -->
          <div class="flex flex-wrap gap-2 items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200">
            <input type="text" id="newId" placeholder="ID (Auto)" class="border px-2.5 py-1.5 rounded text-sm w-24 focus:ring-1 focus:ring-blue-500">
            <input type="text" id="newName" placeholder="Pangalan *" required class="border px-2.5 py-1.5 rounded text-sm w-36 font-medium focus:ring-1 focus:ring-blue-500">
            
            <select id="newAddress" class="border px-2 py-1.5 rounded text-sm bg-white">
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

            <select id="newPlan" class="border px-2 py-1.5 rounded text-sm bg-white">
              <option value="50Mbps">50Mbps</option>
              <option value="75Mbps">75Mbps</option>
              <option value="100Mbps">100Mbps</option>
            </select>

            <select id="newCollector" class="border px-2 py-1.5 rounded text-sm bg-white font-semibold text-blue-900">
              <option value="Jefford">Jefford</option>
              <option value="Jake">Jake</option>
            </select>

            <input type="number" id="newAmount" value="800" placeholder="Monthly ₱" class="border px-2.5 py-1.5 rounded text-sm w-28 font-medium focus:ring-1 focus:ring-blue-500">

            <input type="date" id="newDueDate" class="border px-2 py-1.5 rounded text-sm w-36">
            <button onclick="addSubscriber()" class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 font-semibold shadow transition duration-150 flex items-center gap-1">
              ➕ Add Customer
            </button>
          </div>
        </div>

        <!-- Data Table -->
        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 border-b text-gray-700 text-xs font-bold uppercase tracking-wider">
                <th class="p-3">ID</th>
                <th class="p-3">Customer Name</th>
                <th class="p-3">Address</th>
                <th class="p-3">Plan</th>
                <th class="p-3">Collector</th>
                <th class="p-3">Due Date</th>
                <th class="p-3">Monthly</th>
                <th class="p-3">Prev. Balance</th>
                <th class="p-3">Prev. Mos</th>
                <th class="p-3">Total Due</th>
                <th class="p-3">Status</th>
                <th class="p-3">Actions</th>
              </tr>
            </thead>
            <tbody id="tableBody" class="text-sm divide-y divide-gray-200"></tbody>
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
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Plan</label>
                <select id="editPlan" class="w-full border px-3 py-1.5 rounded text-sm bg-white">
                  <option value="50Mbps">50Mbps</option>
                  <option value="75Mbps">75Mbps</option>
                  <option value="100Mbps">100Mbps</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Collector</label>
                <select id="editCollector" class="w-full border px-3 py-1.5 rounded text-sm bg-white font-semibold">
                  <option value="Jefford">Jefford</option>
                  <option value="Jake">Jake</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Monthly Amount (₱)</label>
                <input type="number" id="editAmount" class="w-full border px-3 py-1.5 rounded text-sm">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Due Date</label>
                <input type="date" id="editDueDate" class="w-full border px-3 py-1.5 rounded text-sm">
              </div>
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
        var currentFilter = 'all';
        var searchQuery = '';
        var allInvoices = [];

        function logout() {
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('adminUser');
          window.location.href = '/';
        }

        function searchCustomer() {
          var inputElement = document.getElementById('searchInput');
          if (inputElement) {
            searchQuery = inputElement.value.trim().toLowerCase();
            loadData();
          }
        }

        function handleSearchKey(e) {
          if (e.key === 'Enter') {
            searchCustomer();
          }
        }

        function filterStatus(status) {
          currentFilter = status;
          loadData();
        }

        async function loadData() {
          var tbody = document.getElementById('tableBody');
          try {
            const res = await fetch('/api/invoices?t=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) throw new Error('Server response error: ' + res.status);

            allInvoices = await res.json();
            if (!Array.isArray(allInvoices)) allInvoices = [];

            var total = allInvoices.length;
            var disconnectedCount = allInvoices.filter(function(d) { return d && d.status === 'disconnected'; }).length;
            
            var totalPaidAmount = allInvoices.filter(function(d) { return d && d.status === 'paid'; }).reduce(function(sum, d) { return sum + (Number(d.amount) || 0) + (Number(d.previousBalance) || 0); }, 0);
            var totalUnpaidAmount = allInvoices.filter(function(d) { return d && d.status === 'unpaid'; }).reduce(function(sum, d) { return sum + (Number(d.amount) || 0) + (Number(d.previousBalance) || 0); }, 0);

            document.getElementById('summary').innerHTML = 
              '<div class="p-4 bg-gray-50 rounded border-l-4 border-blue-500 shadow-sm">' +
                '<div class="text-gray-500 text-xs font-medium">Total Subscribers</div>' +
                '<div class="text-xl font-bold">' + total + '</div>' +
              '</div>' +
              '<div class="p-4 bg-gray-50 rounded border-l-4 border-green-500 shadow-sm">' +
                '<div class="text-gray-500 text-xs font-medium">Paid (Total Collected)</div>' +
                '<div class="text-xl font-bold text-green-600">₱' + totalPaidAmount.toFixed(2) + '</div>' +
              '</div>' +
              '<div class="p-4 bg-gray-50 rounded border-l-4 border-red-500 shadow-sm">' +
                '<div class="text-gray-500 text-xs font-medium">Unpaid (Total Receivables)</div>' +
                '<div class="text-xl font-bold text-red-600">₱' + totalUnpaidAmount.toFixed(2) + '</div>' +
              '</div>' +
              '<div class="p-4 bg-gray-50 rounded border-l-4 border-yellow-500 shadow-sm">' +
                '<div class="text-gray-500 text-xs font-medium">Disconnected Accounts</div>' +
                '<div class="text-xl font-bold text-yellow-600">' + disconnectedCount + '</div>' +
              '</div>';

            tbody.innerHTML = '';
            
            var filtered = allInvoices.filter(function(item) {
              if (!item) return false;
              var st = (item.status || 'unpaid').toLowerCase();
              var matchesStatus = (currentFilter === 'all' || st === currentFilter);
              var nameStr = (item.name || '').toLowerCase();
              var addrStr = (item.address || '').toLowerCase();
              var collStr = (item.collector || '').toLowerCase();
              var planStr = (item.plan || '').toString().toLowerCase();
              var idStr = (item.id || '').toString().toLowerCase();

              var matchesSearch = !searchQuery || 
                                  nameStr.includes(searchQuery) || 
                                  addrStr.includes(searchQuery) ||
                                  collStr.includes(searchQuery) ||
                                  planStr.includes(searchQuery) || 
                                  idStr.includes(searchQuery);

              return matchesStatus && matchesSearch;
            });
            
            if (filtered.length === 0) {
              tbody.innerHTML = '<tr><td colspan="12" class="p-8 text-center text-gray-500 font-medium bg-gray-50">⚡ Walang nahanap na customer record. Magdagdag ng customer sa itaas upang lumabas dito.</td></tr>';
              return;
            }

            filtered.forEach(function(item) {
              if (!item) return;
              var tr = document.createElement('tr');
              tr.className = 'border-b hover:bg-gray-50 transition duration-150';
              
              var itemStatus = (item.status || 'unpaid').toLowerCase();
              var statusBadgeClass = 'bg-gray-100 text-gray-700';
              if (itemStatus === 'paid') statusBadgeClass = 'bg-green-100 text-green-700 border border-green-300';
              else if (itemStatus === 'unpaid') statusBadgeClass = 'bg-red-100 text-red-700 border border-red-300';
              else if (itemStatus === 'disconnected') statusBadgeClass = 'bg-yellow-100 text-yellow-800 border border-yellow-300';
              else if (itemStatus === 'reconnected') statusBadgeClass = 'bg-blue-100 text-blue-700 border border-blue-300';
              else if (itemStatus === 'pullout') statusBadgeClass = 'bg-purple-100 text-purple-800 border border-purple-300';

              var amount = Number(item.amount) || 0;
              var prevBal = Number(item.previousBalance) || 0;
              var totalDue = amount + prevBal;
              var prevMos = item.previousBalanceMonths || 0;
              var collectorName = item.collector ? item.collector.split(' ')[0] : 'Jefford';

              var actionButtons = '';
              if (itemStatus !== 'paid') {
                actionButtons += '<button onclick="markPaid(\\'' + item.id + '\\')" class="bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-green-700 mr-1.5 shadow-sm">Paid</button>';
              }
              actionButtons += '<button onclick="openEditModal(\\'' + item.id + '\\')" class="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-blue-700 mr-1.5 shadow-sm">Edit</button>';
              actionButtons += '<button onclick="deleteCustomer(\\'' + item.id + '\\')" class="bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-red-600 shadow-sm">Delete</button>';

              tr.innerHTML = 
                '<td class="p-3 text-gray-700 font-mono font-bold">' + (item.id !== undefined ? item.id : '') + '</td>' +
                '<td class="p-3 font-semibold text-gray-900">' + (item.name || '') + '</td>' +
                '<td class="p-3 text-gray-600">' + (item.address || 'SAN AGUSTIN') + '</td>' +
                '<td class="p-3 text-gray-600 font-medium">' + (item.plan || '50Mbps') + '</td>' +
                '<td class="p-3 font-bold text-blue-900">' + collectorName + '</td>' +
                '<td class="p-3 text-gray-600">' + (item.dueDate || '') + '</td>' +
                '<td class="p-3 text-gray-800 font-medium">₱' + amount.toFixed(2) + '</td>' +
                '<td class="p-3 text-red-600 font-semibold">₱' + prevBal.toFixed(2) + '</td>' +
                '<td class="p-3 text-gray-600 font-medium">' + prevMos + ' mos</td>' +
                '<td class="p-3 text-emerald-600 font-bold text-base">₱' + totalDue.toFixed(2) + '</td>' +
                '<td class="p-3">' +
                  '<span class="px-2.5 py-1 text-xs rounded-full font-bold uppercase ' + statusBadgeClass + '">' +
                    (itemStatus === 'pullout' ? 'PULL OUT' : itemStatus.toUpperCase()) +
                  '</span>' +
                '</td>' +
                '<td class="p-3 flex items-center">' + actionButtons + '</td>';

              tbody.appendChild(tr);
            });
          } catch (err) {
            console.error('Error loading data:', err);
          }
        }

        async function markPaid(id) {
          try {
            await fetch('/api/invoices/' + id + '/pay', { method: 'PUT' });
            loadData();
          } catch (err) {
            alert('Hindi ma-update ang payment status.');
          }
        }

        async function addSubscriber() {
          try {
            var idInput = document.getElementById('newId').value.trim();
            var name = document.getElementById('newName').value.trim();
            var address = document.getElementById('newAddress').value || "SAN AGUSTIN";
            var plan = document.getElementById('newPlan').value || "50Mbps";
            var collector = document.getElementById('newCollector').value || "Jefford";
            var rawAmount = document.getElementById('newAmount').value || "800";
            var amount = parseFloat(rawAmount) || 800;
            var dueDate = document.getElementById('newDueDate').value;

            if (!name) {
              alert('⚠️ Mangyaring ilagay ang Pangalan ng Customer.');
              document.getElementById('newName').focus();
              return;
            }

            var res = await fetch('/api/invoices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: idInput || undefined,
                name: name,
                address: address,
                plan: plan,
                collector: collector,
                amount: amount,
                dueDate: dueDate
              })
            });

            var data = await res.json();

            if (res.ok) {
              document.getElementById('newId').value = '';
              document.getElementById('newName').value = '';
              document.getElementById('newDueDate').value = '';

              currentFilter = 'all';
              searchQuery = '';
              document.getElementById('searchInput').value = '';

              await loadData();
              alert('✅ Tagumpay na naidagdag si "' + name + '"!');
            } else {
              alert('❌ Error: ' + (data.error || 'May problemang naganap sa pag-save.'));
            }
          } catch (err) {
            alert('❌ Error sa koneksyon: ' + err.message);
          }
        }

        function openEditModal(id) {
          var item = allInvoices.find(function(inv) { return inv && inv.id.toString() === id.toString(); });
          if (!item) return;

          document.getElementById('editId').value = item.id;
          document.getElementById('editName').value = item.name || '';
          document.getElementById('editAddress').value = item.address || 'SAN AGUSTIN';
          document.getElementById('editPlan').value = item.plan || '50Mbps';
          document.getElementById('editCollector').value = item.collector ? item.collector.split(' ')[0] : 'Jefford';
          document.getElementById('editDueDate').value = item.dueDate || '';
          document.getElementById('editAmount').value = item.amount || 800;
          document.getElementById('editPrevBalance').value = item.previousBalance || 0;
          document.getElementById('editPrevBalanceMonths').value = item.previousBalanceMonths || 0;
          document.getElementById('editStatus').value = item.status || 'unpaid';
          document.getElementById('editModal').classList.remove('hidden');
        }

        function closeEditModal() {
          document.getElementById('editModal').classList.add('hidden');
        }

        async function saveEditedCustomer() {
          try {
            var id = document.getElementById('editId').value;
            var name = document.getElementById('editName').value;
            var address = document.getElementById('editAddress').value;
            var plan = document.getElementById('editPlan').value;
            var collector = document.getElementById('editCollector').value;
            var dueDate = document.getElementById('editDueDate').value;
            var amount = parseFloat(document.getElementById('editAmount').value);
            var previousBalance = parseFloat(document.getElementById('editPrevBalance').value);
            var previousBalanceMonths = parseInt(document.getElementById('editPrevBalanceMonths').value, 10);
            var status = document.getElementById('editStatus').value;

            if (!name) {
              alert('Paki-punuan ang pangalan ng customer.');
              return;
            }

            await fetch('/api/invoices/' + id, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name,
                address: address,
                plan: plan,
                collector: collector,
                dueDate: dueDate,
                amount: amount,
                previousBalance: previousBalance,
                previousBalanceMonths: previousBalanceMonths,
                status: status
              })
            });

            closeEditModal();
            loadData();
          } catch (err) {
            alert('Hindi na-save ang mga pagbabago.');
          }
        }

        async function deleteCustomer(id) {
          if (confirm('Sigurado ka bang gusto mong burahin ang customer na ito?')) {
            try {
              await fetch('/api/invoices/' + id, { method: 'DELETE' });
              loadData();
            } catch (err) {
              alert('Hindi nabura ang customer.');
            }
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
          try {
            var res = await fetch('/api/admins');
            var admins = await res.json();
            var listDiv = document.getElementById('adminList');
            listDiv.innerHTML = '';
            admins.forEach(function(a) {
              var div = document.createElement('div');
              div.className = 'p-2 flex justify-between items-center text-xs';
              div.innerHTML = '<span>👤 ' + a.username + '</span>' + (admins.length > 1 ? '<button onclick="deleteAdmin(' + a.id + ')" class="text-red-600 hover:underline">Delete</button>' : '<span class="text-gray-400 italic">Default</span>');
              listDiv.appendChild(div);
            });
          } catch (err) {
            console.error(err);
          }
        }

        async function createAdmin() {
          var username = document.getElementById('newAdminUser').value;
          var password = document.getElementById('newAdminPass').value;
          if (!username || !password) {
            alert('Ilagay ang username at password.');
            return;
          }
          try {
            var res = await fetch('/api/admins', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: username, password: password })
            });
            if (res.ok) {
              document.getElementById('newAdminUser').value = '';
              document.getElementById('newAdminPass').value = '';
              loadAdminsList();
              alert('Tagumpay na nakagawa ng bagong admin!');
            } else {
              var err = await res.json();
              alert(err.error || 'May problema.');
            }
          } catch (err) {
            alert('Error sa pag-add ng admin.');
          }
        }

        async function deleteAdmin(id) {
          if (confirm('Siguradong gusto mong burahin ang admin na ito?')) {
            try {
              await fetch('/api/admins/' + id, { method: 'DELETE' });
              loadAdminsList();
            } catch (err) {
              alert('Hindi nabura ang admin.');
            }
          }
        }

        loadData();
      </script>
    </body>
    </html>
  `);
});

// ================= ADMIN API ENDPOINTS =================[cite: 1]
app.get('/api/admins', (req, res) => {[cite: 1]
  res.json(getAdmins());
});

app.post('/api/admins', (req, res) => {[cite: 1]
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

app.delete('/api/admins/:id', (req, res) => {[cite: 1]
  let admins = getAdmins();
  if (admins.length <= 1) {
    return res.status(400).json({ error: 'Hindi maaaring burahin ang nag-iisang admin.' });
  }
  admins = admins.filter(a => a.id != req.params.id);
  saveAdmins(admins);
  res.json({ success: true });
});

// ================= INVOICES SUPABASE API =================[cite: 1]
app.get('/api/invoices', async (req, res) => {[cite: 1]
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const db = await getDB();
  res.json(db);
});

app.post('/api/invoices', async (req, res) => {[cite: 1]
  try {
    const db = await getDB();
    const customId = req.body.id ? String(req.body.id).trim() : null;

    if (customId && db.some(inv => String(inv.id).toLowerCase() === customId.toLowerCase())) {
      return res.status(400).json({ error: "Mayroon nang umiiral na Customer ID na " + customId + ". Gumamit ng iba." });
    }

    let maxNumericId = 0;
    db.forEach(item => {
      const num = parseInt(item.id, 10);
      if (!isNaN(num) && num > maxNumericId) {
        maxNumericId = num;
      }
    });

    const finalId = customId ? (isNaN(customId) ? customId : Number(customId)) : (maxNumericId + 1);

    let finalDueDate = req.body.dueDate;
    if (!finalDueDate) {
      const today = new Date();
      let year = today.getFullYear();
      let month = today.getMonth();
      const targetDay = 30;

      if (today.getDate() > targetDay) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      const calculatedDate = new Date(year, month, targetDay);
      finalDueDate = calculatedDate.toISOString().split('T')[0];
    }

    const newItem = {
      id: String(finalId),
      name: req.body.name ? req.body.name.trim() : "Untitled Customer",
      address: req.body.address || "SAN AGUSTIN",
      plan: req.body.plan || "50Mbps",
      collector: req.body.collector || "Jefford",
      amount: parseFloat(req.body.amount) || 800,
      previousBalance: 0.00,
      previousBalanceMonths: 0,
      status: "unpaid",
      dueDate: finalDueDate
    };

    const { data, error } = await supabase.from('invoices').insert([newItem]);
    if (error) throw error;

    res.json(newItem);
  } catch (err) {
    console.error("Error sa pag-save ng customer:", err);
    res.status(500).json({ error: "Hindi ma-save ang customer: " + err.message });
  }
});

app.put('/api/invoices/:id/pay', async (req, res) => {[cite: 1]
  try {
    const { data, error } = await supabase.from('invoices').update({
      status: "paid",
      previousBalance: 0.00,
      previousBalanceMonths: 0
    }).eq('id', req.params.id).select();

    if (error) throw error;
    res.json(data[0] || { success: true });
  } catch (err) {
    res.status(500).json({ error: "Hindi ma-update ang status" });
  }
});

app.put('/api/invoices/:id', async (req, res) => {[cite: 1]
  try {
    const updatePayload = {};
    if (req.body.name !== undefined) updatePayload.name = req.body.name;
    if (req.body.address !== undefined) updatePayload.address = req.body.address;
    if (req.body.plan !== undefined) updatePayload.plan = req.body.plan;
    if (req.body.collector !== undefined) updatePayload.collector = req.body.collector;
    if (req.body.dueDate !== undefined) updatePayload.dueDate = req.body.dueDate;
    if (req.body.amount !== undefined) updatePayload.amount = parseFloat(req.body.amount);
    if (req.body.previousBalance !== undefined) updatePayload.previousBalance = parseFloat(req.body.previousBalance);
    if (req.body.previousBalanceMonths !== undefined) updatePayload.previousBalanceMonths = parseInt(req.body.previousBalanceMonths, 10);
    if (req.body.status !== undefined) updatePayload.status = req.body.status;

    const { data, error } = await supabase.from('invoices').update(updatePayload).eq('id', req.params.id).select();
    if (error) throw error;

    res.json(data[0] || { success: true });
  } catch (err) {
    res.status(500).json({ error: "Hindi na-save ang mga pagbabago" });
  }
});

app.delete('/api/invoices/:id', async (req, res) => {[cite: 1]
  try {
    const { data, error } = await supabase.from('invoices').delete().eq('id', req.params.id).select();
    if (error) throw error;
    res.json(data[0] || { success: true });
  } catch (err) {
    res.status(500).json({ error: "Hindi nabura ang customer" });
  }
});

// ================= EXCEL EXPORT ROUTE (15th & 30th) =================[cite: 1]
app.get('/api/export-excel', async (req, res) => {[cite: 1]
  let db = await getDB();
  const collectorQuery = (req.query.collector || '').toLowerCase();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RTECH Computer Center';

  const addCollectorSheet = (sheetName, reportTitle, filteredData) => {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.properties.defaultRowHeight = 22;

    sheet.mergeCells('A1:K1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = reportTitle;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'center' };
    sheet.getRow(1).height = 35;

    sheet.addRow([]);

    const headerRow = sheet.addRow(['Customer ID', 'Customer Name', 'Address', 'Plan', 'Collector', 'Due Date', 'Monthly', 'Prev. Balance', 'Prev. Mos', 'Total Due', 'Status']);
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

    filteredData.forEach((item, index) => {
      const totalDue = (Number(item.amount) || 0) + (Number(item.previousBalance) || 0);
      if (item.status === 'paid') totalCollected += totalDue;
      else if (item.status === 'unpaid') totalReceivables += totalDue;

      const row = sheet.addRow([
        item.id,
        item.name,
        item.address || '',
        item.plan,
        item.collector ? item.collector.split(' ')[0] : '',
        item.dueDate,
        item.amount,
        item.previousBalance || 0,
        (item.previousBalanceMonths || 0) + ' mos',
        totalDue,
        item.status === 'pullout' ? 'PULL OUT' : (item.status || '').toUpperCase()
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

        if (colNumber === 1 || colNumber === 5 || colNumber === 6 || colNumber === 9) cell.alignment = { horizontal: 'center' };
        if (colNumber === 7 || colNumber === 8 || colNumber === 10) {
          cell.numFmt = '"₱"#,##0.00';
          cell.alignment = { horizontal: 'right' };
        }
        if (colNumber === 11) {
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

    const paidRow = sheet.addRow(['', '', '', '', '', '', '', '', 'TOTAL COLLECTED', totalCollected, '']);
    paidRow.font = { name: 'Arial', size: 10, bold: true };
    paidRow.getCell(9).alignment = { horizontal: 'right' };
    paidRow.getCell(10).numFmt = '"₱"#,##0.00';
    paidRow.getCell(10).font = { name: 'Arial', size: 10, bold: true, color: { argb: '047857' } };

    const unpaidRow = sheet.addRow(['', '', '', '', '', '', '', '', 'TOTAL RECEIVABLES', totalReceivables, '']);
    unpaidRow.font = { name: 'Arial', size: 10, bold: true };
    unpaidRow.getCell(9).alignment = { horizontal: 'right' };
    unpaidRow.getCell(10).numFmt = '"₱"#,##0.00';
    unpaidRow.getCell(10).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'B91C1C' } };

    sheet.columns.forEach(column => {
      let maxLength = 10;
      column.eachCell({ includeEmpty: true }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) maxLength = columnLength;
      });
      column.width = maxLength + 5;
    });
  };

  const filterByDueDate = (items, is15th) => {
    return items.filter(item => {
      if (!item.dueDate) return false;
      const day = new Date(item.dueDate).getDate();
      return is15th ? (day <= 15) : (day > 15);
    });
  };

  let collectorsToProcess = ['Jefford', 'Jake'];
  if (collectorQuery.includes('jefford')) collectorsToProcess = ['Jefford'];
  else if (collectorQuery.includes('jake')) collectorsToProcess = ['Jake'];

  collectorsToProcess.forEach(collector => {
    const collectorItems = db.filter(item => (item.collector || '').toLowerCase().includes(collector.toLowerCase()));
    
    const items15th = filterByDueDate(collectorItems, true);
    const items30th = filterByDueDate(collectorItems, false);

    if (items15th.length > 0) {
      addCollectorSheet(`${collector} - 15th Due`, `${collector.toUpperCase()} - 15TH DUE DATE COLLECTION`, items15th);
    }
    if (items30th.length > 0) {
      addCollectorSheet(`${collector} - 30th Due`, `${collector.toUpperCase()} - 30TH DUE DATE COLLECTION`, items30th);
    }
  });

  if (workbook.worksheets.length === 0) {
    const emptySheet = workbook.addWorksheet('No Data');
    emptySheet.addRow(['Walang nahanap na record para sa export.']);
  }

  let exportFilename = 'rtech_billing_report.xlsx';
  if (collectorQuery.includes('jefford')) exportFilename = 'jefford_collection_report.xlsx';
  else if (collectorQuery.includes('jake')) exportFilename = 'jake_collection_report.xlsx';

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${exportFilename}`);

  await workbook.xlsx.write(res);
  res.end();
});

app.listen(PORT, () => {
  console.log("🚀 RTECH Billing Server ay tumatakbo sa http://localhost:" + PORT);
});
