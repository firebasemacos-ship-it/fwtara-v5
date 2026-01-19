
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
    console.log('--- VERIFYING TABLES ---');

    const tablesToCheck = [
        'users_v4',
        'managers_v4',
        'representatives_v4',
        'orders_v4',
        'tempOrders_v4', // Quoted in SQL
        'transactions_v4',
        'conversations_v4',
        'creditors_v4',
        'deposits_v4',
        'settings_v4',
        'expenses_v4',
        'external_debts_v4', // Snake case
        'instant_sales_v4'
    ];

    for (const table of tablesToCheck) {
        // We select column 'id' just to be minimal, limit 0 to just check table existence if possible, 
        // or just catch error.
        const { error } = await supabase.from(table).select('id').limit(1);

        if (error) {
            console.log(`❌ ${table}: FAILED - ${error.message}`);
            // Check for case sensitivity issues for tempOrders and external_debts
            if (table === 'tempOrders_v4') {
                const { error: err2 } = await supabase.from('temporders_v4').select('id').limit(1);
                if (!err2) console.log(`   -> FOUND 'temporders_v4' (lowercase) instead.`);
            }
            if (table === 'external_debts_v4') {
                const { error: err2 } = await supabase.from('externalDebts_v4').select('id').limit(1);
                if (!err2) console.log(`   -> FOUND 'externalDebts_v4' (camelCase) instead.`);
            }
        } else {
            console.log(`✅ ${table}: FOUND`);
        }
    }
}

verifyTables().catch(console.error);
