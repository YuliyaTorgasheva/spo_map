// Центр России
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json', // свободный стиль
    center: [37, 55],
    zoom: 5
});

let munData = {};
let geoData = {};

// Загружаем полигоны и данные
Promise.all([
    fetch('municipalities_simplified.geojson').then(res => res.json()),
    fetch('municipalities_data.json').then(res => res.json())
]).then(([geojson, data]) => {
    geoData = geojson;
    data.forEach(d => { munData[d.municipal_district_name_short] = d; });

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

        // Клик по муниципалитету
        map.on('click', 'mun-polygons', (e) => {
            const munName = e.features[0].properties.municipal_district_name_short;
            const info = munData[munName] || {spo_count:0, ugs_count:0};

            document.getElementById('info').innerHTML = `
                <h2>${munName}</h2>
                <p><strong>СПО:</strong> ${info.spo_count}</p>
                <p><strong>UGS:</strong> ${info.ugs_count}</p>
            `;

            // Строим график
            Plotly.newPlot('chart', [{
                x: ['СПО','UGS'],
                y: [info.spo_count, info.ugs_count],
                type: 'bar',
                marker: {color: ['#627BC1','#FF7F0E']}
            }], {margin: {t: 20, l: 40, r: 20, b: 40}});
        });

        map.on('mouseenter', 'mun-polygons', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'mun-polygons', () => { map.getCanvas().style.cursor = ''; });
    });
});
