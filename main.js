// Инициализация карты
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [37, 55],
    zoom: 8
});

let collegesData = [];
let territoryNeighbors = {};

// Загружаем JSON с колледжами и соседями
Promise.all([
    fetch('data/colleges.json').then(res => res.json()),
    fetch('data/territory_neighbors.json').then(res => res.json())
]).then(([colleges, neighbors]) => {
    collegesData = colleges;
    territoryNeighbors = neighbors;

    // Загружаем GeoJSON муниципалитетов
    fetch('data/municipalities.geojson')
        .then(res => res.json())
        .then(geoData => {
            
            map.on('load', () => {
                map.addSource('municipalities', { type: 'geojson', data: geoData });
                map.addLayer({
                    id: 'mun-polygons',
                    type: 'fill',
                    source: 'municipalities',
                    paint: {
                        'fill-color': '#627BC1',
                        'fill-opacity': 0.5,
                        'fill-outline-color': '#ffffff'
                    }
                });

                map.on('click', 'mun-polygons', (e) => {
                    const props = e.features[0].properties;

                    // Фильтруем колледжи для текущего муниципалитета по oktmo_short_spo
                    const munColleges = collegesData.filter(d => d.oktmo_short_spo === props.oktmo_short_spo);

                    // Получаем соседей из territoryNeighbors
                    const neighbors = territoryNeighbors[props.territory_id] || {};

                    // Строим HTML для карточки
                    let html = `
                        <h2>${props.municipal_district_name_short}</h2>
                        <p><strong>ОКТМО базовый:</strong> ${props.oktmo_base || '-'}</p>
                        <p><strong>ОКТМО короткий СПО:</strong> ${props.oktmo_short_spo || '-'}</p>
                        <p><strong>territory_id:</strong> ${props.territory_id || '-'}</p>
                        <p><strong>Регион:</strong> ${props.region_name || '-'}</p>
                        <p><strong>Тип муниципалитета:</strong> ${props.municipal_district_type || '-'}</p>
                        <p><strong>Население 15-25:</strong> ${props.population_15_25 || '-'}</p>
                        <p><strong>СПО:</strong> ${props.spo_count || 0}</p>
                        <p><strong>UGS:</strong> ${props.ugs_count || 0}</p>
                        <p><strong>Уникальные профили (0–50 км):</strong> ${props.unique_profiles_0_50 || 0}</p>
                        <p><strong>Уникальные профили (51–100 км):</strong> ${props.unique_profiles_51_100 || 0}</p>
                        <p><strong>Уникальные профили (101–400 км):</strong> ${props.unique_profiles_101_400 || 0}</p>
                        <h3>Колледжи муниципалитета:</h3>
                        <ul>
                            ${munColleges.map(c => `<li>${c.name || c.college_name}</li>`).join('')}
                        </ul>
                        <h3>Соседи по категориям расстояний:</h3>
                        <ul>
                            ${Object.entries(neighbors).map(([cat, arr]) => `<li>${cat}: ${arr.join(', ') || '-'}</li>`).join('')}
                        </ul>
                    `;

                    document.getElementById('info').innerHTML = html;

                    // Строим график Plotly
                    Plotly.newPlot('chart', [{
                        x: ['СПО','UGS','0-50','51-100','101-400'],
                        y: [
                            props.spo_count || 0,
                            props.ugs_count || 0,
                            props.unique_profiles_0_50 || 0,
                            props.unique_profiles_51_100 || 0,
                            props.unique_profiles_101_400 || 0
                        ],
                        type: 'bar',
                        marker: {color: ['#627BC1','#FF7F0E','#2CA02C','#D62728','#9467BD']}
                    }], {margin: {t: 20, l: 40, r: 20, b: 40}});
                });

                map.on('mouseenter', 'mun-polygons', () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', 'mun-polygons', () => { map.getCanvas().style.cursor = ''; });
            });
        });
});
