import React, { JSX, useState, useEffect } from "react";
import SecureForm from '../../components/SecureForm';
import { createTour, updateTour, fetchTourById, fetchContinents, type Tour } from "../../services/apiClient";
import { useNavigate, useParams } from "react-router-dom";
import {
  Save,
  ArrowLeft,
  FileText,
  Clock,
  DollarSign,
  Camera,
  Plus,
  X,
  Check,
  Wand2
} from "lucide-react";
import { buildAdminApiUrl } from "../../config/apiBase";
import { useToast } from "../../components/Toast";

// --- Image Upload Helper (Cloudinary) ---
async function uploadImageToStorage(
  file: File,
  tourId: string,
  imageType: 'main' | 'gallery' | 'itinerary' | 'video' | 'related' | 'countries' | 'cities',
  dayNumber?: number
): Promise<string> {
  const formData = new FormData();
  const folder = imageType === 'itinerary' && dayNumber
    ? `tours/${tourId}/itinerary/day-${dayNumber}`
    : `tours/${tourId}/${imageType}`;
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('label', imageType);

  const response = await fetch(buildAdminApiUrl('/api/upload/single'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.message || errBody.error || `Upload failed (HTTP ${response.status})`);
  }

  const data = await response.json();
  return data.url;
}

// Simulate backend API for image record creation
async function createImageRecord(label: 'main' | 'gallery'): Promise<{ id: string; label: string; url?: string }> {
  // Replace with real API call if available
  return { id: `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label };
}

// ── Smart-paste tour text parser ───────────────────────────────────────────
const MONTH_MAP: Record<string, string> = {
  january:'01', jan:'01', february:'02', feb:'02', march:'03', mar:'03',
  april:'04',   apr:'04', may:'05',      june:'06', jun:'06', july:'07',
  jul:'07',     august:'08', aug:'08',   september:'09', sep:'09', sept:'09',
  october:'10', oct:'10', november:'11', nov:'11', december:'12', dec:'12',
};

function toISO(month: string, day: number | string, year: number | string): string {
  const m = MONTH_MAP[month.toLowerCase()] ?? '01';
  return `${year}-${m}-${String(day).padStart(2, '0')}`;
}

function parseTourText(raw: string): Partial<TourFormData> {
  const result: Partial<TourFormData> = {};
  const lines = raw.split(/\r?\n/);

  // ─ Helper: detect tour line from a string ─────────────────────────────
  function detectLine(s: string): string | null {
    const m = s.match(/route\s*([a-z])/i);
    if (m) return `ROUTE_${m[1].toUpperCase()}`;
    return null;
  }

  // ─ Title + duration ───────────────────────────────────────────────────
  const titleWithDays = raw.match(/^([^\n(]+?)\s*\((\d+)\s*days?\)/im);
  if (titleWithDays) {
    result.title = titleWithDays[1].trim();
    result.durationDays = parseInt(titleWithDays[2]);
    const detectedLine = detectLine(result.title);
    if (detectedLine) result.line = detectedLine;
    if (/europe/i.test(result.title))     result.continent = 'Europe';
    else if (/asia/i.test(result.title))  result.continent = 'Asia';
    const slug = result.title.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim();
    result.slug = `${slug}-${result.durationDays ?? 15}-days`;
  } else {
    // Fallback: use first non-empty line as title (handles "Route N Advanced" without "(X days)")
    const firstLine = lines.find(l => l.trim() && !/^(Links?|Liks?|Travel Date|Country|Optional|Full\s*Cash)/i.test(l.trim()));
    if (firstLine) {
      result.title = firstLine.trim();
      const detectedLine = detectLine(result.title);
      if (detectedLine) result.line = detectedLine;
      if (/europe/i.test(result.title))     result.continent = 'Europe';
      else if (/asia/i.test(result.title))  result.continent = 'Asia';
      const slug = result.title.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim();
      result.slug = slug;
    }
  }

  // ─ Booking links (year-tagged) — tolerates typos like "Liks for 2026:" ─
  const bookingLinks: TourFormData['bookingLinks'] = [];
  for (const line of lines) {
    // Match "Links for 2026:", "Liks for 2026:", "Link for 2026:", "links 2026:" etc.
    const lm = line.match(/Li[a-z]{0,3}s?\s+for\s+(\d{4})\s*:\s*(.+)/i)
            ?? line.match(/Links?\s+(\d{4})\s*:\s*(.+)/i);
    if (lm) {
      const year = lm[1];
      const urlPart = lm[2];
      const urls = urlPart.match(/https?:\/\/[^\s,]+/gi) ?? [];
      if (urls.length) bookingLinks.push({ year, urls });
    }
  }
  if (bookingLinks.length) result.bookingLinks = bookingLinks;

  // ─ Departure dates ───────────────────────────────────────────────
  const departureDates: TourFormData['departureDates'] = [];
  const seen = new Set<string>();
  const addDate = (start: string, end: string, price: number) => {
    const k = `${start}|${end}`;
    if (!seen.has(k)) { seen.add(k); departureDates.push({ start, end, price, isAvailable: true, currentBookings: 0 }); }
  };

  // Pattern A — same month: "May 13 - 27, 2026 (Php 170,000)" or "(Php" with no amount
  const pA = /([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),\s*(\d{4})(?:[^\n]*\(Php\s*([\d,]*)\))?/g;
  let m: RegExpExecArray | null;
  while ((m = pA.exec(raw))) {
    const [, mon, d1, d2, yr, ps] = m;
    if (MONTH_MAP[mon.toLowerCase()]) addDate(toISO(mon,d1,yr), toISO(mon,d2,yr), ps ? parseInt(ps.replace(/,/g,'')) : 0);
  }

  // Pattern B — different months: "May 25 - June 8, 2026 (Php 170,000)"
  const pB = /([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:[^\n]*\(Php\s*([\d,]*)\))?/g;
  while ((m = pB.exec(raw))) {
    const [, m1, d1, m2, d2, yr, ps] = m;
    if (MONTH_MAP[m1.toLowerCase()] && MONTH_MAP[m2.toLowerCase()])
      addDate(toISO(m1,d1,yr), toISO(m2,d2,yr), ps ? parseInt(ps.replace(/,/g,'')) : 0);
  }

  if (departureDates.length) {
    result.departureDates = departureDates.sort((a, b) => a.start.localeCompare(b.start));
    result.travelWindow = { start: result.departureDates[0].start, end: result.departureDates[result.departureDates.length - 1].end };
    const prices = result.departureDates.map(d => d.price ?? 0).filter(Boolean);
    if (prices.length) result.regularPricePerPerson = Math.max(...prices);

    // Infer duration from first departure date if not already set
    if (!result.durationDays && result.departureDates.length > 0) {
      const first = result.departureDates[0];
      const startMs = new Date(first.start).getTime();
      const endMs = new Date(first.end).getTime();
      const diffDays = Math.round((endMs - startMs) / 86400000) + 1;
      if (diffDays > 0) result.durationDays = diffDays;
    }
    // Update slug with duration if we have both
    if (result.slug && result.durationDays && !result.slug.match(/-\d+-days$/)) {
      result.slug = `${result.slug}-${result.durationDays}-days`;
    }
  }

  // ─ Promo info ───────────────────────────────────────────────────────
  let promoFlat: number | "" = "";
  let promoPercent: number | "" = "";
  const pfM = raw.match(/promo\s+price[^:]*:\s*(?:Php\s*)?(\d[\d,]*)\s*(?:,000)? /i)
             ?? raw.match(/(\d[\d,]*)\s*(?:,000)?\s*tour\s*packages?/i);
  if (pfM) promoFlat = parseInt(pfM[1].replace(/,/g,''));
  const ppM = raw.match(/(\d+)%\s*(?:discount|off)/i);
  if (ppM) promoPercent = parseInt(ppM[1]);

  // ─ Optional tours ──────────────────────────────────────────────────
  const optionalTours: TourFormData['optionalTours'] = [];
  let inOptional = false;
  for (const line of lines) {
    const l = line.trim();
    if (/optional\s*tours?\s*:/i.test(l) || /^optional\s*tours?\s*$/i.test(l)) { inOptional = true; continue; }
    if (/regular\s*rate|countr(?:y|ies)\s*to\s*visit|cit(?:y|ies)\s*to\s*visit|fullcash|full\s*cash|downpayment/i.test(l)) inOptional = false;
    if (inOptional) {
      const dm = l.match(/Day\s*(\d+)\s*[:\-–]\s*(.+)/i);
      if (dm) {
        optionalTours.push({
          day: parseInt(dm[1]),
          title: dm[2].replace(/^optional\s+(for\s+)?/i,'').trim(),
          regularPrice: "",
          promoEnabled: !!(promoFlat || promoPercent),
          promoType: promoFlat ? "flat" : "percent",
          promoValue: promoFlat || promoPercent,
        });
      }
    }
  }
  if (optionalTours.length) result.optionalTours = optionalTours;

  // ─ Downpayment + balance days ───────────────────────────────────────
  const dpM = raw.match(/Php\s*([\d,]+)\s*downpayment/i);
  if (dpM) { result.allowsDownpayment = true; result.fixedDownpaymentAmount = parseInt(dpM[1].replace(/,/g,'')); }
  const bdM = raw.match(/(\d+)\s*days?\s*before\s*travel/i);
  if (bdM) result.balanceDueDaysBeforeTravel = parseInt(bdM[1]);

  // ─ Countries ───────────────────────────────────────────────────────────
  // Matches "Country to Visit:", "Country:", "Countries:" followed by | or , separated list
  const cM = raw.match(/Countr(?:y|ies)\s*(?:to\s+visit|visited)?\s*:\s*([A-Z][A-Z\s|,&]+)/i);
  if (cM) {
    const cs = cM[1].split(/[|,]/).map(c => c.trim()).filter(Boolean)
      .map(c => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase());
    if (cs.length) {
      result.additionalInfo = {
        countriesVisited: cs,
        startingPoint: "",
        endingPoint: "",
        mainCities: {},
        countries: cs.map(name => ({ name, image: "" })),
        citiesToVisit: [],
      };
    }
  }

  // ─ Cities to Visit ──────────────────────────────────────────────────────
  // Matches "City to Visit:", "Cities to Visit:" followed by | or , separated list
  const cityVisitMatch = raw.match(/Cit(?:y|ies)\s+to\s+[Vv]isit\s*:\s*([^\n]+)/i);
  if (cityVisitMatch) {
    const cities = cityVisitMatch[1].split(/[|,]/).map(c => c.trim()).filter(Boolean);
    if (cities.length) {
      if (!result.additionalInfo) {
        result.additionalInfo = {
          countriesVisited: [],
          startingPoint: "",
          endingPoint: "",
          mainCities: {},
          countries: [],
          citiesToVisit: [],
        };
      }
      result.additionalInfo.citiesToVisit = cities.map(city => ({ city, country: "", image: "" }));
    }
  }

  // ─ Full cash freebies ────────────────────────────────────────────────
  const freebies: TourFormData['cashFreebies'] = [];
  let inFreebies = false;
  for (const line of lines) {
    const l = line.trim();
    if (/fullcash|full\s*cash/i.test(l)) { inFreebies = true; continue; }
    if (inFreebies && l) {
      const pctM2 = l.match(/^(\d+)%\s*off\s+(?:on\s+)?(.+)/i);
      const freeM = l.match(/^free\s+(.+)/i);
      if (pctM2) freebies.push({ label: pctM2[2].trim(), type: "percent_off", value: parseInt(pctM2[1]) });
      else if (freeM) freebies.push({ label: freeM[1].trim(), type: "free", value: "" });
    }
  }
  if (freebies.length) result.cashFreebies = freebies;

  return result;
}

// ── Route A Preferred pre-fill template ─────────────────────────────────────
const ROUTE_A_TEMPLATE: Partial<TourFormData> = {
  bookingLinks: [
    { year: "2026", urls: ["https://bit.ly/ROUTEAPREF_MAR-JUNE2026", "https://bit.ly/ROUTEAPREF_OCT-NOV2026"] },
    { year: "2027", urls: ["https://bit.ly/ROUTEAPREF_MAR-APR2027"] },
  ],
  title: "Route A Preferred – Europe (15 Days)",
  slug: "route-a-preferred-europe-15-days",
  summary: "Experience the best of Europe in 15 days — France, Switzerland, Italy & Vatican with guaranteed departure dates.",
  shortDescription: "15-day Europe tour covering France, Switzerland, Italy and Vatican City.",
  line: "ROUTE_A",
  continent: "Europe",
  durationDays: 15,
  guaranteedDeparture: true,
  regularPricePerPerson: 170000,
  promoPricePerPerson: "",
  basePricePerDay: 15000,
  isSaleEnabled: false,
  saleEndDate: "",
  allowsDownpayment: true,
  fixedDownpaymentAmount: 50000,
  balanceDueDaysBeforeTravel: 90,
  departureDates: [
    { start: "2026-05-13", end: "2026-05-27", price: 170000, isAvailable: true, currentBookings: 0 },
    { start: "2026-05-25", end: "2026-06-08", price: 170000, isAvailable: true, currentBookings: 0 },
    { start: "2026-10-28", end: "2026-11-11", price: 160000, isAvailable: true, currentBookings: 0 },
    { start: "2027-02-24", end: "2027-03-10", price: 160000, isAvailable: true, currentBookings: 0 },
    { start: "2027-03-31", end: "2027-04-14", price: 150000, isAvailable: true, currentBookings: 0 },
  ],
  optionalTours: [
    { day: 4,  title: "Disneyland Paris Tour",               regularPrice: "", promoEnabled: true, promoType: "flat",    promoValue: 15000 },
    { day: 6,  title: "Cable Car and Ice Flyer Chairlift",   regularPrice: "", promoEnabled: true, promoType: "percent", promoValue: 50 },
    { day: 7,  title: "Grindelwald-Interlaken-Lauterbrunnen",regularPrice: "", promoEnabled: true, promoType: "percent", promoValue: 50 },
    { day: 9,  title: "Lake Como-Bellagio-Lugano",            regularPrice: "", promoEnabled: true, promoType: "percent", promoValue: 50 },
    { day: 12, title: "In-depth Colosseum Tour",              regularPrice: "", promoEnabled: true, promoType: "percent", promoValue: 50 },
    { day: 13, title: "Pompeii, Amalfi & Positano Tour",      regularPrice: "", promoEnabled: true, promoType: "percent", promoValue: 50 },
  ],
  cashFreebies: [
    { label: "Visa Processing and Appointment Fee", type: "percent_off", value: 50 },
    { label: "Permits, City Tax & Tippings in Europe",  type: "percent_off", value: 50 },
    { label: "Travel Insurance",                       type: "percent_off", value: 50 },
    { label: "Philippine Travel Tax",                  type: "free",        value: "" },
    { label: "Ireland ETA",                            type: "free",        value: "" },
  ],
  additionalInfo: {
    countriesVisited: ["France", "Switzerland", "Italy", "Vatican"],
    startingPoint: "Paris, France",
    endingPoint: "Rome, Italy",
    mainCities: {
      France: ["Paris"],
      Switzerland: ["Interlaken", "Grindelwald", "Lauterbrunnen", "Lugano"],
      Italy: ["Milan", "Lake Como", "Bellagio", "Rome", "Pompeii", "Amalfi", "Positano"],
      Vatican: ["Vatican City"],
    },
    countries: [
      { name: "France",      image: "" },
      { name: "Switzerland", image: "" },
      { name: "Italy",       image: "" },
      { name: "Vatican",     image: "" },
    ],
    citiesToVisit: [],
  },
  highlights: [
    "Disneyland Paris",
    "Swiss Alps – Grindelwald, Interlaken & Lauterbrunnen",
    "Lake Como, Bellagio & Lugano",
    "Colosseum & Vatican City",
    "Pompeii, Amalfi Coast & Positano",
  ],
  travelWindow: { start: "2026-05-13", end: "2027-04-14" },
};

// Initial tour line options - will be extended with user-added lines
const DEFAULT_LINE_OPTIONS = [
  { value: "ROUTE_A", label: "Route A Preferred" },
  { value: "ROUTE_B", label: "Route B Deluxe" },
  { value: "ROUTE_C", label: "Route C Preferred" },
  { value: "ROUTE_D", label: "Route D Easy" },
];

interface ExtendedTour extends Tour {
  title: string;
  slug: string;
  summary: string;
  shortDescription: string;
  line: string;
  continent: string;
  durationDays: number;
  guaranteedDeparture: boolean;
  bookingPdfUrl: string;
  regularPricePerPerson: number;
  promoPricePerPerson: number;
  basePricePerDay: number;
  isSaleEnabled: boolean;
  saleEndDate: string;
  travelWindow: { start: string; end: string };
  departureDates: { start: string; end: string }[];
  highlights: string[];
  mainImage: string;
  galleryImages: string[];
  relatedImages: string[];
  images?: string[];
  fullStops: { city: string; country: string; days?: number }[];
  additionalInfo: {
    countriesVisited: string[];
    startingPoint: string;
    endingPoint: string;
    mainCities: Record<string, string[]>;
    countries: CountryEntry[];
    citiesToVisit?: CityEntry[];
  };

}


interface CountryEntry {
  name: string;
  image?: string; // a single image URL for the country
}

interface CityEntry {
  city: string;
  country?: string;
  image?: string;
}

interface TourFormData {
  // Basic Info
  title: string;
  slug: string;
  summary: string;
  shortDescription: string;
  line: string;
  continent: string;
  durationDays: number;
  guaranteedDeparture: boolean;
  bookingPdfUrl: string;
  video_url?: string; // Tour video URL

  // Pricing
  regularPricePerPerson: number | "";
  promoPricePerPerson: number | "";
  basePricePerDay: number | "";
  // NEW: sale toggle + end date
  isSaleEnabled?: boolean;
  saleEndDate?: string | "";

  // Travel Details
  travelWindow: { start: string; end: string };
  departureDates: { 
    start: string; 
    end: string; 
    maxCapacity?: number;
    currentBookings?: number;
    isAvailable?: boolean;
    price?: number;
  }[];

  // Content
  highlights: string[];
  mainImage: string;
  galleryImages: string[];
  relatedImages: string[];
  videoFile?: File | null; // For video upload

  // Itinerary
  itinerary: { day: number; title: string; description: string; image?: string }[];

  // Stops & Geography
  fullStops: { city: string; country: string; days?: number }[];
  additionalInfo: {
    countriesVisited: string[];
    startingPoint: string;
    endingPoint: string;
    mainCities: Record<string, string[]>;
    // New: countries with images
    countries?: CountryEntry[];
    // New: cities to visit with images
    citiesToVisit?: CityEntry[];
  };

  // Year-tagged booking links (e.g. from paste text "Links for 2026: url1, url2")
  bookingLinks: { year: string; urls: string[] }[];

  // Optional add-on excursions for specific days
  optionalTours: {
    day: number;
    title: string;
    regularPrice: number | "";
    promoEnabled: boolean;
    promoType: "flat" | "percent";
    promoValue: number | "";
    flipbookUrl?: string; // individual optional-tour flipbook/itinerary link
  }[];

  // Full cash payment freebies
  cashFreebies: {
    label: string;
    type: "free" | "percent_off";
    value: number | "";
  }[];

  // Reservation payment rules
  allowsDownpayment: boolean;
  fixedDownpaymentAmount: number | ""; // e.g. 50000 — overrides % downpayment when set
  balanceDueDaysBeforeTravel: number | ""; // e.g. 90 — days before departure balance is due
}

export default function TourForm(): JSX.Element {
  const { success, error: errorToast } = useToast();
  
  // Itinerary image upload handler
  async function handleItineraryImageUpload(idx: number, file?: File | null) {
    if (!file) return;
    const tourId = id || formData.slug || `new-tour-${Date.now()}`;
    const url = await uploadImageToStorage(file, tourId, 'itinerary', idx + 1);
    if (url) {
      setFormData((prev) => {
        const itinerary = [...prev.itinerary];
        itinerary[idx] = { ...itinerary[idx], image: url };
        return { ...prev, itinerary };
      });
    }
  }
  // Departure Date Range Handlers
  function addDepartureDateRange() {
    setFormData((prev) => ({
      ...prev,
      departureDates: [...prev.departureDates, { start: '', end: '', maxCapacity: undefined, currentBookings: 0, isAvailable: true, price: undefined }],
    }));
  }

  function updateDepartureDateRange(index: number, field: 'start' | 'end' | 'maxCapacity' | 'currentBookings' | 'isAvailable' | 'price', value: string | number | boolean | undefined) {
    setFormData((prev) => {
      const updated = [...prev.departureDates];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, departureDates: updated };
    });
  }

  function removeDepartureDateRange(index: number) {
    setFormData((prev) => {
      const updated = [...prev.departureDates];
      updated.splice(index, 1);
      return { ...prev, departureDates: updated };
    });
  }

  // Tour Line Handlers
  function handleAddTourLine() {
    if (!newLineName.trim() || !newLineValue.trim()) {
      errorToast("Please fill in both Tour Line name and value");
      return;
    }

    // Check if line already exists
    if (tourLines.some(line => line.value === newLineValue)) {
      errorToast("This tour line value already exists");
      return;
    }

    // Add the new line
    const newLine = { value: newLineValue, label: newLineName };
    setTourLines([...tourLines, newLine]);

    // Auto-select the newly created line
    handleInputChange("line", newLineValue);

    // Reset modal
    setNewLineName("");
    setNewLineValue("");
    setShowAddLineModal(false);

    // Show success message
    success(`Tour Line "${newLineName}" added and selected! ✅`);
  }

  function resetAddLineModal() {
    setNewLineName("");
    setNewLineValue("");
    setShowAddLineModal(false);
  }

  // ── Smart Paste state ───────────────────────────────────────────────────
  const [smartPasteOpen, setSmartPasteOpen] = useState(false);
  const [smartPasteText, setSmartPasteText] = useState("");
  const [smartPastePreview, setSmartPastePreview] = useState<Partial<TourFormData> | null>(null);

  function handleSmartParse() {
    if (!smartPasteText.trim()) return;
    const parsed = parseTourText(smartPasteText);
    setSmartPastePreview(parsed);
  }

  function applySmartPaste() {
    if (!smartPastePreview) return;
    setFormData(prev => ({
      ...prev,
      ...smartPastePreview,
      additionalInfo: {
        ...prev.additionalInfo,
        ...(smartPastePreview.additionalInfo ?? {}),
      },
    } as TourFormData));
    setSmartPasteOpen(false);
    setSmartPasteText("");
    setSmartPastePreview(null);
    success("Tour data parsed and applied to the form! ✅ Review each section before saving.");
  }

  // Route A Template Loader
  function loadRouteATemplate() {
    setFormData(prev => ({
      ...prev,
      ...ROUTE_A_TEMPLATE,
      additionalInfo: {
        ...prev.additionalInfo,
        ...(ROUTE_A_TEMPLATE.additionalInfo ?? {}),
      },
    } as TourFormData));
    success("Route A Preferred template loaded! Review and adjust before saving. ✅");
  }

  // Form state
  const [formData, setFormData] = useState<TourFormData>({
    title: "",
    slug: "",
    summary: "",
    shortDescription: "",
    line: "",
    continent: "",
    durationDays: 7,
    guaranteedDeparture: false,
    bookingPdfUrl: "",
    video_url: "",
    videoFile: null,
    regularPricePerPerson: "",
    promoPricePerPerson: "",
    basePricePerDay: "",
    isSaleEnabled: false,
    saleEndDate: "",
    travelWindow: { start: "", end: "" },
    departureDates: [],
    highlights: [],
    mainImage: "",
    galleryImages: [],
    relatedImages: [],
    itinerary: [],
    fullStops: [],
    additionalInfo: {
      countriesVisited: [],
      startingPoint: "",
      endingPoint: "",
      mainCities: {},
      countries: [],
      citiesToVisit: []
    },
    optionalTours: [],
    cashFreebies: [],
    bookingLinks: [],
    allowsDownpayment: false,
    fixedDownpaymentAmount: "",
    balanceDueDaysBeforeTravel: 90,
  });

  // Dynamic gallery upload fields
  const [galleryFields, setGalleryFields] = useState<string[]>([]);
  // Gallery modal state for galleryImages
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  // Tour Line Modal state
  const [tourLines, setTourLines] = useState<Array<{ value: string; label: string }>>(DEFAULT_LINE_OPTIONS);
  const [showAddLineModal, setShowAddLineModal] = useState(false);
  const [newLineName, setNewLineName] = useState("");
  const [newLineValue, setNewLineValue] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Continents for dropdown
  const [continents, setContinents] = useState<string[]>([]);
  
  // Debug logging for continents state
  useEffect(() => {
    console.log("🔍 Continents state updated:", continents);
  }, [continents]);
  
  // Sync galleryFields with formData.galleryImages
  useEffect(() => {
    setGalleryFields(formData.galleryImages.length ? formData.galleryImages : [""]);
  }, [formData.galleryImages]);
  // Helper function to generate slug from title
  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
  };

  // Load continents
  useEffect(() => {
    const loadContinents = async () => {
      try {
        console.log("🌍 Loading continents...");
        const continentsList = await fetchContinents();
        console.log("✅ Continents loaded:", continentsList);
        setContinents(continentsList);
      } catch (error) {
        console.error("❌ Failed to fetch continents:", error);
        // Set a fallback list if there's an error
        setContinents(["Europe", "Asia", "North America"]);
      }
    };
    
    // Add a small delay to make the loading state visible during development
    setTimeout(loadContinents, 100);
  }, []);

  // Load existing tour for editing
  useEffect(() => {
    if (!isEdit || !id) return;

    const loadTour = async () => {
      try {
        setLoading(true);
        const tour = await fetchTourById(id) as ExtendedTour;
        if (!tour) {
          setError("Tour not found");
          return;
        }

        // Convert tour to form data and include sale fields if present
        setFormData({
          title: tour.title || "",
          slug: tour.slug || "",
          summary: tour.summary || "",
          shortDescription: tour.shortDescription || "",
          line: tour.line || "",
          continent: "",
          durationDays: tour.durationDays || 7,
          guaranteedDeparture: tour.guaranteedDeparture || false,
          bookingPdfUrl: tour.bookingPdfUrl || "",
          video_url: (tour as unknown as { video_url?: string }).video_url || "",
          videoFile: null,

          regularPricePerPerson: tour.regularPricePerPerson ?? "",
          promoPricePerPerson: tour.promoPricePerPerson ?? "",
          basePricePerDay: tour.basePricePerDay ?? "",
          // populate sale fields from tour
          isSaleEnabled: tour.isSaleEnabled ?? false,
          saleEndDate: tour.saleEndDate ?? "",

          travelWindow: tour.travelWindow || { start: "", end: "" },
          departureDates: tour.departureDates || [],

          highlights: tour.highlights || [],
          // Populate from DB: images[] → mainImage (first) + galleryImages (rest)
          mainImage: typeof tour.mainImage === 'string' && tour.mainImage
            ? tour.mainImage
            : (Array.isArray(tour.images) && tour.images.length > 0 ? tour.images[0] : ""),
          galleryImages: Array.isArray(tour.galleryImages) && tour.galleryImages.length
            ? tour.galleryImages
            : (Array.isArray(tour.images) && tour.images.length > 1 ? tour.images.slice(1) : []),
          relatedImages: Array.isArray(tour.relatedImages) ? tour.relatedImages : [],

          itinerary: (tour.itinerary || []).map((it, i) => ({
            day: typeof it.day === "number" ? it.day : i + 1,
            title: it.title || "",
            description: it.description || ""
          })),

          fullStops: tour.fullStops || [],
          additionalInfo: {
            countriesVisited: tour.additionalInfo?.countriesVisited || [],
            startingPoint: tour.additionalInfo?.startingPoint || "",
            endingPoint: tour.additionalInfo?.endingPoint || "",
            mainCities: tour.additionalInfo?.mainCities || {},
            countries: (tour.additionalInfo as Record<string, unknown>)?.countries as CountryEntry[] || [],
            citiesToVisit: (tour.additionalInfo as Record<string, unknown>)?.citiesToVisit as CityEntry[] || []
          },
          optionalTours: Array.isArray((tour as Record<string, unknown>).optionalTours)
            ? ((tour as Record<string, unknown>).optionalTours as TourFormData["optionalTours"])
            : [],
          cashFreebies: Array.isArray((tour as Record<string, unknown>).cashFreebies)
            ? ((tour as Record<string, unknown>).cashFreebies as TourFormData["cashFreebies"])
            : [],
          bookingLinks: Array.isArray((tour as Record<string, unknown>).bookingLinks)
            ? ((tour as Record<string, unknown>).bookingLinks as TourFormData["bookingLinks"])
            : [],
          allowsDownpayment: !!(tour as Record<string, unknown>).allowsDownpayment,
          fixedDownpaymentAmount: typeof (tour as Record<string, unknown>).fixedDownpaymentAmount === 'number'
            ? ((tour as Record<string, unknown>).fixedDownpaymentAmount as number)
            : "",
          balanceDueDaysBeforeTravel: typeof (tour as Record<string, unknown>).balanceDueDaysBeforeTravel === 'number'
            ? ((tour as Record<string, unknown>).balanceDueDaysBeforeTravel as number)
            : 90,
        });
      } catch (err) {
        console.error("Load tour error", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load tour";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadTour();
  }, [isEdit, id]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!isEdit && formData.title) {
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setFormData((prev: TourFormData) => ({ ...prev, slug }));
    }
  }, [formData.title, isEdit]);

  // Form handlers
  const handleInputChange = <K extends keyof TourFormData>(field: K, value: TourFormData[K]) => {
  setFormData((prev: TourFormData) => ({ ...prev, [field]: value } as unknown as TourFormData));
  };

  // ----- Countries to Visit helpers -----
  function addCountry() {
  setFormData((prev: TourFormData) => ({
      ...prev,
      additionalInfo: {
        ...prev.additionalInfo,
        countries: [...(prev.additionalInfo.countries || []), { name: "", image: "" }]
      }
    }));
  }

  function updateCountry(index: number, field: "name" | "image", value: string) {
  setFormData((prev: TourFormData) => {
      const countries = [...(prev.additionalInfo.countries || [])];
      countries[index] = { ...(countries[index] || { name: "", image: "" }), [field]: value };
      return { ...prev, additionalInfo: { ...prev.additionalInfo, countries } };
    });
  }

  function removeCountry(index: number) {
  setFormData((prev: TourFormData) => {
      const countries = [...(prev.additionalInfo.countries || [])];
      countries.splice(index, 1);
      return { ...prev, additionalInfo: { ...prev.additionalInfo, countries } };
    });
  }

  function handleCountryFile(index: number, file?: File | null) {
    if (!file) return;
    const tourId = id || formData.slug || `new-tour-${Date.now()}`;
    uploadImageToStorage(file, tourId, 'countries').then(url => {
      if (url) updateCountry(index, "image", url);
    });
  }
  // ---------------------------------------

  // ----- Cities to Visit helpers -----
  function addCity() {
    setFormData((prev: TourFormData) => ({
      ...prev,
      additionalInfo: {
        ...prev.additionalInfo,
        citiesToVisit: [...(prev.additionalInfo.citiesToVisit || []), { city: "", country: "", image: "" }]
      }
    }));
  }

  function updateCity(index: number, field: "city" | "country" | "image", value: string) {
    setFormData((prev: TourFormData) => {
      const citiesToVisit = [...(prev.additionalInfo.citiesToVisit || [])];
      citiesToVisit[index] = { ...(citiesToVisit[index] || { city: "", country: "", image: "" }), [field]: value };
      return { ...prev, additionalInfo: { ...prev.additionalInfo, citiesToVisit } };
    });
  }

  function removeCity(index: number) {
    setFormData((prev: TourFormData) => {
      const citiesToVisit = [...(prev.additionalInfo.citiesToVisit || [])];
      citiesToVisit.splice(index, 1);
      return { ...prev, additionalInfo: { ...prev.additionalInfo, citiesToVisit } };
    });
  }

  function handleCityFile(index: number, file?: File | null) {
    if (!file) return;
    const tourId = id || formData.slug || `new-tour-${Date.now()}`;
    uploadImageToStorage(file, tourId, 'cities').then(url => {
      if (url) updateCity(index, "image", url);
    });
  }
  // -----------------------------------

  // Form submission
  // ── Optional Tour Handlers ────────────────────────────────────────────────
  // ── Booking Links Handlers ────────────────────────────────────────────────
  function addBookingLink() {
    setFormData(prev => ({
      ...prev,
      bookingLinks: [...prev.bookingLinks, { year: String(new Date().getFullYear()), urls: [""] }],
    }));
  }

  function updateBookingLinkYear(index: number, year: string) {
    setFormData(prev => {
      const updated = [...prev.bookingLinks];
      updated[index] = { ...updated[index], year };
      return { ...prev, bookingLinks: updated };
    });
  }

  function updateBookingLinkUrl(linkIndex: number, urlIndex: number, url: string) {
    setFormData(prev => {
      const updated = [...prev.bookingLinks];
      const urls = [...updated[linkIndex].urls];
      urls[urlIndex] = url;
      updated[linkIndex] = { ...updated[linkIndex], urls };
      return { ...prev, bookingLinks: updated };
    });
  }

  function addBookingLinkUrl(linkIndex: number) {
    setFormData(prev => {
      const updated = [...prev.bookingLinks];
      updated[linkIndex] = { ...updated[linkIndex], urls: [...updated[linkIndex].urls, ""] };
      return { ...prev, bookingLinks: updated };
    });
  }

  function removeBookingLinkUrl(linkIndex: number, urlIndex: number) {
    setFormData(prev => {
      const updated = [...prev.bookingLinks];
      const urls = updated[linkIndex].urls.filter((_, i) => i !== urlIndex);
      if (urls.length === 0) {
        // Remove the whole year group if no URLs left
        return { ...prev, bookingLinks: updated.filter((_, i) => i !== linkIndex) };
      }
      updated[linkIndex] = { ...updated[linkIndex], urls };
      return { ...prev, bookingLinks: updated };
    });
  }

  function addOptionalTour() {
    setFormData(prev => ({
      ...prev,
      optionalTours: [
        ...prev.optionalTours,
        { day: prev.optionalTours.length + 4, title: "", regularPrice: "", promoEnabled: false, promoType: "percent", promoValue: "", flipbookUrl: "" },
      ],
    }));
  }

  function updateOptionalTour(
    index: number,
    field: keyof TourFormData["optionalTours"][0],
    value: string | number | boolean
  ) {
    setFormData(prev => {
      const updated = [...prev.optionalTours];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, optionalTours: updated };
    });
  }

  function removeOptionalTour(index: number) {
    setFormData(prev => ({
      ...prev,
      optionalTours: prev.optionalTours.filter((_, i) => i !== index),
    }));
  }

  // ── Cash Freebie Handlers ─────────────────────────────────────────────────
  function addCashFreebie() {
    setFormData(prev => ({
      ...prev,
      cashFreebies: [
        ...prev.cashFreebies,
        { label: "", type: "percent_off", value: 50 },
      ],
    }));
  }

  function updateCashFreebie(
    index: number,
    field: keyof TourFormData["cashFreebies"][0],
    value: string | number
  ) {
    setFormData(prev => {
      const updated = [...prev.cashFreebies];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, cashFreebies: updated };
    });
  }

  function removeCashFreebie(index: number) {
    setFormData(prev => ({
      ...prev,
      cashFreebies: prev.cashFreebies.filter((_, i) => i !== index),
    }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);

      // Prepare images array: combine mainImage and galleryImages
      const imagesArray: string[] = [];
      if (formData.mainImage) imagesArray.push(formData.mainImage);
      if (formData.galleryImages && Array.isArray(formData.galleryImages)) {
        imagesArray.push(...formData.galleryImages.filter((img: string) => img && img !== formData.mainImage));
      }

      // Prepare payload - convert empty strings to undefined/null for numbers
      const payload = {
        ...formData,
        // Map form fields to database field — always send images array so clearing images persists
        images: imagesArray,
        // Remove form-only fields that shouldn't go to DB
        mainImage: undefined,
        galleryImages: undefined,
        relatedImages: undefined,
        videoFile: undefined,
        regularPricePerPerson: formData.regularPricePerPerson === "" ? undefined : Number(formData.regularPricePerPerson),
        promoPricePerPerson: formData.promoPricePerPerson === "" ? undefined : Number(formData.promoPricePerPerson),
        basePricePerDay: formData.basePricePerDay === "" ? undefined : Number(formData.basePricePerDay),
        // include sale fields
        isSaleEnabled: !!formData.isSaleEnabled,
        saleEndDate: formData.isSaleEnabled && formData.saleEndDate ? formData.saleEndDate : undefined,
        travelWindow: formData.travelWindow.start && formData.travelWindow.end ? formData.travelWindow : undefined,
        // include video URL
        video_url: formData.video_url || undefined,
        additionalInfo: {
          ...formData.additionalInfo,
          continent: formData.continent,
          // ensure countries list is included; backend will receive under additionalInfo.countries
          countries: formData.additionalInfo.countries && formData.additionalInfo.countries.length ? formData.additionalInfo.countries : undefined,
          // include cities to visit
          citiesToVisit: formData.additionalInfo.citiesToVisit && formData.additionalInfo.citiesToVisit.length ? formData.additionalInfo.citiesToVisit : undefined
        },
        // Preserve existing backend field name for compatibility — used to store FlippingBook links
        bookingPdfUrl: formData.bookingPdfUrl ? formData.bookingPdfUrl : undefined,
        // Year-tagged booking links
        bookingLinks: formData.bookingLinks && formData.bookingLinks.length
          ? formData.bookingLinks.filter(bl => bl.year && bl.urls.some(u => u.trim()))
              .map(bl => ({ year: bl.year, urls: bl.urls.filter(u => u.trim()) }))
          : undefined,
        // Optional tours and freebies
        optionalTours: formData.optionalTours.length
          ? formData.optionalTours.map(ot => ({
              ...ot,
              regularPrice: ot.regularPrice === "" ? 0 : Number(ot.regularPrice),
              promoValue: ot.promoValue === "" ? 0 : Number(ot.promoValue),
              flipbookUrl: ot.flipbookUrl?.trim() || undefined,
            }))
          : undefined,
        cashFreebies: formData.cashFreebies.length
          ? formData.cashFreebies.map(f => ({
              ...f,
              value: f.value === "" ? undefined : Number(f.value),
            }))
          : undefined,
        // Payment rules
        allowsDownpayment: formData.allowsDownpayment,
        fixedDownpaymentAmount: formData.fixedDownpaymentAmount === "" ? undefined : Number(formData.fixedDownpaymentAmount),
        balanceDueDaysBeforeTravel: formData.balanceDueDaysBeforeTravel === "" ? 90 : Number(formData.balanceDueDaysBeforeTravel),
      };

      if (isEdit && id) {
        await updateTour(id, payload);
      } else {
        await createTour(payload);
      }

      navigate("/tours");
    } catch (err) {
      console.error("Save tour error", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save tour";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/tours")}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-white hover:shadow-sm rounded-lg transition-all mb-6"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Tours</span>
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                  {isEdit ? "Edit Tour" : "Create New Tour"}
                </h1>
                <p className="text-gray-600 text-lg">
                  {isEdit ? "Update tour information and details" : "Add a new tour to your collection"}
                </p>
              </div>
              {!isEdit && (
                <button
                  type="button"
                  onClick={loadRouteATemplate}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow text-sm transition-colors"
                  title="Pre-fill form with Route A Preferred example data (pricing, dates, optional tours, freebies)"
                >
                  <span className="text-base">🗺️</span>
                  Load Route A Template
                </button>
              )}
            </div>
            {!isEdit && (
              <div className="mt-4 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5 text-rose-800 text-sm">
                <strong>Tip:</strong> Click <strong>Load Route A Template</strong> to pre-fill this form with Route A Preferred 2026 pricing, departure dates, optional tours, and full cash payment freebies. You can still edit every field after loading.
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* ─── Smart Paste / AI Auto-fill Panel ──────────────────────── */}
        {!isEdit && (
          <div className="bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden mb-2">
            <button
              type="button"
              onClick={() => { setSmartPasteOpen(o => !o); setSmartPastePreview(null); }}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-purple-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Wand2 className="text-purple-600" size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">AI Smart Paste — Auto-fill from Tour Text</p>
                  <p className="text-sm text-gray-500">Paste your tour brief text and let the form fill itself automatically</p>
                </div>
              </div>
              <span className="text-purple-600 font-semibold text-sm">{smartPasteOpen ? 'Close ↑' : 'Open ↓'}</span>
            </button>

            {smartPasteOpen && (
              <div className="px-6 pb-6 border-t border-purple-100">
                <p className="text-sm text-gray-600 mt-4 mb-3">
                  Paste your raw tour description below (dates, prices, optional tours, countries, freebies, downpayment rules — all supported).
                </p>
                <textarea
                  className="w-full border border-gray-300 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-y min-h-[180px]"
                  placeholder={`Route A Preferred (15 days)\nLinks for 2026: https://bit.ly/ROUTEAPREF_MAR-JUNE2026 , and https://bit.ly/ROUTEAPREF_OCT-NOV2026\nLinks for 2027: https://bit.ly/ROUTEAPREF_MAR-APR2027\nTravel Date: May 13 - 27, 2026 (Php 170,000)\n             May 25 - June 8, 2026 (Php 170,000)\nOptional Tours:\nDay 4: Disneyland Paris Tour\n...\nCountry to Visit: FRANCE | SWITZERLAND | ITALY | VATICAN\nFULLCASH PAYMENT FREEBIES:\n50% off on Visa Processing and Appointment Fee\nFree Philippine Travel Tax`}
                  value={smartPasteText}
                  onChange={e => { setSmartPasteText(e.target.value); setSmartPastePreview(null); }}
                />
                <div className="flex gap-3 mt-3">
                  <button
                    type="button"
                    onClick={handleSmartParse}
                    disabled={!smartPasteText.trim()}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition-colors"
                  >
                    <Wand2 size={16} />
                    Parse &amp; Preview
                  </button>
                  {smartPastePreview && (
                    <button
                      type="button"
                      onClick={applySmartPaste}
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition-colors"
                    >
                      <Check size={16} />
                      Apply to Form
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setSmartPasteText(""); setSmartPastePreview(null); }}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
                  >
                    Clear
                  </button>
                </div>

                {/* Parsed Preview */}
                {smartPastePreview && (
                  <div className="mt-5 bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-3 text-sm">
                    <p className="font-bold text-purple-900 text-base">Detected Fields — review before applying</p>

                    {smartPastePreview.title && (
                      <div className="flex gap-2">
                        <span className="text-purple-500 font-semibold w-36 flex-shrink-0">Title</span>
                        <span className="text-gray-800">{smartPastePreview.title} ({smartPastePreview.durationDays} days)</span>
                      </div>
                    )}
                    {smartPastePreview.bookingLinks && smartPastePreview.bookingLinks.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-purple-500 font-semibold w-36 flex-shrink-0">Booking Links</span>
                        <ul className="space-y-0.5">
                          {smartPastePreview.bookingLinks.map((bl, i) => (
                            <li key={i} className="text-gray-800 text-xs">
                              <strong>{bl.year}:</strong> {bl.urls.join(" · ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {smartPastePreview.line && (
                      <div className="flex gap-2">
                        <span className="text-purple-500 font-semibold w-36 flex-shrink-0">Tour Line</span>
                        <span className="text-gray-800">{smartPastePreview.line}</span>
                      </div>
                    )}
                    {smartPastePreview.regularPricePerPerson !== undefined && smartPastePreview.regularPricePerPerson !== "" && (
                      <div className="flex gap-2">
                        <span className="text-purple-500 font-semibold w-36 flex-shrink-0">Regular Price</span>
                        <span className="text-gray-800">₱{Number(smartPastePreview.regularPricePerPerson).toLocaleString()}</span>
                      </div>
                    )}
                    {smartPastePreview.departureDates && smartPastePreview.departureDates.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-purple-500 font-semibold w-36 flex-shrink-0">Departure Dates</span>
                        <ul className="space-y-0.5">
                          {smartPastePreview.departureDates.map((d, i) => (
                            <li key={i} className="text-gray-800">
                              {new Date(d.start + 'T00:00:00').toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}
                              {' – '}
                              {new Date(d.end + 'T00:00:00').toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}
                              {d.price ? <span className="ml-2 text-green-700 font-medium">₱{d.price.toLocaleString()}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {smartPastePreview.optionalTours && smartPastePreview.optionalTours.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-purple-500 font-semibold w-36 flex-shrink-0">Optional Tours</span>
                        <ul className="space-y-0.5">
                          {smartPastePreview.optionalTours.map((ot, i) => (
                            <li key={i} className="text-gray-800">Day {ot.day} – {ot.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {smartPastePreview.fixedDownpaymentAmount !== undefined && smartPastePreview.fixedDownpaymentAmount !== "" && (
                      <div className="flex gap-2">
                        <span className="text-purple-500 font-semibold w-36 flex-shrink-0">Downpayment</span>
                        <span className="text-gray-800">₱{Number(smartPastePreview.fixedDownpaymentAmount).toLocaleString()}</span>
                      </div>
                    )}
                    {smartPastePreview.balanceDueDaysBeforeTravel !== undefined && smartPastePreview.balanceDueDaysBeforeTravel !== "" && (
                      <div className="flex gap-2">
                        <span className="text-purple-500 font-semibold w-36 flex-shrink-0">Balance Due</span>
                        <span className="text-gray-800">{smartPastePreview.balanceDueDaysBeforeTravel} days before travel</span>
                      </div>
                    )}
                    {smartPastePreview.additionalInfo?.countriesVisited && smartPastePreview.additionalInfo.countriesVisited.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-purple-500 font-semibold w-36 flex-shrink-0">Countries</span>
                        <span className="text-gray-800">{smartPastePreview.additionalInfo.countriesVisited.join(' · ')}</span>
                      </div>
                    )}
                    {smartPastePreview.cashFreebies && smartPastePreview.cashFreebies.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-purple-500 font-semibold w-36 flex-shrink-0">Cash Freebies</span>
                        <ul className="space-y-0.5">
                          {smartPastePreview.cashFreebies.map((f, i) => (
                            <li key={i} className="text-gray-800">
                              {f.type === 'percent_off' ? `${f.value}% off — ` : 'FREE — '}{f.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {Object.keys(smartPastePreview).length === 0 && (
                      <p className="text-orange-700">Could not detect any structured fields. Try pasting more formatted text.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <SecureForm onSubmit={handleSubmit} className="space-y-6">
          {/* Canary tokens — bot/crawler detection, do NOT remove */}
          <div aria-hidden="true" style={{ display: 'none' }}>
            <input name="website" tabIndex={-1} autoComplete="off" value="" readOnly />
            <input name="phone_number_2" tabIndex={-1} autoComplete="off" value="" readOnly />
          </div>
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-blue-100 p-3 rounded-xl">
                <FileText className="text-blue-600" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
                <p className="text-gray-600">Essential details about your tour</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Tour Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    handleInputChange("title", title);
                    // Auto-generate slug if it's empty or matches the previous title's slug
                    if (!formData.slug || formData.slug === generateSlug(formData.title)) {
                      handleInputChange("slug", generateSlug(title));
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                  placeholder="e.g., Route A Preferred - European Adventure"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  URL Slug *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => handleInputChange("slug", e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                    placeholder="auto-generated-from-title"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-gray-400 text-sm">.html</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Auto-generated from tour name, but you can customize it</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Tour Line
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.line}
                    onChange={(e) => handleInputChange("line", e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white"
                  >
                    <option value="">Select Line</option>
                    {tourLines.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddLineModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg flex items-center gap-2 transition-colors"
                    title="Add new tour line"
                  >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Add Line</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.line ? `Selected: ${tourLines.find(l => l.value === formData.line)?.label}` : "Choose or create a tour line"}
                </p>
              </div>

              {/* Add Tour Line Modal */}
              {showAddLineModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-gray-900">Add New Tour Line</h3>
                      <button
                        onClick={resetAddLineModal}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Tour Line Name *
                        </label>
                        <input
                          type="text"
                          value={newLineName}
                          onChange={(e) => setNewLineName(e.target.value)}
                          placeholder="e.g., Route E Premium"
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTourLine()}
                        />
                        <p className="text-xs text-gray-500 mt-1">The display name for the tour line</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Tour Line Code *
                        </label>
                        <input
                          type="text"
                          value={newLineValue}
                          onChange={(e) => setNewLineValue(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                          placeholder="e.g., ROUTE_E"
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm font-mono uppercase"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTourLine()}
                        />
                        <p className="text-xs text-gray-500 mt-1">Unique code (auto-formatted to uppercase)</p>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                      <button
                        type="button"
                        onClick={resetAddLineModal}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTourLine}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                      >
                        <Check size={18} />
                        Add & Select
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Assigned Continent *
                </label>
                <select
                  required
                  value={formData.continent}
                  onChange={(e) => handleInputChange("continent", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm bg-white"
                  disabled={continents.length === 0}
                >
                  <option value="">
                    {continents.length === 0 
                      ? "🔄 Loading continents..." 
                      : `🌍 Select Continent (${continents.length} available)`
                    }
                  </option>
                  {continents.map((continent: string) => (
                    <option key={continent} value={continent}>
                      {continent === "Europe" ? "🇪🇺" : 
                       continent === "Asia" ? "🌏" : 
                       continent === "North America" ? "🌎" :
                       continent === "South America" ? "🌎" :
                       continent === "Africa" ? "🌍" :
                       continent === "Oceania" ? "🌏" : "🌎"} {continent}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Choose the primary continent for this tour</p>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  📝 Tour Summary
                </label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => handleInputChange("summary", e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm resize-none"
                  placeholder="Write a compelling summary that highlights what makes this tour special..."
                />
                <p className="text-xs text-gray-500 mt-1">This appears on tour listings and detail pages</p>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  ✏️ Short Description
                </label>
                <textarea
                  value={formData.shortDescription}
                  onChange={(e) => handleInputChange("shortDescription", e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm resize-none"
                  placeholder="Quick description for cards and previews..."
                />
                <p className="text-xs text-gray-500 mt-1">Used for tour cards and search results</p>
              </div>
            </div>
          </div>

          {/* Tour Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-green-100 p-3 rounded-xl">
                <Clock className="text-green-600" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Tour Details</h2>
                <p className="text-gray-600">Configure tour duration and special features</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  🗓️ Duration (days) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.durationDays}
                  onChange={(e) => handleInputChange("durationDays", Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm text-lg font-medium"
                  placeholder="7"
                />
                <p className="text-xs text-gray-500 mt-1">How many days does this tour last?</p>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  ✅ Special Features
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.guaranteedDeparture}
                      onChange={(e) => handleInputChange("guaranteedDeparture", e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Guaranteed Departure</span>
                      <p className="text-xs text-gray-500">This tour will run regardless of group size</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flipping Book URL
                </label>
                <input
                  type="url"
                  value={formData.bookingPdfUrl}
                  onChange={(e) => handleInputChange("bookingPdfUrl", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.flippingbook.com/view/example-id"
                />
                <p className="text-xs text-gray-500 mt-1">Paste the FlippingBook link (flipbook viewer) for this tour — it will be used instead of a raw PDF file.</p>
              </div>

              {/* ── Year-tagged Booking Links ─────────────────────────────────── */}
              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Year-tagged Booking Links
                  </label>
                  <button
                    type="button"
                    onClick={addBookingLink}
                    className="text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Plus size={12} /> Add Year
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Add booking / flipbook links grouped by year (e.g. "Links for 2026: url1, url2"). Parsed automatically from Smart Paste.
                </p>
                {formData.bookingLinks.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">No year-tagged links yet — use Smart Paste or click "Add Year".</p>
                ) : (
                  <div className="space-y-3">
                    {formData.bookingLinks.map((bl, li) => (
                      <div key={li} className="border border-blue-200 rounded-lg p-3 bg-blue-50 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-blue-700 w-10">Year</span>
                          <input
                            type="text"
                            value={bl.year}
                            onChange={e => updateBookingLinkYear(li, e.target.value)}
                            className="w-20 border border-blue-300 rounded px-2 py-1 text-sm bg-white"
                            placeholder="2026"
                          />
                        </div>
                        {bl.urls.map((url, ui) => (
                          <div key={ui} className="flex items-center gap-2">
                            <span className="text-xs text-blue-500 w-10 flex-shrink-0">Link {ui + 1}</span>
                            <input
                              type="url"
                              value={url}
                              onChange={e => updateBookingLinkUrl(li, ui, e.target.value)}
                              className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm bg-white"
                              placeholder="https://bit.ly/..."
                            />
                            <button
                              type="button"
                              onClick={() => removeBookingLinkUrl(li, ui)}
                              className="text-red-400 hover:text-red-600 text-xs font-medium flex-shrink-0"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addBookingLinkUrl(li)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          + Add another URL for {bl.year}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-yellow-100 p-3 rounded-xl">
                <DollarSign className="text-yellow-600" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Pricing Information</h2>
                <p className="text-gray-600">Set competitive pricing for your tour</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  💰 Regular Price per Person (PHP)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.regularPricePerPerson}
                    onChange={(e) => handleInputChange("regularPricePerPerson", e.target.value ? Number(e.target.value) : "")}
                    className="w-full border border-gray-300 rounded-xl pl-8 pr-4 py-3 text-lg font-medium focus:ring-2 focus:ring-yellow-500 focus:border-transparent shadow-sm"
                    placeholder="170,000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  🏷️ Promo Price per Person (PHP)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.promoPricePerPerson}
                    onChange={(e) => handleInputChange("promoPricePerPerson", e.target.value ? Number(e.target.value) : "")}
                    className="w-full border border-gray-300 rounded-xl pl-8 pr-4 py-3 text-lg font-medium focus:ring-2 focus:ring-yellow-500 focus:border-transparent shadow-sm"
                    placeholder="200,000.00"
                    disabled={!formData.isSaleEnabled}
                  />
                </div>

                {/* Enable/disable sale toggle */}
                <div className="flex items-center mt-4 gap-2">
                  <input
                    type="checkbox"
                    id="enable-sale"
                    checked={!!formData.isSaleEnabled}
                    onChange={e => handleInputChange("isSaleEnabled", e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="enable-sale" className="font-medium">
                    Enable Promo Price (Sale)
                  </label>
                </div>

                {/* Sale end date */}
                {formData.isSaleEnabled && (
                  <div className="mt-2 flex items-center gap-2">
                    <label className="font-medium" htmlFor="sale-end-date">
                      Sale End Date:
                    </label>
                    <input
                      id="sale-end-date"
                      type="date"
                      value={formData.saleEndDate ? formData.saleEndDate.slice(0, 10) : ""}
                      onChange={e => handleInputChange("saleEndDate", e.target.value)}
                      className="rounded border px-2 py-1"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  📅 Base Price per Day (PHP)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.basePricePerDay}
                    onChange={(e) => handleInputChange("basePricePerDay", e.target.value ? Number(e.target.value) : "")}
                    className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                    placeholder="15,000.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Daily rate for pricing calculations</p>
              </div>
            </div>

            {/* ─── Reservation Payment Rules ──────────────────────────────────────── */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">🏦 Reservation Payment Rules</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    id="allows-downpayment"
                    checked={!!formData.allowsDownpayment}
                    onChange={e => handleInputChange("allowsDownpayment", e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <label htmlFor="allows-downpayment" className="text-sm font-semibold text-gray-700 cursor-pointer">Allow Downpayment</label>
                    <p className="text-xs text-gray-500 mt-0.5">Show downpayment option at checkout</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    💵 Fixed Downpayment Amount (PHP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.fixedDownpaymentAmount}
                      onChange={e => handleInputChange("fixedDownpaymentAmount", e.target.value ? Number(e.target.value) : "")}
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                      placeholder="50,000"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Fixed PHP downpayment (overrides % method). E.g. ₱50,000. Leave blank for percentage-based.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📆 Balance Due (Days Before Travel)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.balanceDueDaysBeforeTravel}
                    onChange={e => handleInputChange("balanceDueDaysBeforeTravel", e.target.value ? Number(e.target.value) : "")}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                    placeholder="90"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    E.g. 90 = balance must be settled 90 days before travel OR upon visa release.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Optional Tours / Excursions ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-3 rounded-xl">
                  <Plus className="text-orange-600" size={26} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Optional Tours / Excursions</h2>
                  <p className="text-gray-600 text-sm">
                    Add day-specific optional activities customers can add on to their booking
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={addOptionalTour}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                Add Optional Tour
              </button>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <p className="text-orange-800 text-sm">
                <strong>Route A Preferred Example:</strong>{" "}
                Day 4 – Disneyland Paris Tour &nbsp;·&nbsp;
                Day 6 – Cable Car and Ice Flyer Chairlift &nbsp;·&nbsp;
                Day 7 – Grindelwald-Interlaken-Lauterbrunnen &nbsp;·&nbsp;
                Day 9 – Lake Como-Bellagio-Lugano &nbsp;·&nbsp;
                Day 12 – In-depth Colosseum &nbsp;·&nbsp;
                Day 13 – Pompeii, Amalfi &amp; Positano Tour.
                {" "}Promo: <strong>₱15,000 flat</strong> per package OR <strong>50% off</strong> on optional tours — depends on sales.
              </p>
            </div>

            <div className="space-y-4">
              {formData.optionalTours.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No optional tours added yet.</p>
              ) : (
                formData.optionalTours.map((ot, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Optional Tour #{idx + 1}</span>
                      <button type="button" onClick={() => removeOptionalTour(idx)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Day #</label>
                        <input
                          type="number"
                          min="1"
                          value={ot.day}
                          onChange={e => updateOptionalTour(idx, "day", Number(e.target.value))}
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Activity Title</label>
                        <input
                          type="text"
                          value={ot.title}
                          onChange={e => updateOptionalTour(idx, "title", e.target.value)}
                          placeholder="e.g. Disneyland Paris Tour"
                          className="w-full border rounded px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Regular Price (PHP/pax)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₱</span>
                          <input
                            type="number"
                            min="0"
                            value={ot.regularPrice}
                            onChange={e => updateOptionalTour(idx, "regularPrice", e.target.value ? Number(e.target.value) : "")}
                            className="w-full border rounded pl-7 pr-3 py-2 text-sm"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Promo Type</label>
                        <select
                          value={ot.promoType}
                          onChange={e => updateOptionalTour(idx, "promoType", e.target.value)}
                          disabled={!ot.promoEnabled}
                          className="w-full border rounded px-3 py-2 text-sm bg-white disabled:opacity-50"
                        >
                          <option value="flat">Flat PHP amount (e.g. ₱15,000)</option>
                          <option value="percent">% Discount (e.g. 50% off)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          {ot.promoType === "flat" ? "Promo Price (PHP/pax)" : "Discount (%)"}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                            {ot.promoType === "flat" ? "₱" : "%"}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max={ot.promoType === "percent" ? 100 : undefined}
                            value={ot.promoValue}
                            onChange={e => updateOptionalTour(idx, "promoValue", e.target.value ? Number(e.target.value) : "")}
                            disabled={!ot.promoEnabled}
                            className="w-full border rounded pl-7 pr-3 py-2 text-sm disabled:opacity-50"
                            placeholder={ot.promoType === "flat" ? "15,000" : "50"}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id={`ot-promo-${idx}`}
                        checked={ot.promoEnabled}
                        onChange={e => updateOptionalTour(idx, "promoEnabled", e.target.checked)}
                        className="w-4 h-4 text-orange-500"
                      />
                      <label htmlFor={`ot-promo-${idx}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                        Enable Promo Pricing for this optional tour
                      </label>
                      {ot.promoEnabled && ot.promoType === "flat" && ot.promoValue !== "" && (
                        <span className="ml-2 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          Promo: ₱{Number(ot.promoValue).toLocaleString()}
                        </span>
                      )}
                      {ot.promoEnabled && ot.promoType === "percent" && ot.promoValue !== "" && (
                        <span className="ml-2 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          Promo: {ot.promoValue}% off → ₱{ot.regularPrice !== "" ? Math.round(Number(ot.regularPrice) * (1 - Number(ot.promoValue) / 100)).toLocaleString() : "—"}
                        </span>
                      )}
                    </div>

                    {/* Flipbook link for this individual optional tour */}
                    <div className="pt-1">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Flipbook / Itinerary Link (optional)
                      </label>
                      <input
                        type="url"
                        value={ot.flipbookUrl ?? ""}
                        onChange={e => updateOptionalTour(idx, "flipbookUrl", e.target.value)}
                        placeholder="https://bit.ly/..."
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Shown as a "View Details" button next to this optional tour on the tour detail page.</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ─── Full Cash Payment Freebies ───────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-3 rounded-xl">
                  <Check className="text-green-600" size={26} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Full Cash Payment Freebies</h2>
                  <p className="text-gray-600 text-sm">
                    Perks shown to customers who choose full cash payment at booking
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={addCashFreebie}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                Add Freebie
              </button>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 text-sm">
                <strong>Route A Preferred Freebies (Full Cash Payment):</strong>{" "}
                50% off Visa Processing &amp; Appointment Fee &nbsp;·&nbsp;
                50% off Permits, City Tax &amp; Tippings in Europe &nbsp;·&nbsp;
                50% off Travel Insurance &nbsp;·&nbsp;
                Free Philippine Travel Tax &nbsp;·&nbsp;
                Free Ireland ETA
              </p>
            </div>

            <div className="space-y-3">
              {formData.cashFreebies.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No freebies added yet.</p>
              ) : (
                formData.cashFreebies.map((fb, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Freebie Label</label>
                      <input
                        type="text"
                        value={fb.label}
                        onChange={e => updateCashFreebie(idx, "label", e.target.value)}
                        placeholder="e.g. Free Philippine Travel Tax"
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                      <select
                        value={fb.type}
                        onChange={e => updateCashFreebie(idx, "type", e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm bg-white"
                      >
                        <option value="free">Completely Free</option>
                        <option value="percent_off">% Off</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        {fb.type === "percent_off" ? "Discount %" : "N/A"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={fb.type === "percent_off" ? fb.value : ""}
                        onChange={e => updateCashFreebie(idx, "value", e.target.value ? Number(e.target.value) : "")}
                        disabled={fb.type === "free"}
                        className="w-full border rounded px-3 py-2 text-sm disabled:opacity-40 disabled:bg-gray-100"
                        placeholder={fb.type === "percent_off" ? "50" : "—"}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeCashFreebie(idx)}
                        className="px-3 py-2 bg-red-50 text-red-700 rounded text-xs font-semibold hover:bg-red-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ─── Live Pricing Computation Preview ───────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-100 p-3 rounded-xl">
                <DollarSign className="text-blue-600" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Live Pricing Preview</h2>
                <p className="text-gray-600 text-sm">Real-time computation — reflects exactly what customers will see</p>
              </div>
            </div>

            {/* Route A Preferred reference callout */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-blue-800 text-sm">
              <strong>Reference – Route A Preferred (15 days):</strong>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                <li>May 13–27, 2026 · May 25–Jun 8, 2026 → <strong>₱170,000</strong> per pax</li>
                <li>Oct 28–Nov 11, 2026 · Feb 24–Mar 10, 2027 → <strong>₱160,000</strong> per pax</li>
                <li>Mar 31–Apr 14, 2027 → <strong>₱150,000</strong> per pax</li>
                <li>Promo: ₱15,000 tour package OR 50% off optional tours (sales-dependent)</li>
                <li>Downpayment: ₱50,000 · Balance: 90 days before travel or upon visa release</li>
                <li>Countries: France · Switzerland · Italy · Vatican</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Base Pricing */}
              <div className="space-y-2">
                <h3 className="font-bold text-gray-700 text-base border-b pb-2">Base Pricing</h3>
                <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                  <span className="text-sm text-gray-600">Regular Rate / Pax</span>
                  <span className="font-bold text-gray-900 text-lg">
                    {formData.regularPricePerPerson !== ""
                      ? `₱${Number(formData.regularPricePerPerson).toLocaleString()}`
                      : <span className="text-gray-400 text-sm">Not set</span>}
                  </span>
                </div>
                {formData.isSaleEnabled && (
                  <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                    <span className="text-sm text-gray-600">Promo / Sale Rate / Pax</span>
                    <span className="font-bold text-green-600 text-lg">
                      {formData.promoPricePerPerson !== ""
                        ? `₱${Number(formData.promoPricePerPerson).toLocaleString()}`
                        : <span className="text-gray-400 text-sm">Not set</span>}
                    </span>
                  </div>
                )}
                {formData.isSaleEnabled &&
                  formData.regularPricePerPerson !== "" &&
                  formData.promoPricePerPerson !== "" && (
                    <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                      <span className="text-sm text-gray-600">Customer Savings</span>
                      <span className="font-bold text-green-700">
                        ₱{(Number(formData.regularPricePerPerson) - Number(formData.promoPricePerPerson)).toLocaleString()}
                        {" "}({Math.round((1 - Number(formData.promoPricePerPerson) / Number(formData.regularPricePerPerson)) * 100)}% off)
                      </span>
                    </div>
                  )}
              </div>

              {/* Payment Rules */}
              <div className="space-y-2">
                <h3 className="font-bold text-gray-700 text-base border-b pb-2">Payment Rules</h3>
                <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                  <span className="text-sm text-gray-600">Downpayment</span>
                  <span className="font-semibold text-gray-800">
                    {formData.allowsDownpayment
                      ? formData.fixedDownpaymentAmount !== ""
                        ? `₱${Number(formData.fixedDownpaymentAmount).toLocaleString()}`
                        : "Enabled (amount not set)"
                      : <span className="text-gray-400">Full payment only</span>}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                  <span className="text-sm text-gray-600">Balance Due</span>
                  <span className="font-semibold text-gray-800">
                    {formData.balanceDueDaysBeforeTravel !== ""
                      ? `${formData.balanceDueDaysBeforeTravel} days before travel / visa release`
                      : <span className="text-gray-400">Not set</span>}
                  </span>
                </div>
                {formData.allowsDownpayment &&
                  formData.fixedDownpaymentAmount !== "" &&
                  formData.regularPricePerPerson !== "" && (
                    <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                      <span className="text-sm text-gray-600">Remaining Balance (after DP)</span>
                      <span className="font-semibold text-gray-700">
                        ₱{(Number(formData.regularPricePerPerson) - Number(formData.fixedDownpaymentAmount)).toLocaleString()}
                      </span>
                    </div>
                  )}
              </div>
            </div>

            {/* Per-departure-date pricing */}
            {formData.departureDates.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-gray-700 text-base border-b pb-2 mb-3">Departure Date Pricing</h3>
                <div className="space-y-2">
                  {formData.departureDates.map((d, idx) => {
                    const effectivePrice = d.price != null
                      ? d.price
                      : formData.regularPricePerPerson !== ""
                        ? Number(formData.regularPricePerPerson)
                        : null;
                    return (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-dashed border-gray-100">
                        <span className="text-sm text-gray-600">
                          {d.start && d.end
                            ? `${new Date(d.start + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(d.end + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
                            : `Departure #${idx + 1}`}
                        </span>
                        <div className="flex items-center gap-2">
                          {d.price != null && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Custom Price</span>
                          )}
                          <span className="font-semibold text-gray-800">
                            {effectivePrice !== null
                              ? `₱${effectivePrice.toLocaleString()}`
                              : <span className="text-gray-400 text-xs">TBD</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Optional Tours computed prices */}
            {formData.optionalTours.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-gray-700 text-base border-b pb-2 mb-3">Optional Tour Pricing</h3>
                <div className="space-y-2">
                  {formData.optionalTours.map((ot, idx) => {
                    const promoPrice =
                      ot.promoEnabled && ot.promoValue !== ""
                        ? ot.promoType === "flat"
                          ? Number(ot.promoValue)
                          : ot.regularPrice !== ""
                            ? Math.round(Number(ot.regularPrice) * (1 - Number(ot.promoValue) / 100))
                            : null
                        : null;
                    return (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-dashed border-gray-100">
                        <span className="text-sm text-gray-600">
                          Day {ot.day} – {ot.title || `Optional Tour #${idx + 1}`}
                        </span>
                        <div className="flex items-center gap-3">
                          {ot.regularPrice !== "" && (
                            <span className={`text-sm ${
                              promoPrice !== null ? "line-through text-gray-400" : "font-semibold text-gray-800"
                            }`}>
                              ₱{Number(ot.regularPrice).toLocaleString()}
                            </span>
                          )}
                          {promoPrice !== null && (
                            <span className="font-semibold text-green-600">₱{promoPrice.toLocaleString()}</span>
                          )}
                          {ot.promoEnabled && ot.promoType === "percent" && ot.promoValue !== "" && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{ot.promoValue}% off</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cash Freebies list */}
            {formData.cashFreebies.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-gray-700 text-base border-b pb-2 mb-3">Full Cash Payment Freebies</h3>
                <ul className="space-y-1">
                  {formData.cashFreebies.map((fb, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-green-800">
                      <Check size={15} className="text-green-500 flex-shrink-0" />
                      {fb.type === "percent_off" && fb.value !== ""
                        ? `${fb.value}% off ${fb.label}`
                        : fb.type === "free"
                          ? `FREE ${fb.label}`
                          : fb.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Travel Dates Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-green-100 p-3 rounded-xl">
                <Clock className="text-green-600" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Departure Dates</h2>
                <p className="text-gray-600">Set multiple departure windows for this tour</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">📅 Multiple Departure Windows</h3>
                <p className="text-blue-700 text-sm">
                  Add multiple departure date ranges for this tour. Each range represents a separate tour departure that customers can book.
                  For example: "Feb 4-18, 2026", "May 27 - Jun 10, 2026", etc.
                </p>
              </div>

              {/* Departure Dates List with Availability */}
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-700">
                  Departure Date Ranges & Availability
                </label>
                {formData.departureDates.map((range, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-600 w-8">#{idx + 1}</span>
                      <button type="button" onClick={() => removeDepartureDateRange(idx)} className="ml-auto text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
                    </div>
                    
                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={range.start}
                          onChange={e => updateDepartureDateRange(idx, 'start', e.target.value)}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                        <input
                          type="date"
                          value={range.end}
                          onChange={e => updateDepartureDateRange(idx, 'end', e.target.value)}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    </div>
                    
                    {/* Capacity & Availability */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Max Capacity</label>
                        <input
                          type="number"
                          min="1"
                          value={range.maxCapacity || ''}
                          placeholder="Unlimited"
                          onChange={e => updateDepartureDateRange(idx, 'maxCapacity', e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Current Bookings</label>
                        <input
                          type="number"
                          min="0"
                          value={range.currentBookings || 0}
                          onChange={e => updateDepartureDateRange(idx, 'currentBookings', parseInt(e.target.value) || 0)}
                          className="w-full border rounded px-3 py-2 bg-gray-100"
                          readOnly
                          title="This will be auto-updated when bookings are made"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Override Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={range.price || ''}
                          placeholder="Use default"
                          onChange={e => updateDepartureDateRange(idx, 'price', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    </div>
                    
                    {/* Availability Toggle */}
                    <div className="flex items-center gap-3 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={range.isAvailable !== false}
                          onChange={e => updateDepartureDateRange(idx, 'isAvailable', e.target.checked)}
                          className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Available for Booking</span>
                      </label>
                      {range.maxCapacity && range.currentBookings !== undefined && (
                        <span className="ml-auto text-xs font-medium text-gray-600">
                          {range.currentBookings} / {range.maxCapacity} booked
                          {range.currentBookings >= range.maxCapacity && (
                            <span className="ml-2 text-red-600 font-semibold">(FULL)</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addDepartureDateRange} className="w-full border-2 border-dashed border-green-300 rounded-lg p-4 text-green-600 hover:border-green-400 hover:bg-green-50 transition-all">
                  + Add New Departure Date Range
                </button>
                {formData.departureDates.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <Clock className="mx-auto mb-2" size={32} />
                    <p>No departure dates set yet. Add your first departure date range above.</p>
                  </div>
                )}
              </div>

              {/* Legacy Travel Window (Optional) */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Legacy Travel Window (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.travelWindow.start}
                      onChange={(e) => handleInputChange("travelWindow", { ...formData.travelWindow, start: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.travelWindow.end}
                      onChange={(e) => handleInputChange("travelWindow", { ...formData.travelWindow, end: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  This is the old single travel window format. Use departure date ranges above for better flexibility.
                </p>
              </div>
            </div>
          </div>

          {/* Itinerary Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Itinerary</h2>
                <p className="text-gray-600">Add day-by-day details and an image for each day.</p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({
                    ...prev,
                    itinerary: [...prev.itinerary, { day: prev.itinerary.length + 1, title: '', description: '', image: '' }]
                  }))}
                  className="px-4 py-2 rounded bg-gradient-to-r from-green-400 to-green-500 text-white font-semibold text-sm shadow hover:from-green-500 hover:to-green-600 transition"
                >
                  + Add Day
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {formData.itinerary.length > 0 ? (
                formData.itinerary.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center bg-gray-50 p-3 rounded">
                    <div className="md:col-span-1">
                      <label className="block text-xs text-gray-600 mb-1">Day</label>
                      <input
                        type="number"
                        min={1}
                        value={it.day}
                        onChange={e => {
                          const day = Number(e.target.value);
                          setFormData((prev) => {
                            const itinerary = [...prev.itinerary];
                            itinerary[idx] = { ...itinerary[idx], day };
                            return { ...prev, itinerary };
                          });
                        }}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={it.title}
                        onChange={e => {
                          const title = e.target.value;
                          setFormData((prev) => {
                            const itinerary = [...prev.itinerary];
                            itinerary[idx] = { ...itinerary[idx], title };
                            return { ...prev, itinerary };
                          });
                        }}
                        placeholder="e.g., Arrival in Paris"
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Description</label>
                      <textarea
                        value={it.description}
                        onChange={e => {
                          const description = e.target.value;
                          setFormData((prev) => {
                            const itinerary = [...prev.itinerary];
                            itinerary[idx] = { ...itinerary[idx], description };
                            return { ...prev, itinerary };
                          });
                        }}
                        rows={2}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        placeholder="Details for this day..."
                      />
                    </div>
                    <div className="md:col-span-1 flex flex-col items-center gap-2">
                      <label className="block text-xs text-gray-600 mb-1">Image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => {
                          const file = e.target.files && e.target.files[0];
                          if (file) handleItineraryImageUpload(idx, file);
                        }}
                        className="mb-2"
                      />
                      {it.image ? (
                        <img src={it.image} alt={`Itinerary Day ${it.day}`} className="w-24 h-16 object-cover rounded border" />
                      ) : (
                        <div className="w-24 h-16 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">No image</div>
                      )}
                      {it.image && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => {
                              const itinerary = [...prev.itinerary];
                              itinerary[idx] = { ...itinerary[idx], image: '' };
                              return { ...prev, itinerary };
                            });
                          }}
                          className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded hover:bg-red-100"
                        >Remove</button>
                      )}
                    </div>
                    <div className="md:col-span-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => {
                            const itinerary = prev.itinerary.filter((_, i) => i !== idx);
                            return { ...prev, itinerary };
                          });
                        }}
                        className="px-3 py-1 rounded bg-red-50 text-red-700 text-xs hover:bg-red-100"
                      >Remove Day</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500">No itinerary days added yet. Click \"Add Day\" to begin.</div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-purple-100 p-3 rounded-xl">
                <Camera className="text-purple-600" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Tour Images</h2>
                <p className="text-gray-600">Add stunning visuals to showcase your tour</p>
              </div>
            </div>

            <div className="space-y-8">
              {/* Main Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Main Image (required)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    // Create record with label 'main'
                    const record = await createImageRecord('main');
                    const tourId = id || formData.slug || `new-tour-${Date.now()}`;
                    const url = await uploadImageToStorage(file, tourId, 'main');
                    // Update record with URL (simulate)
                    record.url = url;
                    if (url) handleInputChange("mainImage", url);
                  }}
                  className="mb-2"
                />
                {formData.mainImage && (
                  <div className="flex items-center gap-2 mt-2">
                    <img src={formData.mainImage} alt="Main Tour" className="w-48 h-32 object-cover rounded border" />
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Main</span>
                  </div>
                )}
              </div>

              {/* Gallery Images Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Tour Gallery Images</label>
                <div className="space-y-2">
                  {galleryFields.map((img: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      {img ? (
                        <img src={img} alt={`Gallery ${idx + 1}`} className="w-24 h-16 object-cover rounded border" />
                      ) : (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const record = await createImageRecord('gallery');
                            const tourId = id || formData.slug || `new-tour-${Date.now()}`;
                            const url = await uploadImageToStorage(file, tourId, 'gallery');
                            record.url = url;
                            // Update galleryFields and formData.galleryImages
                            const newFields = [...galleryFields];
                            newFields[idx] = url;
                            setGalleryFields(newFields);
                            handleInputChange("galleryImages", newFields.filter(Boolean));
                          }}
                          className="mb-2"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newFields = galleryFields.filter((_: string, i: number) => i !== idx);
                          setGalleryFields(newFields);
                          handleInputChange("galleryImages", newFields.filter(Boolean));
                        }}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold"
                      >Remove</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setGalleryFields([...galleryFields, ""])}
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded font-semibold mt-2"
                  >+ Add Gallery Image</button>
                </div>
                {formData.galleryImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                    {formData.galleryImages.map((image: string, index: number) => (
                      <div key={index} className="relative group">
                        <img
                          src={image}
                          alt={`Gallery ${index + 1}`}
                          className="w-full h-24 object-cover rounded border cursor-pointer"
                          onClick={() => { setGalleryIndex(index); setGalleryOpen(true); }}
                        />
                        <span className="absolute top-2 left-2 bg-white text-purple-700 border border-purple-300 rounded-full px-2 py-1 text-xs font-bold shadow">Gallery</span>
                        <button
                          type="button"
                          onClick={() => {
                            // Set as main image
                            handleInputChange("mainImage", image);
                          }}
                          className="absolute bottom-2 left-2 bg-blue-100 text-blue-700 border border-blue-300 rounded-full px-2 py-1 text-xs font-bold shadow hover:bg-blue-200"
                        >
                          Set as Main
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Remove image from gallery
                            const newGallery = formData.galleryImages.filter((_: string, i: number) => i !== index);
                            handleInputChange("galleryImages", newGallery);
                          }}
                          className="absolute bottom-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Gallery Modal */}
                {galleryOpen && formData.galleryImages.length > 0 && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
                    <div className="relative bg-white rounded-lg shadow-lg p-4 max-w-xl w-full flex flex-col items-center">
                      <img
                        src={formData.galleryImages[galleryIndex]}
                        alt={`Gallery image ${galleryIndex + 1}`}
                        className="w-full h-96 object-contain rounded-lg mb-4"
                      />
                      <div className="flex gap-4 mb-2">
                        <button
                          type="button"
                          onClick={() => setGalleryIndex((galleryIndex - 1 + formData.galleryImages.length) % formData.galleryImages.length)}
                          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setGalleryIndex((galleryIndex + 1) % formData.galleryImages.length)}
                          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          Next
                        </button>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {formData.galleryImages.map((img: string, idx: number) => (
                          <button
                            key={idx}
                            type="button"
                            className={`w-4 h-4 rounded-full border ${galleryIndex === idx ? 'bg-blue-500 border-blue-700' : 'bg-gray-300 border-gray-400'}`}
                            onClick={() => setGalleryIndex(idx)}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setGalleryOpen(false)}
                        className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tour Video Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Tour Video
                  <span className="text-xs text-gray-500 ml-2">(MP4, WebM, MOV - max 100MB)</span>
                </label>
                <div className="space-y-3">
                  {formData.video_url ? (
                    <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                      <video 
                        src={formData.video_url} 
                        controls 
                        className="w-full max-h-64 rounded-lg bg-black"
                      />
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-green-700 font-medium">✓ Video uploaded</span>
                        <button
                          type="button"
                          onClick={() => handleInputChange("video_url", "")}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors"
                        >
                          Remove Video
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 bg-blue-50/30 hover:bg-blue-50 transition-colors">
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          // Validate file size (100MB limit)
                          if (file.size > 100 * 1024 * 1024) {
                            errorToast('Video file size must be less than 100MB');
                            return;
                          }

                          // Upload to storage
                          try {
                            const tourId = id || formData.slug || `new-tour-${Date.now()}`;
                            const url = await uploadImageToStorage(file, tourId, 'video');
                            if (url) {
                              handleInputChange("video_url", url);
                              handleInputChange("videoFile", file);
                            }
                          } catch (error) {
                            console.error('Video upload failed:', error);
                            errorToast('Failed to upload video. Please try again.');
                          }
                        }}
                        className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                      />
                      <p className="mt-2 text-xs text-gray-500 text-center">
                        This video will be displayed on the tour detail page
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Related Images Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Other Related Images</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    const tourId = id || formData.slug || `new-tour-${Date.now()}`;
                    const urls = await Promise.all(files.map(async (file) => await uploadImageToStorage(file, tourId, 'related')));
                    const validUrls = urls.filter(url => url);
                    handleInputChange("relatedImages", [...formData.relatedImages, ...validUrls]);
                  }}
                  className="mb-2"
                />
                {formData.relatedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.relatedImages.map((image: string, index: number) => (
                      <img key={index} src={image} alt={`Related ${index + 1}`} className="w-20 h-16 object-cover rounded border" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NEW: Countries to Visit */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Countries to Visit</h2>
                <p className="text-gray-600">Add the countries this tour will visit and a single image for each country.</p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={addCountry}
                  className="px-4 py-2 rounded bg-gradient-to-r from-pink-400 to-pink-500 text-white font-semibold text-sm shadow hover:from-pink-500 hover:to-pink-600 transition"
                >
                  + Add Country
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {(formData.additionalInfo.countries && formData.additionalInfo.countries.length > 0) ? (
                formData.additionalInfo.countries.map((c: CountryEntry, idx: number) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center bg-gray-50 p-3 rounded">
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Country</label>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => updateCountry(idx, "name", e.target.value)}
                        placeholder="e.g., France"
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs text-gray-600 mb-1">Image URL</label>
                      <input
                        type="url"
                        value={c.image ?? ""}
                        onChange={(e) => updateCountry(idx, "image", e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                      <div className="text-xs text-gray-500 mt-1">Or upload an image file below — a preview will be shown.</div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) handleCountryFile(idx, file);
                        }}
                        className="mt-2"
                      />
                    </div>

                    <div className="md:col-span-1 flex items-center gap-3">
                      {c.image ? (
                        <img src={c.image} alt={c.name || `country-${idx}`} className="w-24 h-16 object-cover rounded border" />
                      ) : (
                        <div className="w-24 h-16 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">No image</div>
                      )}
                      <div className="ml-auto">
                        <button
                          type="button"
                          onClick={() => removeCountry(idx)}
                          className="px-3 py-1 rounded bg-red-50 text-red-700 text-xs hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500">No countries added yet. Click "Add Country" to begin.</div>
              )}
            </div>
          </div>

          {/* NEW: Cities to Visit */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Cities to Visit</h2>
                <p className="text-gray-600">Add the cities this tour will visit, with an optional country and photo for each.</p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={addCity}
                  className="px-4 py-2 rounded bg-gradient-to-r from-indigo-400 to-indigo-500 text-white font-semibold text-sm shadow hover:from-indigo-500 hover:to-indigo-600 transition"
                >
                  + Add City
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {(formData.additionalInfo.citiesToVisit && formData.additionalInfo.citiesToVisit.length > 0) ? (
                formData.additionalInfo.citiesToVisit.map((c: CityEntry, idx: number) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-8 gap-3 items-center bg-gray-50 p-3 rounded">
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">City Name</label>
                      <input
                        type="text"
                        value={c.city}
                        onChange={(e) => updateCity(idx, "city", e.target.value)}
                        placeholder="e.g., Tokyo"
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Country</label>
                      <input
                        type="text"
                        value={c.country ?? ""}
                        onChange={(e) => updateCity(idx, "country", e.target.value)}
                        placeholder="e.g., Japan"
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs text-gray-600 mb-1">Image URL</label>
                      <input
                        type="url"
                        value={c.image ?? ""}
                        onChange={(e) => updateCity(idx, "image", e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                      <div className="text-xs text-gray-500 mt-1">Or upload a photo file — a preview will be shown.</div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) handleCityFile(idx, file);
                        }}
                        className="mt-2"
                      />
                    </div>

                    <div className="md:col-span-1 flex items-center gap-3">
                      {c.image ? (
                        <img src={c.image} alt={c.city || `city-${idx}`} className="w-24 h-16 object-cover rounded border" />
                      ) : (
                        <div className="w-24 h-16 bg-gray-100 rounded border flex items-center justify-center text-xs text-gray-400">No photo</div>
                      )}
                      <div className="ml-auto">
                        <button
                          type="button"
                          onClick={() => removeCity(idx)}
                          className="px-3 py-1 rounded bg-red-50 text-red-700 text-xs hover:bg-red-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500">No cities added yet. Click "+ Add City" to begin.</div>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col sm:flex-row gap-6 justify-between items-center">
              <div>
                <p className="text-gray-700 font-medium text-lg">
                  {isEdit ? "Save your changes to update the tour" : "Create your new tour and make it available to customers"}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  {isEdit ? "All changes will be saved immediately" : "Your tour will be visible to customers once created"}
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => navigate("/tours")}
                  className="px-8 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-3 px-10 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg font-semibold text-lg"
                >
                  <Save size={22} />
                  {saving ? "Saving..." : isEdit ? "Update Tour" : "Create Tour"}
                </button>
              </div>
            </div>
          </div>
        </SecureForm>
      </div>
    </div>
  );
}


