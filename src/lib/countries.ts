/* Display names for the ISO-3166 alpha-2 codes used by the shipping regions.
   Kept as a plain map so the cart can label a country picker without pulling
   in an i18n dependency; unknown codes fall back to the raw code. */
export const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates", AR: "Argentina", AT: "Austria", AU: "Australia",
  BE: "Belgium", BR: "Brazil", CA: "Canada", CH: "Switzerland", CL: "Chile",
  CN: "China", CO: "Colombia", CZ: "Czechia", DE: "Germany", DK: "Denmark",
  ES: "Spain", FI: "Finland", FJ: "Fiji", FR: "France", GB: "United Kingdom",
  GR: "Greece", HK: "Hong Kong", ID: "Indonesia", IE: "Ireland", IN: "India",
  IT: "Italy", JP: "Japan", KR: "South Korea", MX: "Mexico", MY: "Malaysia",
  NC: "New Caledonia", NL: "Netherlands", NO: "Norway", NZ: "New Zealand",
  PE: "Peru", PG: "Papua New Guinea", PH: "Philippines", PL: "Poland",
  PT: "Portugal", SE: "Sweden", SG: "Singapore", TH: "Thailand", TO: "Tonga",
  TW: "Taiwan", US: "United States", UY: "Uruguay", VN: "Vietnam",
  VU: "Vanuatu", WS: "Samoa",
};

export const countryName = (code: string) => COUNTRY_NAMES[code] ?? code;
