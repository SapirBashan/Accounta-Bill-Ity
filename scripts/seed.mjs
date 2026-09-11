import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const categories = [
  // Fixed Expenses (הוצאות קבועות)
  { name: 'שכר דירה \\ משכנתה', type: 'fixed_expense', group_name: 'דיור', default_budget: 2500 },
  { name: 'ארנונה', type: 'fixed_expense', group_name: 'דיור', default_budget: 417 },
  { name: 'מניות / השקעות', type: 'fixed_expense', group_name: 'דיור', default_budget: 2500 },
  { name: 'ועד בית', type: 'fixed_expense', group_name: 'דיור', default_budget: 0 },
  { name: 'ביטוח רכב', type: 'fixed_expense', group_name: 'חיוניות', default_budget: 244 },
  { name: 'ביטוח בריאות', type: 'fixed_expense', group_name: 'חיוניות', default_budget: 0 },
  { name: 'אינטרנט', type: 'fixed_expense', group_name: 'חיוניות', default_budget: 120 },
  { name: 'מנויים', type: 'fixed_expense', group_name: 'חיוניות', default_budget: 13 },

  // Variable Expenses (הוצאות משתנות)
  { name: 'חשמל', type: 'variable_expense', group_name: 'דיור', default_budget: 140 },
  { name: 'מים', type: 'variable_expense', group_name: 'דיור', default_budget: 86 },
  { name: 'גז', type: 'variable_expense', group_name: 'דיור', default_budget: 31 },
  { name: 'דלק', type: 'variable_expense', group_name: 'חיוניות', default_budget: 700 },
  { name: 'תחזוקת בית', type: 'variable_expense', group_name: 'דיור', default_budget: 0 },
  { name: 'מזון לבית', type: 'variable_expense', group_name: 'חיוניות', default_budget: 1400 },
  { name: 'ביגוד והנעלה', type: 'variable_expense', group_name: 'חיוניות', default_budget: 200 },
  { name: 'קוסמטיקה', type: 'variable_expense', group_name: 'חיוניות', default_budget: 150 },
  { name: 'סופר פארם', type: 'variable_expense', group_name: 'חיוניות', default_budget: 200 },
  { name: 'מסעדות / בילויים', type: 'variable_expense', group_name: 'מותרות', default_budget: 0 },
  { name: 'חיתולים', type: 'variable_expense', group_name: 'ילדים', default_budget: 0 },
  { name: 'חדר כושר', type: 'fixed_expense', group_name: 'בריאות', default_budget: 0 },

  // Income (הכנסות)
  { name: 'משכורת', type: 'income', group_name: 'הכנסות', default_budget: 0 },
  { name: 'הכנסות נוספות', type: 'income', group_name: 'הכנסות', default_budget: 0 },
];

async function runSeed() {
  console.log('🌱 Seeding initial categories into Supabase...');

  const { data, error } = await supabase
    .from('categories')
    .insert(categories)
    .select();

  if (error) {
    console.error('❌ Seeding failed:', error.message);
  } else {
    console.log(`✅ Success! Seeded ${data.length} categories into database.`);
  }
}

runSeed();