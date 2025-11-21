const STORAGE_KEY = 'gtacars-tracker-v1';
const DEFAULT_SLOTS = 10;

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

const CAR_CATALOG = [
  {
    brand: 'Annis',
    model: 'Elegy Retro Custom',
    class: 'Sports',
    tags: 'tuner, awd',
    logo: brandLogoPlaceholder('Annis'),
    image: carImagePlaceholder('Elegy Retro Custom'),
  },
  {
    brand: 'Pegassi',
    model: 'Ignus',
    class: 'Super',
    tags: 'electric, hsw',
    logo: brandLogoPlaceholder('Pegassi'),
    image: carImagePlaceholder('Ignus'),
  },
  {
    brand: 'Enus',
    model: 'Deity',
    class: 'Sedan',
    tags: 'armored, missile-lock-on',
    logo: brandLogoPlaceholder('Enus'),
    image: carImagePlaceholder('Deity'),
  },
  {
    brand: 'Bravado',
    model: 'Buffalo STX',
    class: 'Muscle',
    tags: 'armored, missile-lock-on',
    logo: brandLogoPlaceholder('Bravado'),
    image: carImagePlaceholder('Buffalo STX'),
  },
  {
    brand: 'Dinka',
    model: 'Jester RR',
    class: 'Sports',
    tags: 'tuner',
    logo: brandLogoPlaceholder('Dinka'),
    image: carImagePlaceholder('Jester RR'),
  },
  {
    brand: 'Overflod',
    model: 'Entity MT',
    class: 'Super',
    tags: 'hsw',
    logo: brandLogoPlaceholder('Overflod'),
    image: carImagePlaceholder('Entity MT'),
  },
  {
    brand: 'Grotti',
    model: 'Itali GTO',
    class: 'Sports',
    tags: 'hsw',
    logo: brandLogoPlaceholder('Grotti'),
    image: carImagePlaceholder('Itali GTO'),
  },
  {
    brand: 'Pfister',
    model: 'Comet S2',
    class: 'Sports',
    tags: 'tuner',
    logo: brandLogoPlaceholder('Pfister'),
    image: carImagePlaceholder('Comet S2'),
  },
  {
    brand: 'Annis',
    model: 'ZR350',
    class: 'Sports Classic',
    tags: 'tuner',
    logo: brandLogoPlaceholder('Annis'),
    image: carImagePlaceholder('ZR350'),
  },
  {
    brand: 'Lampadati',
    model: 'Cinquemila',
    class: 'Sedan',
    tags: 'luxury',
    logo: brandLogoPlaceholder('Lampadati'),
    image: carImagePlaceholder('Cinquemila'),
  },
];

const carTableBody = document.querySelector('#car-table tbody');
const garageFilter = document.getElementById('garage-filter');
const searchFilter = document.getElementById('search-filter');
const carForm = document.getElementById('car-form');
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

const catalogIndex = buildCatalogIndex();
let state = normalizeState(loadState());

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
  const normalizedCars = Array.isArray(value?.cars) ? value.cars.map(enrichCarWithCatalog) : [];
  const normalizedWishlist = Array.isArray(value?.wishlist) ? value.wishlist.map(enrichWishlistItem) : [];
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
      ...CAR_CATALOG.map((c) => c.model),
      ...state.cars.map((c) => c.model),
      ...state.wishlist.map((c) => c.model),
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
      const text = `${c.brand} ${c.model} ${c.tags || ''} ${c.notes || ''}`.toLowerCase();
      return text.includes(term);
    })
    .sort((a, b) => a.garage.localeCompare(b.garage) || a.floor - b.floor || (a.slot || 0) - (b.slot || 0))
    .map(
      (car) => `<tr>
        <td>${car.garage}</td>
        <td>${car.floor}</td>
        <td>${car.slot || '-'}</td>
        <td>${car.brand}</td>
        <td>${car.model}</td>
        <td>${car.class || ''}</td>
        <td>${car.tags || ''}</td>
        <td>${car.logo ? `<img class="logo-thumb" src="${car.logo}" alt="${car.brand} logo" />` : ''}</td>
        <td>${car.image ? `<img class="car-thumb" src="${car.image}" alt="${car.model}" />` : ''}</td>
      </tr>`
    )
    .join('');

  carTableBody.innerHTML = rows || "<tr><td colspan=\"9\">Nog geen auto's</td></tr>";
}

function renderWishlist() {
  wishlistList.innerHTML = state.wishlist
    .map(
      (item) => `<li>
        <h3>${item.brand} ${item.model}</h3>
        <p>${item.class || ''}</p>
        ${item.notes ? `<p>${item.notes}</p>` : ''}
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

  const cars = state.cars.filter((c) => c.garage === garage && Number(c.floor) === floor);
  const template = document.getElementById('slot-template');

  for (let i = 1; i <= DEFAULT_SLOTS; i += 1) {
    const slotCar = cars.find((c) => Number(c.slot) === i);
    const node = template.content.cloneNode(true);
    node.querySelector('.slot-number').textContent = `Plek ${i}`;

    const select = node.querySelector('.slot-select');
    select.dataset.slot = i;
    select.innerHTML = `<option value="">-- koppel auto --</option>` +
      cars
        .map((c) => `<option value="${c.id}" ${slotCar && c.id === slotCar.id ? 'selected' : ''}>${c.brand} ${c.model}</option>`)
        .join('');

    const body = node.querySelector('.slot-body');
    if (slotCar) {
      body.classList.remove('empty');
      body.innerHTML = `
        <strong>${slotCar.brand} ${slotCar.model}</strong>
        <span>${slotCar.class || ''}</span>
        ${slotCar.image ? `<img src="${slotCar.image}" alt="${slotCar.model}" />` : ''}
        <div class="tags">${(slotCar.tags || '').split(',').filter(Boolean).map((t) => `<span class="badge">${t.trim()}</span>`).join('')}</div>
      `;
    }

    grid.appendChild(node);
  }
}

function buildCatalogIndex() {
  return CAR_CATALOG.reduce((map, car) => {
    map.set(car.model.toLowerCase(), car);
    return map;
  }, new Map());
}

function getCatalogEntry(model) {
  if (!model) return null;
  return catalogIndex.get(model.trim().toLowerCase()) || null;
}

function enrichCarWithCatalog(car) {
  const catalogEntry = getCatalogEntry(car?.model);
  if (!catalogEntry) return car;
  return {
    ...catalogEntry,
    ...car,
    brand: car.brand || catalogEntry.brand,
    class: car.class || catalogEntry.class,
    tags: car.tags || catalogEntry.tags || '',
    logo: car.logo || catalogEntry.logo || brandLogoPlaceholder(car.brand || catalogEntry.brand),
    image: car.image || catalogEntry.image || carImagePlaceholder(car.model || catalogEntry.model),
  };
}

function enrichWishlistItem(item) {
  const catalogEntry = getCatalogEntry(item?.model);
  if (!catalogEntry) return item;
  return {
    ...catalogEntry,
    ...item,
    brand: item.brand || catalogEntry.brand,
    class: item.class || catalogEntry.class,
  };
}

function renderPreview(container, entry) {
  if (!container) return;
  if (!entry) {
    container.innerHTML = '<p class="muted">Kies een model uit de catalogus. Merk, type, tags, logo en afbeelding worden automatisch ingevuld.</p>';
    return;
  }

  const badges = (entry.tags || '')
    .split(',')
    .filter(Boolean)
    .map((tag) => `<span class="badge">${tag.trim()}</span>`) || [];

  const logo = entry.logo ? `<img class="logo-thumb" src="${entry.logo}" alt="${entry.brand} logo" />` : '';
  const image = entry.image ? `<img class="car-thumb" src="${entry.image}" alt="${entry.model}" />` : '';

  container.innerHTML = `
    <div class="preview-header">
      <div>
        <strong>${entry.brand} ${entry.model}</strong>
        <span class="muted">${entry.class || ''}</span>
      </div>
      <div class="preview-media">${logo}${image}</div>
    </div>
    <div class="tags">${badges.join('')}</div>
  `;
}

function renderAutofillPreview() {
  const entry = getCatalogEntry(carForm.elements.model.value);
  renderPreview(autofillPreview, entry);
}

function renderWishlistPreview() {
  const entry = getCatalogEntry(wishlistForm.elements.model.value);
  renderPreview(wishlistPreview, entry);
}

function handleCarSubmit(event) {
  event.preventDefault();
  const formData = new FormData(carForm);
  const entry = Object.fromEntries(formData.entries());

  const catalogEntry = getCatalogEntry(entry.model);
  if (!catalogEntry) {
    alert('Kies een model uit de catalogus zodat merk, type, tags, logo en afbeelding automatisch ingevuld worden.');
    return;
  }

  const car = {
    ...catalogEntry,
    ...entry,
    id: crypto.randomUUID(),
    floor: Number(entry.floor),
    slot: entry.slot ? Number(entry.slot) : null,
    brand: catalogEntry.brand,
    class: catalogEntry.class,
    tags: catalogEntry.tags || '',
    logo: catalogEntry.logo || '',
    image: catalogEntry.image || '',
  };

  state.cars.push(car);
  if (car.garage && !state.garages.includes(car.garage)) {
    state.garages.push(car.garage);
  }
  saveState();
  carForm.reset();
  renderAll();
}

function handleWishlistSubmit(event) {
  event.preventDefault();
  const formData = new FormData(wishlistForm);
  const entry = Object.fromEntries(formData.entries());

  const catalogEntry = getCatalogEntry(entry.model);
  if (!catalogEntry) {
    alert('Kies een model uit de catalogus zodat merk en type automatisch ingevuld worden.');
    return;
  }

  const wishlistItem = {
    ...catalogEntry,
    ...entry,
    brand: catalogEntry.brand,
    class: catalogEntry.class,
  };

  state.wishlist.push(wishlistItem);
  saveState();
  wishlistForm.reset();
  renderAll();
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
    return {
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
    };
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

function handleSlotChange(event) {
  const select = event.target.closest('.slot-select');
  if (!select) return;
  const carId = select.value;
  const slot = Number(select.dataset.slot);
  const garage = garageMapSelect.value;
  const floor = Number(floorMapSelect.value);

  state.cars = state.cars.map((car) => {
    if (car.garage === garage && Number(car.floor) === floor && Number(car.slot) === slot) {
      return { ...car, slot: null };
    }
    if (car.id === carId) {
      return { ...car, slot };
    }
    return car;
  });

  saveState();
  renderGarageGrid();
  renderCarTable();
}

carForm.addEventListener('submit', handleCarSubmit);
modelSelect.addEventListener('change', renderAutofillPreview);
modelSelect.addEventListener('input', renderAutofillPreview);
wishlistForm.addEventListener('submit', handleWishlistSubmit);
wishlistModelSelect.addEventListener('change', renderWishlistPreview);
wishlistModelSelect.addEventListener('input', renderWishlistPreview);

garageFilter.addEventListener('change', renderCarTable);
searchFilter.addEventListener('input', renderCarTable);

garageMapSelect.addEventListener('change', () => {
  renderMapSelectors();
  renderGarageGrid();
});

floorMapSelect.addEventListener('change', renderGarageGrid);
grid.addEventListener('change', handleSlotChange);

exportBtn.addEventListener('click', exportJson);
resetBtn.addEventListener('click', resetData);
importFile.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) {
    importData(file);
  }
});
