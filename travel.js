// travel.js

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv"; // Reminder: clean up language for production.
const GOOGLE_API_KEY = "AIzaSyCWVnQe33Yw8RLLeewe69h48sda62ZTP1g";
const ORIGIN_ADDRESS = "221 Corley Mill Rd, Lexington, SC 29072";

// Called by the Google Maps API when ready
function initMap() {
  console.log("Google Maps API Loaded. Initializing...");
  updateDashboard();
}

// Fetch CSV data from the published Google Sheet
async function fetchCSV() {
  const response = await fetch(SHEET_CSV_URL);
  return await response.text();
}

// Parse CSV text into an array of objects
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

// Return today's date in M/D/YYYY format
function getTodayInMDYYYY() {
  const today = new Date();
  return `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
}

// Geocode an address using Google Maps Geocoding API
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

// Get travel time from origin to destination using Google Maps Directions API
async function getTravelTime(origin, destination) {
  return new Promise((resolve, reject) => {
    if (!google || !google.maps) {
      reject("Google Maps API not loaded!");
      return;
    }
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: origin,
        destination: destination,
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
  });
}

/**
 * Calculate departure time.
 * @param {string} eventStartTimeStr - The event start time in ISO format (e.g., "2024-11-03T15:00:00").
 * @param {string} travelTimeText - The travel time from Google Maps (e.g., "35 mins").
 * @param {number} [buffer=5] - Optional buffer in minutes.
 * @returns {Date} - The computed departure time.
 */
function calculateDepartureTime(eventStartTimeStr, travelTimeText, buffer = 5) {
  // Extract minutes from travelTimeText (assumes format like "35 mins")
  const travelTimeMinutes = parseInt(travelTimeText, 10);
  const eventStartTime = new Date(eventStartTimeStr);
  // Subtract travel time and buffer (converted to milliseconds) from event start time
  const departureTime = new Date(
    eventStartTime.getTime() - (travelTimeMinutes + buffer) * 60000
  );
  return departureTime;
}

// Update the dashboard with event info, travel ETA, and map embed.
// Note: Departure time is no longer displayed here but is stored in localStorage for use on your other site.
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
    // Clear any previously stored ETA and departure time
    localStorage.removeItem("eventETA");
    localStorage.removeItem("eventDepartureTime");
    return;
  }

  const venueName = todaysEvent["Venue Name"];
  const destAddress = `${todaysEvent["Address"]}, ${todaysEvent["City"]}, ${todaysEvent["State"]} ${todaysEvent["Zipcode"]}`;
  const eventStartTimeStr = todaysEvent["Event Start Time"]; // Should be in ISO format

  venueEl.textContent = venueName;

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
    const travelTime = await getTravelTime(ORIGIN_ADDRESS, destAddress);
    etaEl.textContent = `Estimated Travel Time: ${travelTime}`;

    // Save ETA to localStorage for your first website
    localStorage.setItem("eventETA", travelTime);

    // Calculate departure time and store it in localStorage for your other GitHub site
    if (eventStartTimeStr) {
      const departureTime = calculateDepartureTime(eventStartTimeStr, travelTime);
      // Storing as an ISO string; your other site can format it as needed
      localStorage.setItem("eventDepartureTime", departureTime.toISOString());
    } else {
      localStorage.removeItem("eventDepartureTime");
    }
  } catch (error) {
    etaEl.textContent = error;
  }

  const wazeURL = `https://embed.waze.com/iframe?zoom=12&from_lat=${originCoords.lat}&from_lon=${originCoords.lng}&to_lat=${destCoords.lat}&to_lon=${destCoords.lng}&pin=1`;
  mapEl.src = wazeURL;
}


