import os

SELF = "'self'"
STATIC = "../static"
UNPKG = "https://unpkg.com"
GOOGLE_FONTS = "https://fonts.googleapis.com"
G_STATIC_FONTS = "https://fonts.gstatic.com"
OPENSTREETMAP = "https://*.tile.openstreetmap.org"
CORNELL = "https://research.cs.cornell.edu"
METADATA = 'https://cv.cs.columbia.edu/utkarsh/GRAFTDemoMetadata'
DATA = "data:"
JQUERY = "https://code.jquery.com"

config = {
    "DEBUG": True,
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "FLASK_ENV": os.environ.get("FLASK_ENV", "development"),
}

csp = {
    "default-src": [SELF],
    "script-src": [
        SELF,
        UNPKG,
        f"{STATIC}/scripts.js",
        f"{STATIC}/scripts_sas.js",
        JQUERY,
    ],
    "style-src": [
        SELF,
        UNPKG,
        GOOGLE_FONTS,
        f"{STATIC}/styles.css",
    ],
    "img-src": [SELF, DATA, CORNELL, UNPKG, OPENSTREETMAP],
    "font-src": [SELF, G_STATIC_FONTS],
}
