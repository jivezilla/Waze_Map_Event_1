// travel.js

var SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";
var GOOGLE_API_KEY = "AIzaSyB4b4Ho4rNwF9hyPKCYFYXNU6dXI550M6U";
var ORIGIN_ADDRESS = "221 Corley Mill Rd, Lexington, SC 29072";

/**
 * Attach initMap to window so that Google can call it when the API loads.
 */
window.initMap = function() {
  console.log("Google Maps API Loaded. Initializing...");
  updateDashboard();
};

/**
 * Fetch CSV data from your Google Sheet.
 */
function fetchCSV() {
  return fetch(SHEET_CSV_URL).then(function(response) {
    console.log("Fetch finished loading:", response.url);
    return response.text();
  });
}

/**
 * Parse CSV text into an array of objects.
 */
function parseCSV(csvText) {
  var lines = csvText.trim().split("\n");
  var headers = lines[0].split(",").map(function(h) {
    return h.trim();
  });
  var data = [];
  for (var i = 1; i < lines.length; i++) {
    var values = lines[i].split(",");
    var rowObj = {};
    for (var j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = values[j];
    }
    data.push(rowObj);
  }
  return data;
}

/**
 * Return today's date in M/D/YYYY format.
 */
function getTodayInMDYYYY() {
  var today = new Date();
  return (today.getMonth() + 1) + "/" + today.getDate() + "/" + today.getFullYear();
}

/**
 * Client-side geocoder using the Maps JavaScript API.
 */
function geocodeClientSide(address) {
  return new Promise(function(resolve, reject) {
    console.log("Geocoding: " + address);
    var geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: address }, function(results, status) {
      if (status === "OK") {
        resolve(results[0].geometry.location);
      } else {
        console.error("Geocoding failed:", status);
        resolve(null); // Continue gracefully
      }
    });
  });
}

/**
 * Get travel time from origin to destination using the new Routes API.
 * This makes a POST request to https://routes.googleapis.com/directions/v2:computeRoutes.
 */
function getTravelTime(originCoords, destCoords) {
  return new Promise(function(resolve, reject) {
    if (!originCoords || !destCoords) {
      reject("Invalid coordinates");
      return;
    }
    var url = "https://routes.googleapis.com/directions/v2:computeRoutes?key=" + GOOGLE_API_KEY;
    var requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: originCoords.lat(),
            longitude: originCoords.lng()
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destCoords.lat(),
            longitude: destCoords.lng()
          }
        }
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL", // Use TRAFFIC_AWARE_OPTIMAL for a more exhaustive search
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidHighways: false,
        avoidTolls: false,
        avoidFerries: false
      },
      languageCode: "en-US",
      units: "IMPERIAL"
    };

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Request only the route duration in the response.
        "X-Goog-FieldMask": "routes.duration"
      },
      body: JSON.stringify(requestBody)
    })
      .then(function(response) {
        if (!response.ok) {
          reject("Routes API request failed with status " + response.status);
          return;
        }
        return response.json();
      })
      .then(function(data) {
        if (data.routes && data.routes.length > 0) {
          // Assuming the API returns duration as a string (e.g., "165s")
          var travelTime = data.routes[0].duration;
          resolve(travelTime);
        } else {
          reject("No valid route found in response.");
        }
      })
      .catch(function(err) {
        reject("Routes API error: " + err);
      });
  });
}

/**
 * Update the dashboard with event info, travel ETA, and an embedded Google Map.
 */
function updateDashboard() {
  console.log("Fetching data...");
  fetchCSV().then(function(csvText) {
    var rows = parseCSV(csvText);
    var todayStr = getTodayInMDYYYY();
    var todayEvents = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i]["Date"] === todayStr) {
        todayEvents.push(rows[i]);
      }
    }
    var todaysEvent = todayEvents.length > 0 ? todayEvents[todayEvents.length - 1] : null;
    var venueEl = document.getElementById("venueName");
    var etaEl = document.getElementById("eta");
    var mapEl = document.getElementById("mapFrame");

    if (!todaysEvent) {
      venueEl.textContent = "No event today";
      etaEl.textContent = "";
      mapEl.src = "";
      localStorage.removeItem("eventETA");
      return;
    }

    var venueName = todaysEvent["Venue Name"];
    var destAddress = todaysEvent["Address"] + ", " +
                      todaysEvent["City"] + ", " +
                      todaysEvent["State"] + " " +
                      todaysEvent["Zipcode"];
    venueEl.textContent = venueName;

    // Geocode both the origin and destination addresses (client-side)
    Promise.all([
      geocodeClientSide(ORIGIN_ADDRESS),
      geocodeClientSide(destAddress)
    ]).then(function(coordsArray) {
      var originCoords = coordsArray[0];
      var destCoords = coordsArray[1];

      if (!originCoords || !destCoords) {
        etaEl.textContent = "Address not found";
        mapEl.src = "";
        return;
      }

      // Get travel time using the new Routes API
      getTravelTime(originCoords, destCoords)
        .then(function(travelTime) {
          etaEl.textContent = "Estimated Travel Time: " + travelTime;
          // Store the ETA for use on another site if needed
          localStorage.setItem("eventETA", travelTime);
        })
        .catch(function(error) {
          etaEl.textContent = error;
        });

      // Embed a Google Map with driving directions using the Maps Embed API
      var googleMapsEmbedURL = "https://www.google.com/maps/embed/v1/directions?key=" +
        GOOGLE_API_KEY +
        "&origin=" + encodeURIComponent(ORIGIN_ADDRESS) +
        "&destination=" + encodeURIComponent(destAddress) +
        "&mode=driving";
      mapEl.src = googleMapsEmbedURL;
    });
  });
}

