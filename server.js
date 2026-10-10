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

// Helper para maiwasan ang timezone offset issues sa mga petsa
const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  const cleanStr = String(dateStr).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  return new Date(dateStr);
};

const formatLocalDate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
    
    let updated = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let item of db) {
      if (!item || !item.dueDate) continue;

      let due = parseLocalDate(item.dueDate);
      if (isNaN(due.getTime())) continue;
      due.setHours(0, 0, 0, 0);

      const billingDay = due.getDate();

      let updatedThisItem = false;
      let newStatus = item.status;
      let newPrevBalance = Number(item.previousBalance) || 0;
      let newPrevMonths = Number(item.previousBalanceMonths) || 0;
      let newAmountPaid = Number(item.amountPaid) || 0;
      const monthlyAmount = Number(item.amount) || 0;

      // Helper function para makuha ang Cutoff Date (2 araw bago ang due date)
      const getCutoffDate = (dateObj) => {
        const cutoff = new Date(dateObj.getTime());
        cutoff.setDate(cutoff.getDate() - 2);
        cutoff.setHours(0, 0, 0, 0);
        return cutoff;
      };

      let cutoffDate = getCutoffDate(due);

      // Kapag ang araw ngayon (today) ay umabot o lumagpas na sa cutoff date (2 days before due date)
      while (today >= cutoffDate) {
        if (newStatus === 'paid') {
          newPrevBalance = 0;
          newPrevMonths = 0;
          newAmountPaid = 0;
          newStatus = 'unpaid';
        } else if (newStatus === 'unpaid' || newStatus === 'reconnected') {
          const totalUnpaidBeforeRollover = (newPrevBalance + monthlyAmount) - newAmountPaid;
          newPrevBalance = Math.max(0, totalUnpaidBeforeRollover);
          newPrevMonths = monthlyAmount > 0 ? Math.round(newPrevBalance / monthlyAmount) : 0;
          newAmountPaid = 0;
          newStatus = 'unpaid';
        }

        // I-advance ang due date nang +1 buwan
        due.setMonth(due.getMonth() + 1);
        const lastDayOfNewMonth = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
        due.setDate(Math.min(billingDay, lastDayOfNewMonth));

        // Kunin ang bagong cutoff date para sa susunod na buwan
        cutoffDate = getCutoffDate(due);
        updatedThisItem = true;
      }

      if (updatedThisItem && item.status !== 'free') {
        const newDueDate = formatLocalDate(due);

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
      <title>Login - R-TECH Computer Center</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gradient-to-br from-blue-950 via-gray-900 to-black min-h-screen flex items-center justify-center p-4 font-sans">
      <div class="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-2xl text-white">
        <div class="text-center mb-6">
          <div class="bg-white p-2 rounded-full w-28 h-28 mx-auto mb-3 flex items-center justify-center border-2 border-blue-500 shadow-lg overflow-hidden">
            <img src="/logo.png" alt="Logo" class="w-full h-full object-contain rounded-full" onerror="this.src='https://via.placeholder.com/100?text=R-TECH'">
          </div>
          <h1 class="text-2xl font-bold tracking-wide mt-2">R-TECH Billing System</h1>
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
      <title>Customer Portal - R-TECH Billing</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gradient-to-br from-blue-950 via-gray-900 to-black min-h-screen flex items-center justify-center p-4 font-sans">
      <div class="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-lg w-full shadow-2xl text-white">
        <div class="text-center mb-6">
          <div class="bg-white p-2 rounded-full w-20 h-20 mx-auto mb-3 flex items-center justify-center border-2 border-blue-500 shadow-lg overflow-hidden">
            <img src="/logo.png" alt="Logo" class="w-full h-full object-contain rounded-full" onerror="this.src='https://via.placeholder.com/100?text=R-TECH'">
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
          const errDiv =
