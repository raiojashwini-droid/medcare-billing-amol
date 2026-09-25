async function test() {
  const caseData = {
    patientId: "pat-001",
    accidentType: "AUTO_ACCIDENT",
    accidentState: "TX",
    painDescription: ["Sharp", "Throbbing"]
  };
  const res = await fetch('http://localhost:5000/v1/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(caseData)
  });
  const data = await res.json();
  console.log("Created Case painDescription:", data.painDescription);
  
  const fetchRes = await fetch(`http://localhost:5000/v1/cases/${data.id}`);
  const fetchedData = await fetchRes.json();
  console.log("Fetched Case painDescription:", fetchedData.painDescription);
}
test();
