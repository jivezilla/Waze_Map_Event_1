const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";
const GOOGLE_API_KEY = "AIzaSyDSjcIsQxjIkd9ReFTxiCcS7_JHhSMQmXY";

// Fixed origin coordinates for Corley Mill House
const originAddress = "221 Corley Mill Rd, Lexington, SC 29072";

async function fetchCSV() {
  const response = await fetch(SHEET_CSV_URL);
  return await response.text();
}

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  const data = lines.slice(1).map(line => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i]; });
    return obj;
  });
  return data;
}

async function geocode(address) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`
  );
  const data = await response.json();
  return data.results[0]?.geometry.location; // { lat, lng }
}

async function getTravelTime(origin, destination) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${GOOGLE_API_KEY}`
  );
  const data = await response.json();
  const duration = data.routes[0]?.legs[0]?.duration.text;
  return duration || "Unknown";
}

async function init() {
  const csvText = await fetchCSV();
  const rows = parseCSV(csvText);
  const todayStr = new Date().toLocaleDateString("en-US");
  const todayRows = rows.filter(row => row["Event Date"] === todayStr);
  const todaysEvent = todayRows[todayRows.length - 1];

  if (!todaysEvent) {
    document.getElementById("venueName").textContent = "No event today";
    document.getElementById("eta").textContent = "";
    return;
  }

  const venueName = todaysEvent["Venue Name"];
  const destAddress = `${todaysEvent["Address"]}, ${todaysEvent["City"]}, ${todaysEvent["State"]} ${todaysEvent["Zipcode"]}`;

  document.getElementById("venueName").textContent = venueName;

  const originCoords = await geocode(originAddress);
  const destCoords = await geocode(destAddress);

  if (!originCoords || !destCoords) {
    document.getElementById("eta").textContent = "Address not found";
    return;
  }

  const eta = await getTravelTime(originAddress, destAddress);
  document.getElementById("eta").textContent = `Estimated Travel Time: ${eta}`;

  // Set Waze iframe URL
  const wazeURL = `https://embed.waze.com/iframe?zoom=12&from_lat=${originCoords.lat}&from_lon=${originCoords.lng}&to_lat=${destCoords.lat}&to_lon=${destCoords.lng}&pin=1`;
  document.getElementById("wazeMap").src = wazeURL;

  // Refresh every 5 mins (300,000ms)
  setTimeout(init, 300000);
}

init();
