import express from 'express';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// ================= SUPABASE CONFIGURATION =================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cytckucqmcyubwbhyhsx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGNrdWNxbWN5dWJ3Ymh5aHN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTczODA0MiwiZXhwIjoyMTAxMzE0MDQyfQ.UdwBWO_XaSaFC2J2z-I7GB_5DEy__Q-lo-f_U_jNvnY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Admin management using Supabase (falls back to default admin if table is empty)
const getAdmins = async () => {
  try {
    const { data, error } = await supabase.from('admins').select('*').order('id', { ascending: true });
    if (error || !data || data.length === 0) {
      return [{ id: 1, username: "admin", password: "admin123" }];
    }
    return data;
  } catch (err) {
    return [{ id: 1, username: "admin", password: "admin123" }];
  }
};

// Helper to avoid timezone offset issues on dates
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

      // Cutoff Date Helper (2 days before due date)
      const getCutoffDate = (dateObj) => {
        const cutoff = new Date(dateObj.getTime());
        cutoff.setDate(cutoff.getDate() - 2);
        cutoff.setHours(0, 0, 0, 0);
        return cutoff;
      };

      let cutoffDate = getCutoffDate(due);

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

        due.setMonth(due.getMonth() + 1);
        const lastDayOfNewMonth = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
        due.setDate(Math.min(billingDay, lastDayOfNewMonth));

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
      <div class="bg-white/15 backdrop-blur
