const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv"; // Replace with your published CSV URL

// API Keys
const MAPS_JS_API_KEY = "AIzaSyAnlvXPhzOWC7QuAu1yimiguBJ1LV0x4Bw"; // Frontend Key
const BACKEND_API_KEY = "AIzaSyCWVnQe33Yw8RLLeewe69h48sda62ZTP1g"; // Backend Key

const originAddress = "221 Corley Mill Rd, Lexington, SC 29072";

async function fetchCSV() {
  const response = await fetch(SHEET_CSV_URL);
  return await response.text();
}

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

function getTodayInMDYYYY() {
  const today = new Date();
  return `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${BACKEND_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK") {
    console.error("Geocoding failed:", data.status, data.error_message);
    return null;
  }
  return data.results[0]?.geometry.location;
}

async function getTravelTime(origin, destination) {
  const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': BACKEND_API_KEY,
      'X-Goog-FieldMask': 'routes.duration'
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE'
    })
  });

  const data = await response.json();
  console.log("Routes API response:", data);

  if (!data.routes || data.routes.length === 0) {
    console.error("No routes found.");
    return "Unavailable";
  }

  const travelSeconds = parseInt(data.routes[0].duration.slice(0, -1));
  const travelMinutes = Math.ceil(travelSeconds / 60);

  return `${travelMinutes} mins`;
}

async function updateDashboard() {
  const csvText = await fetchCSV();
  const rows = parseCSV(csvText);
  const todayStr = getTodayInMDYYYY();
  const todayEvents = rows.filter(row => row["Date"] === todayStr);
  const todaysEvent = todayEvents[todayEvents.length - 1];

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

  const travelTime = await getTravelTime(originAddress, destAddress);
  etaEl.textContent = `Estimated Travel Time: ${travelTime}`;

  const mapsURL = `https://www.google.com/maps/embed/v1/directions?key=${MAPS_JS_API_KEY}&origin=${encodeURIComponent(originAddress)}&destination=${encodeURIComponent(destAddress)}&mode=driving&traffic_model=best_guess`;
  mapEl.src = mapsURL;
}


  const venueName = todaysEvent["Venue Name"];
  const destAddress = `${todaysEvent["Address"]}, ${todaysEvent["City"]}, ${todaysEvent["State"]} ${todaysEvent["Zipcode"]}`;

  venueEl.textContent = venueName;

  const [originCoords, destCoords] = await Promise.all([
    geocode(originAddress),
    geocode(destAddress)
  ]);

  if (!originCoords || !destCoords) {
    etaEl.textContent = "Address not found";
    mapEl.src = "";
    return;
  }

  const travelTime = await getTravelTime(originAddress, destAddress);
  etaEl.textContent = `Estimated Travel Time: ${travelTime}`;

  const wazeURL = `https://embed.waze.com/iframe?zoom=12&from_lat=${originCoords.lat}&from_lon=${originCoords.lng}&to_lat=${destCoords.lat}&to_lon=${destCoords.lng}&pin=1`;
  mapEl.src = wazeURL;
}

updateDashboard();
setInterval(updateDashboard, 300000);

