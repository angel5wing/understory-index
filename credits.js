
const CREDITS_KEY = "understory-photo-credits";

const API_URL =
  "https://www.inaturalist.org/observations.json" +
  "?taxon_id=47170" +
  "&place_id=66357" +
  "&per_page=20" +
  "&order_by=date_added" +
  "&order=desc" +
  "&photo_license=cc0,cc-by";

const ALLOWED_LICENSES = new Set(["CC0", "CC-BY"]);

const LICENSE_URLS = {
  "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC-BY": "https://creativecommons.org/licenses/by/4.0/"
};

const container = document.getElementById("credits-list");
const status = document.getElementById("credits-status");

function createLink(label, url) {
  const link = document.createElement("a");
  link.textContent = label;
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function getPhotographer(photoData, observation) {
  const attribution = photoData.attribution || "";
  const match = attribution.match(/uploaded by (.+)$/i);

  return (
    match?.[1]?.trim() ||
    observation.user?.login ||
    "unknown photographer"
  );
}

// Retrieves credits saved during the current index session
function getSavedCredits() {
  try {
    const saved = sessionStorage.getItem(CREDITS_KEY);
    const parsed = JSON.parse(saved || "[]");

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("unable to retrieve saved credits:", error);
    return [];
  }
}

// Fetches photographic records when no saved credits exist
async function fetchCredits() {
  const response = await fetch(`${API_URL}&page=1`);

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const observations = await response.json();

  if (!Array.isArray(observations)) {
    throw new Error("Unexpected API response format");
  }

  const credits = [];

  observations.forEach((observation) => {
    if (observation.id == null) {
      return;
    }

    const photoData = observation.photos?.find((photo) => {
      const license = String(
        photo.license_code || ""
      ).toUpperCase();

      return (
        ALLOWED_LICENSES.has(license) &&
        Boolean(photo.large_url)
      );
    });

    if (!photoData) {
      return;
    }

    const license = String(
      photoData.license_code
    ).toUpperCase();

    const name =
      observation.taxon?.common_name?.name ||
      observation.species_guess ||
      observation.taxon?.name ||
      "unidentified fungus";

    credits.push({
      specimenNumber: credits.length + 1,
      observationId: observation.id,
      name,
      photographer: getPhotographer(photoData, observation),
      license,
      licenseUrl:
        photoData.license_url || LICENSE_URLS[license],
      observationUrl:
        `https://www.inaturalist.org/observations/${observation.id}`,
      photoUrl: photoData.large_url
    });
  });

  return credits;
}

// Displays the photographic credits
function renderCredits(credits) {
  container.replaceChildren();

  credits.forEach((credit) => {
    const entry = document.createElement("article");
    entry.className = "credit-entry";

    const heading = document.createElement("h2");
    heading.textContent =
      `SPECIMEN ${String(credit.specimenNumber).padStart(3, "0")} — ${credit.name}`;

    const creator = document.createElement("p");
    creator.textContent =
      `photographer: ${credit.photographer}`;

    const licence = document.createElement("p");
    licence.textContent =
      `licence: ${credit.license}`;

    const links = document.createElement("div");
    links.className = "credit-links";

    links.appendChild(
      createLink("original observation", credit.observationUrl)
    );

    links.appendChild(
      createLink("photo", credit.photoUrl)
    );

    if (credit.licenseUrl) {
      links.appendChild(
        createLink("licence details", credit.licenseUrl)
      );
    }

    entry.append(
      heading,
      creator,
      licence,
      links
    );

    container.appendChild(entry);
  });
}

// Initialises the credits page
async function initialiseCredits() {
  const savedCredits = getSavedCredits();

  if (savedCredits.length > 0) {
    status.textContent =
      `uncovered details for ${savedCredits.length} total memories...`;

    renderCredits(savedCredits);
    return;
  }

  status.textContent =
    "retrieving photo credits from iNaturalist...";

  try {
    const credits = await fetchCredits();

    if (credits.length === 0) {
      status.textContent =
        "no eligible photographic credits found...";
      return;
    }

    status.textContent =
      `${credits.length} photo credits found`;

    renderCredits(credits);

  } catch (error) {
    console.error("unable to load photographic credits:", error);

    status.textContent =
      "unable to retrieve photographic credits. please try again later...";
  }
}

initialiseCredits();
