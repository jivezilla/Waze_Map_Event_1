// travel.js

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";

const GOOGLE_API_KEY = "AIzaSyB4b4Ho4rNwF9hyPKCYFYXNU6dXI550M6U";
const ORIGIN_ADDRESS = "221 Corley Mill Rd, Lexington, SC 29072";

/**
 * initMap() is called automatically by the Google Maps JS script (via callback).
 */
function initMap() {
  console.log("Google Maps API Loaded. Initializing...");
  updateDashboard();
}

/**
 * Fetch CSV data from Google Sheets.
 */
async function fetchCSV() {
  const response = await fetch(SHEET_CSV_URL);
  console.log("Fetch finished loading:", response.url);
  return await response.text();
}

/**
 * Parse CSV text into an array of objects.
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",");
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index];
      return acc;
    }, {});
  });
}

/**
 * Return today's date in M/D/YYYY format.
 */
function getTodayInMDYYYY() {
  const today = new Date();
  return `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
}

/**
 * CLIENT-SIDE GEOCODER
 * Uses the Maps JavaScript API's built-in geocoder instead of the web service.
 */
function geocodeClientSide(address) {
  return new Promise((resolve, reject) => {
    console.log(`Geocoding: ${address}`);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK") {
        // Return the LatLng of the first result
        resolve(results[0].geometry.location);
      } else {
        console.error("Geocoding failed:", status);
        resolve(null); // or reject(...) if you prefer
      }
    });
  });
}

/**
 * Get travel time from origin to destination using the Maps JavaScript API.
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
 * Update the dashboard with event info, travel ETA, and an embedded Google Map.
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

  if (!todaysEvent) {
    venueEl.textContent = "No event today";
    etaEl.textContent = "";
    mapEl.src = "";
    localStorage.removeItem("eventETA");
    return;
  }

  const venueName = todaysEvent["Venue Name"];
  const destAddress = `${todaysEvent["Address"]}, ${todaysEvent["City"]}, ${todaysEvent["State"]} ${todaysEvent["Zipcode"]}`;
  venueEl.textContent = venueName;

  // Geocode both origin & destination (client-side approach)
  const [originCoords, destCoords] = await Promise.all([
    geocodeClientSide(ORIGIN_ADDRESS),
    geocodeClientSide(destAddress)
  ]);

  if (!originCoords || !destCoords) {
    etaEl.textContent = "Address not found";
    mapEl.src = "";
    return;
  }

  try {
    // Get the travel time using the DirectionsService
    const travelTime = await getTravelTime(ORIGIN_ADDRESS, destAddress);
    etaEl.textContent = `Estimated Travel Time: ${travelTime}`;

    // Store the ETA so your other site can access it
    localStorage.setItem("eventETA", travelTime);
  } catch (error) {
    etaEl.textContent = error;
  }

  // Embed a Google Map with driving directions (Maps Embed API)
  const googleMapsEmbedURL = `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_API_KEY}&origin=${encodeURIComponent(
    ORIGIN_ADDRESS
  )}&destination=${encodeURIComponent(destAddress)}&mode=driving`;
  mapEl.src = googleMapsEmbedURL;
}
