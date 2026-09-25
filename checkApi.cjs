const fetch = require('node-fetch') || (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
async function check() {
  const res = await fetch('http://localhost:5000/v1/cases');
  const data = await res.json();
  console.log(JSON.stringify(data.map(c => ({ id: c.id, painDescription: c.painDescription })), null, 2));
}
check();
