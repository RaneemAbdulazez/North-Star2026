import streamlit as st
from db_config import get_db
from firebase_admin import firestore

def seed_data():
    st.title("Database Seeder")
    
    if st.button("Seed Database"):
        try:
            db = get_db()
            
            # Define the data structure
            pillars = {
                "The Cleanup (Debt)": [
                    {"name": "WeSecure & Privacy Policy", "target": "Clear in Jan"},
                    {"name": "Tech Debt Removal", "target": "Email/Invoice fix"}
                ],
                "The Growth Engine": [
                    {"name": "Marla Course Launch", "target": "Feb Launch"},
                    {"name": "LinkedIn Personal Brand", "target": "Daily Content"}
                ],
                "The Vertical (Finance Niche)": [
                    {"name": "Finance Studies", "target": "College/Courses"},
                    {"name": "Financial Offer V1", "target": "Design & Pilot"}
                ]
            }
            
            progress_text = "Operation in progress. Please wait..."
            my_bar = st.progress(0, text=progress_text)
            
            total_steps = len(pillars)
            current_step = 0
            
            for pillar_name, projects in pillars.items():
                # Create Pillar document
                # Using Set to avoid duplicates if run multiple times, but overwrite fields
                db.collection("pillars").document(pillar_name).set({
                    "name": pillar_name,
                    "created_at": firestore.SERVER_TIMESTAMP
                })
                st.write(f"**Pillar:** {pillar_name} created/updated.")
                
                for project in projects:
                    # Create Project document
                    # Using add() because we don't have a unique ID for projects specified, 
                    # but if we wanted to avoid dupes we might query first. 
                    # For simple seeding, add() is fine, but running twice will duplicate projects.
                    # User constraint: "Use the Pillar Name as the Document ID". implicit for pillar.
                    # For projects, generic add is typical unless names are unique keys.
                    
                    project_data = {
                        "name": project["name"],
                        "target": project["target"],
                        "pillar_id": pillar_name,
                        "total_hours_budget": 100,  # Default placeholder
                        "created_at": firestore.SERVER_TIMESTAMP
                    }
                    
                    db.collection("projects").add(project_data)
                    st.write(f"- Project: {project['name']} added.")
                
                current_step += 1
                my_bar.progress(current_step / total_steps, text=progress_text)
                
            my_bar.empty()
            st.success("Database seeded successfully!")
            
        except Exception as e:
            st.error(f"An error occurred: {e}")

if __name__ == "__main__":
    seed_data()
