
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const table = 'external_debts_v4';
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });

    if (error) {
        console.error(`Error checking ${table}:`, error.message);
    } else {
        console.log(`${table} count: ${count}`);
    }

    // Check transactions too
    const { count: tCount } = await supabase.from('transactions_v4').select('*', { count: 'exact', head: true });
    console.log(`transactions_v4 count: ${tCount}`);
}

checkData();
