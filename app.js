const STORAGE_KEY = 'gtacars-tracker-v1';
const DEFAULT_SLOTS = 10;

const carTableBody = document.querySelector('#car-table tbody');
const garageFilter = document.getElementById('garage-filter');
const searchFilter = document.getElementById('search-filter');
const carForm = document.getElementById('car-form');
const wishlistForm = document.getElementById('wishlist-form');
const wishlistList = document.getElementById('wishlist');
const garageMapSelect = document.getElementById('garage-map');
const floorMapSelect = document.getElementById('floor-map');
const grid = document.getElementById('garage-grid');

const exportBtn = document.getElementById('export-json');
const importFile = document.getElementById('import-file');
const resetBtn = document.getElementById('reset-data');

let state = loadState();

if (!state.cars.length && !state.wishlist.length) {
  state = buildSampleData();
  saveState();
}

renderAll();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return { cars: [], wishlist: [] };
  try {
    return JSON.parse(saved);
  } catch (err) {
    console.warn('Kon opgeslagen data niet lezen, start opnieuw.', err);
    return { cars: [], wishlist: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  renderCarFilters();
  renderCarTable();
  renderWishlist();
  renderMapSelectors();
  renderGarageGrid();
}

function renderCarFilters() {
  const garages = Array.from(new Set(state.cars.map((c) => c.garage))).sort();
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

  carTableBody.innerHTML = rows || '<tr><td colspan="9">Nog geen auto's</td></tr>';
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
  const garages = Array.from(new Set(state.cars.map((c) => c.garage))).sort();
  garageMapSelect.innerHTML = garages.map((g) => `<option value="${g}">${g}</option>`).join('');

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
    grid.innerHTML = '<p>Voeg eerst auto's toe om een plattegrond te tonen.</p>';
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

function handleCarSubmit(event) {
  event.preventDefault();
  const formData = new FormData(carForm);
  const entry = Object.fromEntries(formData.entries());
  const car = {
    ...entry,
    id: crypto.randomUUID(),
    floor: Number(entry.floor),
    slot: entry.slot ? Number(entry.slot) : null,
  };

  state.cars.push(car);
  saveState();
  carForm.reset();
  renderAll();
}

function handleWishlistSubmit(event) {
  event.preventDefault();
  const formData = new FormData(wishlistForm);
  const entry = Object.fromEntries(formData.entries());
  state.wishlist.push(entry);
  saveState();
  wishlistForm.reset();
  renderWishlist();
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
      state = JSON.parse(text);
    } else {
      state = parseCsv(text);
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
  return { cars, wishlist: [] };
}

function buildSampleData() {
  return {
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
        logo: 'https://i.imgur.com/XX00xNi.png',
        image: 'https://i.imgur.com/EObwFiX.jpeg',
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
        logo: 'https://i.imgur.com/e4wJltR.png',
        image: 'https://i.imgur.com/lPbBUQo.jpeg',
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
        logo: 'https://i.imgur.com/IJFP9X4.png',
        image: 'https://i.imgur.com/iQUpSsR.jpeg',
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
  state = buildSampleData();
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
wishlistForm.addEventListener('submit', handleWishlistSubmit);

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
