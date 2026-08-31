const express = require('express');
const path = require('path');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= SUPABASE CONFIGURATION =================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cytckucqmcyubwbhyhsx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGNrdWNxbWN5dWJ3Ymh5aHN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTczODA0MiwiZXhwIjoyMTAxMzE0MDQyfQ.UdwBWO_XaSaFC2J2z-I7GB_5DEy__Q-lo-f_U_jNvnY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_FILE = path.join(__dirname, 'admins.json');
const fs = require('fs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

if (!fs.existsSync(ADMIN_FILE)) {
  const initialAdmins = [{ id: 1, username: "admin", password: "admin123" }];
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(initialAdmins, null, 2));
}

const getAdmins = () => JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
const saveAdmins = (data) => fs.writeFileSync(ADMIN_FILE, JSON.stringify(data, null, 2));

const getDB = async () => {
  try {
    const { data, error } = await supabase.from('invoices').select('*').order('id', { ascending: true });
    if (error) throw error;
    let db = data || [];
    
    db.sort((a, b) => {
      let idA = a.id;
      let idB = b.id;
      let numA = Number(idA);
      let numB = Number(idB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return String(idA).localeCompare(String(idB), undefined, { numeric: true, sensitivity: 'base' });
    });
    
    // I-COMMENT OUT O TANGGALIN ANG BUONG LOOP NA NAG-AAUTO-ROLLOVER NG DUE DATE AT BALANCE:
    /*
    let updated = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let item of db) {
      if (!item || !item.dueDate) continue;

      let due = new Date(item.dueDate);
      if (isNaN(due.getTime())) continue;
      due.setHours(0, 0, 0, 0);

      const billingDay = due.getDate();

      let updatedThisItem = false;
      let newStatus = item.status;
      let newPrevBalance = Number(item.previousBalance) || 0;
      let newPrevMonths = Number(item.previousBalanceMonths) || 0;
      let newAmountPaid = Number(item.amountPaid) || 0;

      const triggerDate = new Date(due);
      triggerDate.setDate(triggerDate.getDate() - 2);
      triggerDate.setHours(0, 0, 0, 0);

      if (today >= triggerDate) {
        if (newStatus === 'paid') {
          newPrevBalance = 0;
          newPrevMonths = 0;
          newAmountPaid = 0;
          newStatus = 'unpaid';
        } else if (newStatus === 'unpaid' || newStatus === 'reconnected') {
          const totalDueBeforeRollover = newPrevBalance + (Number(item.amount) || 0);
          const remainingUnpaid = Math.max(0, totalDueBeforeRollover - newAmountPaid);
          
          newPrevBalance = remainingUnpaid;
          newAmountPaid = 0;
          newStatus = 'unpaid';
        }

        due.setDate(1);
        due.setMonth(due.getMonth() + 1);
        const lastDayOfNewMonth = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
        due.setDate(Math.min(billingDay, lastDayOfNewMonth));

        updatedThisItem = true;
      }

      if (updatedThisItem && item.status !== 'free') {
        const newDueDate = due.toISOString().split('T')[0];

        await supabase.from('invoices').update({
          status: newStatus,
          previousBalance: newPrevBalance,
          previousBalanceMonths: newPrevMonths,
          amountPaid: newAmountPaid,
          dueDate: newDueDate
        }).eq('id', item.id);

        item.status = newStatus;
        item.previousBalance = newPrevBalance;
        item.previousBalanceMonths = newPrevMonths;
        item.amountPaid = newAmountPaid;
        item.dueDate = newDueDate;
        updated = true;
      }
    }
    */

    return db;
  } catch (err) {
    console.error("Error reading DB from Supabase:", err);
    return [];
  }
};

// ================= LOGIN PAGE =================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
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
          <a href="/customer" class="text-xs text-blue-400 hover:underline">🔍 Customer Portal (View Bill using ID)</a>
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
              errDiv.textContent = data.error || 'Invalid username or password.';
              errDiv.classList.remove('hidden');
            }
          } catch (err) {
            errDiv.textContent = 'Cannot connect to the server.';
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
    res.status(401).json({ error: 'Invalid username or password.' });
  }
});

// ================= CUSTOMER PORTAL =================
app.get('/customer', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
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
          <p class="text-xs text-gray-300 mt-1">Enter your Customer ID to view your account status.</p>
        </div>

        <div class="flex gap-2 mb-6">
          <input type="text" id="customerId" placeholder="Example: 1 or CUST-01" class="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 text-white">
          <button onclick="checkBill()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition shadow-lg">View</button>
        </div>

        <div id="resultArea" class="hidden bg-black/40 border border-gray-700 rounded-xl p-5 space-y-3 text-sm">
          <div class="flex justify-between border-b border-gray-700 pb-2">
            <span class="text-gray-400">Customer ID:</span>
            <span id="resId" class="font-mono font-bold text-blue-400"></span>
          </div>
          <div class="flex justify-between border-b border-gray-700 pb-2">
            <span class="text-gray-400">Name:</span>
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
            <span class="text-gray-400">Previous Balance:</span>
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
          <a href="/" class="text-xs text-gray-300 hover:underline">← Back to Admin Login</a>
        </div>
      </div>

      <script>
        async function checkBill() {
          const id = document.getElementById('customerId').value.trim();
          const errDiv = document.getElementById('errorMsg');
          const resultArea = document.getElementById('resultArea');

          if (!id) {
            errDiv.textContent = 'Please enter a Customer ID.';
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
              document.getElementById('resPrevBalance').textContent = '₱' + (Number(data.previousBalance) || 0).toFixed(2) + ' (' + prevMos + ' month(s))';
              
              const totalDue = (data.status === 'disconnected' || data.status === 'free' || data.status === 'pullout') ? 0 : ((Number(data.previousBalance) || 0) + (Number(data.amount) || 0));
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
              } else if (data.status === 'disconnected') {
                statusEl.className += 'bg-yellow-500/20 text-yellow-400 border border-yellow-500';
              } else if (data.status === 'pullout') {
                statusEl.className += 'bg-purple-500/20 text-purple-400 border border-purple-500';
              } else if (data.status === 'free') {
                statusEl.className += 'bg-cyan-500/20 text-cyan-400 border border-cyan-500';
              } else {
                statusEl.className += 'bg-gray-500/20 text-gray-400 border border-gray-500';
              }

              resultArea.classList.remove('hidden');
            } else {
              errDiv.textContent = data.error || 'Customer ID not found.';
              errDiv.classList.remove('hidden');
              resultArea.classList.add('hidden');
            }
          } catch (err) {
            errDiv.textContent = 'A connection error occurred.';
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
    return res.status(404).json({ error: 'No record found for this Customer ID.' });
  }
  res.json(customer);
});

// ================= ADMIN DASHBOARD =================
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
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
        
        <div id="summary" class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6"></div>

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
              <button onclick="filterStatus('free')" class="px-3 py-1 bg-cyan-100 text-cyan-800 rounded text-sm font-medium hover:bg-cyan-200">Free</button>
            </div>
            
            <div class="flex items-center gap-1 ml-2">
              <input type="text" id="searchInput" placeholder="Search customer..." class="border px-3 py-1 rounded text-sm focus:outline-none focus:border-blue-500" oninput="searchCustomer()" onkeypress="handleSearchKey(event)">
              <button onclick="searchCustomer()" class="bg-gray-700 text-white px-3 py-1 rounded text-sm hover:bg-gray-800 font-medium shadow">🔍 Search</button>
            </div>
          </div>

          <!-- Add Customer Form -->
          <div class="flex flex-wrap gap-2 items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200">
            <input type="text" id="newId" placeholder="ID (Auto)" class="border px-2.5 py-1.5 rounded text-sm w-24 focus:ring-1 focus:ring-blue-500">
            <input type="text" id="newName" placeholder="Name *" required class="border px-2.5 py-1.5 rounded text-sm w-36 font-medium focus:ring-1 focus:ring-blue-500">
            
            <select id="newAddress" class="border px-2 py-1.5 rounded text-sm bg-white">
              <option value="" disabled selected>Address</option>
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
              <option value="NARARAGAN">NARARAGAN</option>
              <option value="MACUGAY">MACUGAY</option>
              <option value="CABAYU">CABAYU</option>
              <option value="BUNNONG">BUNNONG</option>
              <option value="BATAL">BATAL</option>
            </select>

            <select id="newPlan" class="border px-2 py-1.5 rounded text-sm bg-white">
              <option value="" disabled selected>Plan</option>
              <option value="50Mbps">50Mbps</option>
              <option value="75Mbps">75Mbps</option>
              <option value="100Mbps">100Mbps</option>
            </select>

            <select id="newCollector" class="border px-2 py-1.5 rounded text-sm bg-white font-semibold text-blue-900">
              <option value="" disabled selected>Collector</option>
              <option value="Jefford">Jefford</option>
              <option value="Jake">Jake</option>
            </select>

            <input type="number" id="newAmount" list="monthlyAmounts" placeholder="Monthly" class="border px-2.5 py-1.5 rounded text-sm w-28 font-medium focus:ring-1 focus:ring-blue-500">
            <datalist id="monthlyAmounts">
              <option value="800">
              <option value="1000">
              <option value="1200">
              <option value="2000">
            </datalist>

            <input type="text" onfocus="this.type='date'" onblur="if(!this.value)this.type='text'" placeholder="Due Date" id="newDueDate" class="border px-2 py-1.5 rounded text-sm w-36">
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

      <!-- FLOATING SCROLL BUTTONS -->
      <div class="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        <button onclick="scrollToTop()" class="bg-blue-600 hover:bg-blue-700 text-white w-11 h-11 rounded-full shadow-xl flex items-center justify-center font-bold text-lg transition transform hover:scale-105" title="Scroll to Top">▲</button>
        <button onclick="scrollToBottom()" class="bg-blue-600 hover:bg-blue-700 text-white w-11 h-11 rounded-full shadow-xl flex items-center justify-center font-bold text-lg transition transform hover:scale-105" title="Scroll to Bottom">▼</button>
      </div>

      <!-- EDIT MODAL -->
      <div id="editModal" class="fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
          <h2 class="text-xl font-bold text-gray-800 mb-4">Edit Customer Info</h2>
          
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Customer ID</label>
              <input type="text" id="editId" class="w-full border px-3 py-1.5 rounded text-sm font-mono font-bold">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Customer Name</label>
              <input type="text" id="editName" class="w-full border px-3 py-1.5 rounded text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Address</label>
              <select id="editAddress" class="w-full border px-3 py-1.5 rounded text-sm bg-white">
                <option value="" disabled selected>Address</option>
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
                <option value="NARARAGAN">NARARAGAN</option>
                <option value="MACUGAY">MACUGAY</option>
                <option value="CABAYU">CABAYU</option>
                <option value="BUNNONG">BUNNONG</option>
                <option value="BATAL">BATAL</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Plan</label>
                <select id="editPlan" class="w-full border px-3 py-1.5 rounded text-sm bg-white">
                  <option value="" disabled selected>Plan</option>
                  <option value="50Mbps">50Mbps</option>
                  <option value="75Mbps">75Mbps</option>
                  <option value="100Mbps">100Mbps</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Collector</label>
                <select id="editCollector" class="w-full border px-3 py-1.5 rounded text-sm bg-white font-semibold">
                  <option value="" disabled selected>Collector</option>
                  <option value="Jefford">Jefford</option>
                  <option value="Jake">Jake</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Monthly Amount (₱)</label>
                <input type="number" id="editAmount" list="editMonthlyAmounts" placeholder="Monthly" class="w-full border px-3 py-1.5 rounded text-sm">
                <datalist id="editMonthlyAmounts">
                  <option value="800">
                  <option value="1000">
                  <option value="1200">
                  <option value="2000">
                </datalist>
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
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Prev. Mos (Months)</label>
                <input type="number" id="editPrevBalanceMonths" class="w-full border px-3 py-1.5 rounded text-sm" placeholder="e.g. 1, 2">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Amount Paid (₱)</label>
                <input type="number" id="editAmountPaid" class="w-full border px-3 py-1.5 rounded text-sm" placeholder="0.00">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 uppercase mb-1">Status</label>
                <select id="editStatus" class="w-full border px-3 py-1.5 rounded text-sm bg-white font-semibold">
                  <option value="paid">PAID</option>
                  <option value="unpaid">UNPAID</option>
                  <option value="disconnected">DISCONNECTED</option>
                  <option value="reconnected">RECONNECTED</option>
                  <option value="pullout">PULL OUT</option>
                  <option value="free">FREE</option>
                </select>
              </div>
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

        function scrollToTop() {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function scrollToBottom() {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }

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
            var freeCount = allInvoices.filter(function(d) { return d && d.status === 'free'; }).length;
            
            // Total Collected: Sum of amountPaid (or full total due if status is paid and amountPaid is 0)
            var totalPaidAmount = allInvoices
              .reduce(function(sum, d) { 
                if (!d) return sum;
                var paid = Number(d.amountPaid) || 0;
                var status = (d.status || '').toLowerCase();
                if (status === 'paid' && paid === 0) {
                  paid = (Number(d.previousBalance) || 0) + (Number(d.amount) || 0);
                }
                return sum + paid; 
              }, 0);

            // Total Receivables: Sum of remaining balances for unpaid/reconnected accounts
            var totalUnpaidAmount = allInvoices
              .filter(function(d) { return d && (d.status === 'unpaid' || d.status === 'reconnected'); })
              .reduce(function(sum, d) { 
                var totalDue = (Number(d.previousBalance) || 0) + (Number(d.amount) || 0);
                var paid = Number(d.amountPaid) || 0;
                return sum + Math.max(0, totalDue - paid); 
              }, 0);

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
              '</div>' +
              '<div class="p-4 bg-gray-50 rounded border-l-4 border-cyan-500 shadow-sm">' +
                '<div class="text-gray-500 text-xs font-medium">Free Accounts</div>' +
                '<div class="text-xl font-bold text-cyan-600">' + freeCount + '</div>' +
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
              tbody.innerHTML = '<tr><td colspan="12" class="p-8 text-center text-gray-500 font-medium bg-gray-50">⚡ No customer records found. Add a customer above to display them here.</td></tr>';
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
              else if (itemStatus === 'free') statusBadgeClass = 'bg-cyan-100 text-cyan-800 border border-cyan-300';

              var amount = Number(item.amount) || 0;
              var prevBal = Number(item.previousBalance) || 0;
              
              var totalDue = (itemStatus === 'disconnected' || itemStatus === 'free' || itemStatus === 'pullout') ? 0 : (prevBal + amount);
              
              var prevMos = item.previousBalanceMonths || 0;
              var collectorName = item.collector ? item.collector.split(' ')[0] : 'Jefford';

              var safeId = String(item.id !== undefined ? item.id : '').replace(/'/g, "\\\\'");
              var actionButtons = '';
              if (itemStatus !== 'paid') {
                actionButtons += '<button onclick="markPaid(\\'' + safeId + '\\')" class="bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-green-700 mr-1.5 shadow-sm">Paid</button>';
              }
              actionButtons += '<button onclick="openEditModal(\\'' + safeId + '\\')" class="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-blue-700 mr-1.5 shadow-sm">Edit</button>';
              actionButtons += '<button onclick="deleteCustomer(\\'' + safeId + '\\')" class="bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-red-600 shadow-sm">Delete</button>';

              var totalDueDisplay = '';
              if (itemStatus === 'disconnected') {
                totalDueDisplay = '<span class="text-gray-400 font-normal text-xs">₱0.00 (Disc.)</span>';
              } else if (itemStatus === 'free') {
                totalDueDisplay = '<span class="text-cyan-600 font-semibold text-xs">₱0.00 (Free)</span>';
              } else if (itemStatus === 'pullout') {
                totalDueDisplay = '<span class="text-purple-600 font-semibold text-xs">₱0.00 (Pull Out)</span>';
              } else {
                totalDueDisplay = '₱' + totalDue.toFixed(2);
              }

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
                '<td class="p-3 text-emerald-600 font-bold text-base">' + totalDueDisplay + '</td>' +
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
          var item = allInvoices.find(function(inv) { return inv && inv.id.toString() === id.toString(); });
          if (!item) return;

          var defaultTotalDue = Math.max(0, ((Number(item.previousBalance) || 0) + (Number(item.amount) || 0)) - (Number(item.amountPaid) || 0));
          var inputVal = prompt("Enter amount paid by " + (item.name || 'Customer') + " (₱):", defaultTotalDue);
          
          if (inputVal === null) return;

          var amountPaid = parseFloat(inputVal);
          if (isNaN(amountPaid) || amountPaid < 0) {
            alert("⚠️ Please enter a valid payment amount.");
            return;
          }

          try {
            var res = await fetch('/api/invoices/' + id + '/pay', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amountPaid: amountPaid })
            });

            if (!res.ok) throw new Error('Failed to update payment.');

            loadData();
          } catch (err) {
            alert('❌ Cannot update payment status.');
          }
        }

        async function addSubscriber() {
          try {
            var idInput = document.getElementById('newId').value.trim();
            var name = document.getElementById('newName').value.trim();
            var address = document.getElementById('newAddress').value;
            var plan = document.getElementById('newPlan').value;
            var collector = document.getElementById('newCollector').value;
            var rawAmount = document.getElementById('newAmount').value || "800";
            var amount = parseFloat(rawAmount) || 800;
            var dueDate = document.getElementById('newDueDate').value;

            if (!name) {
              alert('⚠️ Please enter the Customer Name.');
              document.getElementById('newName').focus();
              return;
            }

            if (!address) {
              alert('⚠️ Please select an Address.');
              document.getElementById('newAddress').focus();
              return;
            }

            if (!plan) {
              alert('⚠️ Please select a Plan.');
              document.getElementById('newPlan').focus();
              return;
            }

            if (!collector) {
              alert('⚠️ Please select a Collector.');
              document.getElementById('newCollector').focus();
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
              document.getElementById('newAddress').selectedIndex = 0;
              document.getElementById('newPlan').selectedIndex = 0;
              document.getElementById('newCollector').selectedIndex = 0;
              document.getElementById('newAmount').value = '';
              document.getElementById('newDueDate').value = '';

              currentFilter = 'all';
              searchQuery = '';
              document.getElementById('searchInput').value = '';

              await loadData();
              alert('✅ Successfully added "' + name + '"!');
            } else {
              alert('❌ Error: ' + (data.error || 'An error occurred while saving.'));
            }
          } catch (err) {
            alert('❌ Connection error: ' + err.message);
          }
        }

        function openEditModal(id) {
          var item = allInvoices.find(function(inv) { return inv && inv.id.toString() === id.toString(); });
          if (!item) return;

          document.getElementById('editModal').dataset.originalId = item.id;
          document.getElementById('editId').value = item.id;
          document.getElementById('editName').value = item.name || '';
          document.getElementById('editAddress').value = item.address || 'SAN AGUSTIN';
          document.getElementById('editPlan').value = item.plan || '50Mbps';
          document.getElementById('editCollector').value = item.collector ? item.collector.split(' ')[0] : 'Jefford';
          
          var formattedDueDate = '';
          if (item.dueDate) {
            formattedDueDate = item.dueDate.toString().split('T')[0];
          }
          document.getElementById('editDueDate').value = formattedDueDate;

          document.getElementById('editAmount').value = item.amount || 800;
          document.getElementById('editPrevBalance').value = item.previousBalance || 0;
          document.getElementById('editPrevBalanceMonths').value = item.previousBalanceMonths || 0;
          document.getElementById('editAmountPaid').value = item.amountPaid || 0;
          document.getElementById('editStatus').value = item.status || 'unpaid';
          document.getElementById('editModal').classList.remove('hidden');
        }

        function closeEditModal() {
          document.getElementById('editModal').classList.add('hidden');
        }

        async function saveEditedCustomer() {
          try {
            var originalId = document.getElementById('editModal').dataset.originalId;
            var newId = document.getElementById('editId').value.trim();
            var name = document.getElementById('editName').value;
            var address = document.getElementById('editAddress').value;
            var plan = document.getElementById('editPlan').value;
            var collector = document.getElementById('editCollector').value;
            var dueDate = document.getElementById('editDueDate').value;
            var amount = parseFloat(document.getElementById('editAmount').value);
            var previousBalance = parseFloat(document.getElementById('editPrevBalance').value);
            var previousBalanceMonths = parseInt(document.getElementById('editPrevBalanceMonths').value, 10);
            var amountPaid = parseFloat(document.getElementById('editAmountPaid').value) || 0;
            var status = document.getElementById('editStatus').value;

            if (!newId) {
              alert('Please fill in the Customer ID.');
              return;
            }

            if (!name) {
              alert('Please fill in the customer name.');
              return;
            }

            var res = await fetch('/api/invoices/' + originalId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: newId,
                name: name,
                address: address,
                plan: plan,
                collector: collector,
                dueDate: dueDate,
                amount: amount,
                previousBalance: previousBalance,
                previousBalanceMonths: previousBalanceMonths,
                amountPaid: amountPaid,
                status: status
              })
            });

            if (!res.ok) {
              var errData = await res.json();
              alert(errData.error || 'Changes were not saved.');
              return;
            }

            closeEditModal();
            loadData();
          } catch (err) {
            alert('Changes were not saved.');
          }
        }

        async function deleteCustomer(id) {
          if (confirm('Are you sure you want to delete this customer?')) {
            try {
              await fetch('/api/invoices/' + id, { method: 'DELETE' });
              loadData();
            } catch (err) {
              alert('Customer was not deleted.');
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
            alert('Enter the username and password.');
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
              alert('Successfully created a new admin!');
            } else {
              var err = await res.json();
              alert(err.error || 'There was a problem.');
            }
          } catch (err) {
            alert('Error adding admin.');
          }
        }

        async function deleteAdmin(id) {
          if (confirm('Are you sure you want to delete this admin?')) {
            try {
              await fetch('/api/admins/' + id, { method: 'DELETE' });
              loadAdminsList();
            } catch (err) {
              alert('Admin was not deleted.');
            }
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
    return res.status(400).json({ error: 'Username already exists.' });
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
    return res.status(400).json({ error: 'Cannot delete the only admin.' });
  }
  admins = admins.filter(a => a.id != req.params.id);
  saveAdmins(admins);
  res.json({ success: true });
});

// ================= INVOICES SUPABASE API =================
app.get('/api/invoices', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const db = await getDB();
  res.json(db);
});

app.post('/api/invoices', async (req, res) => {
  try {
    const db = await getDB();
    const customId = req.body.id ? String(req.body.id).trim() : null;

    if (customId && db.some(inv => String(inv.id).toLowerCase() === customId.toLowerCase())) {
      return res.status(400).json({ error: "Customer ID " + customId + " already exists. Please use another one." });
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
      amountPaid: 0.00,
      status: "unpaid",
      dueDate: finalDueDate
    };

    const { data, error } = await supabase.from('invoices').insert([newItem]);
    if (error) throw error;

    res.json(newItem);
  } catch (err) {
    console.error("Error saving customer:", err);
    res.status(500).json({ error: "Cannot save customer: " + err.message });
  }
});

// ================= PAYMENT LOGIC (STRICT AMOUNT PAID REFLECTION) =================
app.put('/api/invoices/:id/pay', async (req, res) => {
  try {
    const db = await getDB();
    const item = db.find(inv => String(inv.id) === String(req.params.id));
    if (!item) return res.status(404).json({ error: "Customer not found" });

    const paymentInput = req.body.amountPaid !== undefined ? parseFloat(req.body.amountPaid) : 0;
    const monthlyRate = Number(item.amount) || 800;
    const oldPrevBal = Number(item.previousBalance) || 0;
    const totalDue = oldPrevBal + monthlyRate;

    // Accumulate total amount paid correctly (adds only the inputted amount to existing accumulated paid)
    const existingPaid = Number(item.amountPaid) || 0;
    const totalAmountPaid = existingPaid + paymentInput;

    const remainingBalance = Math.max(0, totalDue - totalAmountPaid);
    const newStatus = remainingBalance <= 0 ? "paid" : "unpaid";
    
    let newPrevBalance = remainingBalance;
    let newPrevMonths = monthlyRate > 0 ? Number((newPrevBalance / monthlyRate).toFixed(1)) : 0;

    if (newStatus === "paid") {
      newPrevBalance = 0;
      newPrevMonths = 0;
    }

    const { data, error } = await supabase.from('invoices').update({
      status: newStatus,
      amountPaid: totalAmountPaid,
      previousBalance: newPrevBalance,
      previousBalanceMonths: Math.round(newPrevMonths)
    }).eq('id', req.params.id).select();

    if (error) throw error;
    res.json(data[0] || { success: true });
  } catch (err) {
    console.error("Payment Update Error:", err);
    res.status(500).json({ error: "Cannot update status: " + err.message });
  }
});

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const oldId = req.params.id;
    const newId = req.body.id !== undefined ? String(req.body.id).trim() : oldId;

    const db = await getDB();

    if (newId !== oldId) {
      if (db.some(inv => String(inv.id).toLowerCase() === newId.toLowerCase())) {
        return res.status(400).json({ error: "Customer ID " + newId + " already exists." });
      }
    }

    const existingItem = db.find(inv => String(inv.id) === String(oldId));
    if (!existingItem) {
      return res.status(404).json({ error: "Customer record not found." });
    }

    const updatedAmount = req.body.amount !== undefined ? parseFloat(req.body.amount) : existingItem.amount;
    const updatedPrevBal = req.body.previousBalance !== undefined ? parseFloat(req.body.previousBalance) : existingItem.previousBalance;
    let updatedAmountPaid = req.body.amountPaid !== undefined ? parseFloat(req.body.amountPaid) : (existingItem.amountPaid || 0);
    const updatedStatus = req.body.status !== undefined ? req.body.status : existingItem.status;

    // Kung binago ang status sa 'paid' ngunit ang amountPaid ay 0 o hindi tinype, awtomatikong i-set ito sa buong total due
    if (updatedStatus === 'paid' && (req.body.amountPaid === undefined || Number(req.body.amountPaid) === 0) && updatedAmountPaid === 0) {
      updatedAmountPaid = (Number(updatedPrevBal) || 0) + (Number(updatedAmount) || 0);
    }

    const updatedData = {
      id: newId,
      name: req.body.name !== undefined ? req.body.name : existingItem.name,
      address: req.body.address !== undefined ? req.body.address : existingItem.address,
      plan: req.body.plan !== undefined ? req.body.plan : existingItem.plan,
      collector: req.body.collector !== undefined ? req.body.collector : existingItem.collector,
      dueDate: req.body.dueDate !== undefined ? req.body.dueDate : existingItem.dueDate,
      amount: updatedAmount,
      previousBalance: updatedPrevBal,
      previousBalanceMonths: req.body.previousBalanceMonths !== undefined ? parseInt(req.body.previousBalanceMonths, 10) : existingItem.previousBalanceMonths,
      amountPaid: updatedAmountPaid,
      status: updatedStatus
    };

    if (newId !== oldId) {
      const { error: deleteError } = await supabase.from('invoices').delete().eq('id', oldId);
      if (deleteError) throw deleteError;

      const { data: insertData, error: insertError } = await supabase.from('invoices').insert([updatedData]).select();
      if (insertError) throw insertError;

      return res.json(insertData[0] || updatedData);
    } else {
      const updatePayload = {
        name: updatedData.name,
        address: updatedData.address,
        plan: updatedData.plan,
        collector: updatedData.collector,
        dueDate: updatedData.dueDate,
        amount: updatedData.amount,
        previousBalance: updatedData.previousBalance,
        previousBalanceMonths: updatedData.previousBalanceMonths,
        amountPaid: updatedData.amountPaid,
        status: updatedData.status
      };

      const { data, error } = await supabase.from('invoices').update(updatePayload).eq('id', oldId).select();
      if (error) throw error;

      res.json(data[0] || { success: true });
    }
  } catch (err) {
    console.error("Error updating customer:", err);
    res.status(500).json({ error: "Changes were not saved: " + err.message });
  }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('invoices').delete().eq('id', req.params.id).select();
    if (error) throw error;
    res.json(data[0] || { success: true });
  } catch (err) {
    res.status(500).json({ error: "Customer was not deleted" });
  }
});

// ================= EXCEL EXPORT ROUTE =================
app.get('/api/export-excel', async (req, res) => {
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
      const itemStatus = (item.status || '').toLowerCase();
      const isExempt = itemStatus === 'disconnected' || itemStatus === 'free' || itemStatus === 'pullout';
      const totalDue = isExempt ? 0 : ((Number(item.previousBalance) || 0) + (Number(item.amount) || 0));
      
      let actualPaid = Number(item.amountPaid) || 0;
      if (itemStatus === 'paid' && actualPaid === 0) {
        actualPaid = totalDue;
      }
      totalCollected += actualPaid;

      if (itemStatus === 'unpaid' || itemStatus === 'reconnected') {
        totalReceivables += Math.max(0, totalDue - actualPaid);
      }

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
          else if (item.status === 'free') colorCode = '0891B2';
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
    emptySheet.addRow(['No records found for export.']);
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
  console.log("🚀 RTECH Billing Server is running at http://localhost:" + PORT);
});
