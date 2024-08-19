# Flask Imports
import os
from flask import Flask, request, render_template, jsonify, session
from flask_caching import Cache
from flask_talisman import Talisman
from flask_cors import CORS
from utils import (load_images, make_response, initialize_models, format_loc, get_threshold_from_query)

# Model Imports
import numpy as np
import torch.nn.functional as F
import torch

# Config Imports
from config import config, csp
from dotenv import load_dotenv, find_dotenv
import secrets

# ------------------Flask App Configuration------------------
app = Flask(__name__)
app.secret_key = secrets.token_hex(16)

load_dotenv(find_dotenv(), override=True)
CORS(app)
app.config.from_mapping(config)
cache = Cache(app)
talisman = Talisman(app, content_security_policy=csp, content_security_policy_nonce_in=["script-src", "style-src"])


# ------------------Model Config and Helper Functions------------------
# Initialize the models when the app starts
with app.app_context():
    # CHANGE THIS LINE BELOW TO LOAD OTHER STATES
    states = ["MA", "NY", "MN", 'austria']
    app.config["models"] = initialize_models(states)
    app.config["images"] = load_images([f"features/{state}_2020.txt" for state in states])


def high_prob_points(top_locs, state):
    points = []
    num_valid_points = 0
    index = 0
    img_url = os.environ.get("IMAGE_SOURCE")
    while num_valid_points != 200 and index < len(top_locs):
        loc = top_locs[index]
        key = format_loc(loc)
        index += 1
        try:
            img_src = f"{img_url}{state}/{app.config['images'][key]}"
            points.append(
                {
                    "img": img_src,
                    "long": loc[0],
                    "lat": loc[1],
                }
            )
            num_valid_points += 1
        except:
            continue
    return points


def classify(query, thresh=0.05, state="MA"):
    feats, locs, device, textmodel, tokenizer = app.config["models"][state]
    with torch.no_grad():
        textsenc = tokenizer([query], padding=True, return_tensors="pt").to(device)
        class_embeddings = F.normalize(textmodel(**textsenc).text_embeds, dim=-1)

    classprob = feats @ class_embeddings.cpu().numpy().T
    condition = classprob[:, 0] > thresh
    filtered_locs = locs[condition]

    swapped_points = filtered_locs[:, [1, 0]]
    swapped_points = swapped_points.tolist()
    top_locs = locs[np.argsort(classprob[:, -1])[::-1]]
    top_points = high_prob_points(top_locs, state)

    return swapped_points, top_points


# ------------------Flask Status Routes------------------
@app.route("/health")
def health():
    return jsonify({"status": "OK"}), 200


@app.errorhandler(404)
def not_found(error):
    return render_template("404.html"), 404


@app.errorhandler(500)
def internal_error(error):
    print(error)
    return f"Internal error: {error}", 500


# ------------------Flask App Routes------------------
@app.route("/")
def index():
    return render_template("index.html")


@cache.cached(timeout=300)
@app.route("/classified-points")
def classified_points():
    # get params
    query = request.args.get("query")
    thresh = request.args.get("thresh")
    max_points = request.args.get("k")
    print(max_points)
    state = request.args.get("state")

    # get stored params
    prev_query = session.get("prev_query")
    prev_state = session.get("prev_state")
    if prev_query != query or prev_state != state or thresh is None:
        thresh = get_threshold_from_query(query)
    thresh = float(thresh)

    # set session
    session["prev_query"] = query
    session["prev_state"] = state

    # Check for Cache Hit
    cache_key = f"{query}_{thresh}_{state}"
    cached_response = cache.get(cache_key)
    if cached_response:
        print("Cache Hit")
        kwargs = {
            "thresh": str(thresh),
            "blue_coords": cached_response[1],
            "top_locs": cached_response[2],
        }
        if max_points is not None:
            kwargs["top_locs"] = kwargs["top_locs"][: int(max_points)]
            return make_response(**kwargs, status_code=200)
        return make_response(**kwargs, status_code=200)

    # Fetch Results
    list_of_blue_points, top_locs = classify(query, thresh, state)

    # Cache Results and Return
    cache.set(cache_key, [thresh, list_of_blue_points, top_locs], timeout=300)
    return make_response(
        thresh=thresh, blue_coords=list_of_blue_points, top_locs=top_locs[: int(max_points)]
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
