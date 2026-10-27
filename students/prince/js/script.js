// Set caching for 10 minutes to reduce API calls and improve performance
// 10 minutes in milliseconds
const CACHE_TIME_WEATHER = 10 * 60 * 1000;
// Set Wikipedia cache TTL to 24 hours
const CACHE_TIME_WIKI = 24 * 60 * 60 * 1000;

// Save data to localStorage
// https://javascript.info/localstorage
function saveToCache(name, data) {
  const entry = {
    // Add a timestamp to the entry
    savedAt: Date.now(),
    data: data
  };
  // Store the data as JSON string in localStorage
  localStorage.setItem(name, JSON.stringify(entry));
}

// Read data from localStorage
function readFromCache(name, maxAge) {
  const raw = localStorage.getItem(name);
  if (!raw) return null;

  // Parse the stored JSON string to get the saved data and timestamp
  const entry = JSON.parse(raw);
  const age = Date.now() - entry.savedAt;

  // If the data is older than maxAge, delete it and return null
  if (age > maxAge) {
    localStorage.removeItem(name);
    return null;
  }

  return entry.data;
}

// Show error message
function showError(msg) {
  const err = document.getElementById("error-message");
  err.textContent = msg;
  err.style.display = "block";
}

// Clear error message
function clearError() {
  const err = document.getElementById("error-message");
  err.textContent = "";
  err.style.display = "none";
}

// Show skeleton loaders
function showSkeletons() {
  document.getElementById("wiki-thumbnail-wrapper").style.display = "block";
  document.getElementById("wiki-title-wrapper").style.display = "block";
  document.getElementById("wiki-description-wrapper").style.display = "block";
}

// Hide skeleton loaders
function hideSkeletons() {
  document.getElementById("wiki-thumbnail-wrapper").style.display = "none";
  document.getElementById("wiki-title-wrapper").style.display = "none";
  document.getElementById("wiki-description-wrapper").style.display = "none";
}

// Set loading state for submit button
function setLoadingState(isLoading) {
  const btn = document.getElementById("submit-btn");
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Loading…" : "Submit";
}

// API Endpoints for geocoding, weather, air quality, and Wikipedia
const API_BASE = {
  GEOCODING: "https://geocoding-api.open-meteo.com/v1/search",
  WEATHER: "https://api.open-meteo.com/v1/forecast",
  AIR_QUALITY: "https://air-quality-api.open-meteo.com/v1/air-quality",
  WIKIPEDIA: "https://en.wikipedia.org/api/rest_v1/page/summary",
};

// Helper function to encode city names for URLs
function encodeCity(cityName) {
  if (!cityName || cityName.trim() === "") {
    throw new Error("City name cannot be empty");
  }
  // encodeURIComponent() - JavaScript function that encodes special characters in a URL so that they don't break the URL syntax.
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
  return encodeURIComponent(cityName.trim());
}

// Helper function to format city name  by capitalizing the first letter of each word
// Cities with multiple words were failing to fetch Wikipedia data (eg. New York, Cape Town)
function formatCityName(cityName) {
  return cityName
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* Helper functions to build API URLs */

// Build Geocoding API URL with query parameters
function buildGeocodingURL(cityName) {
  return `${API_BASE.GEOCODING}?name=${encodeCity(cityName)}`;
}

// Build Weather API URL with query parameters
function buildWeatherURL(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    timezone: "auto",
  });
  return `${API_BASE.WEATHER}?${params}`;
}

// Build Air Quality API URL with query parameters
function buildAirQualityURL(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "us_aqi,pm10,pm2_5",
    timezone: "auto",
  });
  return `${API_BASE.AIR_QUALITY}?${params}`;
}

// Build Wikipedia API URL
function buildWikipediaURL(cityName) {
  return `${API_BASE.WIKIPEDIA}/${encodeCity(cityName)}`;
}

// Helper function to get AQI radius
function getAqiRadius(aqiValue) {
  if (!aqiValue) return 3000;
  if (aqiValue <= 50) return 2000; // Good
  if (aqiValue <= 100) return 4000; // Moderate
  if (aqiValue <= 150) return 6000; // Unhealthy for sensitive
  if (aqiValue <= 200) return 8000; // Unhealthy
  if (aqiValue <= 300) return 12000; // Very unhealthy
  return 16000; // Hazardous
}

// Helper function to get weather description from code
// https://open-meteo.com/en/docs#weather_variable_documentation
function getWeatherDescription(code) {
  const weatherCodes = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return weatherCodes[code] || "Unknown";
}

// Helper function to get AQI info (color and label) based on AQI value
function getAqiInfo(aqiValue) {
  if (aqiValue === null || aqiValue === undefined) {
    return { color: "#cccccc", label: "Unknown" };
  }

  if (aqiValue <= 50) {
    return { color: "#2d8c5a", label: "Good" };
  } else if (aqiValue <= 100) {
    return { color: "#e6b422", label: "Moderate" };
  } else if (aqiValue <= 150) {
    return { color: "#e8853a", label: "Unhealthy for Sensitive Groups" };
  } else if (aqiValue <= 200) {
    return { color: "#cd5c5c", label: "Unhealthy" };
  } else if (aqiValue <= 300) {
    return { color: "#8b5f8c", label: "Very Unhealthy" };
  } else {
    return { color: "#8b3a3a", label: "Hazardous" };
  }
}

// Initialize Leaflet Map
// https://leafletjs.com/reference.html#map-example
let map;
let currentMarker = null;
let currentCircle = null;

function initMap() {
  // Define map view with default coordinates (London) and zoom level 13
  map = L.map("map").setView([51.505, -0.09], 13);

  // Add OpenStreetMap base layer with attribution and max zoom level
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);
}

// Update map with weather and AQI data
function updateMapWithWeather(
  lat,
  lon,
  cityName,
  weatherCode,
  temperature,
  aqi,
) {
  // Map view with zoom level 12
  map.setView([lat, lon], 12);

  if (currentMarker) map.removeLayer(currentMarker);
  if (currentCircle) map.removeLayer(currentCircle);

  // Circle color based on AQI level
  const aqiInfo = getAqiInfo(aqi ? aqi.us_aqi : null);
  const circleColor = aqiInfo.color;
  const fillColor = aqiInfo.color;

  currentMarker = L.marker([lat, lon]).addTo(map);

  // Weather description from weather code
  const weatherDesc = getWeatherDescription(weatherCode);

  // popup with city name, weather and AQI info
  currentMarker
    .bindPopup(
      `
    <b style="color: ${circleColor}">${formatCityName(cityName)}</b><br>
    🌡️ ${temperature}°C<br>
    ☁️ ${weatherDesc}<br>
    🗰 AQI: ${aqi ? aqi.us_aqi : "N/A"}
  `,
    )
    .openPopup();

  // AQI circle with radius based on AQI level
  currentCircle = L.circle([lat, lon], {
    color: circleColor,
    fillColor: fillColor,
    fillOpacity: 0.2,
    radius: getAqiRadius(aqi ? aqi.us_aqi : null),
  }).addTo(map);
}

// Show result sections when data loads
function showResultsSections() {
  const resultsContainer = document.getElementById("results-container");
  resultsContainer.hidden = false;

  // Added a small delay to make sure the map container is visible before setting the map size
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 100);
}

// Hide result sections before fetching data
function hideResultsSections() {
  const resultsContainer = document.getElementById("results-container");
  resultsContainer.hidden = true;
}

// Get and validate city input
function getValidatedCityInput() {
  // Trim input and check if it's empty
  // Trim removes whitespace from both ends of a string
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim
  const value = document.getElementById("city-input").value.trim();

  // If input is empty then show error and return null
  if (!value) {
    showError("Please enter a city name.");
    return null;
  }
  return value;
}

// Clear input field after submission
function clearInput() {
  document.getElementById("city-input").value = "";
}

// Form submission handler
document.getElementById("city-form").addEventListener("submit", async (e) => {
  // Prevent default form submission
  e.preventDefault();

  // Reset UI and show loading state
  clearError();

  // Get and validate city input
  const cityName = getValidatedCityInput();
  if (!cityName) return;

  // Set loading state for submit button
  setLoadingState(true);

  // Fetch city data with error handling
  try {
    await fetchCityData(cityName);
  } catch (error) {
    // show an error message
    showError("Failed to fetch city data. Please try again.");
  } finally {
    // Reset loading state and clear input field for the next search
    setLoadingState(false);
    clearInput();
  }
});

// Fetch geocoding data for the city
async function fetchGeocoding(cityName) {
  const cacheName = `geocode_${cityName.toLowerCase()}`;
  const cached = readFromCache(cacheName, CACHE_TIME_WEATHER);

  // Return cached data if available
  if (cached) return cached;

  // Fetch from API if not cached
  const res = await fetch(buildGeocodingURL(cityName));
  if (!res.ok) throw new Error("Geocoding API error");
  const json = await res.json();

  // Save to cache for future requests
  saveToCache(cacheName, json);
  return json;
}

// Reset Wikipedia UI data
function resetWikiUI() {
  const thumbnail = document.getElementById("wiki-thumbnail");
  thumbnail.src = "";
  thumbnail.style.display = "none";

  document.getElementById("wiki-title").textContent = "";
  document.getElementById("wiki-description").textContent = "";
  document.getElementById("wiki-link").style.display = "none";

  // Show skeleton loaders while data is loading
  showSkeletons();
}

// Fetch city data - geocoding, weather, AQI, Wikipedia
async function fetchCityData(cityName) {
  // check if user is online, if not show an error
  if (!navigator.onLine) {
    showError("You appear to be offline. Check your connection and try again.");
    return;
  }

  try {
    // Fetch geocoding data
    const geoData = await fetchGeocoding(cityName);

    // Check if geocoding results are valid
    if (!geoData.results || geoData.results.length === 0) {
      showError("City not found. Please try another city.");
      return;
    }

    // Extract latitude, longitude, and name
    const { latitude, longitude, name } = geoData.results[0];

    // Hide previous results
    hideResultsSections();

    // Reset Wikipedia UI
    resetWikiUI();

    // Clear previous error
    clearError();

    // Show result section
    showResultsSections();

    // Fetch all city data
    await fetchAllCityData(cityName, latitude, longitude);
  } catch (error) {
    // show an error message
    showError("Failed to fetch city data. Please try again.");
    console.error("Error fetching city data:", error);
  }
}

// Update map with weather and AQI data
function updateMapAfterLoad(lat, lon, cityName, weather, aqi) {
  // Check if weather data is available
  if (weather.status !== "fulfilled" || !weather.value) return;

  const { temperature_2m, weather_code } = weather.value.current;
  const aqiCurrent =
    aqi.status === "fulfilled" && aqi.value ? aqi.value.current : null;
  
  // Update map with weather and AQI data
  updateMapWithWeather(
    lat,
    lon,
    cityName,
    weather_code,
    temperature_2m,
    aqiCurrent,
  );
}

// Fetch weather, AQI and Wikipedia data in parallel
async function fetchAllCityData(cityName, lat, lon) {
  // Fetch all in parallel with individual error handling
  // Promise.allSettled() - JavaScript method that takes an array of promises and returns a new promise that resolves after all of the input promises have settled (either fulfilled or rejected).
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
  const [weather, aqi, wiki] = await Promise.allSettled([
    fetchWeather(lat, lon),
    fetchAirQuality(lat, lon),
    fetchWikipedia(cityName),
  ]);

  // Update UI individually based on the availability of data
  updateWeatherUI(weather);
  updateAQIUI(aqi);
  updateWikiUI(wiki);
  updateMapAfterLoad(lat, lon, cityName, weather, aqi);
  hideSkeletons();
}

// Fetch weather data
async function fetchWeather(lat, lon) {
  // Check cache to avoid unnecessary API calls
  const cacheName = `weather_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const cached = readFromCache(cacheName, CACHE_TIME_WEATHER);

  // Return cached data if available
  if (cached) return cached;

  // Fetch weather data if not cached
  const res = await fetch(buildWeatherURL(lat, lon));
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const json = await res.json();

  // Save to cache
  saveToCache(cacheName, json);
  return json;
}

// Update weather UI
function updateWeatherUI(result) {
  // Check if weather data is available
  if (result.status === "fulfilled" && result.value) {
    const weatherData = result.value;

    // Transform raw weather data
    const transformed = transformWeatherData(weatherData);
    
    // show error message if mising data
    if (!transformed) {
      showError("Weather data could not be read.");
      return;
    }

    // Weather description from weather code
    const weatherDesc = getWeatherDescription(transformed.weatherCode);

    // Update weather section with weatherData
    document.getElementById("temperature").textContent =
      `${transformed.temperature} ${weatherDesc}`;
    document.getElementById("humidity").textContent =
      transformed.relativeHumidity;
    document.getElementById("wind-speed").textContent = transformed.windSpeed;
  } else {
    showError("Weather data not available for this location.");
  }
}

// Transform raw weather data into simple format
function transformWeatherData(rawData) {
  // Return null if data is missing
  if (!rawData || !rawData.current) return null;

  // Extract the required data
  const current = rawData.current;
  const units = rawData.current_units || {};

  // Return a simplified data to read
  return {
    temperature: current.temperature_2m
      ? `${current.temperature_2m}${units.temperature_2m || "°"}`
      : null,
    relativeHumidity: current.relative_humidity_2m
      ? `${current.relative_humidity_2m}${units.relative_humidity_2m || ""}`
      : null,
    windSpeed: current.wind_speed_10m
      ? `${current.wind_speed_10m}${units.wind_speed_10m || ""}`
      : null,
    weatherCode: current.weather_code || null,
  };
}

// Fetch air quality data
async function fetchAirQuality(lat, lon) {
  // Check cache to avoid unnecessary API calls
  const cacheName = `aqi_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const cached = readFromCache(cacheName, CACHE_TIME_WEATHER);

  // Return cached data if available
  if (cached) return cached;

  // Fetch AQI data if not cached
  const res = await fetch(buildAirQualityURL(lat, lon));
  if (!res.ok) throw new Error(`Air Quality API error: ${res.status}`);
  const json = await res.json();

  // Save to cache
  saveToCache(cacheName, json);
  return json;
}

// Update AQI UI
function updateAQIUI(result) {
  if (result.status === "fulfilled" && result.value) {
    const aqiData = result.value;

    // Update AQI section with aqiData
    const transformed = transformAQIData(aqiData);
    document.getElementById("aqi").textContent = transformed.usAQI;
    document.getElementById("pm10").textContent = transformed.pm10;
    document.getElementById("pm25").textContent = transformed.pm25;
  } else {
    showError("Air quality data not available");
  }
}

// Transform raw AQI data
function transformAQIData(rawData) {
  if (!rawData || !rawData.current) return null;

  const current = rawData.current;
  const units = rawData.current_units || {};

  // Use the helper function to get AQI info
  const aqiInfo = getAqiInfo(current.us_aqi);

  return {
    usAQI: current.us_aqi ? `${current.us_aqi} ${aqiInfo.label || ""}` : null,
    pm10: current.pm10 ? `${current.pm10} ${units.pm10 || ""}` : null,
    pm25: current.pm2_5 ? `${current.pm2_5} ${units.pm2_5 || ""}` : null,
  };
}

// Fetch Wikipedia data
async function fetchWikipedia(cityName) {
  const formattedName = formatCityName(cityName);
  // Cache Wiki Data for 24 hours
  const cacheName = `wiki_${formattedName.toLowerCase()}`;
  const cached = readFromCache(cacheName, CACHE_TIME_WIKI);

  if (cached) return cached;

  try {
    const wikiRes = await fetch(buildWikipediaURL(formattedName));
    if (!wikiRes.ok) throw new Error("Wikipedia API error");
    const json = await wikiRes.json();
    saveToCache(cacheName, json);
    return json;
  } catch (error) {
    showError("Wikipedia data not available");
    return null;
  }
}

// Update Wikipedia UI
function updateWikiUI(result) {
  // Clear previous data when searching a new city
  const thumbnail = document.getElementById("wiki-thumbnail");
  thumbnail.src = "";
  thumbnail.style.display = "none";
  thumbnail.classList.add("skeleton");

  if (result.status === "fulfilled" && result.value) {
    const wikiData = result.value;

    // Update Wikipedia section with wikiData
    const transformed = transformWikiData(wikiData);

    document.getElementById("wiki-title").textContent = transformed.title;
    document.getElementById("wiki-description").textContent =
      transformed.description;

    const thumbnail = document.getElementById("wiki-thumbnail");
    if (transformed.thumbnail) {
      thumbnail.src = transformed.thumbnail;
      thumbnail.alt = transformed.title || "City image";
      thumbnail.style.display = "block";
    } else {
      // Default image from Freepik.com
      thumbnail.src = "/assets/landscape.jpg";
      thumbnail.alt = "Default city image";
      thumbnail.style.display = "none";
    }

    const link = document.getElementById("wiki-link");
    if (transformed.wikiUrl) {
      link.href = transformed.wikiUrl;
      link.style.display = "";
    } else {
      link.style.display = "none";
    }

  } else {
    showError("Wikipedia data not available");
  }
}

// Transform raw Wikipedia data into simple format
function transformWikiData(rawData) {
  if (!rawData) return null;

  return {
    title: rawData.title || null,
    description: rawData.extract ? rawData.extract.slice(0, 250) + "..." : null,
    thumbnail: rawData.originalimage ? rawData.originalimage?.source : null,
    wikiUrl: rawData.content_urls?.desktop?.page || null,
  };
}

// Initialize map when page loads
document.addEventListener("DOMContentLoaded", () => {
  initMap();
});
