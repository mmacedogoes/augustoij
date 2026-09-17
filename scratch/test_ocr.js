require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { processarDocumentoCore } = require('./dist/lib/documentos-processar.server.js');

async function run() {
  try {
    const res = await processarDocumentoCore(supabase, 'dummy', 'a5f7bc6c-422d-432d-909b-0b751b9cdce8', process.env.LOVABLE_API_KEY);
    console.log(res);
  } catch(e) {
    console.error(e);
  }
}
run();
