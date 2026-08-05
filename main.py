import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Compatibility shim.
#
# Mental_health_model.pkl was pickled with scikit-learn 1.6.x, which stored a
# private helper class called _RemainderColsList inside the ColumnTransformer.
# scikit-learn 1.7 deleted that class, so unpickling on any newer version dies
# with "no attribute '_RemainderColsList'" before the app can even start.
#
# Recreating a stand-in under the same name gives the unpickler something to
# bind to. The class is only a list subclass used to track passthrough columns,
# and this pipeline drops the remainder anyway, so nothing is lost.
#
# This is a patch, not a fix. The real fix is to re-run joblib.dump() in the
# notebook on the scikit-learn version you deploy with, then delete this block.
# ---------------------------------------------------------------------------
import sklearn
import sklearn.compose._column_transformer as _ct

if not hasattr(_ct, '_RemainderColsList'):
    class _RemainderColsList(list):
        pass
    _ct._RemainderColsList = _RemainderColsList

print(f"scikit-learn version in use: {sklearn.__version__}")

model = joblib.load('Mental_health_model.pkl')    # loading ML model
print("Model loaded successfully.")

# ...--> required, le=less than equal to, ge=greater than equal to
# Pydantic model (data validation)
class studentdata(BaseModel):
    age                     : int = Field(..., ge=10, le=100)
    gender                  : Literal['Male', 'Female']
    country                 : str
    academic_level          : Literal['Undergraduate', 'Graduate', 'High School']
    most_used_platform      : Literal['Facebook', 'LinkedIn', 'Instagram', 'Snapchat', 'Twitter', 'YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp', 'WeChat']
    purpose_of_use          : Literal['Networking', 'Education', 'Entertainment', 'News']
    avg_daily_usage_hours   : float = Field(..., ge=0, le=24)
    daily_unlocks           : int   = Field(..., ge=0)
    study_hours             : float = Field(..., ge=0, le=24)
    physical_activity_hours : float = Field(..., ge=0, le=24)
    sleep_hours_per_night   : float = Field(..., ge=0, le=24)
    stress_level            : Literal['Medium', 'Low', 'Very High', 'High']


app = FastAPI()   # creating fastapi object

# cors: cross-origin resource sharing. used to link fastapi with UI(html,css,js)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get('/')   # adding info. on home page(/)
def info():
    return {'This is my Backend'}


top_countries = [
    'Other',
    'India',
    'USA',
    'Canada',
    'Australia',
    'UK',
    'Germany',
    'Mexico',
    'Turkey',
    'France',
    'Spain'
]


# Pydantic model (validating predicted value by model)
class Predicted_Response(BaseModel):
    predicted_mental_health_score: float


# creating prediction function
@app.post('/predict', response_model=Predicted_Response)
def predict(data: studentdata):   # data: object, studentdata: class

    country_group = data.country if data.country in top_countries else "Other"

    # converting input data from user into dataframe
    input_data = pd.DataFrame([{
        'Age'                       : data.age,
        'Gender'                    : data.gender,
        'Country'                   : data.country,
        'Academic_Level'            : data.academic_level,
        'Most_Used_Platform'        : data.most_used_platform,
        'Purpose_Of_Use'            : data.purpose_of_use,
        'Avg_Daily_Usage_Hours'     : data.avg_daily_usage_hours,
        'Daily_Unlocks'             : data.daily_unlocks,
        'Study_Hours'               : data.study_hours,
        'Physical_Activity_Hours'   : data.physical_activity_hours,
        'Sleep_Hours_Per_Night'     : data.sleep_hours_per_night,
        'Stress_Level'              : data.stress_level,

        # FIX: the trained pipeline expects this exact column name.
        # It was 'Grouped_country', which made every /predict call raise
        # ValueError: columns are missing: {'grouped_countries'}
        'grouped_countries'         : country_group
    }])

    # Raising HTTPException instead of letting the error escape means the
    # response still carries CORS headers, so the browser shows the real
    # message instead of reporting it as a network failure.
    try:
        prediction = model.predict(input_data)[0]
    except Exception as exc:
        print("Prediction failed:", exc)
        raise HTTPException(status_code=500, detail=f"Model error: {exc}")

    return Predicted_Response(
        predicted_mental_health_score=round(float(prediction), 2)
    )
