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
        rectangle: true,
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

// add a listner for #search-btn using jquery
$("#search-btn").click(function () {
    boundedQuery();
});
$("#save-btn").click(function () {
    saveData();
});

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

var lastRectangle = null;

map.addControl(new resetZoomControl());
document.getElementById('reset-zoom').addEventListener('click', resetZoom);

map.on('draw:drawstart', function (event) {
    if (event.layerType === 'rectangle' && lastRectangle) {
        drawnItems.removeLayer(lastRectangle);
    }
});

//remove rectangle when a new one is drawn
map.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;
    // Add the drawn rectangle to the map
    drawnItems.addLayer(layer);

    lastRectangle = layer;

    // Get the coordinates of the rectangle
    const bounds = layer.getBounds();
    const northEast = bounds.getNorthEast(); // Top-right corner
    const southWest = bounds.getSouthWest(); // Bottom-left corner

    // Output the bounds of the rectangle
    console.log('Rectangle bounds:', bounds);
    console.log('North-East:', northEast);
    console.log('South-West:', southWest);
});

var save_scores = null;
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


function boundedQuery(e) {
    if (e) e.preventDefault();
    document.getElementById("loading-icon").style.display = "flex";
    var query = document.getElementById("userInput").value;
    var threshold = document.getElementById("threshold").value;
    var k = document.getElementById("k").value;
    if (lastRectangle !== null) {
        var bounds = lastRectangle.getBounds();
        var ne = bounds.getNorthEast();
        var sw = bounds.getSouthWest();
    }
    else{
        // altert user to draw a rectangle
        alert("Please draw a rectangle on the map to bound your query.")
        document.getElementById("loading-icon").style.display = "none";
        return
    }

    console.log(k, threshold, query, ne, sw);
    var state = stateDropdown.value;
    if (heatmapLayer) map.removeLayer(heatmapLayer);

    var thresh_arg = threshold !== "" ? `&thresh=${threshold}` : "";
    if (thresholdSlider.disabled) thresh_arg = "";
    var k_arg = k !== "" ? `&k=${k}` : "";
    var state_arg = `&state=${state}`;
    var ne_arg = `&ne=${ne.lat},${ne.lng}`;
    var sw_arg = `&sw=${sw.lat},${sw.lng}`;
    fetch(`/classified-bounded-points?query=${query}${thresh_arg}${k_arg}${state_arg}${ne_arg}${sw_arg}`, 
        {
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
            saved_scores = data.scores;

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


function saveData(){
    // save blue_coords and top_locs to download as a json file
    console.log("Saving data")
    console.log("Length of saved_scores: ", saved_scores.length)
    var data = {
        "saved_scores": saved_scores
    }
    var query = document.getElementById("userInput").value;
    query = query.replace(/\s/g, "_");
    var json = JSON.stringify(data);
    var blob = new Blob([json], {type: "application/json"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    a.download = query + "_data.json";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);    
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