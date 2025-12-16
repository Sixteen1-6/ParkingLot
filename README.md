Parking Lot Detector

## Description
YOLO-based parking lot occupancy detection with a Python Flask API and a Node.js CLI client that uploads an image, runs detection, and opens a local HTML report in your browser.

## Tech Stack
- Language(s): Python, JavaScript, HTML
- Backend: Python, Flask, Flask-CORS
- Frontend / Client: Node.js CLI (`form-data`), HTML
- Model / Libraries: Ultralytics YOLO, PyTorch, OpenCV

## Requirements
- Python: 3.10+ (developed with 3.12.9)
- Node.js: 18+ (developed with 22.21.0)
- Git (optional but recommended)
- `best.pt` YOLO weights file in the project root

## Installation and Runtime Instructions

1. Clone and enter the project
    git clone https://github.com/Sixteen1-6/ParkingLot.git
    cd ParkingLot

2. Create and Activate a virtual environment:
    python3 -m venv venv

    Mac/Linux:
        source venv/bin/activate 
    Windows:
        .\venv\Scripts\activate

3. Install Python Dependencies:
    pip install -r requirements.txt

4. Establish Flask Server for the API needed
    python3 pyapi.py

    Expected output:
        Loading YOLO model...
        Model loaded from: /path/to/Project/best.pt
        Starting Flask server on http://127.0.0.1:40000
        * Serving Flask app 'pyapi'
        * Running on http://127.0.0.1:40000

    Leave this running for the duration of use for the detector.

5. Get Node dependencies Run the JavaScript with an image of a parking lot
    
    npm install 

    node PKLotDetector.js /path/to/image http://127.0.0.1:40000

    Expected Output:
    ======================================================================
    Image: /path/to/your/image
    API: http://127.0.0.1:40000
    ======================================================================

    Uploading image to API...
    Detection complete!
      Free: NUM_FREE
      Occupied: NUM_OCCUPIED
      Total: NUM_SPACES

    Downloading annotated image...
     Image downloaded!

    Results ready at: http://localhost:23000

6. Once the JavaScript finished calling the python, a browser will open to view the results

