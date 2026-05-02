import os

BASE_DIR = r"c:\Users\andre\Downloads\Analytics Case Study"
RAW_DATA_DIR = os.path.join(BASE_DIR, "Analytics Case Study")
CLEANED_DATA_DIR = os.path.join(BASE_DIR, "data", "cleaned")
INTEGRATED_DATA_DIR = os.path.join(BASE_DIR, "data", "integrated")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
ANALYSIS_DIR = os.path.join(OUTPUTS_DIR, "analysis")
PRESENTATION_DIR = os.path.join(OUTPUTS_DIR, "presentation")

RAW_FILES = {
    "6sense_campaign": os.path.join(RAW_DATA_DIR, "Datathon_db_6sense_campaign_accounts.xlsx"),
    "ad_metrics": os.path.join(RAW_DATA_DIR, "Datathon_db_ad_metrics.xlsx"),
    "email": os.path.join(RAW_DATA_DIR, "Datathon_db_email_engagements_log.xlsx"),
    "web": os.path.join(RAW_DATA_DIR, "Datathon_db_web_engagements_log.xlsx"),
    "accounts": os.path.join(RAW_DATA_DIR, "Datathon_db_account_log.xlsx"),
    "opportunities": os.path.join(RAW_DATA_DIR, "Datathon_db_opportunity_log.xlsx"),
    "icp": os.path.join(RAW_DATA_DIR, "Datathon_db_icp_database_log.xlsx"),
    "segments": os.path.join(RAW_DATA_DIR, "Datathon_db_6sense_segments.xlsx"),
}

FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "aol.com", "icloud.com", "protonmail.com", "live.com",
}

INDUSTRY_NORMALIZATION = {
    "COMPUTER_SOFTWARE": "Software",
    "Computer Software": "Software",
    "Enterprise Software": "Software",
    "Software Development & Design": "Software",
    "software development & design": "Software",
    "IT Services": "IT Services",
    "It Services": "IT Services",
    "INFORMATION_TECHNOLOGY_AND_SERVICES": "IT Services",
    "Information Technology & Services": "IT Services",
    "information technology & services": "IT Services",
    "Managed Services": "Managed Services",
    "MARKETING_AND_ADVERTISING": "Marketing & Advertising",
    "Marketing & Advertising": "Marketing & Advertising",
    "marketing and advertising": "Marketing & Advertising",
    "HUMAN_RESOURCES": "Human Resources",
    "Human Resources": "Human Resources",
    "professional training & coaching": "Professional Services",
    "Professional Training & Coaching": "Professional Services",
    "Professional Services": "Professional Services",
    "PROFESSIONAL_TRAINING_AND_COACHING": "Professional Services",
    "Financial Services": "Financial Services",
    "FINANCIAL_SERVICES": "Financial Services",
    "Private Equity": "Private Equity",
    "Hardware": "Hardware",
    "INTERNET": "Internet",
    "Internet": "Internet",
    "STAFFING_AND_RECRUITING": "Staffing & Recruiting",
    "Staffing & Recruiting": "Staffing & Recruiting",
    "staffing and recruiting": "Staffing & Recruiting",
    "Telecommunications": "Telecommunications",
    "TELECOMMUNICATIONS": "Telecommunications",
    "Retail": "Retail",
    "RETAIL": "Retail",
    "Healthcare": "Healthcare",
    "HOSPITAL_AND_HEALTH_CARE": "Healthcare",
    "Hospital & Health Care": "Healthcare",
    "Education": "Education",
    "HIGHER_EDUCATION": "Education",
    "E-Learning": "Education",
    "Media": "Media",
    "MEDIA_PRODUCTION": "Media",
    "Media Production": "Media",
    "Consumer Goods": "Consumer Goods",
    "CONSUMER_GOODS": "Consumer Goods",
    "Insurance": "Insurance",
    "INSURANCE": "Insurance",
    "Real Estate": "Real Estate",
    "REAL_ESTATE": "Real Estate",
    "Automotive": "Automotive",
    "AUTOMOTIVE": "Automotive",
    "Logistics & Supply Chain": "Logistics",
    "LOGISTICS_AND_SUPPLY_CHAIN": "Logistics",
}

CHANNEL_LEADSOURCE_MAP = {
    "Marketing: 6sense": "6sense_display",
    "Marketing: 6sense Breakthrough 2023": "6sense_event",
    "Marketing: 6sense Breakthrough 2024": "6sense_event",
    "Channel Referral: 6sense": "6sense_channel",
    "Marketing: Event - 6sense 2022": "6sense_event",
    "Marketing: Event - 6Sense 2021": "6sense_event",
    "Marketing: MQA": "email_mqa",
    "Marketing: Website Inbound": "web_inbound",
    "Marketing: Forrester/6sense B2B 2023": "event",
    "Marketing: Gartner 2024": "event",
    "Marketing: GoTo/Francisco Partners Webinar 2024": "webinar",
    "Marketing: Pavilion CMO Summit 2024": "event",
    "Marketing: B2BSMX Event 2023": "event",
    "Marketing: Webinars": "webinar",
    "LinkedIn InMail - Hiring Marketers": "linkedin",
    "MQL - Webinar MaaS": "webinar",
    "Marketing: Marketo": "email_mqa",
    "Marketing: Other": "other_marketing",
    "Marketing: Event - Forrester B2B 2022": "event",
    "Marketing: Pavilion GTM 2023 Event": "event",
    "Marketing: Mops-apalooza 2023": "event",
    "Existing Client": "existing_client",
    "Referral: Client": "referral",
    "Referral: Partner": "referral",
    "Sales Prospecting": "sales",
    "Cold Call": "sales",
    "Sales: Outbound": "sales",
    "Outbound": "sales",
    "Web Inbound": "web_inbound",
}

MARKETING_CHANNELS = {
    "6sense_display", "6sense_event", "6sense_channel",
    "email_mqa", "web_inbound", "event", "webinar",
    "linkedin", "other_marketing",
}

BRAND_COLORS = [
    "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728",
    "#9467BD", "#8C564B", "#E377C2", "#7F7F7F",
    "#BCBD22", "#17BECF",
]

CHANNEL_COLOR_MAP = {
    "6sense_display": "#1F77B4",
    "6sense_event": "#AEC7E8",
    "6sense_channel": "#6BAED6",
    "email_mqa": "#FF7F0E",
    "web_inbound": "#2CA02C",
    "event": "#D62728",
    "webinar": "#E377C2",
    "linkedin": "#0077B5",
    "sales": "#7F7F7F",
    "referral": "#BCBD22",
    "existing_client": "#17BECF",
    "other_marketing": "#9467BD",
}
