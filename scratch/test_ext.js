const fs = require('fs');
const { extrairImagensDoPdf } = require('./dist/lib/documentos.server.js');
const buffer = fs.readFileSync('.tempmediaStorage/media_1789217991858.pdf');
console.log('Buffer size:', buffer.length);
try {
  const imgs = extrairImagensDoPdf(buffer);
  console.log('Imagens:', imgs.length);
  for(let i=0; i<Math.min(3, imgs.length); i++) console.log(imgs[i].bytes.length);
} catch(e) {
  console.error(e);
}
