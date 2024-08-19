var map = L.map("map").setView([42.4072, -71.3824], 8);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const stateCoordinates = {
    "austria": [47.5162, 14.5501],
    "NY": [43.0, -75.0],
    "MA": [42.4072, -71.3824]
};

const stateDropdown = document.getElementById("stateDropdown");
stateDropdown.addEventListener('change', function () {
    const selectedState = this.value;
    const coords = stateCoordinates[selectedState];
    if (coords) {
        map.setView(coords, 8);
    }
});

var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var drawControl = new L.Control.Draw({
    draw: {
        rectangle: false,
        polyline: false,
        polygon: false,
        circle: false,
        marker: false,
        circlemarker: false,
    },
    edit: {
        featureGroup: drawnItems,
        edit: false,
        remove: false,
    },
});
map.addControl(drawControl);

var heatmapLayer;

let thresholdSlider = document.getElementById("threshold");
let thresholdValue = document.getElementById("thresholdValue");
let kSlider = document.getElementById("k");
let kValue = document.getElementById("kValue");

let form = document.getElementById("search");
let slidingTimeout;

thresholdSlider.disabled = true;
kSlider.disabled = true;

form.addEventListener("submit", sendRequest);

thresholdSlider.addEventListener("input", function () {
    thresholdValue.textContent = this.value;
});

thresholdSlider.addEventListener("change", function () {
    if (slidingTimeout) {
        clearTimeout(slidingTimeout);
    }

    slidingTimeout = setTimeout(function () {
        sendRequest();
    }, 1000);
});

kSlider.addEventListener("input", function () {
    kValue.textContent = this.value;
});

kSlider.addEventListener("change", function () {
    if (slidingTimeout) {
        clearTimeout(slidingTimeout);
    }

    slidingTimeout = setTimeout(function () {
        sendRequest();
    }, 1000);
});

document
    .getElementById("toggle-heatmap-btn")
    .addEventListener("click", toggleHeatmap);
document.getElementById("reset-btn").addEventListener("click", resetPage);

function resetZoom() {
    const selectedState = stateDropdown.value;
    const coords = stateCoordinates[selectedState];
    if (coords) {
        map.setView(coords, 8);
    } else {
        map.setView([42.4072, -71.3824], 8);
    }
}


var resetZoomControl = L.Control.extend({
    options: {
        position: "topright",
    },

    onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        container.innerHTML =
            '<button id="reset-zoom">Reset Zoom</button>';
        return container;
    },
});

map.addControl(new resetZoomControl());
document.getElementById('reset-zoom').addEventListener('click', resetZoom);


function sendRequest(e) {
    if (e) e.preventDefault();
    document.getElementById("loading-icon").style.display = "flex";
    var query = document.getElementById("userInput").value;
    var threshold = document.getElementById("threshold").value;
    var k = document.getElementById("k").value;
    console.log(k)
    var state = stateDropdown.value;
    if (heatmapLayer) map.removeLayer(heatmapLayer);


    var thresh_arg = threshold !== "" ? `&thresh=${threshold}` : "";
    if (thresholdSlider.disabled) thresh_arg = "";
    var k_arg = k !== "" ? `&k=${k}` : "";
    var state_arg = `&state=${state}`;
    fetch(`/classified-points?query=${query}${thresh_arg}${k_arg}${state_arg}`, {
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((response) => response.json())
        .then((data) => {
            map.eachLayer(function (layer) {
                if (layer instanceof L.Marker) {
                    map.removeLayer(layer);
                }
            });

            var heatmapData = data.blue_coords.map(function (point) {
                return [point[0], point[1]];
            });
            console.log(heatmapData)
            // console.log(data.blue_coords)

            heatmapLayer = new L.heatLayer(heatmapData, {
                radius: 25,
                blur: 0,
                maxZoom: 18,
                max: 1.0,
                opacity: 1.0,
                gradient: {
                    0.2: "blue",
                    0.4: "green",
                    0.6: "yellow",
                    0.8: "orange",
                    1.0: "red",
                },
            }).addTo(map);

            // var heatmapData = data.blue_coords.map(function (point) {
            //     return {'lat': point[0], 'lng': point[1]};
            // });
            // heatmapLayer = new L.hexbinLayer(heatmapData, {
            //     radius: 25,
            //     blur: 0,
            //     maxZoom: 18,
            //     max: 1.0,
            // }).addTo(map);
            

            map.on('zoomend', function () {
            var currentZoom = map.getZoom();
            console.log(currentZoom);
            console.log(heatmapLayer.options);
            });
            map.removeLayer(heatmapLayer);

            data.top_locs.forEach((loc, index) => {
                var redIcon = L.divIcon({
                    className: "custom-icon",
                    html: `<div class="marker-label">${index + 1
                        }</div><img src="https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png"/>`,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [0, -20],
                });
                var marker = L.marker([loc.lat, loc.long], {
                    icon: redIcon,
                }).addTo(map);

                var popupContent = `<img src="${loc.img}" class="small-image" />`;
                marker.bindPopup(popupContent, {
                    minWidth: "fit-content",
                    minHeight: "fit-content",
                });

                // Show the popup (with the image) when hovering over the marker
                marker.on("mouseover", function (e) {
                    this.openPopup();
                });
                marker.on("mouseout", function (e) {
                    this.closePopup();
                });
            });

            document.getElementById("loading-icon").style.display = "none";
            thresholdSlider.disabled = false;
            kSlider.disabled = false;
            console.log(data.thresh);
            thresholdSlider.value = data.thresh;
            thresholdSlider.dispatchEvent(new Event('input'));
        })
        .catch((error) => {
            console.error("Error:", error);
            document.getElementById("loading-icon").style.display = "none";
            thresholdSlider.disabled = false;
            kSlider.disabled = false;
        });
}

function toggleHeatmap() {
    if (heatmapLayer) {
        if (!map.hasLayer(heatmapLayer)) {
            heatmapLayer.addTo(map);
            thresholdSlider.disabled = false;
            kSlider.disabled = false;
        } else {
            map.removeLayer(heatmapLayer);
            thresholdSlider.disabled = true;
            kSlider.disabled = false;
        }
    }
}

function resetPage() {
    location.reload();
}

L.Control.geocoder().addTo(map);