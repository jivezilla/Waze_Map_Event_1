// travel.js

// Google Sheet CSV URL
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";

// Your Google Maps API key
const GOOGLE_API_KEY = "AIzaSyB4b4Ho4rNwF9hyPKCYFYXNU6dXI550M6U";

// The address you’re departing from
const ORIGIN_ADDRESS = "221 Corley Mill Rd, Lexington, SC 29072";

/**
 * initMap() is called automatically when the Google Maps JS script loads
 */
function initMap() {
  console.log("Google Maps API Loaded. Initializing...");
  updateDashboard();
}

/**
 * Fetch CSV data from the published Google Sheet
 */
async function fetchCSV() {
  const response = await fetch(SHEET_CSV_URL);
  return await response.text();
}

/**
 * Parse CSV text into an array of objects
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map(header => header.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",");
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index];
      return acc;
    }, {});
  });
}

/**
 * Return today's date in M/D/YYYY format
 */
function getTodayInMDYYYY() {
  const today = new Date();
  return `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
}

/**
 * Geocode an address using Google Maps Geocoding API
 */
async function geocode(address) {
  console.log(`Geocoding: ${address}`);
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${GOOGLE_API_KEY}`
  );
  const data = await response.json();

  if (data.status !== "OK") {
    console.error("Geocoding error:", data.status);
    return null;
  }
  return data.results[0]?.geometry.location;
}

/**
 * Get travel time from origin to destination using Google Maps Directions API
 * via the client-side Maps JavaScript API
 */
async function getTravelTime(origin, destination) {
  return new Promise((resolve, reject) => {
    if (!google || !google.maps) {
      reject("Google Maps API not loaded!");
      return;
    }
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin,
        destination,
        travelMode: "DRIVING",
      },
      (response, status) => {
        if (status === "OK") {
          const durationText = response.routes[0].legs[0].duration.text;
          resolve(durationText);
        } else {
          reject("Could not retrieve directions: " + status);
        }
      }
    );
  });
}

/**
 * Update the dashboard with event info, travel ETA, and an embedded Google Map
 */
async function updateDashboard() {
  console.log("Fetching data...");
  const csvText = await fetchCSV();
  const rows = parseCSV(csvText);
  const todayStr = getTodayInMDYYYY();
  const todayEvents = rows.filter(row => row["Date"] === todayStr);
  const todaysEvent = todayEvents[todayEvents.length - 1];

  const venueEl = document.getElementById("venueName");
  const etaEl = document.getElementById("eta");
  const mapEl = document.getElementById("mapFrame");

  // If no event today, clear everything out
  if (!todaysEvent) {
    venueEl.textContent = "No event today";
    etaEl.textContent = "";
    mapEl.src = "";
    localStorage.removeItem("eventETA");
    return;
  }

  // Build the address from the CSV row
  const venueName = todaysEvent["Venue Name"];
  const destAddress = `${todaysEvent["Address"]}, ${todaysEvent["City"]}, ${todaysEvent["State"]} ${todaysEvent["Zipcode"]}`;

  venueEl.textContent = venueName;

  // Geocode both origin & destination
  const [originCoords, destCoords] = await Promise.all([
    geocode(ORIGIN_ADDRESS),
    geocode(destAddress)
  ]);

  if (!originCoords || !destCoords) {
    etaEl.textContent = "Address not found";
    mapEl.src = "";
    return;
  }

  try {
    // Get the travel time
    const travelTime = await getTravelTime(ORIGIN_ADDRESS, destAddress);
    etaEl.textContent = `Estimated Travel Time: ${travelTime}`;

    // Store the ETA so your other site can access it
    localStorage.setItem("eventETA", travelTime);
  } catch (error) {
    etaEl.textContent = error;
  }

  // Embed a Google Map with driving directions
  const googleMapsEmbedURL = `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_API_KEY}&origin=${encodeURIComponent(
    ORIGIN_ADDRESS
  )}&destination=${encodeURIComponent(destAddress)}&mode=driving`;
  mapEl.src = googleMapsEmbedURL;
}
