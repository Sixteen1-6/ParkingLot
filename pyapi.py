"""
File: parking_api.py
Author: Parker Jenkins
Date: 2025-12-08
Description:
    Flask API that uses a YOLO model to detect parking spaces in an image,
    counts free and occupied spots, and serves annotated images and status.
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from ultralytics import YOLO
import numpy as np
import cv2
import os

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__)) #Gets path to current directory
MODEL_PATH = os.path.join(BASE_DIR, "best.pt")   #Gets model "best.pt" from current directory
LAST_PATH = os.path.join(BASE_DIR, "last_annotated.jpg") #Path to the last annotated image

PORT = 40000 #Port to run api on

# -----------------------------------------------------------------------------
# Flask app + model
# -----------------------------------------------------------------------------

app = Flask(__name__) #Create flask application object
CORS(app) #Enable CORS so javascript can call it

print("Loading YOLO model...")
api_model = YOLO(MODEL_PATH) #Load YOLO model wusing weights from above model
print("Model loaded from:", MODEL_PATH)

# -----------------------------------------------------------------------------
# Detection helpers
# -----------------------------------------------------------------------------

FREE_LABELS = {"free", "open", "vacant", "empty", "available"}
OCC_LABELS  = {"occupied", "taken", "parked", "blocked"}


def draw_detections(img, result):
    """
    Draw bounding boxes on image.

    Parameters:
        img (numpy.ndarray) : OpenCV image array in BGR format
        result (ultralytics.engine.results.Results) : Yolo prediction results

    Returns:
        numpy.ndarray : Annotated image

    """
    #Get names and boxes from untralytics results
    names = result.names 
    boxes = result.boxes

    #Take all of the resulting data and iterate through them in parelled as triples
    for xyxy, cls, conf in zip(
        boxes.xyxy.cpu().numpy(),
        boxes.cls.cpu().numpy(),
        boxes.conf.cpu().numpy()
    ):
        x1, y1, x2, y2 = map(int, xyxy) #Convert coordinates to pixel positions
        lbl = names[int(cls)].lower() #Maps the class index to the class name

        if lbl in FREE_LABELS: #Check if the label is indicating a free space
            #Set the rectangle color to green with a thick border and condidence displayed
            color = (0, 200, 0) 
            thickness = 3
            txt = f"Free {conf:.2f}"

            #Calculate the dimensions for the label and the y coordinate for the top
            (tw, th), _ = cv2.getTextSize(
                txt, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2
            )
            y0 = max(0, y1 - th - 6)

            overlay = img.copy() #Copy current image to overlay
            cv2.rectangle(overlay, (x1, y0), (x1 + tw + 8, y1), color, -1) #Draw the rectangles with the given coordinates
            cv2.addWeighted(overlay, 0.35, img, 0.65, 0, img) #Blends the overlay with img to have a transparent overlay
            #Draws the label text onto img
            cv2.putText(
                img,
                txt,
                (x1 + 4, y1 - 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2,
            )
        #Mark any non free label with a thin red box
        else:
            color = (50, 50, 200)
            thickness = 1

        cv2.rectangle(img, (x1, y1), (x2, y2), color, thickness) #Draws the bounding boxes with the needed color, thickness, and position

    return img # return the annotated image


def count_spots(result):
    """
    Count free vs occupied spots using label sets above.
    
    Parameters:
        result (ultralytics.engine.results.Results) : YOLO prediction results

    Return:
        tuple[int, int] : [open_cnt, occ_cnt], number of free spots and occupied spots
    """
    names = result.names #Get the class index for name mapping again
    open_cnt = 0 #Count of open spots
    occ_cnt = 0 #Count of occupied spots

    for cls in result.boxes.cls.cpu().numpy().astype(int): #Loop over each class index
        lbl = names[int(cls)].lower() #Maps each class index to its class name

        #If the label is free, add to open count, otherwise add to occupied count
        if lbl in FREE_LABELS:
            open_cnt += 1
        elif lbl in OCC_LABELS:
            occ_cnt += 1

    return open_cnt, occ_cnt #Return open count and occupied count

@app.post("/detect")
def detect_route():
    """
    Register POST requests at path /detect.

    Return:
        flask.Response : {ok : bool; free : int; occupied : int; total : int; openCount : int; occupiedCount : int}
    """
    f = request.files.get("image") #Read uploaded file looking for an image
    if f is None:
        return jsonify(error='missing file field "image"'), 400

    data = f.read() #Reads the file as bytes 
    if not data:
        return jsonify(error="empty upload"), 400

    arr = np.frombuffer(data, np.uint8) #Create an array that views the raw image bytes without copying
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR) #Decode the array into an OpenCV image
    if img is None:
        return jsonify(error="decode failed (bad image bytes)"), 400


    result = api_model(img, conf=0.35, iou=0.50)[0] #Calls api model and stores results in "result"
    open_cnt, occ_cnt = count_spots(result) #Use results to get the open and occupied counts

    annotated = draw_detections(img.copy(), result) #Annotate image and store it in "annotated"
    cv2.imwrite(LAST_PATH , annotated) #Write annotated to the path at LAST_PATH

    total = open_cnt + occ_cnt #Compute total number of spots

    #Builds JSON indicating:
        #ok=True: Flag indicating success
        #free=open_cnt: Number of free spots
        #occupied=occ_cnt: Number of occupied spots
        #total=total: Total number of spots
        #openCount=open_cnt: number of free spots
        #occupiedCount=occc_cnt: number of occupied spots
    return jsonify(
        ok=True,
        free=open_cnt,
        occupied=occ_cnt,
        total=total,
        openCount=open_cnt,
        occupiedCount=occ_cnt,
    )


@app.get("/get_image")
def get_image():
    """
    Handles GET requests at /get-image

    Returns:
        On success:
            flask.Response : JPEG bytes containing annotated image.
        On failure:
            flask.Response : {"error" : "No image available"} and status 404
    """
    if not os.path.exists(LAST_PATH):
        return jsonify(error="No image available"), 404

    return send_file(LAST_PATH, mimetype="image/jpeg") #If the file at LAST_PATH exists, send it as HTTP with MIME type image/jpeg
 


@app.get("/status")
def status():
    """
    GET /status
    Simple health-check.

    Return:
        flask.response ; {status : str; model : str; classes : list[str]}
    """
    #Return JSON saying the api is running and the model that it is running on as status
    return jsonify(
        status="running",
        model=os.path.basename(MODEL_PATH),
        classes=api_model.names,
    )


if __name__ == "__main__":
    print(f"Starting Flask server on http://127.0.0.1:{PORT}") #Print where the flask server is starting
    app.run(host="127.0.0.1", port=PORT, threaded=True) #Start the flask server
