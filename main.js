const CONFIG = {
    MAP_CENTER: [-6.2088, 106.8456],
    SUPABASE_URL: 'https://cdvvmvjffmhvnnkqojoc.supabase.co',
    SUPABASE_KEY: 'YOUR_SUPABASE_ANON_KEY',
};

const state = {
    map: null,
    supabase: null,
    wilayah: null,
    markers: []
};

// Initialize
(async () => {
    // Supabase
    state.supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    
    // Map
    state.map = L.map('map').setView(CONFIG.MAP_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(state.map);
    
    // Fetch data
    const { data: wilayahData } = await state.supabase.from('wilayah').select('*');
    if (!wilayahData) return alert('Failed to load data');
    
    state.wilayah = wilayahData;
    
    // Render boundaries & markers
    wilayahData.forEach(w => {
        if (!w.geojson_data) return;
        
        // GeoJSON layer
        L.geoJSON(w.geojson_data, {
            style: { color: '#3388ff', weight: 2, fillOpacity: 0.2 },
            onEachFeature: () => onWilayahClick(w)
        }).addTo(state.map);
        
        // Marker at center
        const center = w.geojson_data.type === 'Polygon' 
            ? getPolygonCenter(w.geojson_data.coordinates[0])
            : [w.geojson_data.coordinates[1], w.geojson_data.coordinates[0]];
        
        L.circleMarker(center, {
            radius: 8,
            fillColor: '#ff7800',
            color: '#fff',
            weight: 2,
            fillOpacity: 0.8
        }).addTo(state.map)
            .bindPopup(`<strong>${w.nama_rt_rw}</strong><br><button onclick="onWilayahClick({id: ${w.id}, nama_rt_rw: '${w.nama_rt_rw}'})">View</button>`);
    });
    
    // Fit bounds
    if (state.markers.length > 0) {
        state.map.fitBounds(new L.featureGroup(state.markers).getBounds(), { padding: [50, 50] });
    }
})();

// Get polygon center
function getPolygonCenter(coords) {
    let x = 0, y = 0;
    coords.forEach(c => { x += c[1]; y += c[0]; });
    return [x / coords.length, y / coords.length];
}

// Handle wilayah click
async function onWilayahClick(w) {
    const { data: pengurus } = await state.supabase
        .from('pengurus')
        .select('*')
        .eq('wilayah_id', w.id);
    
    let html = `<div class="wilayah-header"><h2>${w.nama_rt_rw}</h2></div><div class="officials-list">`;
    
    if (!pengurus?.length) {
        html += '<p>No officials registered</p>';
    } else {
        pengurus.forEach(p => {
            html += `
                <div class="official-card">
                    ${p.foto_url ? `<img src="${p.foto_url}" alt="${p.nama}" class="official-photo">` : ''}
                    <h3>${p.nama}</h3>
                    <p><strong>Position:</strong> ${p.jabatan}</p>
                    <p><strong>NIK:</strong> ${p.nik}</p>
                    <p><strong>Phone:</strong> ${p.no_telp || 'N/A'}</p>
                </div>
            `;
        });
    }
    
    html += '</div>';
    document.getElementById('detailsContent').innerHTML = html;
    document.getElementById('detailsPanel').classList.remove('hidden');
}

// Search
document.getElementById('searchInput')?.addEventListener('input', debounce(async (e) => {
    const query = e.target.value;
    const resultsDiv = document.getElementById('searchResults');
    
    if (!query.trim()) {
        resultsDiv.classList.add('hidden');
        return;
    }
    
    const { data: results } = await state.supabase
        .from('wilayah')
        .select('*')
        .ilike('nama_rt_rw', `%${query}%`);
    
    resultsDiv.innerHTML = results?.map(r => 
        `<div class="result-item" onclick="searchSelect(${r.id})">${r.nama_rt_rw}</div>`
    ).join('') || '<p>No results</p>';
    resultsDiv.classList.remove('hidden');
}, 300));

function searchSelect(id) {
    const w = state.wilayah.find(x => x.id === id);
    if (w?.geojson_data) {
        const bounds = L.geoJSON(w.geojson_data).getBounds();
        state.map.flyToBounds(bounds, { padding: [50, 50] });
        onWilayahClick(w);
    }
    document.getElementById('searchResults').classList.add('hidden');
}

function debounce(fn, ms) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
}

// Close panel
document.getElementById('closePanel')?.addEventListener('click', () => {
    document.getElementById('detailsPanel').classList.add('hidden');
});
