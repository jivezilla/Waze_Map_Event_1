<!DOCTYPE html>
<html>
<head>
  <title>Event Travel & ETA Dashboard</title>
  <style>
    body { font-family: "Instrument Serif", serif; margin: 0; padding: 20px; background: #E99031; color: #fff; }
    h1, h2 { margin-bottom: 10px; }
    iframe { border: none; width: 100%; height: 600px; margin-top: 20px; }
  </style>
  <script async
    src="https://maps.googleapis.com/maps/api/js?key=AIzaSyA1AbE3G3s1KmOn38BZ99r8gMDxbkVYCWc">
  </script>
</head>
<body>

<h1 id="venueName">Loading venue name...</h1>
<h2 id="eta">Loading ETA...</h2>

<iframe id="wazeMap" src=""></iframe>

<script>
const SHEET_CSV_URL = "YOUR_SHEET_CSV_URL"; // Replace with your published CSV URL
const GOOGLE_API_KEY = "AIzaSyA1AbE3G3s1KmOn38BZ99r8gMDxbkVYCWc";
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
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`
  );
  const data = await response.json();
  return data.results[0]?.geometry.location;
}

function getTravelTime(origin, destination) {
  return new Promise((resolve, reject) => {
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin,
        destination,
        travelMode: "DRIVING",
      },
      (response, status) => {
        if (status === "OK") {
          resolve(response.routes[0].legs[0].duration.text);
        } else {
          reject("Could not retrieve directions: " + status);
        }
      }
    );
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
</script>

<iframe id="wazeMap" src=""></iframe>

</body>
</html>
