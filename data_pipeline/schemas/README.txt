INFLUENCER IMPACT & ROI ESTIMATOR - FIRST REVIEW TECHNICAL DRAFT

This folder contains proposed design artifacts, NOT proof of a trained model or deployed system.

Files:
- engagement_event.proto : proposed Protobuf message definition
- sample_event.json : illustrative engagement event corresponding to the presentation
- sample_prediction.json : illustrative campaign forecast and ROI calculations

Data flow planned:
Engagement/campaign sources -> schema validation + Kafka ingestion -> Redis features
-> NLP sentiment and network/engagement features -> XGBoost regression
-> CPC/ROI computation -> FastAPI -> comparison dashboard.

Worked example:
Reach 310000, CTR 3.8% = 11780 estimated clicks/visits (simplifying assumption).
259 purchases * $120 price = $31080 gross revenue.
ROI = (($31080 - $10000)/$10000) * 100 = 210.8%.
CPC on assumed clicks = $10000 / 11780 = approximately $0.85.

Next steps: dataset acquisition, data-quality analysis, baseline training, time-aware test split,
XGBoost evaluation (MAE/RMSE/R2), API/dashboard integration.
