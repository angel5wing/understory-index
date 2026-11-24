const API_URL =
  "https://www.inaturalist.org/observations.json" +
  "?taxon_id=47170" +
  "&place_id=66357" +
  "&per_page=20" +
  "&order_by=date_added" +
  "&order=desc" +
  "&photo_license=cc0,cc-by";

const PAGE_SIZE = 20;
const ALLOWED_LICENSES = new Set(["CC0", "CC-BY"]);
const CREDITS_KEY = "understory-photo-credits";

const LICENSE_URLS = {
  "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "CC-BY": "https://creativecommons.org/licenses/by/4.0/"
};

let currentPage = 1;
let totalLoaded = 0;
let isLoading = false;
let hasMore = true;

const displayedObservations = new Set();
const photoCredits = [];

function saveCredits() {
  try {
    sessionStorage.setItem(
      CREDITS_KEY,
      JSON.stringify(photoCredits)
    );
  } catch (error) {
    console.warn("could not save photo credits:", error);
  }
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

// retrieves observation data from iNaturalist
async function getFungi() {
  const status = document.getElementById("status");
  const container = document.getElementById("observations");
  const loadMoreButton = document.getElementById("load-more");

  if (isLoading || !hasMore) {
    return;
  }

  isLoading = true;
  loadMoreButton.disabled = true;
  loadMoreButton.hidden = true;

  status.textContent =
    totalLoaded === 0
      ? "connecting to wood wide web..."
      : "tracing mycelial network...";

  try {
    const response = await fetch(
      `${API_URL}&page=${currentPage}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const observations = await response.json();

    if (!Array.isArray(observations)) {
      throw new Error("unexpected API response format");
    }

    // creates a card for each eligible observation
    observations.forEach((observation) => {
      if (
        observation.id == null ||
        displayedObservations.has(observation.id)
      ) {
        return;
      }

      // selects only photographs with approved licences
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

      displayedObservations.add(observation.id);

      const scientificName =
        observation.taxon?.name || "unidentified";

      const commonName =
        observation.taxon?.common_name?.name ||
        observation.species_guess ||
        scientificName;

      const photo = photoData.large_url;
      const date = observation.observed_on || "unknown";
      const location =
        observation.place_guess || "greater london";

      const photographer = getPhotographer(
        photoData,
        observation
      );

      const license = String(
        photoData.license_code
      ).toUpperCase();

      const observationUrl =
        `https://www.inaturalist.org/observations/${observation.id}`;

      const specimenNumber = totalLoaded + 1;

      // records photographic attribution
      photoCredits.push({
        specimenNumber,
        observationId: observation.id,
        name: commonName,
        photographer,
        attribution: photoData.attribution || "",
        license,
        licenseUrl: photoData.license_url ||
          LICENSE_URLS[license],
        observationUrl,
        photoUrl: photo
      });

      // pokemon card
      const card = document.createElement("article");
      card.className = "fungus-card";

      // card header
      const header = document.createElement("div");
      header.className = "card-header";

      const number = document.createElement("span");
      number.textContent =
        `SPECIMEN ${String(specimenNumber).padStart(3, "0")}`;

      const category = document.createElement("span");
      category.textContent = "FUNGI";

      header.append(number, category);

      // photo container
      const imageWrapper = document.createElement("div");
      imageWrapper.className = "image-wrapper";

      const image = document.createElement("img");
      image.src = photo;
      image.alt = `Observation of ${commonName}`;
      image.loading = "lazy";

      imageWrapper.appendChild(image);

      // overlay
      const photoCredit = document.createElement("span");
      photoCredit.className = "photo-credit";
      photoCredit.textContent = `photo: ${photographer}`;
      photoCredit.title = photoCredit.textContent;

      imageWrapper.appendChild(photoCredit);
      imageWrapper.tabIndex = 0;
      imageWrapper.setAttribute(
        "aria-label",
        photoCredit.textContent
      );

      // common name
      const title = document.createElement("h2");
      title.textContent = commonName;
      title.title = commonName;

      // scientific name
      const scientific = document.createElement("p");
      scientific.className = "scientific-name";
      scientific.textContent = scientificName;
      scientific.title = scientificName;

      // divider
      const divider = document.createElement("div");
      divider.className = "card-divider";

      // observation metadata
      const details = document.createElement("div");
      details.className = "card-details";

      function addDetail(label, value) {
        const row = document.createElement("div");
        row.className = "detail-row";

        const labelElement = document.createElement("span");
        labelElement.textContent = label;

        const valueElement = document.createElement("span");
        valueElement.textContent = value;

        row.append(labelElement, valueElement);
        details.appendChild(row);
      }

      addDetail("OBSERVED", date);
      addDetail("LOCATION", location);

      // original observation link
      const link = document.createElement("a");
      link.className = "observation-link";
      link.href = observationUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "VIEW ORIGINAL OBSERVATION";

      // assembles specimen card
      card.append(
        header,
        imageWrapper,
        title,
        scientific,
        divider,
        details,
        link
      );

      container.appendChild(card);
      totalLoaded += 1;
    });

    // saves credits after each successful batch
    saveCredits();

    // advances pagination
    currentPage += 1;
    hasMore = observations.length === PAGE_SIZE;

    if (totalLoaded === 0) {
      status.textContent = hasMore
        ? "no eligible photographs in this batch. explore further..."
        : "no eligible fungal photographs found...";
    } else {
      status.textContent =
        `${totalLoaded} total memories uncovered...`;
    }

    if (!hasMore && totalLoaded > 0) {
      status.textContent += " end of the network.";
    }

    loadMoreButton.hidden = !hasMore;
    loadMoreButton.textContent = "view more entries";

  } catch (error) {
    console.error("API request failed:", error);

    status.textContent =
      totalLoaded === 0
        ? "connection to the wood wide web failed..."
        : "the network was interrupted. try again...";

    loadMoreButton.hidden = false;
    loadMoreButton.textContent = "retry loading";

  } finally {
    isLoading = false;
    loadMoreButton.disabled = false;
  }
}

// starts a fresh index session
saveCredits();

document.getElementById("load-more").addEventListener(
  "click",
  getFungi
);

getFungi();