// XBOTIX 2026 — site configuration. Items marked [CONFIRM] must be confirmed by the organizing committee.
// The Sheet ID and Drive folder ID live ONLY in Apps Script Script Properties, never here.
window.XBOTIX_CONFIG = {
  debug: true,                        // true enables ?stage= / ?now= overrides. Set to false before launch.
  year: 2026, edition: 8,             // [CONFIRM]
  theme: "",                          // [CONFIRM] 2026 tagline (2025 was "Sharpen • Sync • Strike")
  dates: {                            // ALWAYS with +05:30 [CONFIRM all]
    registrationOpens:  "2026-09-02T00:00:00+05:30",
    registrationCloses: "2026-12-02T23:59:59+05:30",
    competitionStarts:  "2026-12-19T08:00:00+05:30",
    competitionEnds:    "2026-12-19T18:00:00+05:30"
  },
  api: { url: "https://script.google.com/macros/s/AKfycbyATUddgx0aihA4wI4HeSUx4qVlhZ68EVohkIXVLy-s8rBKiA_MmPN9uykwBPfyYLoK_Q/exec", timeoutMs: 60000 },
  features: { sponsors: true, workshops: true, announcements: false, liveCount: false, turnstile: false },
  team:   { school: { min: 2, max: 5 }, university: { min: 2, max: 5 } },   // member 1 = leader
  upload: { maxMB: 5, types: ["application/pdf"], allowImages: false,        // allowImages:true adds image/jpeg,image/png + compression
            imageMaxPx: 2000, imageQuality: 0.8 },
  uniRegYears: { min: 2018, max: 2026 },                                     // [CONFIRM]
  rulebooks: [                                                               // placeholder PDFs until the committee delivers the real ones
    { category: "school",     title: "School Category Rulebook",     file: "assets/rulebooks/school-rulebook-v1.0.pdf",     version: "1.0", updated: "2026-10-01", size: "" },
    { category: "university", title: "University Category Rulebook", file: "assets/rulebooks/university-rulebook-v1.0.pdf", version: "1.0", updated: "2026-10-01", size: "" }
  ],
  venue: { name: "Faculty of Engineering, University of Ruhuna", address: "Hapugala, Galle", mapUrl: "https://maps.google.com/?q=Faculty+of+Engineering+University+of+Ruhuna" },
  links: { whatsappGroup: "", whatsappContact: "94715508827", email: "eies@eng.ruh.ac.lk", facebook: "", instagram: "", linkedin: "", youtube: "" },
  contacts: [                                                                  // shown as named people in Venue & Contact
    { name: "Mr. Milinda Jayawardhana", role: "EIES Society President", phone: "94715508827", email: "eies@eng.ruh.ac.lk" },
    { name: "Mr. Hasintha Edirisooriya", role: "", phone: "94713125373", email: "hasinthabhanuka11@gmail.com" }
  ],
  stats: [                                                                   // entries with value 0 are hidden until real numbers are confirmed
    { value: 7, label: "Editions" }, { value: 12, label: "Years of legacy" },
    { value: 0, label: "Teams", suffix: "+" }, { value: 0, label: "Schools", suffix: "+" }
  ]
};
