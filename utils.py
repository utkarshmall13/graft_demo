from flask import jsonify
import numpy as np
from transformers import AutoTokenizer, CLIPTextModelWithProjection
import torch
import os
from sentence_transformers import SentenceTransformer, util
import requests
from config import METADATA
from tqdm import tqdm

model = SentenceTransformer("paraphrase-MiniLM-L6-v2")

# EuroSAT concepts: annualcrop, forest, herbaceousvegetation, highway, industrial, pasture, permanentcrop, residential, river, sealake
# RESISC concepts: airplane, airport, baseball diamond, basketball court, beach, bridge, chaparral, church, circularfarmland, cloud, commercial area, dense residential, desert, forest, freeway, golf course, ground track field, harbor, industrial area, intersection, island, lake, meadow, medium residential, mobile home park, mountain, overpass, palace, parking lot, railway, railway station, rectangular farmland, river, roundabout, runway, sea ice, ship, snowberg, sparse residential, stadium, storage tank, tennis court, terrace, thermal power station, and wetland
concepts = [
    "farmland",
    "forest",
    "highway",
    "industrial",
    "residential",
    "river",
    "sea or lake",
    "beach",
    "bridge",
    "intersection",
    "mountain",
    "parking lot",
    "railway",
    "energy or energy farm",
    "city",
    "military facility",
    "solar farm",
    "wind farm",
    "powerlines",
    "airport"
]
concept_embeddings = model.encode(concepts, convert_to_tensor=True)
# concept_thresholds should directly bebased on the concepts list
concept_thresholds = {
    "farmland": 0.1,
    "forest": 0.14,
    "highway": 0.1,
    "industrial": 0.04,
    "residential": 0.03,
    "river": 0.09,
    "sea or lake": 0.12,
    "beach": 0.11,
    "bridge": 0.12,
    "intersection": 0.04,
    "mountain": 0.09,
    "parking lot": 0.07,
    "railway": 0.15,
    "energy or energy farm": 0.05,
    "city": 0.05,
    "military facility": 0.11,
    "solar farm": 0.15,
    "wind farm": 0.15,
    "powerlines": 0.15,
    "airport": 0.15,
}

def download_file(url, filename):
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        # Get the total file size in bytes
        total_size = int(response.headers.get('content-length', 0))        
        with open(filename, 'wb') as file, tqdm(
            desc=filename,
            total=total_size,
            unit='B',
            unit_scale=True,
            unit_divisor=1024,
        ) as bar:
            for data in response.iter_content(chunk_size=1024):
                file.write(data)
                bar.update(len(data))
        print(f"\nFile downloaded successfully and saved as {filename}")
    else:
        print(f"Failed to download file. Status code: {response.status_code}")

def get_most_similar_concept(query):
    query_embedding = model.encode(query, convert_to_tensor=True)
    cosine_scores = util.pytorch_cos_sim(
        query_embedding, concept_embeddings)[0]
    most_similar_concept = concepts[torch.argmax(cosine_scores).item()]
    return most_similar_concept


def make_response(status_code=200, **kwargs):
    if not kwargs:
        return jsonify(), status_code

    if "error" in kwargs:
        return jsonify(error=kwargs["error"]), status_code

    return jsonify(**kwargs), status_code


def load_model(state="MA", device="cpu"):
    if not os.path.exists("features"):
        os.makedirs("features")
    if not os.path.exists(f"features/{state}_2020.npz"):
        download_file(f"{METADATA}/{state}_2020.npz", f"features/{state}_2020.npz")
    file_path = f"features/{state}_2020.npz"
    data = np.load(file_path)
    feats = np.array(data["feats"])
    locs = np.array(data["locs"])
    textmodel = (CLIPTextModelWithProjection.from_pretrained("openai/clip-vit-base-patch16").eval().to(device))
    tokenizer = AutoTokenizer.from_pretrained("openai/clip-vit-base-patch16")
    return feats, locs, device, textmodel, tokenizer


def initialize_models(states):
    models = dict()
    for state in states:
        models[state] = load_model(state)
    return models


def load_images(files=["features/MA_2020.txt"]):
    image_dict = dict()
    for file_path in files:
        if not os.path.exists(file_path):
            download_file(f"{METADATA}/{file_path.split('/')[-1]}", file_path)
        with open(file_path, "r") as f:
            for line in f:
                line = line.strip()
                key = line.split("/")[-1]
                image_dict[key] = line
    return image_dict


def format_loc(loc):
    point_lon = str(int(np.round(loc[0] * 100000)))
    point_lat = str(int(np.round(loc[1] * 100000)))
    return point_lon + "_" + point_lat + ".jpg"


def get_threshold_from_query(query):
    matched_concept = get_most_similar_concept(query)
    print(f"Matched Concept: {matched_concept}")
    return concept_thresholds.get(matched_concept, 0.05)
