
import joblib
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Literal
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware

model=joblib.load('Mental_health_model.pkl')    #loading ML model



# ...--> required, le=less than equal to, ge=greater than equal to
#Pydantic model(data validation)
class studentdata(BaseModel):
    age                     : int = Field(..., ge=10, le=100)
    gender                  : Literal['Male', 'Female']
    country                 : str
    academic_level          : Literal['Undergraduate', 'Graduate', 'High School']
    most_used_platform      : Literal['Facebook', 'LinkedIn', 'Instagram', 'Snapchat','Twitter','YouTube', 'TikTok', 'LINE', 'KakaoTalk', 'VKontakte', 'WhatsApp','WeChat']
    purpose_of_use          : Literal['Networking', 'Education', 'Entertainment', 'News']
    avg_daily_usage_hours   : float = Field(..., ge=0, le=24)
    daily_unlocks           : int   = Field(..., ge=0)
    study_hours             : float = Field(..., ge=0, le=24)
    physical_activity_hours : float = Field(..., ge=0, le=24)
    sleep_hours_per_night   : float = Field(..., ge=0, le=24)
    stress_level            : Literal['Medium', 'Low', 'Very High', 'High']



app=FastAPI() #creating fastapi object

#corse: cross-origin resource sharing. used to link fastapi with UI(html,css,js)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get('/')  #adding info. on home page(/)
def info():
    return {'This is my Backend'}


top_countries=[
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
 'Spain']


#Pydantic model (validating predicted value by model) 
class Predicted_Response(BaseModel):
    predicted_mental_health_score:float



#creating prediction function
@app.post('/predict', response_model=Predicted_Response)
def predict(data: studentdata):   #data: object, studentdata: class
    
   
   country_group = data.country if data.country in top_countries else "Other"

   #converting input data from user into dataframe
   input_data = pd.DataFrame([{
        'Age'                       :data.age,
        'Gender'                    :data.gender,
        'Country'                   :data.country,
        'Academic_Level'            :data.academic_level,
        'Most_Used_Platform'        :data.most_used_platform,
        'Purpose_Of_Use'            :data.purpose_of_use,
        'Avg_Daily_Usage_Hours'     :data.avg_daily_usage_hours,
        'Daily_Unlocks'             :data.daily_unlocks,
        'Study_Hours'               :data.study_hours,
        'Physical_Activity_Hours'   :data.physical_activity_hours,
        'Sleep_Hours_Per_Night'     :data.sleep_hours_per_night,
        'Stress_Level'              :data.stress_level,
        'Grouped_country'           :country_group

    }])
   prediction=model.predict(input_data)[0] #predicting output from model.prediction 
   return Predicted_Response(predicted_mental_health_score=round(float(prediction),2))

   



    









