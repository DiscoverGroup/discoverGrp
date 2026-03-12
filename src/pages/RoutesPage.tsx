import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { fetchTours, fetchToursByCountry } from "../api/tours";
import type { Tour } from "../types";
import TourCard from "../components/TourCard";
import React from "react";

export default function RoutesPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [searchParams] = useSearchParams();
  const countryFilter = searchParams.get("country") ?? "";

  useEffect(() => {
    if (countryFilter) {
      fetchToursByCountry(countryFilter).then(setTours);
    } else {
      fetchTours().then(setTours);
    }
  }, [countryFilter]);

  // Prettify the country slug for display ("japan" → "Japan", "united-kingdom" → "United Kingdom")
  const countryLabel = countryFilter
    ? countryFilter
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : "";

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto p-6">
        {/* Back link when filtering by country */}
        {countryFilter && (
          <Link
            to={`/destinations/${countryFilter}`}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mb-4 text-sm font-medium"
          >
            ← Back to {countryLabel}
          </Link>
        )}

        <h1 className="text-3xl font-bold mb-6 text-gray-900">
          {countryLabel ? `${countryLabel} Tours` : "Our Routes"}
        </h1>

        {/* Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {tours.length > 0 ? (
            tours.map((tour) => <TourCard key={tour.id} tour={tour} />)
          ) : (
            <p className="col-span-full text-gray-700 text-center py-12 text-lg">
              {countryFilter ? `No tours found for ${countryLabel}.` : "No tours found."}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
