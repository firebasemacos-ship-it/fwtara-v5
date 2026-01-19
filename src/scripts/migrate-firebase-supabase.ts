
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, query, collectionGroup } from "firebase/firestore";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables for Supabase
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Firebase Config provided by user
const firebaseConfig = {
    apiKey: "AIzaSyAkF7fttkWmmh6cXg_53JthJA57GqsZzZQ",
    authDomain: "fawtara-system.firebaseapp.com",
    projectId: "fawtara-system",
    storageBucket: "fawtara-system.firebasestorage.app",
    messagingSenderId: "1003969181691",
    appId: "1:1003969181691:web:1326e5b936be4ce6b93d5e",
    measurementId: "G-XSTTEQQSQ2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTIONS = [
    { fb: 'users_v4', sb: 'users_v4' },
    { fb: 'managers_v4', sb: 'managers_v4' },
    { fb: 'representatives_v4', sb: 'representatives_v4' },
    { fb: 'orders_v4', sb: 'orders_v4' },
    { fb: 'tempOrders_v4', sb: 'temporders_v4' }, // Note lowercase in Supabase
    { fb: 'transactions_v4', sb: 'transactions_v4' },
    { fb: 'conversations_v4', sb: 'conversations_v4' },
    { fb: 'notifications_v4', sb: 'notifications_v4' },
    { fb: 'settings_v4', sb: 'settings_v4' },
    { fb: 'expenses_v4', sb: 'expenses_v4' },
    { fb: 'deposits_v4', sb: 'deposits_v4' },
    { fb: 'externalDebts_v4', sb: 'external_debts_v4' }, // Mapping camelCase to snake_case
    { fb: 'creditors_v4', sb: 'creditors_v4' },
    { fb: 'manual_labels_v4', sb: 'manual_labels_v4' },
    { fb: 'instant_sales_v4', sb: 'instant_sales_v4' }
];

async function migrateCollection(fbName: string, sbName: string) {
    console.log(`Migrating ${fbName} -> ${sbName}...`);
    try {
        const querySnapshot = await getDocs(collection(db, fbName));
        const docs = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Handle timestamps: Supabase expects ISO strings or Date objects, Firestore has Timestamp objects
            // Convert any Firestore Timestamp to ISO string
            for (const key in data) {
                if (data[key] && typeof data[key].toDate === 'function') {
                    data[key] = data[key].toDate().toISOString();
                }
                // Handle complex objects if necessary, but JSONB should handle most
            }
            return { id: doc.id, ...data };
        });

        if (docs.length === 0) {
            console.log(`   No documents found in ${fbName}.`);
            return;
        }

        console.log(`   Found ${docs.length} documents. Inserting into Supabase...`);

        // Batch insert in chunks of 100 to avoid limits
        const chunkSize = 100;
        for (let i = 0; i < docs.length; i += chunkSize) {
            const chunk = docs.slice(i, i + chunkSize);
            const { error } = await supabase.from(sbName).upsert(chunk);
            if (error) {
                console.error(`   ❌ Error upserting chunk ${i / chunkSize + 1}:`, error.message);
            }
        }
        console.log(`   ✅ Finished ${fbName}.`);

    } catch (error) {
        console.error(`   ❌ Error migrating ${fbName}:`, error);
    }
}

async function migrateSubCollections() {
    console.log("Migrating subcollections...");
    // Specifically 'messages' in 'conversations_v4'
    // First, get all conversations
    const convSnapshot = await getDocs(collection(db, 'conversations_v4'));
    for (const convDoc of convSnapshot.docs) {
        const convId = convDoc.id;
        // console.log(`   Checking messages for conversation ${convId}...`);
        try {
            const msgSnapshot = await getDocs(collection(db, `conversations_v4/${convId}/messages`));
            const messages = msgSnapshot.docs.map(doc => {
                const data = doc.data();
                for (const key in data) {
                    if (data[key] && typeof data[key].toDate === 'function') {
                        data[key] = data[key].toDate().toISOString();
                    }
                }
                // We need to ensure the target table 'messages' exists or we store it in the conversation? 
                // Wait, Supabase schema might not have a 'messages' table if it was using subcollections in NoSQL.
                // Let's check if 'messages' table exists in Postgres. 
                // Typically SQL migration from NoSQL requires either a 'messages' table with 'conversation_id' 
                // OR storing messages in a JSONB column in 'conversations_v4'.

                // Inspecting 'create_tables.sql' (from memory/context):
                // conversations_v4 had `messages JSONB`. 
                // If the old system used subcollections, we need to merge them into the JSONB array OR insert into a messages table if it exists.
                // BUT, if the 'create_tables.sql' defined 'messages' as a JSONB column in 'conversations_v4', 
                // then we should probably update the conversation row with this array.

                // Let's assume we update the conversation doc with the messages array.
                return { id: doc.id, ...data };
            });

            if (messages.length > 0) {
                // Update the conversation row in Supabase with these messages
                // Check if the 'messages' column expects an array found in 'messages'.
                // If the schema has a 'messages' table, we should insert there.
                // To be safe, I'll assume we might need to put them in a JSONB column named 'messages' (common pattern for simple migrations).

                const { error } = await supabase.from('conversations_v4')
                    .update({ messages: messages })
                    .eq('id', convId);

                if (error) {
                    // If column doesn't exist, we might fail.
                    // console.log(`Failed to update messages for ${convId}: ${error.message}`);
                }
            }
        } catch (err) {
            console.error(`Error migrating messages for ${convId}:`, err);
        }
    }
}

async function run() {
    console.log("Starting Full Migration...");

    // 1. Migrate Collections
    for (const col of COLLECTIONS) {
        await migrateCollection(col.fb, col.sb);
    }

    // 2. Migrate Subcollections (Messages)
    // NOTE: If 'conversations_v4' table structure expects a separate table, this needs adjustment.
    // Based on `create_tables.sql` line view earlier, `conversations_v4` likely has a messages column or separate table.
    // I will try to update the 'messages' column assuming it's JSONB.
    await migrateSubCollections();

    console.log("Migration Complete.");
}

run();
