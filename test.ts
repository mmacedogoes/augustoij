import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import dotenv from "dotenv";
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.storage.from("documentos").download("e209715f-fd86-4548-a62f-42d7e9758189/1789579704128_CONVEN_O_DE_CONDOMINIO.pdf");
  const buf = new Uint8Array(await data.arrayBuffer());
  try {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    console.log("Pages:", doc.getPageCount());
  } catch(e) {
    console.error("PDF-LIB ERROR:", e);
  }
}
run();
