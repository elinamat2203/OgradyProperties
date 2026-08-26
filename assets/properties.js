/* Shared logic for fetching + rendering property listings from the Google Sheet */

const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#4C1683"/>
  <g stroke="#d9aa3b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <polyline points="120,210 120,140 200,90 280,140 280,210"/>
    <rect x="150" y="160" width="30" height="50"/>
    <rect x="210" y="150" width="20" height="20"/>
    <rect x="240" y="150" width="20" height="20"/>
    <line x1="120" y1="210" x2="280" y2="210"/>
  </g>
</svg>`);

function euro(value){
  if(!value) return '';
  const s = String(value).trim();
  if(s.startsWith('€') || s.startsWith('$') || s.startsWith('£')) return s;
  const n = Number(s.replace(/[^0-9.]/g,''));
  if(isNaN(n)) return s;
  return '€' + n.toLocaleString('en-IE');
}

function floorArea(value){
  if(!value) return '';
  const area = String(value).trim();
  return /(sq\.?\s*m|m²|m2)/i.test(area) ? area : area + ' sq.m';
}

function slugify(str){
  return String(str||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

function statusClass(status){
  const s = (status||'').toLowerCase();
  if(s.includes('let') && !s.includes('to let')) return 'let';
  if(s.includes('agreed')) return 'sale-agreed';
  return '';
}

function isSaleAgreed(status){
  return String(status || '').trim().toLowerCase() === 'sale agreed';
}

function saleAgreedRibbon(status){
  return isSaleAgreed(status) ? '<span class="sale-agreed-ribbon">SALE AGREED</span>' : '';
}

function splitList(val){
  if(!val) return [];
  return String(val).split(/[;|]/).map(s => s.trim()).filter(Boolean);
}

function getImages(row){
  const imgs = Array.from({length:10}, (_, index) => row[`image${index + 1}`])
    .map(resolveImagePath)
    .filter(Boolean);
  return imgs.length ? imgs : [PLACEHOLDER_IMG];
}

function resolveImagePath(value){
  const path = String(value || '').trim();
  if(!path) return '';
  if(/^(data:|https?:|\/)/i.test(path)) return path;
  if(path.startsWith('assets/')) return path;
  if(path.startsWith('properties/')) return 'assets/' + path;
  return 'assets/properties/' + path;
}

function imageFallback(image){
  const source = image.getAttribute('src') || '';
  if(!image.dataset.extensionFallback && /^assets\/.*\.(jpg|jpeg)$/i.test(source)){
    image.dataset.extensionFallback = 'true';
    image.src = source + '.jpg';
    return;
  }
  image.onerror = null;
  image.src = PLACEHOLDER_IMG;
}

// Fetches and parses the published Google Sheet CSV into an array of row objects.
async function fetchProperties(){
  if(!PROPERTIES_SHEET_CSV_URL || PROPERTIES_SHEET_CSV_URL.includes('PASTE_YOUR')){
    return { error: 'not-configured', rows: [] };
  }
  try{
    const res = await fetch(PROPERTIES_SHEET_CSV_URL + (PROPERTIES_SHEET_CSV_URL.includes('?') ? '&' : '?') + 'cachebust=' + Date.now());
    if(!res.ok) throw new Error('Fetch failed: ' + res.status);
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { header:true, skipEmptyLines:true });
    const rows = parsed.data
      .map(r => {
        const clean = {};
        Object.keys(r).forEach(k => clean[k.trim().toLowerCase()] = (r[k]||'').trim());
        return clean;
      })
      .filter(r => r.title || r.address);
    return { error:null, rows };
  }catch(err){
    console.error(err);
    return { error:'fetch-failed', rows: [] };
  }
}

function propertyIdFor(row, index){
  return row.id ? slugify(row.id) : slugify(row.title + '-' + row.address) || String(index);
}

/* ---------------- Listing grid (properties.html) ---------------- */
async function renderListingGrid(){
  const grid = document.getElementById('listingGrid');
  const countEl = document.getElementById('filterCount');
  const categoryFilters = document.querySelectorAll('.category-filter');
  const typeFilters = document.querySelectorAll('.type-filter');
  let activeCategory = 'sale';
  let activeType = 'all';
  let rows = [];

  categoryFilters.forEach(button => button.addEventListener('click', () => {
    activeCategory = button.dataset.category;
    categoryFilters.forEach(item => {
      const isActive = item === button;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
    });
    draw();
  }));

  typeFilters.forEach(button => button.addEventListener('click', () => {
    activeType = button.dataset.type;
    typeFilters.forEach(item => {
      const isActive = item === button;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
    });
    draw();
  }));

  const result = await fetchProperties();
  const error = result.error;
  rows = result.rows;

  if(error === 'not-configured'){
    grid.innerHTML = `<div class="empty-state">
      <p><strong>No property feed connected yet.</strong></p>
      <p>Publish your Google Sheet as CSV and paste the link into <code>assets/properties-config.js</code> — see PROPERTIES-SETUP.md for step-by-step instructions.</p>
    </div>`;
    return;
  }
  if(error){
    grid.innerHTML = `<div class="empty-state"><p>We couldn't load properties right now. Please try again shortly.</p></div>`;
    return;
  }
  if(!rows.length){
    grid.innerHTML = `<div class="empty-state"><p>No properties listed at the moment — check back soon.</p></div>`;
    return;
  }

  function propertyCategory(row){
    const status = String(row.status || '').toLowerCase();
    if(status.includes('let') || status.includes('rent')) return 'rent';
    if(status.includes('sale')) return 'sale';
    return '';
  }

  function propertyType(row){
    const type = String(row.type || '').toLowerCase();
    if(String(row.id || '').trim() === '4' || type.includes('commercial')) return ['commercial'];
    if(type.includes('land')) return ['land'];
    if(type) return ['residential'];
    return [];
  }

  function draw(){
    const filtered = rows.filter(r =>
      propertyCategory(r) === activeCategory &&
      (activeType === 'all' || propertyType(r).includes(activeType))
    );
    const availableCount = filtered.filter(r => !isSaleAgreed(r.status)).length;
    countEl.textContent = availableCount + (availableCount === 1 ? ' property' : ' properties');

    if(!filtered.length){
      grid.innerHTML = `<div class="empty-state"><p>No properties match those filters.</p></div>`;
      return;
    }

    grid.innerHTML = filtered.map((r, i) => {
      const id = propertyIdFor(r, rows.indexOf(r));
      const img = getImages(r)[0];
      return `
      <a class="listing-card reveal is-visible" href="property.html?id=${encodeURIComponent(id)}">
        <div class="listing-photo">
          <img src="${img}" alt="${r.title||r.address}" loading="lazy" onerror="imageFallback(this)">
          ${saleAgreedRibbon(r.status)}
          ${r.status && !isSaleAgreed(r.status) ? `<span class="listing-status ${statusClass(r.status)}">${r.status}</span>` : ''}
        </div>
        <div class="listing-body">
          ${r.price && !isSaleAgreed(r.status) ? `<div class="listing-price">${euro(r.price)}</div>` : ''}
          <div class="listing-title">${r.title || r.address}</div>
          <div class="listing-address">${r.address||''}</div>
          <div class="listing-meta">
            ${r.beds ? `<span>${r.beds} bed</span>` : ''}
            ${r.baths ? `<span>${r.baths} bath</span>` : ''}
            ${r.type ? `<span>${r.type}</span>` : ''}
          </div>
        </div>
      </a>`;
    }).join('');
  }

  draw();
}

/* ---------------- Featured grid (index.html) ---------------- */
async function renderFeaturedGrid(){
  const grid = document.getElementById('featuredGrid');
  if(!grid) return;
  const { error, rows } = await fetchProperties();

  if(error === 'not-configured'){
    grid.parentElement.parentElement.style.display = 'none'; // hide whole section until connected
    return;
  }
  if(error || !rows.length){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p>No properties listed at the moment — check back soon.</p></div>`;
    return;
  }

  let featured = rows.filter(r => (r.featured||'').toLowerCase() === 'yes');
  if(!featured.length) featured = rows.slice(0, 3);
  featured = featured.slice(0, 3);

  grid.innerHTML = featured.map((r) => {
    const id = propertyIdFor(r, rows.indexOf(r));
    const img = getImages(r)[0];
    return `
    <a class="listing-card reveal is-visible" href="property.html?id=${encodeURIComponent(id)}">
      <div class="listing-photo">
        <img src="${img}" alt="${r.title||r.address}" loading="lazy" onerror="imageFallback(this)">
        ${saleAgreedRibbon(r.status)}
        ${r.status && !isSaleAgreed(r.status) ? `<span class="listing-status ${statusClass(r.status)}">${r.status}</span>` : ''}
      </div>
      <div class="listing-body">
        ${r.price && !isSaleAgreed(r.status) ? `<div class="listing-price">${euro(r.price)}</div>` : ''}
        <div class="listing-title">${r.title || r.address}</div>
        <div class="listing-address">${r.address||''}</div>
        <div class="listing-meta">
          ${r.beds ? `<span>${r.beds} bed</span>` : ''}
          ${r.baths ? `<span>${r.baths} bath</span>` : ''}
          ${r.type ? `<span>${r.type}</span>` : ''}
        </div>
      </div>
    </a>`;
  }).join('');
}

/* ---------------- Property detail (property.html) ---------------- */
async function renderPropertyDetail(){
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const container = document.getElementById('detailContainer');

  const { error, rows } = await fetchProperties();

  if(error === 'not-configured'){
    container.innerHTML = `<div class="empty-state"><p>No property feed connected yet. See PROPERTIES-SETUP.md.</p></div>`;
    return;
  }
  if(error || !rows.length){
    container.innerHTML = `<div class="empty-state"><p>We couldn't load this property right now.</p></div>`;
    return;
  }

  const row = rows.find((r, i) => propertyIdFor(r, i) === id);
  if(!row){
    container.innerHTML = `<div class="empty-state"><p>We couldn't find that property. <a href="properties.html">View all properties</a>.</p></div>`;
    return;
  }

  document.title = (row.title || row.address) + ' | Martell O\'Grady Estate Agents';

  const images = getImages(row);
  const features = splitList(row.features);

  container.innerHTML = `
    <a href="properties.html" class="back-link">&larr; All properties</a>
    <div class="detail-grid">
      <div>
        <div class="detail-gallery">
          <div class="main-photo">
            <img id="mainPhoto" src="${images[0]}" alt="${row.title||row.address}" onerror="imageFallback(this)">
            ${saleAgreedRibbon(row.status)}
            ${images.length > 1 ? `<button type="button" class="gallery-arrow gallery-arrow-prev" id="galleryPrev" aria-label="Previous property image">&lsaquo;</button>
            <button type="button" class="gallery-arrow gallery-arrow-next" id="galleryNext" aria-label="Next property image">&rsaquo;</button>` : ''}
          </div>
          ${images.length > 1 ? `<div class="detail-thumbs">
            ${images.map((img,i)=>`<button class="${i===0?'active':''}" data-src="${img}"><img src="${img}" alt="" onerror="imageFallback(this)"></button>`).join('')}
          </div>` : ''}
        </div>

        <div class="detail-description">
          <h2>${row.title || row.address}</h2>
          <p>${row.description || ''}</p>
          ${features.length ? `<ul class="detail-features">${features.map(f=>`<li>${f}</li>`).join('')}</ul>` : ''}
        </div>
      </div>

      <aside class="detail-side">
        ${isSaleAgreed(row.status) ? '<div class="sale-agreed-indicator">SALE AGREED</div>' : ''}
        ${row.status && !isSaleAgreed(row.status) ? `<span class="status-pill">${row.status}</span>` : ''}
        ${!isSaleAgreed(row.status) && row.price ? `<div class="detail-price">${euro(row.price)}</div>` : ''}
        <div class="detail-address">${row.address||''}</div>
        <ul class="detail-facts">
          ${row.beds ? `<li><span>Bedrooms</span><span>${row.beds}</span></li>` : ''}
          ${row.baths ? `<li><span>Bathrooms</span><span>${row.baths}</span></li>` : ''}
          ${row.type ? `<li><span>Type</span><span>${row.type}</span></li>` : ''}
          ${row.floor_area ? `<li><span>Floor area</span><span>${floorArea(row.floor_area)}</span></li>` : ''}
          ${row.ber ? `<li><span>BER</span><span>${row.ber}</span></li>` : ''}
        </ul>
        <a href="index.html#enquiryForm" class="btn btn-primary">Enquire about this property</a>
        <a href="tel:0719150155" class="btn btn-ghost">Call 071 915 0155</a>
      </aside>
    </div>
  `;

  const mainPhoto = document.getElementById('mainPhoto');
  const thumbs = container.querySelectorAll('.detail-thumbs button');
  let activeImage = 0;

  function thumbnailSource(index){
    const thumbnail = thumbs[index]?.querySelector('img');
    return thumbnail?.currentSrc || thumbnail?.src || images[index];
  }

  function showImage(index){
    activeImage = (index + images.length) % images.length;
    mainPhoto.classList.add('is-changing');
    mainPhoto.src = thumbnailSource(activeImage);
    window.requestAnimationFrame(() => {
      mainPhoto.classList.remove('is-changing');
    });
    thumbs.forEach((button, thumbIndex) => {
      button.classList.toggle('active', thumbIndex === activeImage);
    });
  }

  if(images.length > 1){
    thumbs.forEach((button, thumbIndex) => {
      button.querySelector('img').addEventListener('load', () => {
        if(thumbIndex === activeImage) showImage(activeImage);
      });
    });
    document.getElementById('galleryPrev').addEventListener('click', () => showImage(activeImage - 1));
    document.getElementById('galleryNext').addEventListener('click', () => showImage(activeImage + 1));
    thumbs.forEach((button, thumbIndex) => button.addEventListener('click', () => showImage(thumbIndex)));
    showImage(0);

    let touchStartX = 0;
    let touchStartY = 0;
    mainPhoto.parentElement.addEventListener('touchstart', event => {
      touchStartX = event.changedTouches[0].clientX;
      touchStartY = event.changedTouches[0].clientY;
    }, {passive:true});
    mainPhoto.parentElement.addEventListener('touchend', event => {
      const deltaX = event.changedTouches[0].clientX - touchStartX;
      const deltaY = event.changedTouches[0].clientY - touchStartY;
      if(Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)){
        showImage(activeImage + (deltaX < 0 ? 1 : -1));
      }
    }, {passive:true});
  }
}
