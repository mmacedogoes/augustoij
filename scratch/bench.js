const bytes = new Uint8Array(30 * 1024 * 1024);
// put some fake JPEGs
bytes[100] = 0xff; bytes[101] = 0xd8;
bytes[2000] = 0xff; bytes[2001] = 0xd9;
const start = Date.now();
let found = 0;
for (let i = 0; i < bytes.length - 1; i++) {
  if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) {
    let end = -1;
    for (let j = i; j < bytes.length - 1; j++) {
      if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
        end = j + 2;
        break;
      }
    }
    if (end > i) {
      found++;
      i = end - 1;
    }
  }
}
console.log('Took: ' + (Date.now() - start) + 'ms');
