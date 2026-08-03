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

// Siguraduhing may database.json na may laman
if (!fs.existsSync(DB_FILE)) {
  const initialData = [
    {
      "id": 1,
      "name": "Juan Dela Cruz",
      "address": "SAN AGUSTIN",
      "plan": "50Mbps",
      "collector": "Jefford",
      "amount": 800,
      "previousBalance": 0,
      "previousBalanceMonths": 0,
      "status": "unpaid",
      "dueDate": "2026-08-30"
    }
  ];
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

// Siguraduhing may admins.json
if (!fs.existsSync(ADMIN_FILE)) {
  const initialAdmins = [{ id: 1, username: "admin", password: "admin123" }];
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(initialAdmins, null, 2));
}

// Helper Functions
const getDB = () => {
  try {
    let raw = fs.readFileSync(DB_FILE, 'utf8');
    let db = JSON.parse(raw);
    return Array.isArray(db) ? db : [];
  } catch (err) {
    return [];
  }
};

const saveDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
const getAdmins = () => JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));

// ================= LOGIN PAGE =================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tl">
    <head>
      <meta charset="UTF-8">
      <title>Login - RTECH Computer Center</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-900 min-h-screen flex items-center justify-center p-4">
      <div class="bg-white/10 p-8 rounded-xl max-w-md w-full text-white">
        <h1 class="text-2xl font-bold mb-4 text-center">RTECH Billing Login</h1>
        <form onsubmit="handleLogin(event)" class="space-y-4">
          <input type="text" id="username" placeholder="Username" class="w-full p-2 bg-black/50 border border-gray-600 rounded">
          <input type="password" id="password" placeholder="Password" class="w-full p-2 bg-black/50 border border-gray-600 rounded">
          <button type="submit" class="w-full bg-blue-600 py-2 rounded font-bold">Login</button>
        </form>
      </div>
      <script>
        async function handleLogin(e) {
          e.preventDefault();
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: document.getElementById('username').value,
              password: document.getElementById('password').value
            })
          });
          if (res.ok) {
            localStorage.setItem('isLoggedIn', 'true');
            window.location.href = '/dashboard';
          } else {
            alert('Mali ang username o password.');
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
  if (admin) res.json({ success: true });
  else res.status(401).json({ error: 'Mali ang credentials' });
});

// ================= DASHBOARD =================
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="tl">
    <head>
      <meta charset="UTF-8">
      <title>Billing System - RTECH</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 p-6 font-sans">
      <div class="max-w-7xl mx-auto bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold text-gray-800">Internet Billing & Payment Tracker</h1>
          <button onclick="logout()" class="bg-red-600 text-white px-3 py-1.5 rounded text-xs">Logout</button>
        </div>

        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 border-b text-gray-700 text-xs font-bold uppercase">
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
              </tr>
            </thead>
            <tbody id="tableBody" class="text-sm divide-y divide-gray-200">
              <tr>
                <td colspan="11" class="p-4 text-center text-gray-400">Nagso-solve/Nag-o-open ng data...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <script>
        if (localStorage.getItem('isLoggedIn') !== 'true') {
          window.location.href = '/';
        }

        function logout() {
          localStorage.removeItem('isLoggedIn');
          window.location.href = '/';
        }

        async function loadData() {
          const tbody = document.getElementById('tableBody');
          try {
            const res = await fetch('/api/invoices');
            const data = await res.json();

            if (!Array.isArray(data) || data.length === 0) {
              tbody.innerHTML = '<tr><td colspan="11" class="p-6 text-center text-gray-500 font-bold">⚠️ Walang nahanap na data sa database.json</td></tr>';
              return;
            }

            tbody.innerHTML = '';
            data.forEach(item => {
              const tr = document.createElement('tr');
              tr.className = 'border-b hover:bg-gray-50';
              
              const amount = Number(item.amount) || 0;
              const prevBal = Number(item.previousBalance) || 0;
              const totalDue = amount + prevBal;

              tr.innerHTML = \`
                <td class="p-3 font-bold">\${item.id || ''}</td>
                <td class="p-3 font-semibold text-gray-900">\${item.name || ''}</td>
                <td class="p-3 text-gray-600">\${item.address || ''}</td>
                <td class="p-3 text-gray-600">\${item.plan || ''}</td>
                <td class="p-3 text-blue-900 font-bold">\${item.collector || ''}</td>
                <td class="p-3 text-gray-600">\${item.dueDate || ''}</td>
                <td class="p-3">₱\${amount.toFixed(2)}</td>
                <td class="p-3 text-red-600">₱\${prevBal.toFixed(2)}</td>
                <td class="p-3">\${item.previousBalanceMonths || 0} mos</td>
                <td class="p-3 text-emerald-600 font-bold">₱\${totalDue.toFixed(2)}</td>
                <td class="p-3 font-bold uppercase">\${item.status || 'unpaid'}</td>
              \`;
              tbody.appendChild(tr);
            });
          } catch (err) {
            console.error('Error:', err);
            tbody.innerHTML = '<tr><td colspan="11" class="p-6 text-center text-red-500 font-bold">❌ Error sa pagkuha ng data mula sa server.</td></tr>';
          }
        }

        loadData();
      </script>
    </body>
    </html>
  `);
});

// API Endpoint
app.get('/api/invoices', (req, res) => {
  res.json(getDB());
});

app.listen(PORT, () => {
  console.log("🚀 Server running on http://localhost:" + PORT);
});
