// --- Инициализация карты ---
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json',
    center: [37, 55],
    zoom: 3
});

let collegesData = [];
let ugsData = [];
let territoryNeighbors = {};
let geoData = [];
let territoryUGSMap = {};

// --- Загружаем JSON ---
Promise.all([
    fetch('data/colleges.json').then(res => res.json()),
    fetch('data/ugs.json').then(res => res.json()),
    fetch('data/territory_neighbors.json').then(res => res.json()),
    fetch('data/municipalities.geojson').then(res => res.json())
]).then(([colleges, ugs, neighbors, geoJSON]) => {
    collegesData = colleges;
    ugsData = ugs;
    territoryNeighbors = neighbors;
    geoData = geoJSON;

    // --- Создаём lookup territory_id -> Set of UGS ---
    ugsData.forEach(u => {
        if (!u.org_id || !u.ugs_name || u.ugs_name === 'nan') return;
        if (!territoryUGSMap[u.territory_id]) territoryUGSMap[u.territory_id] = new Set();
        territoryUGSMap[u.territory_id].add(u.ugs_name);
    });

    // --- контейнер под таблицу ---
    const tableContainer = document.createElement('div');
    tableContainer.id = 'neighbors-table';
    tableContainer.style.marginTop = '15px';
    tableContainer.style.backgroundColor = 'white';
    tableContainer.style.padding = '10px';
    tableContainer.style.borderRadius = '6px';
    tableContainer.style.fontFamily = 'Arial, sans-serif';
    tableContainer.style.fontSize = '13px';
    document.body.appendChild(tableContainer);

    // --- Генерация чекбоксов ---
    const ugsCheckboxesContainer = document.getElementById('ugs-checkboxes');
    const uniqueUGS = Array.from(new Set(
        ugsData.map(u => u.ugs_name).filter(name => name && name.trim() !== '' && name !== 'nan')
    )).sort();

    uniqueUGS.forEach(name => {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.marginBottom = '2px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = name;

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + name));
        ugsCheckboxesContainer.appendChild(label);
    });

    // --- Фильтр по чекбоксам (быстрый, сохраняет клики) ---
    function filterMunicipalities() {
        const checkedUGS = Array.from(ugsCheckboxesContainer.querySelectorAll('input:checked')).map(c => c.value);

        if (checkedUGS.length === 0) {
            map.setFilter('mun-polygons', null);
            return;
        }

        const filterArray = ['any']; // MapLibre filter
        geoData.features.forEach(f => {
            const props = f.properties;
            const neighborsDataMun = territoryNeighbors[String(props.territory_id)] || {};
            const relevantTerritories = [props.territory_id, ...(neighborsDataMun['0-50'] || [])];

            const hasUGS = relevantTerritories.some(tid => {
                const ugsSet = territoryUGSMap[tid];
                return ugsSet && checkedUGS.some(ugs => ugsSet.has(ugs));
            });

            if (hasUGS) {
                filterArray.push(['==', ['get', 'territory_id'], props.territory_id]);
            }
        });

        map.setFilter('mun-polygons', filterArray);
    }

    // --- Кнопки ---
    document.getElementById('apply-filter').addEventListener('click', filterMunicipalities);
    document.getElementById('clear-filter').addEventListener('click', () => {
        ugsCheckboxesContainer.querySelectorAll('input').forEach(c => c.checked = false);
        map.setFilter('mun-polygons', null);
    });

    // --- Загрузка карты и слоев ---
    map.on('load', () => {
        geoData.features.forEach((f, i) => { f.id = f.id || i; });
        map.addSource('municipalities', { type: 'geojson', data: geoData });

        map.addLayer({
            id: 'mun-polygons',
            type: 'fill',
            source: 'municipalities',
            paint: {
                'fill-color': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    '#FF7F0E',
                    ['step',
                        ['get', 'index'],
                        '#f0f0f0',
                        1, '#edf8e9',
                        10, '#bae4b3',
                        20, '#74c476',
                        30, '#31a354',
                        37, '#006d2c'
                    ]
                ],
                'fill-opacity': 0.4,
                'fill-outline-color': 'rgba(255, 255, 255, 0.6)'
            }
        });

        let hoveredMunId = null;

        // --- Hover ---
        map.on('mousemove', 'mun-polygons', (e) => {
            if (hoveredMunId !== null) map.setFeatureState({ source: 'municipalities', id: hoveredMunId }, { hover: false });
            if (e.features.length > 0) {
                hoveredMunId = e.features[0].id;
                map.setFeatureState({ source: 'municipalities', id: hoveredMunId }, { hover: true });
            }
        });

        map.on('mouseleave', 'mun-polygons', () => {
            if (hoveredMunId !== null) map.setFeatureState({ source: 'municipalities', id: hoveredMunId }, { hover: false });
            hoveredMunId = null;
        });

        // --- Клик (карточка) ---
        map.on('click', 'mun-polygons', (e) => {
            const props = e.features[0].properties;
            const munColleges = collegesData
                .filter(c => c.oktmo_short_spo === props.oktmo_short_spo)
                .map(c => c.spo_name)
                .filter(name => name && name.trim() !== '');
            const neighborsData = territoryNeighbors[String(props.territory_id)] || {};

            const allUGSNames = Array.from(
                new Set(
                    ugsData
                        .map(u => u.ugs_name)
                        .filter(name => name && name.trim() !== '' && name !== 'nan')
                )
            ).sort();

            const neighbor50Ids = neighborsData['0-50'] || [];
            const relevantTerritories = [props.territory_id, ...neighbor50Ids];

            let ugsPresenceHTML = `<h3>Наличие УГС (муниципалитет + соседи 0-50 км)</h3>
                <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:15px;">
                    <thead><tr><th>УГС</th><th>Наличие</th></tr></thead><tbody>`;

            allUGSNames.forEach(ugsName => {
                const exists = relevantTerritories.some(tid => {
                    const ugsSet = territoryUGSMap[tid];
                    return ugsSet && ugsSet.has(ugsName);
                });
                ugsPresenceHTML += `<tr><td>${ugsName}</td><td>${exists ? '✔' : '-'}</td></tr>`;
            });
            ugsPresenceHTML += `</tbody></table>`;

            const ugsCount = allUGSNames.filter(ugsName =>
                relevantTerritories.some(tid => {
                    const ugsSet = territoryUGSMap[tid];
                    return ugsSet && ugsSet.has(ugsName);
                })
            ).length;

            let html = `
                <h2>${props.municipal_district_name_short}</h2>
                <p><strong>Индекс доступности СПО:</strong> ${props.index || '-'}</p>
                <p><strong>Регион:</strong> ${props.region_name || '-'}</p>
                <p><strong>Тип муниципалитета:</strong> ${props.municipal_district_type || '-'}</p>
                <p><strong>Население 15–25:</strong> ${props.population_15_25 || '-'}</p>
                <p><strong>СПО, включая соседей до 50 км:</strong> ${props.unique_colleges_0_50 || 0}</p>
                <p><strong>Доступно УГС, включая соседей до 50 км:</strong> ${ugsCount}</p>
                ${ugsPresenceHTML}
            `;
            document.getElementById('info').innerHTML = html;

            let tableHTML = `<h3>Колледжи муниципалитета</h3>
                <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:15px;">
                    <thead><tr><th>Муниципалитет</th><th>Колледж</th></tr></thead><tbody>`;
            munColleges.forEach(c => {
                tableHTML += `<tr><td>${props.municipal_district_name_short}</td><td>${c}</td></tr>`;
            });
            tableHTML += `</tbody></table>`;

            document.getElementById('neighbors-table').innerHTML = tableHTML;
        });
    });
});
