const API_KEY_STORAGE = "googleMapsApiKey";
const PICKER_ZOOM_CONTROL_ENABLED = false;
const STREET_VIEW_ZOOM_CONTROL_ENABLED = false;

const state = {
  apiKey: "",
  map: null,
  panorama: null,
  marker: null,
  streetViewService: null,
  coverageLayer: null,
  coverageEnabled: false,
  mapTypeId: "roadmap",
  pickerResizeBound: false,
};

const elements = {
  streetView: document.getElementById("streetview"),
  placeholder: document.getElementById("placeholder"),
  map: document.getElementById("map"),
  pickerStatus: document.getElementById("pickerStatus"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveApiKey: document.getElementById("saveApiKey"),
  apiHint: document.getElementById("apiHint"),
  mapMode: document.getElementById("mapMode"),
  satelliteMode: document.getElementById("satelliteMode"),
  hybridMode: document.getElementById("hybridMode"),
  coverageToggle: document.getElementById("coverageToggle"),
};

const showPlaceholder = () => {
  elements.streetView.classList.remove("is-active");
  elements.placeholder.style.opacity = "1";
};

const hidePlaceholder = () => {
  elements.streetView.classList.add("is-active");
  elements.placeholder.style.opacity = "0";
};

const updateMapMode = (mode) => {
  state.mapTypeId = mode;
  if (state.map) {
    state.map.setMapTypeId(mode);
  }
  if (elements.mapMode) {
    elements.mapMode.classList.toggle("is-active", mode === "roadmap");
  }
  if (elements.satelliteMode) {
    elements.satelliteMode.classList.toggle("is-active", mode === "satellite");
  }
  if (elements.hybridMode) {
    elements.hybridMode.classList.toggle("is-active", mode === "hybrid");
  }
};

const setCoverageEnabled = (isEnabled) => {
  state.coverageEnabled = isEnabled;
  if (state.coverageLayer && state.map) {
    state.coverageLayer.setMap(isEnabled ? state.map : null);
  }
  if (elements.coverageToggle) {
    elements.coverageToggle.classList.toggle("is-active", isEnabled);
  }
};

const setStatus = (message) => {
  if (!elements.pickerStatus) {
    return;
  }
  elements.pickerStatus.textContent = message;
};

const toggleApiPanel = (isVisible) => {
  elements.apiKeyInput
    .closest(".api-key")
    .classList.toggle("is-hidden", !isVisible);
};

const bindPickerResize = () => {
  if (state.pickerResizeBound) {
    return;
  }

  const picker = document.querySelector(".picker");
  if (!picker) {
    return;
  }

  const readBaseSize = () => {
    const rect = picker.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    picker.style.setProperty("--picker-base-w", `${width}px`);
    picker.style.setProperty("--picker-base-h", `${height}px`);
    return { width, height };
  };

  const updateExpandedSize = () => {
    const { width: baseW, height: baseH } = readBaseSize();
    const aspect = baseW / baseH;
    const maxHeight = window.innerHeight * 0.8;
    const maxWidth = window.innerWidth * 0.9;
    const expandedH = Math.min(maxHeight, maxWidth / aspect);
    const expandedW = expandedH * aspect;
    picker.style.setProperty("--picker-expanded-w", `${expandedW}px`);
    picker.style.setProperty("--picker-expanded-h", `${expandedH}px`);
  };

  const handleResize = () => {
    if (!state.map) {
      return;
    }
    const center = state.map.getCenter();
    google.maps.event.trigger(state.map, "resize");
    if (center) {
      state.map.setCenter(center);
    }
  };

  picker.addEventListener("mouseenter", () => {
    updateExpandedSize();
    picker.classList.add("is-expanded");
    requestAnimationFrame(() => setTimeout(handleResize, 220));
  });

  picker.addEventListener("mouseleave", () => {
    picker.classList.remove("is-expanded");
    requestAnimationFrame(() => setTimeout(handleResize, 220));
  });

  picker.addEventListener("transitionend", (event) => {
    if (event.propertyName === "width" || event.propertyName === "height") {
      handleResize();
    }
  });

  window.addEventListener("resize", () => {
    if (!picker.classList.contains("is-expanded")) {
      return;
    }
    updateExpandedSize();
    requestAnimationFrame(() => setTimeout(handleResize, 220));
  });

  state.pickerResizeBound = true;
};

const loadGoogleMaps = (apiKey) =>
  new Promise((resolve, reject) => {
    if (!apiKey) {
      reject(new Error("Missing API key"));
      return;
    }

    if (window.google && window.google.maps) {
      resolve(window.google.maps);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

const initMap = () => {
  state.map = new google.maps.Map(elements.map, {
    center: { lat: 48.8584, lng: 2.2945 },
    zoom: 3,
    mapTypeId: state.mapTypeId,
    disableDefaultUI: true,
    zoomControl: PICKER_ZOOM_CONTROL_ENABLED,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
    scaleControl: false,
    rotateControl: false,
    clickableIcons: false,
    keyboardShortcuts: false,
  });

  state.coverageLayer = new google.maps.StreetViewCoverageLayer();
  setCoverageEnabled(false);

  state.panorama = new google.maps.StreetViewPanorama(elements.streetView, {
    visible: false,
    disableDefaultUI: true,
    motionTracking: false,
    motionTrackingControl: false,
    addressControl: false,
    fullscreenControl: false,
    zoomControl: STREET_VIEW_ZOOM_CONTROL_ENABLED,
    linksControl: false,
    panControl: false,
    clickToGo: true,
    keyboardShortcuts: false,
  });

  state.streetViewService = new google.maps.StreetViewService();

  state.map.addListener("click", (event) => {
    if (!event.latLng) {
      return;
    }
    findNearestPanorama(event.latLng);
  });

  bindPickerResize();
  updateMapMode(state.mapTypeId);
  setStatus("Click on the map to choose a location.");
};

const findNearestPanorama = (latLng) => {
  if (!state.streetViewService) {
    setStatus("Map not ready yet. Please try again.");
    return;
  }
  setStatus("Finding nearby Street View...");
  state.streetViewService.getPanorama(
    {
      location: latLng,
      radius: 1000, // 1 km search radius for closest location
      source: google.maps.StreetViewSource.DEFAULT,
    },
    (data, status) => {
      if (status !== google.maps.StreetViewStatus.OK || !data) {
        setStatus("No Street View found nearby. Try another spot.");
        showPlaceholder();
        return;
      }

      const panoLocation = data.location.latLng;

      if (!state.marker) {
        state.marker = new google.maps.Marker({
          map: state.map,
          position: panoLocation,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: "#4f8cff",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
      } else {
        state.marker.setPosition(panoLocation);
      }

      state.map.panTo(panoLocation);

      state.panorama.setPosition(panoLocation);
      state.panorama.setPov({ heading: 0, pitch: 0, zoom: 0 });
      state.panorama.setVisible(true);
      hidePlaceholder();
      setStatus("Street View loaded.");
    }
  );
};

const setupApiKey = () => {
  const storedKey = localStorage.getItem(API_KEY_STORAGE);
  if (storedKey) {
    state.apiKey = storedKey;
    elements.apiKeyInput.value = storedKey;
    toggleApiPanel(false);
  } else {
    toggleApiPanel(true);
  }

  elements.saveApiKey.addEventListener("click", async () => {
    const key = elements.apiKeyInput.value.trim();
    if (!key) {
      setStatus("Enter a valid API key to start.");
      return;
    }

    localStorage.setItem(API_KEY_STORAGE, key);
    state.apiKey = key;
    elements.apiHint.textContent = "Key saved locally. Loading Google Maps...";

    try {
      await loadGoogleMaps(key);
      initMap();
      elements.apiHint.textContent = "Key saved locally. Google Maps ready.";
      toggleApiPanel(false);
    } catch (error) {
      elements.apiHint.textContent =
        "Could not load Google Maps. Check the key.";
      showPlaceholder();
      toggleApiPanel(true);
    }
  });

  if (state.apiKey) {
    loadGoogleMaps(state.apiKey)
      .then(() => {
        initMap();
        elements.apiHint.textContent = "Key saved locally. Google Maps ready.";
        toggleApiPanel(false);
      })
      .catch(() => {
        elements.apiHint.textContent =
          "Could not load Google Maps. Check the key.";
        showPlaceholder();
        toggleApiPanel(true);
      });
  } else {
    showPlaceholder();
    toggleApiPanel(true);
  }
};

const setupModeToggle = () => {
  elements.mapMode.addEventListener("click", () => updateMapMode("roadmap"));
  elements.satelliteMode.addEventListener("click", () =>
    updateMapMode("satellite")
  );
  if (elements.hybridMode) {
    elements.hybridMode.addEventListener("click", () =>
      updateMapMode("hybrid")
    );
  }
  if (elements.coverageToggle) {
    elements.coverageToggle.addEventListener("click", () =>
      setCoverageEnabled(!state.coverageEnabled)
    );
  }
};

setupApiKey();
setupModeToggle();
