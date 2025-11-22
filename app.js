const STORAGE_KEY = 'gtacars-tracker-v1';
const DEFAULT_SLOTS = 10;
const GTABASE_SEARCH_URL = 'https://www.gtabase.com/search?searchword=';
const GTABASE_VEHICLE_BASE = 'https://www.gtabase.com/grand-theft-auto-v/vehicles/';

const OFFLINE_VEHICLE_FALLBACKS = {
  zentorno: { brand: 'Pegassi', class: 'Super' },
  ignus: { brand: 'Pegassi', class: 'Super', tags: 'electric' },
  cyclops: { brand: 'Declasse', class: 'Muscle' },
  scramjet: { brand: 'Declasse', class: 'Super', tags: 'weaponized' },
  calico: { brand: 'Karin', class: 'Sports', tags: 'tuner' },
  'elegy retro custom': { brand: 'Annis', class: 'Sports', tags: 'tuner' },
  deity: { brand: 'Enus', class: 'Sedan', tags: 'armored' },
  champion: { brand: 'Dewbauchee', class: 'Super', tags: 'armored' },
  itali: { brand: 'Grotti', class: 'Super' },
  pariah: { brand: 'Ocelot', class: 'Sports' },
};

function makePlaceholder(text, { width = 320, height = 180, fontSize = 22, bg = '#0f172a', fg = '#e2e8f0' } = {}) {
  const safeText = String(text || '').trim() || 'Auto';
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="12" fill="${bg}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${fg}" font-family="'Inter', 'Segoe UI', Arial, sans-serif" font-size="${fontSize}" font-weight="700">${safeText}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function brandLogoPlaceholder(brand) {
  return makePlaceholder(brand || 'Merk', { width: 180, height: 100, fontSize: 20, bg: '#111827', fg: '#f59e0b' });
}

function carImagePlaceholder(model) {
  return makePlaceholder(model || 'Auto', { width: 360, height: 200, fontSize: 20, bg: '#0b132b', fg: '#e5e7eb' });
}

function titleCase(text = '') {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

const carTableBody = document.querySelector('#car-table tbody');
const garageFilter = document.getElementById('garage-filter');
const searchFilter = document.getElementById('search-filter');
const carForm = document.getElementById('car-form');
const carSubmitBtn = document.getElementById('car-submit');
const cancelEditBtn = document.getElementById('cancel-edit');
const wishlistForm = document.getElementById('wishlist-form');
const wishlistList = document.getElementById('wishlist');
const garageMapSelect = document.getElementById('garage-map');
const floorMapSelect = document.getElementById('floor-map');
const grid = document.getElementById('garage-grid');
const garageOptions = document.getElementById('garage-options');
const modelSelect = document.getElementById('model-select');
const wishlistModelSelect = document.getElementById('wishlist-model-select');
const modelOptions = document.getElementById('model-options');
const autofillPreview = document.getElementById('autofill-preview');
const wishlistPreview = document.getElementById('wishlist-preview');

const exportBtn = document.getElementById('export-json');
const importFile = document.getElementById('import-file');
const resetBtn = document.getElementById('reset-data');

const modelCache = new Map();
let lookupTimer = null;
let state = normalizeState(loadState());
let editingCarId = null;

if (!state.cars.length && !state.wishlist.length) {
  state = normalizeState(buildSampleData());
  saveState();
}

renderAll();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { cars: [], wishlist: [], garages: [] };
  try {
    return JSON.parse(saved);
  } catch (err) {
    console.warn('Kon opgeslagen data niet lezen, start opnieuw.', err);
    return { cars: [], wishlist: [], garages: [] };
  }
}

function normalizeState(value) {
  const base = { cars: [], wishlist: [], garages: [] };
  const normalizedCars = Array.isArray(value?.cars)
    ? value.cars.map((car) => applyPlaceholders({
        ...car,
        floor: Number(car.floor) || 1,
        slot: car.slot ? Number(car.slot) : null,
      }))
    : [];
  const normalizedWishlist = Array.isArray(value?.wishlist) ? value.wishlist.map((item) => ({ ...item })) : [];
  return {
    ...base,
    ...(value || {}),
    cars: normalizedCars,
    wishlist: normalizedWishlist,
    garages: Array.isArray(value?.garages)
      ? value.garages
      : Array.from(new Set((value?.cars || []).map((c) => c.garage))),
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyPlaceholders(entry) {
  return {
    ...entry,
    logo: entry.logo || brandLogoPlaceholder(entry.brand),
    image: entry.image || carImagePlaceholder(entry.model),
  };
}

function renderAll() {
  renderCarFilters();
  renderFormSuggestions();
  renderCarTable();
  renderWishlist();
  renderMapSelectors();
  renderGarageGrid();
}

function getAllGarages() {
  return Array.from(new Set([...(state.garages || []), ...state.cars.map((c) => c.garage)])).filter(Boolean).sort();
}

function renderFormSuggestions() {
  const garages = getAllGarages();
  garageOptions.innerHTML = garages.map((g) => `<option value="${g}"></option>`).join('');

  renderModelSelects();
}

function renderModelSelects() {
  const models = Array.from(
    new Set([
      ...state.cars.map((c) => c.model),
      ...state.wishlist.map((c) => c.model),
      ...Array.from(modelCache.values())
        .filter((m) => m?.model)
        .map((m) => m.model),
    ])
  )
    .filter(Boolean)
    .sort();

  const options = models.map((m) => `<option value="${m}"></option>`);
  modelOptions.innerHTML = options.join('');

  renderAutofillPreview();
  renderWishlistPreview();
}

function renderCarFilters() {
  const garages = getAllGarages();
  garageFilter.innerHTML = '<option value="">Alle garages</option>' + garages.map((g) => `<option value="${g}">${g}</option>`).join('');
}

function renderCarTable() {
  const term = searchFilter.value.toLowerCase();
  const garage = garageFilter.value;

  const rows = state.cars
    .filter((c) => !garage || c.garage === garage)
    .filter((c) => {
      if (!term) return true;
      const text = `${c.brand || ''} ${c.model || ''} ${c.tags || ''} ${c.notes || ''}`.toLowerCase();
      return text.includes(term);
    })
    .sort((a, b) => a.garage.localeCompare(b.garage) || a.floor - b.floor || (a.slot || 0) - (b.slot || 0))
    .map(
      (car) => `<tr data-id="${car.id}">
        <td>${car.garage}</td>
        <td>${car.floor}</td>
        <td>${car.slot || '-'}</td>
        <td>${car.brand || ''}</td>
        <td>${car.model || ''}</td>
        <td>${car.class || ''}</td>
        <td>${car.tags || ''}</td>
        <td>${car.logo ? `<img class="logo-thumb" src="${car.logo}" alt="${car.brand || 'Merk'} logo" />` : ''}</td>
        <td>${car.image ? `<img class="car-thumb" src="${car.image}" alt="${car.model || 'Auto'}" />` : ''}</td>
        <td class="row-actions">
          <button type="button" class="ghost edit-car">Bewerk</button>
          <button type="button" class="ghost danger delete-car">Verwijder</button>
        </td>
      </tr>`
    )
    .join('');

  carTableBody.innerHTML = rows || "<tr><td colspan=\"10\">Nog geen auto's</td></tr>";
}

function renderWishlist() {
  wishlistList.innerHTML = state.wishlist
    .map(
      (item, idx) => `<li data-idx="${idx}">
        <div class="wishlist-row">
          <div>
            <h3>${item.brand ? `${item.brand} ` : ''}${item.model}</h3>
            <p>${item.class || ''}</p>
            ${item.notes ? `<p>${item.notes}</p>` : ''}
          </div>
          <button type="button" class="ghost danger delete-wish">Verwijder</button>
        </div>
      </li>`
    )
    .join('');
}

function renderMapSelectors() {
  const garages = getAllGarages();
  garageMapSelect.innerHTML = garages.map((g) => `<option value="${g}">${g}</option>`).join('');

  if (garages.length && !garages.includes(garageMapSelect.value)) {
    garageMapSelect.value = garages[0];
  }

  const selectedGarage = garageMapSelect.value || garages[0];
  if (selectedGarage) {
    const floors = Array.from(new Set(state.cars.filter((c) => c.garage === selectedGarage).map((c) => c.floor))).sort((a, b) => a - b);
    floorMapSelect.innerHTML = floors.map((f) => `<option value="${f}">${f}</option>`).join('');
  } else {
    floorMapSelect.innerHTML = '';
  }
}

function renderGarageGrid() {
  const garage = garageMapSelect.value;
  const floor = Number(floorMapSelect.value);
  grid.innerHTML = '';

  if (!garage || Number.isNaN(floor)) {
    grid.innerHTML = "<p>Voeg eerst auto's toe om een plattegrond te tonen.</p>";
    return;
  }

  const garageCars = state.cars.filter((c) => c.garage === garage);
  const cars = garageCars.filter((c) => c.garage === garage && Number(c.floor) === floor);
  const template = document.getElementById('slot-template');

  for (let i = 1; i <= DEFAULT_SLOTS; i += 1) {
    const slotCar = cars.find((c) => Number(c.slot) === i);
    const node = template.content.cloneNode(true);
    node.querySelector('.slot-number').textContent = `Plek ${i}`;

    const select = node.querySelector('.slot-select');
    select.dataset.slot = i;
    select.innerHTML = `<option value="">-- koppel auto --</option>` +
      garageCars
        .map((c) => `<option value="${c.id}" ${slotCar && c.id === slotCar.id ? 'selected' : ''}>${c.brand || ''} ${c.model || ''} (${c.floor || 1})</option>`)
        .join('');

    const body = node.querySelector('.slot-body');
    if (slotCar) {
      body.classList.remove('empty');
      body.innerHTML = `
        <strong>${slotCar.brand || ''} ${slotCar.model || ''}</strong>
        <span>${slotCar.class || ''}</span>
        ${slotCar.image ? `<img src="${slotCar.image}" alt="${slotCar.model || 'Auto'}" />` : ''}
        <div class="tags">${(slotCar.tags || '').split(',').filter(Boolean).map((t) => `<span class="badge">${t.trim()}</span>`).join('')}</div>
      `;
    }

    grid.appendChild(node);
  }
}

function getCachedModel(model) {
  if (!model) return null;
  return modelCache.get(model.trim().toLowerCase()) || null;
}

function renderPreview(container, entry, modelValue) {
  if (!container) return;
  if (!modelValue) {
    container.innerHTML = '<p class="muted">Typ een model; merk, type en afbeeldingen worden automatisch opgehaald via GTABase.</p>';
    return;
  }

  if (!entry) {
    container.innerHTML = '<p class="muted">Opzoeken...</p>';
    return;
  }

  if (entry.status === 'loading') {
    container.innerHTML = '<p class="muted">Opzoeken bij GTABase...</p>';
    return;
  }

  if (entry.status === 'error') {
    container.innerHTML = `<p class="muted">Kon geen GTABase-resultaat vinden: ${entry.error || 'onbekende fout'}. Je kunt toch opslaan; placeholders worden gebruikt.</p>`;
    return;
  }

  const badges = (entry.tags || '')
    .split(',')
    .filter(Boolean)
    .map((tag) => `<span class="badge">${tag.trim()}</span>`) || [];

  const logo = entry.logo ? `<img class="logo-thumb" src="${entry.logo}" alt="${entry.brand} logo" />` : '';
  const image = entry.image ? `<img class="car-thumb" src="${entry.image}" alt="${entry.model}" />` : '';
  const source = entry.sourceUrl ? `<a class="muted" href="${entry.sourceUrl}" target="_blank" rel="noreferrer">Bron: GTABase</a>` : '';

  container.innerHTML = `
    <div class="preview-header">
      <div>
        <strong>${entry.brand || ''} ${entry.model || modelValue}</strong>
        <span class="muted">${entry.class || ''}</span>
      </div>
      <div class="preview-media">${logo}${image}</div>
    </div>
    <div class="tags">${badges.join('')}</div>
    ${source}
  `;
}

function renderAutofillPreview() {
  const value = carForm.elements.model.value;
  const entry = getCachedModel(value);
  renderPreview(autofillPreview, entry, value);
}

function renderWishlistPreview() {
  const value = wishlistForm.elements.model.value;
  const entry = getCachedModel(value);
  renderPreview(wishlistPreview, entry, value);
}

async function handleCarSubmit(event) {
  event.preventDefault();
  const formData = new FormData(carForm);
  const entry = Object.fromEntries(formData.entries());

  const lookup = await ensureModelInfo(entry.model);

  const car = applyPlaceholders({
    ...entry,
    ...lookup,
    id: editingCarId || crypto.randomUUID(),
    floor: Number(entry.floor),
    slot: entry.slot ? Number(entry.slot) : null,
    brand: lookup?.brand || entry.brand || '',
    class: lookup?.class || entry.class || '',
    tags: lookup?.tags || entry.tags || '',
  });

  if (editingCarId) {
    state.cars = state.cars.map((c) => (c.id === editingCarId ? { ...car } : c));
  } else {
    state.cars.push(car);
  }

  if (car.garage && !state.garages.includes(car.garage)) {
    state.garages.push(car.garage);
  }
  saveState();
  cancelEdit();
  renderAll();
}

async function handleWishlistSubmit(event) {
  event.preventDefault();
  const formData = new FormData(wishlistForm);
  const entry = Object.fromEntries(formData.entries());

  const lookup = await ensureModelInfo(entry.model);

  const wishlistItem = {
    ...entry,
    ...lookup,
    brand: lookup?.brand || entry.brand || '',
    class: lookup?.class || entry.class || '',
  };

  state.wishlist.push(wishlistItem);
  saveState();
  wishlistForm.reset();
  renderAll();
}

async function ensureModelInfo(model) {
  if (!model) return null;
  const normalized = model.trim().toLowerCase();
  const cached = modelCache.get(normalized);
  if (cached?.status === 'success') return cached;
  if (cached?.status === 'loading') {
    return new Promise((resolve) => {
      const watcher = setInterval(() => {
        const current = modelCache.get(normalized);
        if (current && current.status !== 'loading') {
          clearInterval(watcher);
          resolve(current.status === 'success' ? current : null);
        }
      }, 200);
    });
  }
  const result = await fetchAndCacheModel(model);
  return result?.status === 'success' ? result : null;
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gtacars.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    if (file.name.endsWith('.json')) {
      state = normalizeState(JSON.parse(text));
    } else {
      state = normalizeState(parseCsv(text));
    }
    saveState();
    renderAll();
  };
  reader.readAsText(file);
}

function parseCsv(text) {
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const columns = header.split(',');
  const cars = lines.map((line) => {
    const values = line.split(',');
    const row = Object.fromEntries(columns.map((col, idx) => [col.trim(), values[idx] ? values[idx].trim() : '']));
    return applyPlaceholders({
      id: crypto.randomUUID(),
      garage: row.garage,
      floor: Number(row.floor) || 1,
      slot: row.slot ? Number(row.slot) : null,
      brand: row.brand,
      model: row.model,
      class: row.class,
      tags: row.tags,
      logo: row.logo,
      image: row.image,
      notes: row.notes,
    });
  });
  const garages = Array.from(new Set(cars.map((c) => c.garage))).filter(Boolean);
  return { cars, wishlist: [], garages };
}

function buildSampleData() {
  return {
    garages: ['Eclipse Towers', 'Agency'],
    cars: [
      {
        id: crypto.randomUUID(),
        garage: 'Eclipse Towers',
        floor: 1,
        slot: 1,
        brand: 'Annis',
        model: 'Elegy Retro Custom',
        class: 'Sports',
        tags: 'tuner, awd',
        logo: brandLogoPlaceholder('Annis'),
        image: carImagePlaceholder('Elegy Retro Custom'),
        notes: 'Metallic black / lime pearl',
      },
      {
        id: crypto.randomUUID(),
        garage: 'Eclipse Towers',
        floor: 1,
        slot: 2,
        brand: 'Pegassi',
        model: 'Ignus',
        class: 'Super',
        tags: 'electric, hsw',
        logo: brandLogoPlaceholder('Pegassi'),
        image: carImagePlaceholder('Ignus'),
        notes: 'HSW upgrade',
      },
      {
        id: crypto.randomUUID(),
        garage: 'Agency',
        floor: 2,
        slot: 1,
        brand: 'Enus',
        model: 'Deity',
        class: 'Sedan',
        tags: 'armored, missile-lock-on',
        logo: brandLogoPlaceholder('Enus'),
        image: carImagePlaceholder('Deity'),
        notes: 'Armor plating',
      },
    ],
    wishlist: [
      { brand: 'Bravado', model: 'Buffalo STX', class: 'Muscle', notes: 'Kogelvrij glas, Agency trade price' },
      { brand: 'Dinka', model: 'Jester RR', class: 'Sports', notes: 'Tuner build' },
    ],
  };
}

function resetData() {
  state = normalizeState(buildSampleData());
  saveState();
  renderAll();
}

function startEditCar(carId) {
  const car = state.cars.find((c) => c.id === carId);
  if (!car) return;
  editingCarId = carId;
  carForm.elements.garage.value = car.garage || '';
  carForm.elements.floor.value = car.floor || '';
  carForm.elements.slot.value = car.slot || '';
  carForm.elements.model.value = car.model || '';
  carForm.elements.notes.value = car.notes || '';
  carSubmitBtn.textContent = 'Auto bijwerken';
  cancelEditBtn.style.display = 'inline-flex';
  queueLookup(car.model);
  renderAutofillPreview();
}

function cancelEdit() {
  editingCarId = null;
  carForm.reset();
  carSubmitBtn.textContent = 'Auto opslaan';
  cancelEditBtn.style.display = 'none';
  renderAutofillPreview();
}

function handleSlotChange(event) {
  const select = event.target.closest('.slot-select');
  if (!select) return;
  const carId = select.value;
  const slot = Number(select.dataset.slot);
  const garage = garageMapSelect.value;
  const floor = Number(floorMapSelect.value);

  state.cars = state.cars.map((car) => {
    if (car.garage === garage && Number(car.floor) === floor && Number(car.slot) === slot && !carId) {
      return { ...car, slot: null };
    }
    if (car.garage === garage && Number(car.floor) === floor && Number(car.slot) === slot && car.id !== carId) {
      return { ...car, slot: null };
    }
    if (car.id === carId) {
      return { ...car, slot, garage, floor };
    }
    return car;
  });

  saveState();
  renderGarageGrid();
  renderCarTable();
}

function deleteCar(carId) {
  const car = state.cars.find((c) => c.id === carId);
  if (!car) return;
  state.cars = state.cars.filter((c) => c.id !== carId);
  saveState();
  if (editingCarId === carId) {
    cancelEdit();
  }
  renderAll();
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

async function fetchAndCacheModel(model) {
  if (!model) return null;
  const key = model.trim().toLowerCase();
  if (modelCache.get(key)?.status === 'loading') return modelCache.get(key);
  modelCache.set(key, { status: 'loading', model: model.trim() });
  renderAutofillPreview();
  renderWishlistPreview();

  try {
    const url = await resolveGtabaseUrl(model);
    const html = await fetchVehicleContent(url);
    const parsed = parseVehiclePage(html, url, model);
    const result = {
      status: 'success',
      ...parsed,
      model: parsed.model || titleCase(model),
      logo: parsed.logo || brandLogoPlaceholder(parsed.brand),
      image: parsed.image || carImagePlaceholder(parsed.model || model),
    };
    modelCache.set(key, result);
    renderModelSelects();
    return result;
  } catch (err) {
    console.error('GTABase lookup mislukt', err);
    const fallback = buildOfflineModel(model);
    if (fallback) {
      modelCache.set(key, fallback);
      renderAutofillPreview();
      renderWishlistPreview();
      renderModelSelects();
      return fallback;
    }
    modelCache.set(key, { status: 'error', model, error: err.message || 'Geen resultaat' });
    renderAutofillPreview();
    renderWishlistPreview();
    return null;
  }
}

async function resolveGtabaseUrl(model) {
  const searchQuery = `${GTABASE_SEARCH_URL}${encodeURIComponent(model)}&searchphrase=all`;
  const searchResults = await fetchTextWithFallback([
    `https://r.jina.ai/${searchQuery}`,
    `https://r.jina.ai/https://www.gtabase.com/search?searchword=${encodeURIComponent(model)}&searchphrase=all`,
    `https://r.jina.ai/http://www.gtabase.com/search?searchword=${encodeURIComponent(model)}&searchphrase=all`,
  ]).catch(() => null);

  if (searchResults) {
    const match = searchResults.match(/https?:\/\/www\.gtabase\.com\/grand-theft-auto-v\/vehicles\/[a-z0-9-]+/i);
    if (match) return match[0].replace('http://', 'https://');
  }

  const slug = slugify(model);
  return `${GTABASE_VEHICLE_BASE}${slug}`;
}

async function fetchVehicleContent(url) {
  const urls = [
    `https://r.jina.ai/${url}`,
    `https://r.jina.ai/https://${url.replace(/^https?:\/\//, '')}`,
    `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`,
    url,
  ];
  return fetchTextWithFallback(urls);
}

async function fetchTextWithFallback(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) continue;
      const text = await res.text();
      if (text) return text;
    } catch (err) {
      // try next
    }
  }
  throw new Error('Geen bruikbare GTABase-respons');
}

function buildOfflineModel(model) {
  const key = model.trim().toLowerCase();
  const fallback = OFFLINE_VEHICLE_FALLBACKS[key];
  const brand = fallback?.brand || (key.includes(' ') ? titleCase(key.split(' ')[0]) : 'Onbekend');
  const modelName = fallback?.model || titleCase(model);

  return {
    status: 'success',
    brand,
    model: modelName,
    class: fallback?.class || '',
    tags: fallback?.tags || '',
    logo: brandLogoPlaceholder(brand),
    image: carImagePlaceholder(modelName),
    sourceUrl: '',
  };
}

function parseVehiclePage(text, url, modelInput) {
  const parser = new DOMParser();
  let doc = null;
  try {
    doc = parser.parseFromString(text, 'text/html');
  } catch (err) {
    doc = null;
  }

  const slug = (url || '').split('/').pop() || '';
  const slugParts = slug.split('-').filter(Boolean);
  const slugBrand = slugParts.length > 1 ? titleCase(slugParts[0]) : '';
  const slugModel = slugParts.length > 1 ? titleCase(slugParts.slice(1).join(' ')) : titleCase(modelInput);

  let ogTitle = '';
  let ogImage = '';
  if (doc) {
    ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  }

  let brand = '';
  let vehicleClass = '';

  if (ogTitle) {
    const parts = ogTitle.split('|')[0].trim().split(' ');
    if (parts.length > 1) {
      brand = parts[0];
    }
  }

  if (doc) {
    const brandNode = doc.querySelector('[itemprop="brand"], .product-manufacturer, .vehicle-manufacturer');
    if (brandNode) brand = brandNode.textContent.trim();

    const classLabel = Array.from(doc.querySelectorAll('td, th, span, li')).find((node) =>
      /class|vehicle class/i.test(node.textContent)
    );
    if (classLabel && classLabel.nextElementSibling) {
      vehicleClass = classLabel.nextElementSibling.textContent.trim();
    }
  }

  const textMatchClass = text.match(/Vehicle Class[^:]*:\s*([A-Za-z ]+)/i);
  if (!vehicleClass && textMatchClass) {
    vehicleClass = textMatchClass[1].trim();
  }

  const imgMatch = text.match(/og:image" content="([^"]+)"/i) || text.match(/src="(https?:[^"']+\/vehicles[^"']+)"/i);
  const image = ogImage || (imgMatch ? imgMatch[1] : '') || '';

  return {
    brand: brand || slugBrand,
    model: slugModel || modelInput,
    class: vehicleClass || '',
    tags: '',
    image,
    logo: brandLogoPlaceholder(brand || slugBrand),
    sourceUrl: url,
  };
}

function queueLookup(model) {
  clearTimeout(lookupTimer);
  if (!model) {
    renderAutofillPreview();
    renderWishlistPreview();
    return;
  }
  lookupTimer = setTimeout(() => {
    fetchAndCacheModel(model);
  }, 500);
}

carForm.addEventListener('submit', (event) => {
  event.preventDefault();
  handleCarSubmit(event);
});
modelSelect.addEventListener('input', () => {
  queueLookup(modelSelect.value);
  renderAutofillPreview();
});
modelSelect.addEventListener('blur', () => queueLookup(modelSelect.value));
wishlistForm.addEventListener('submit', (event) => {
  event.preventDefault();
  handleWishlistSubmit(event);
});
wishlistModelSelect.addEventListener('input', () => {
  queueLookup(wishlistModelSelect.value);
  renderWishlistPreview();
});
wishlistModelSelect.addEventListener('blur', () => queueLookup(wishlistModelSelect.value));

cancelEditBtn.addEventListener('click', cancelEdit);

carTableBody.addEventListener('click', (event) => {
  const row = event.target.closest('tr');
  const carId = row?.dataset?.id;
  if (!carId) return;
  if (event.target.classList.contains('edit-car')) {
    startEditCar(carId);
  }
  if (event.target.classList.contains('delete-car')) {
    deleteCar(carId);
  }
});

garageFilter.addEventListener('change', renderCarTable);
searchFilter.addEventListener('input', renderCarTable);

garageMapSelect.addEventListener('change', () => {
  renderMapSelectors();
  renderGarageGrid();
});

floorMapSelect.addEventListener('change', renderGarageGrid);
grid.addEventListener('change', handleSlotChange);
wishlistList.addEventListener('click', (event) => {
  const item = event.target.closest('li');
  if (!item) return;
  if (event.target.classList.contains('delete-wish')) {
    const idx = Number(item.dataset.idx);
    state.wishlist.splice(idx, 1);
    saveState();
    renderWishlist();
  }
});

exportBtn.addEventListener('click', exportJson);
resetBtn.addEventListener('click', resetData);
importFile.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) {
    importData(file);
  }
});
