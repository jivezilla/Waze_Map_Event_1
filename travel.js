// travel.js - SHC Travel Dashboard with Live Waze Map & ETA

// ===== CONFIGURE THESE VARIABLES =====
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=cs"; // Replace with your published CSV URL
const GOOGLE_API_KEY = "AIzaSyDSjcIsQxjIkd9ReFTxiCcS7_JHhSMQmX"; // Replace with your Google API key

const originAddress = "221 Corley Mill Rd, Lexington, SC 29072";

// ===== FETCH CSV FROM GOOGLE SHEET =====
async function fetchCSV() {
  const response = await fetch(SHEET_CSV_URL);
  return await response.text();
}

// ===== PARSE CSV INTO OBJECT =====
function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    return headers.reduce((acc, header, idx) => {
      acc[header] = cols[idx];
      return acc;
    }, {});
  });
}

// ===== DATE HELPER FUNCTION (M/D/YYYY format) =====
function getTodayInMDYYYY() {
  const today = new Date();
  return `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
}

// ===== GEOCODING ADDRESS TO COORDINATES =====
async function geocode(address) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`
  );
  const data = await response.json();
  return data.results[0]?.geometry.location; // returns { lat, lng }
}

// ===== FETCH TRAVEL TIME FROM GOOGLE DIRECTIONS API =====
async function getTravelTime(origin, destination) {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${GOOGLE_API_KEY}`
  );
  const data = await response.json();
  const duration = data.routes[0]?.legs[0]?.duration.text;
  return duration || "Unknown";
}

// ===== MAIN FUNCTION =====
async function updateDashboard() {
  const csvText = await fetchCSV();
  const rows = parseCSV(csvText);

  const todayStr = getTodayInMDYYYY();
  const todayEvents = rows.filter(row => row["Event Date"] === todayStr);
  const todaysEvent = todayEvents[todayEvents.length - 1]; // Last matching row

  const venueEl = document.getElementById("venueName");
  const etaEl = document.getElementById("eta");
  const mapEl = document.getElementById("wazeMap");

  if (!todaysEvent) {
    venueEl.textContent = "No event today";
    etaEl.textContent = "";
    mapEl.src = "";
    return;
  }

  const venueName = todaysEvent["Venue Name"];
  const destAddress = `${todaysEvent["Address"]}, ${todaysEvent["City"]}, ${todaysEvent["State"]} ${todaysEvent["Zipcode"]}`;

  venueEl.textContent = venueName;

  const [originCoords, destCoords, travelTime] = await Promise.all([
    geocode(originAddress),
    geocode(destAddress),
    getTravelTime(originAddress, destAddress)
  ]);

  if (!originCoords || !destCoords) {
    etaEl.textContent = "Address not found";
    mapEl.src = "";
    return;
  }

  etaEl.textContent = `Estimated Travel Time: ${travelTime}`;

  const wazeURL = `https://embed.waze.com/iframe?zoom=12&from_lat=${originCoords.lat}&from_lon=${originCoords.lng}&to_lat=${destCoords.lat}&to_lon=${destCoords.lng}&pin=1`;
  mapEl.src = wazeURL;
}

// ===== INITIALIZE & AUTO REFRESH EVERY 5 MINUTES =====
updateDashboard();
setInterval(updateDashboard, 300000); // refresh every 5 mins (300000ms)

