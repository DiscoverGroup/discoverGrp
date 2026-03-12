import type { Tour } from "../types/index.js";
import { buildApiUrl } from "../config/apiBase";

const API_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url: string, timeoutMs: number = API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchTours(): Promise<Tour[]> {
  try {
    const response = await fetchWithTimeout(buildApiUrl('/public/tours'));
    if (!response.ok) {
      throw new Error(`Failed to fetch tours: ${response.status}`);
    }
    const tours = await response.json();
    console.log('✅ Loaded tours from API:', tours.length);
    return tours;
  } catch (error) {
    console.error("❌ Error fetching tours from API:", error);
    console.error("API_BASE:", buildApiUrl(''));
    // Don't return mock tours - throw error so user knows API is down
    throw new Error(`Failed to load tours from backend: ${error}`);
  }
}

export async function fetchFeaturedTours(limit: number = 6): Promise<Tour[]> {
  try {
    const response = await fetchWithTimeout(buildApiUrl(`/public/tours?limit=${limit}&featured=true`));
    if (!response.ok) {
      throw new Error(`Failed to fetch featured tours: ${response.status}`);
    }
    const tours = await response.json();
    console.log('✅ Loaded featured tours from API:', tours.length);
    return tours;
  } catch (error) {
    console.error("❌ Error fetching featured tours from API:", error);
    // Fallback to fetching all tours and taking first 6
    console.log('⚠️ Falling back to fetchTours with limit');
    const allTours = await fetchTours();
    return allTours.slice(0, limit);
  }
}

export async function fetchTourBySlug(slug: string): Promise<Tour | null> {
  try {
    const response = await fetchWithTimeout(buildApiUrl(`/public/tours/${slug}`));
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch tour: ${response.status}`);
    }
    const tour = await response.json();
    console.log('✅ Loaded tour from API:', tour.title);
    return tour;
  } catch (error) {
    console.error("❌ Error fetching tour by slug:", error);
    console.error("API_BASE:", buildApiUrl(''));
    // Don't return mock tours - throw error so user knows API is down
    throw new Error(`Failed to load tour from backend: ${error}`);
  }
}

export async function fetchContinents(): Promise<string[]> {
  try {
    const tours = await fetchTours();
    const continents = new Set<string>();
    
    tours.forEach(tour => {
      if (typeof tour.continent === "string" && tour.continent.length > 0) {
        continents.add(tour.continent);
      }
    });
    
    // Return sorted continents, with Europe first if it exists
    const continentList = Array.from(continents).sort();
    const europeIndex = continentList.indexOf('Europe');
    if (europeIndex > 0) {
      continentList.splice(europeIndex, 1);
      continentList.unshift('Europe');
    }
    
    return continentList;
  } catch {
    // Fallback to hardcoded list
    return ["Europe", "Asia", "North America"];
  }
}

// Hardcoded fallback: proper country names (never city names) per continent
const CONTINENT_COUNTRY_FALLBACK: Record<string, string[]> = {
  "Europe": ["France", "Italy", "Switzerland", "Vatican City", "Spain", "Germany", "Austria", "Netherlands", "Belgium", "Portugal", "Greece", "Czech Republic", "Hungary", "Poland", "Croatia", "United Kingdom"],
  "Asia": ["Japan", "Thailand", "Vietnam", "Philippines", "South Korea", "China", "Indonesia", "Malaysia", "Singapore", "India", "Turkey"],
  "North America": ["USA", "Canada", "Mexico"],
  "South America": ["Brazil", "Argentina", "Chile", "Peru", "Colombia"],
  "Africa": ["South Africa", "Egypt", "Morocco", "Kenya"],
  "Oceania": ["Australia", "New Zealand"],
};

export async function fetchCountriesByContinent(continent: string): Promise<string[]> {
  try {
    // Primary: fetch from the Countries collection (real country names, never cities)
    const response = await fetchWithTimeout(buildApiUrl(`/api/countries/by-continent/${encodeURIComponent(continent)}/names`));
    if (!response.ok) {
      throw new Error('Countries-by-continent API unavailable');
    }
    const data: { name: string; slug: string }[] = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map((c) => c.name);
    }
    // If the API returned an empty array, fall through to the fallback below
    throw new Error('No countries returned from API');
  } catch {
    // Fallback: return hardcoded country names (not tour data – avoids cities leaking in)
    return CONTINENT_COUNTRY_FALLBACK[continent] ?? [];
  }
}

export async function fetchDestinationsByContinent(continent: string): Promise<string[]> {
  return fetchCountriesByContinent(continent);
}

export async function fetchToursByCountry(country: string): Promise<Tour[]> {
  // Normalize to slug so both "France" and "france" match tours with "France" in countriesVisited
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const needle = normalize(country);
  const tours = await fetchTours();
  return tours.filter((t) =>
    (t.additionalInfo?.countriesVisited ?? []).some((c: string) => normalize(c) === needle)
  );
}

export async function fetchToursByContinent(continent: string): Promise<Tour[]> {
  const tours = await fetchTours();
  const continentCountries = await fetchCountriesByContinent(continent);
  return tours.filter((t) => (t.additionalInfo?.countriesVisited ?? []).some((c) => continentCountries.includes(c)));
}
