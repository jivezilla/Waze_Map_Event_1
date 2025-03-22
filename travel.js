// travel.js

// Your published CSV URL from Google Sheets
var SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";

// The origin address
var ORIGIN_ADDRESS = "221 Corley Mill Rd, Lexington, SC 29072";

/**
 * We attach initMap to window so the Google script can find it.
 */
window.initMap = function() {
  console.log("Google Maps API Loaded. Initializing...");
  updateDashboard();
};

/**
 * Fetch the CSV from Google Sheets.
 */
function fetchCSV() {
  return fetch(SHEET_CSV_URL).then(function(response) {
    console.log("Fetch finished loading:", response.url);
    return response.text();
  });
}

/**
 * Parse the CSV into an array of objects.
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
        resolve(null); // or reject if you want to handle errors differently
      }
    });
  });
}

/**
 * Get travel time from origin to destination using DirectionsService.
 */
/**
 * Get travel time from origin to destination using DistanceMatrixService.
 * This is an alternative to DirectionsService if you just want the travel time.
 */
function getTravelTime(origin, destination) {
  return new Promise(function(resolve, reject) {
    if (!google || !google.maps) {
      reject("Google Maps API not loaded!");
      return;
    }
    var distanceService = new google.maps.DistanceMatrixService();
    distanceService.getDistanceMatrix(
      {
        origins: [origin],        // array of 1 address or LatLng
        destinations: [destination],
        travelMode: google.maps.TravelMode.DRIVING,
      },
      function(response, status) {
        if (status === "OK") {
          // Grab the first (and only) element
          var element = response.rows[0].elements[0];
          if (element.status === "OK") {
            var durationText = element.duration.text;
            resolve(durationText);
          } else {
            reject("Could not retrieve travel time: " + element.status);
          }
        } else {
          reject("DistanceMatrix request failed: " + status);
        }
      }
    );
  });
}


/**
 * Main function to update the dashboard.
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
    var todaysEvent = null;
    if (todayEvents.length > 0) {
      todaysEvent = todayEvents[todayEvents.length - 1];
    }

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

    // Geocode both origin & destination
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

      // Get travel time
      getTravelTime(ORIGIN_ADDRESS, destAddress)
        .then(function(travelTime) {
          etaEl.textContent = "Estimated Travel Time: " + travelTime;
          // Store the ETA for another site to use
          localStorage.setItem("eventETA", travelTime);
        })
        .catch(function(error) {
          etaEl.textContent = error;
        });

      // Embed a Google Map with driving directions
      var googleMapsEmbedURL = "https://www.google.com/maps/embed/v1/directions?key=" +
        "AIzaSyB4b4Ho4rNwF9hyPKCYFYXNU6dXI550M6U" +
        "&origin=" + encodeURIComponent(ORIGIN_ADDRESS) +
        "&destination=" + encodeURIComponent(destAddress) +
        "&mode=driving";

      mapEl.src = googleMapsEmbedURL;
    });
  });
}
