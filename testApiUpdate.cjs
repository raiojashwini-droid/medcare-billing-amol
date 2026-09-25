async function test() {
  const casesRes = await fetch('http://localhost:5000/v1/cases');
  const cases = await casesRes.json();
  if(!cases || cases.length === 0) return console.log("No cases");
  const caseId = cases[0].id;
  
  console.log("Before update:", cases[0].painDescription);
  
  const updateRes = await fetch(`http://localhost:5000/v1/cases/${caseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ painDescription: ["Sharp", "Throbbing"] })
  });
  
  const updatedCase = await updateRes.json();
  console.log("After update:", updatedCase.painDescription);
  
  const fetchAgainRes = await fetch(`http://localhost:5000/v1/cases/${caseId}`);
  const fetchedCase = await fetchAgainRes.json();
  console.log("Fetch again:", fetchedCase.painDescription);
}
test();
