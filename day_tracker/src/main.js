


const form = document.querySelector('#search-form');
const input = document.querySelector('#address-input');
const locateBtn = document.querySelector('#locate-btn');
const resultContainer = document.querySelector('#result-container');
const errorMessage = document.querySelector('#error-message');
const btnText = document.querySelector('.btn-text');
const loader = document.querySelector('.loader');

// Elements to update
const locationNameEl = document.querySelector('#location-name');
const sunriseTimeEl = document.querySelector('#sunrise-time');
const sunsetTimeEl = document.querySelector('#sunset-time');
const dayLengthEl = document.querySelector('#day-length');
const solsticeCountdownEl = document.querySelector('#solstice-countdown');
const localTimeEl = document.querySelector('#local-time');
const dayTimelineEl = document.querySelector('#day-timeline');
const sunIconGroup = document.querySelector('#sun-icon-group');

let currentUtcOffset = null; // Minutes
let currentTodayData = null;

function startClock() {
    setInterval(() => {
        if (currentUtcOffset === null) return;

        const now = new Date();
        const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        const targetMs = utcMs + (currentUtcOffset * 60000);
        const targetDate = new Date(targetMs);

        localTimeEl.textContent = targetDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Update Sun Position and Gradient Live
        if (currentTodayData) {
            const seconds = targetDate.getHours() * 3600 +
                            targetDate.getMinutes() * 60 +
                            targetDate.getSeconds();

            updateSunVisuals(seconds, currentTodayData);
        }
    }, 1000);
}

function updateSunVisuals(currentSec, data) {
    const sunrise = parseTimeStr(data.sunrise);
    const sunset = parseTimeStr(data.sunset);

    let percent = 0;
    let isDay = false;

    if (currentSec <= sunrise) {
        percent = 0;
    } else if (currentSec >= sunset) {
        percent = 1;
    } else {
        percent = (currentSec - sunrise) / (sunset - sunrise);
        isDay = true;
    }

    const angle = Math.PI + (percent * Math.PI);
    const r = 80;
    const cx = 100;
    const cy = 90;

    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    if (sunIconGroup) {
         sunIconGroup.style.transform = `translate(${x}px, ${y}px)`;
         sunIconGroup.style.opacity = isDay ? '1' : '0.3';
    }

    updateSkyGradient(currentSec, data);
}

function updateSkyGradient(currentSec, data) {
    const sunrise = parseTimeStr(data.sunrise);
    const sunset = parseTimeStr(data.sunset);
    const dawn = parseTimeStr(data.dawn);
    const dusk = parseTimeStr(data.dusk);

    let className = 'sky-night';
    const buffer = 1800; // 30 mins

    if (currentSec >= sunrise + buffer && currentSec <= sunset - buffer) {
        className = 'sky-day';
    } else if (currentSec >= sunrise - buffer && currentSec <= sunrise + buffer) {
        className = 'sky-sunrise';
    } else if (currentSec >= sunset - buffer && currentSec <= sunset + buffer) {
        className = 'sky-sunset';
    } else if (currentSec >= dawn && currentSec < sunrise - buffer) {
        className = 'sky-civil';
    } else if (currentSec > sunset + buffer && currentSec <= dusk) {
        className = 'sky-civil';
    } else if (currentSec >= parseTimeStr(data.first_light) && currentSec < dawn) {
        className = 'sky-nautical';
    } else if (currentSec > dusk && currentSec <= parseTimeStr(data.last_light)) {
        className = 'sky-nautical';
    } else if (currentSec > parseTimeStr(data.last_light) || currentSec < parseTimeStr(data.first_light)) {
        className = 'sky-night';
    } else {
        className = 'sky-night';
    }

    document.body.classList.remove(
        'sky-night', 'sky-astro', 'sky-nautical', 'sky-civil',
        'sky-sunrise', 'sky-sunset', 'sky-day',
        'theme-night', 'theme-day'
    );
    document.body.classList.add(className);
}

startClock();

// Init
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query) {
        input.value = query;
        performSearch(query, false); // Don't push state on initial load
    }
});

// Handle Back/Forward
window.addEventListener('popstate', (e) => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query) {
        input.value = query;
        performSearch(query, false);
    } else {
        // Reset to initial state if needed, or just clear input
        input.value = '';
        resultContainer.classList.add('hidden');
    }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  performSearch(query, true); // Push state on form submit
});

// Locate Button Handler
locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        try {
            // Reverse geocode to get city name for the input field
            // Using Open-Meteo (CORS enabled)
            const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to get your location name');

            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                 showError('Could not determine your city name.');
                 setLoading(false);
                 return;
            }

            const result = data.results[0];

            // Construct query
            let query = result.name;
            if (result.admin1) query += `, ${result.admin1}`;
            if (result.country) query += `, ${result.country}`;

            if (query) {
                input.value = query;
                performSearch(query, true);
            } else {
                showError('Could not determine your city name.');
                setLoading(false);
            }

        } catch (err) {
            console.error(err);
            showError('Failed to retrieve location info.');
            setLoading(false);
        }
    }, () => {
        showError('Unable to retrieve your location. Please check permissions.');
        setLoading(false);
    });
});

async function performSearch(query, pushState = true) {
  // Reset UI
  setLoading(true);
  showError(null);

  // Keep previous result visible but dimmed to prevent layout jump
  if (!resultContainer.classList.contains('hidden')) {
    resultContainer.classList.add('updating');
  }

  try {
    // 1. Geocode
    const coords = await getCoordinates(query);

    // 2. Get Day Length (Today) AND Solstices for min/max
    // We only need today now, not a range
    const todayStr = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();

    const [todayData, solstice1, solstice2] = await Promise.all([
      getDayLength(coords.lat, coords.lon, todayStr, todayStr),
      getDayLength(coords.lat, coords.lon, `${currentYear}-06-21`, `${currentYear}-06-21`),
      getDayLength(coords.lat, coords.lon, `${currentYear}-12-21`, `${currentYear}-12-21`)
    ]);

    // 3. Update UI
    updateUI(coords.display_name, todayData, solstice1, solstice2);

    // 4. Update URL
    if (pushState) {
        const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }

  } catch (err) {
    console.error(err);
    showError(err.message || 'Something went wrong. Please try again.');
    // If error, hide the potentially stale result
    resultContainer.classList.add('hidden');
  } finally {
    setLoading(false);
    resultContainer.classList.remove('updating');
  }
}



async function getCoordinates(query) {
  // Use Open-Meteo Geocoding API (CORS enabled)
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;

  const response = await fetch(url);

  if (!response.ok) throw new Error('Failed to fetch location data');

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error('Location not found');
  }

  // Use first result
  const result = data.results[0];

  let displayName = result.name;
  // Only add admin1 (Region/State) if it's different from the city name
  if (result.admin1 && result.admin1 !== result.name) {
      displayName += `, ${result.admin1}`;
  }
  if (result.country) {
      displayName += `, ${result.country}`;
  }

  return {
    lat: result.latitude,
    lon: result.longitude,
    display_name: displayName
  };
}

async function getDayLength(lat, lng, start, end) {
  // Direct call to sunrisesunset.io (CORS enabled)
  const url = `https://api.sunrisesunset.io/json?lat=${lat}&lng=${lng}&date_start=${start}&date_end=${end}`;

  const response = await fetch(url);

  if (!response.ok) throw new Error('Failed to fetch day length data');

  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error('Could not calculate day length');
  }

  return data.results; // Returns array for range
}

function parseDuration(durationStr) {
  const parts = durationStr.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  return h * 3600 + m * 60 + s;
}

function updateUI(locationName, data, solstice1, solstice2) {
  // API returns array. result[0] is today.
  const today = data[0];

  locationNameEl.textContent = locationName;
  sunriseTimeEl.textContent = today.sunrise; // Display directly (e.g., "8:07 AM")
  sunsetTimeEl.textContent = today.sunset;

  // Set global offset for the clock
  currentUtcOffset = today.utc_offset || 0;
  currentTodayData = today;

  // Calculate Current Time at Location (in seconds from midnight)
  const now = new Date();
  // Get UTC time in ms, add offset (minutes * 60 * 1000)
  // utc_offset is from API (e.g. 0 or 540)
  const offsetMin = today.utc_offset || 0;
  const localNowMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (offsetMin * 60000);
  const localDate = new Date(localNowMs);
  const localSec = localDate.getHours() * 3600 + localDate.getMinutes() * 60 + localDate.getSeconds();

  // Immediate Update for Sun/Sky (Fixes lag)
  updateSunVisuals(localSec, today);

  // Helper: Format "09:47:12" to "9h 47m"
  const formatLength = (val) => {
      if (!val) return '--h --m';
      // If it's number (unlikely here but handled for safety)
      if (typeof val === 'number') {
           const h = Math.floor(val / 3600);
           const m = Math.floor((val % 3600) / 60);
           return `${h}h ${m}m`;
      }
      // "09:47:12"
      const parts = val.split(':');
      if (parts.length >= 2) {
        return `${parseInt(parts[0], 10)}h ${parseInt(parts[1], 10)}m`;
      }
      return val;
  };

  dayLengthEl.textContent = formatLength(today.day_length);

  // Update Progress Bar (Seasonal 24h)
  const parseDur = (val) => {
      if (typeof val === 'number') return val;
      // parseDuration handles "H:M:S"
      return parseDuration(val);
  };

  const todaySec = parseDur(today.day_length);
  const s1Sec = parseDur(solstice1[0].day_length);
  const s2Sec = parseDur(solstice2[0].day_length);

  const minSec = Math.min(s1Sec, s2Sec);
  const maxSec = Math.max(s1Sec, s2Sec);

  // Total seconds in a day = 86400
  const totalSec = 86400;

  const minPercent = (minSec / totalSec) * 100;
  const maxPercent = (maxSec / totalSec) * 100;
  const currentPercent = (todaySec / totalSec) * 100;

  const barMin = document.getElementById('bar-min-fill');
  const barMax = document.getElementById('bar-max-fill');
  const indicator = document.getElementById('bar-current-indicator');
  const progressLabel = document.getElementById('day-percent');

  if (barMin && barMax && indicator && progressLabel) {
      setTimeout(() => {
        barMin.style.width = `${minPercent}%`;
        // Max fill is from maxPercent to 100%.
        // Using right:0, so width is (100 - maxPercent)
        barMax.style.width = `${100 - maxPercent}%`;
        indicator.style.left = `${currentPercent}%`;
      }, 50);

      const minInfo = formatLength(minSec === s1Sec ? solstice1[0].day_length : solstice2[0].day_length);
      const maxInfo = formatLength(maxSec === s1Sec ? solstice1[0].day_length : solstice2[0].day_length);

      progressLabel.textContent = `${formatLength(today.day_length)} (Annual Range: ${minInfo} - ${maxInfo})`;
  }

  // Update Solstice Countdown
  const countdownNow = new Date();
  const currentYear = countdownNow.getFullYear();

  // Approximate dates
  const juneSolstice = new Date(Date.UTC(currentYear, 5, 21)); // Month is 0-indexed (5 = June)
  const decSolstice = new Date(Date.UTC(currentYear, 11, 21));

  let targetSolstice;
  let eventName;

  // Find the next one
  if (now < juneSolstice) {
      targetSolstice = juneSolstice;
      eventName = "Summer Solstice"; // Northern Hemisphere bias, but "June Solstice" is safer? Let's use generic names.
      // Actually, let's just say "Solstice" or specific.
      // User is likely in Northern Hemisphere based on "Sea/Lon".
      // Let's use "June Solstice" / "December Solstice" to be neutral but clear.
      eventName = "June Solstice";
  } else if (now < decSolstice) {
      targetSolstice = decSolstice;
      eventName = "December Solstice";
  } else {
      // Next year June
      targetSolstice = new Date(Date.UTC(currentYear + 1, 5, 21));
      eventName = "June Solstice";
  }

  const diffTime = targetSolstice - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (solsticeCountdownEl) {
      solsticeCountdownEl.textContent = `${diffDays} days until the ${eventName}`;
  }

  // Update Timeline
  renderTimeline(today);

  resultContainer.classList.remove('hidden');
}

function setLoading(isLoading) {
  if (isLoading) {
    btnText.classList.add('hidden');
    loader.classList.remove('hidden');
    input.disabled = true;
  } else {
    btnText.classList.remove('hidden');
    loader.classList.add('hidden');
    input.disabled = false;
    // Keep focus
    input.focus();
  }
}

function showError(msg) {
  if (msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  } else {
    errorMessage.classList.add('hidden');
  }
}

function parseTimeStr(timeStr) {
  if (!timeStr) return 0;
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes, seconds] = time.split(':');
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);
  seconds = seconds ? parseInt(seconds, 10) : 0;

  if (hours === 12 && modifier === 'AM') {
      hours = 0;
  }
  if (hours !== 12 && modifier === 'PM') {
      hours += 12;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function renderTimeline(data) {
  if (!dayTimelineEl) return;
  dayTimelineEl.innerHTML = '';

  // Define the start times of each phase
  // sunrisesunset.io keys: first_light, dawn, sunrise, sunset, dusk, last_light
  // Mapping:
  // Night -> first_light (Nautical Start)
  // first_light -> dawn (Civil Start)
  // dawn -> sunrise (Day Start)
  // sunrise -> sunset (Civil Start - post sunset)
  // sunset -> dusk (Nautical Start - post dusk)
  // dusk -> last_light (Night Start)
  // last_light -> 86400

  const events = [
      { name: 'night', time: 0 },
      // API 'first_light' is typically Nautical Twilight start (-12 deg).
      // We don't have Astro start, so 0->first_light is Night.
      { name: 'nautical', time: parseTimeStr(data.first_light) || 0 },
      { name: 'civil', time: parseTimeStr(data.dawn) || 0 },
      { name: 'day', time: parseTimeStr(data.sunrise) || 0 },
      { name: 'civil', time: parseTimeStr(data.sunset) || 0 },
      { name: 'nautical', time: parseTimeStr(data.dusk) || 0 },
      { name: 'night', time: parseTimeStr(data.last_light) || 0 },
      { name: 'end', time: 86400 }
  ];

  // Sort by time (handles crossing midnight or weird data order, though simple sort suffices for normal days)
  events.sort((a, b) => a.time - b.time);

  // Filter out duplicates (if times are same) to prevent 0-width divs? CSS handles 0 width fine.

  for (let i = 0; i < events.length - 1; i++) {
      const start = events[i];
      const end = events[i+1];

      const duration = end.time - start.time;
      if (duration <= 0) continue;

      const percent = (duration / 86400) * 100;

      const el = document.createElement('div');
      el.className = `timeline-segment phase-${start.name}`;
      el.style.width = `${percent}%`;
      // Simple tooltip
      el.title = `${start.name.toUpperCase()}: ${formatTimeSec(start.time)}`;

      dayTimelineEl.appendChild(el);
  }
}

function formatTimeSec(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
}
