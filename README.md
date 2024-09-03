# Graft - Flask based web application for Demonstration
This guide provides detailed instructions on how to set up, run, and deploy the Flask based web application for demonstrating the Graft project.

## Initial Setup
**Virtual Environment (venv) Setup**:
   - The installation requires some heavy python libraries. Make sure you have some free space on hard drive (~20 GB).
   - To set up a virtual environment, navigate to the project root and run:
     ```bash
     python3 -m venv venv
     ```
   - Activate the virtual environment:
     - On macOS and Linux:
       ```bash
       source venv/bin/activate
       ```
     - On Windows:
       ```bash
       .\venv\Scripts\activate
       ```
   - Install the required dependencies using the provided `requirements.txt` file:
     ```bash
     pip install -r requirements.txt
     ```

## Running the Application
- Optionally, make sure to select a subset of states you want to load in the `states` variable on `line 34` in the `app.py` and in `templates/index.html` at `line 28`.
- To run the application, navigate to the project root and run:
    ```bash
    python app.py
    ```
- **Note:** The first time you run this, it will download a bunch of metadata. Make sure you have alteast 30 GBs of space.
- The application will be accessible at `http://localhost:8080/`.

# Update (09/03/24)
## Applications:
- Visiting `http://127.0.0.1:8080/search_and_save` now allows for searching within a bounding box and saving resultant scores.
- If the number of satellite images in the search bounding box is larger than 10000, it will save the highest scoring 10000 images.
- Otherwise, it returns a json file with all images and their corresponding scores.