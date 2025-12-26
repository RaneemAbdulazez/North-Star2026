import streamlit as st
import firebase_admin
from firebase_admin import credentials, firestore

@st.cache_resource
def get_db():
    if not firebase_admin._apps:
        # Load credentials from Streamlit secrets
        # Expects st.secrets["firebase"] to look like the service account JSON
        key_dict = dict(st.secrets["firebase"])
        
        cred = credentials.Certificate(key_dict)
        firebase_admin.initialize_app(cred)
        
    db = firestore.client()
    return db
