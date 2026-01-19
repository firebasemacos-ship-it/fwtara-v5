
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugFinance() {
    // List all tables
    const { data: tables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

    if (tableError) {
        // Supabase client might not allow access to information_schema directly via .from() sometimes due to permissions, 
        // but let's try. If fail, we rely on standard tables.
        console.error('Error listing tables:', tableError);
    } else {
        console.log('Tables in DB:', tables?.map(t => t.table_name));
    }

    // Check Expenses to verify access to new tables
    const { data: expenses, error: expensesError } = await supabase.from('expenses_v4').select('*');
    if (expensesError) console.log('Error fetching expenses_v4:', expensesError.message);
    else console.log('Expenses count:', expenses?.length);

    // Try other debt table names
    const debtTables = ['debts_v4', 'externalDebts_v4', 'external_debts_v4', 'company_debts_v4'];
    for (const table of debtTables) {
        const { data, error } = await supabase.from(table).select('*');
        if (!error) {
            console.log(`FOUND TABLE: ${table}`);
            const sum = (data || []).reduce((s, d) => s + (d.amount || 0), 0);
            console.log(`Sum of ${table}: ${sum}`);
        } else {
            console.log(`Table ${table} not found or error:`, error.message);
        }
    }

    const { data: orders, error: ordersError } = await supabase.from('orders_v4').select('*');
    const allOrders = orders || [];
    // Check Creditors
    const { data: creditors, error: creditorsError } = await supabase.from('creditors_v4').select('*');
    const allCreditors = creditors || [];

    // --- REVENUE HYPOTHESIS: Collected Amount ---
    console.log('\n--- REVENUE HYPOTHESIS: Collected Amount ---');
    console.log('Target Revenue: 432,841.90');

    // Calculate Total Selling Price of ALL active orders (not cancelled)
    const activeOrders = allOrders.filter(o => o.status !== 'cancelled');
    const totalSellingPrice = activeOrders.reduce((sum, o) => sum + (o.sellingPriceLYD || 0), 0);
    const totalRemaining = activeOrders.reduce((sum, o) => sum + (o.remainingAmount || 0), 0);

    // Revenue = Total Selling - Total Remaining
    const calculatedRevenue = totalSellingPrice - totalRemaining;

    console.log(`Total Selling Price (Active): ${totalSellingPrice.toFixed(2)}`);
    console.log(`Total Remaining (Debt on Orders): ${totalRemaining.toFixed(2)}`);
    console.log(`Calculated Revenue (Selling - Remaining): ${calculatedRevenue.toFixed(2)}`);
    console.log(`Difference from Target: ${(calculatedRevenue - 432841.90).toFixed(2)}`);

    // --- DEBT ANALYSIS: Missing 42k ---
    console.log('\n--- DEBT ANALYSIS: Missing ~42k ---');
    console.log('Target Debt: 105,612.10');
    console.log('Current Order Debt: 62,926.00'); // Based on previous run, assuming totalRemaining matches

    const totalCreditorsDebt = allCreditors.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
    console.log(`Total Creditors Debt: ${totalCreditorsDebt.toFixed(2)}`);

    console.log(`Order Debt + Creditors Debt: ${(totalRemaining + totalCreditorsDebt).toFixed(2)}`);

    // Check Users Debt Sum vs Calculated Order Debt
    const { data: users, error: usersError } = await supabase.from('users_v4').select('debt');
    const totalUserDebt = (users || []).reduce((sum, u) => sum + (u.debt || 0), 0);
    console.log(`Sum of users_v4 'debt': ${totalUserDebt.toFixed(2)}`);
    console.log(`Difference (User Debt - Order Debt): ${(totalUserDebt - 62926).toFixed(2)}`);
}

debugFinance().catch(console.error);
