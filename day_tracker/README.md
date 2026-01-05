# Day Tracker

A static web application that calculates the day length for any city or zipcode. This tool was **completely**
vibe-coded, so use at your own risk. See it in action [here](https://ayberkyilmaz.net/day-tracker).

## Features

-   **Geocoding**: Converts city names or zipcodes to coordinates using OpenStreetMap (Nominatim).
-   **Day Length Calculation**: Fetches sunrise, sunset, and day length data using Sunrise-Sunset.io.
-   **Seasonal Context**: Visual 24h bar showing guaranteed daylight vs. annual variation.
-   **Solstice Countdown**: Tracks days remaining until the next Summer or Winter Solstice.
-   **Dynamic Backgrounds**: Automatically switches themes (Day/Night) based on the location's current time.
-   **Linkable Locations**: Shareable URLs (`/?q=City`). Searching updates the URL, and browser history is supported.
-   **Current Location**: One-click "Locate Me" button to find daylight data for your exact position.
-   **Proxy Support**: Configured with Vite to handle CORS for local development.

## Getting Started

### Prerequisites

-   Node.js (v14 or higher)
-   npm

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd day_tracker
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Running Locally

To start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173/`.

> **Note**: The API requests are proxied through Vite (`vite.config.js`) to avoid CORS issues during development.

### Building for Production

To create a production build:

```bash
npm run build
```

The output will be in the `dist` directory.

## APIs Used

-   [Nominatim (OpenStreetMap)](https://nominatim.org/) - For Geocoding
-   [Sunrise-Sunset.io](https://sunrisesunset.io/api/) - For Solar Data

## License

MIT
