import streamlit as st
import pandas as pd
import datetime
import time
import re
import json
import plotly.express as px
import google.generativeai as genai
from db_config import get_db
from firebase_admin import firestore

# --- Helper Functions ---
@st.cache_data(ttl=600)
def get_projects():
    """Fetches all projects from Firestore and returns a dict mapping Name -> ID."""
    db = get_db()
    projects_ref = db.collection("projects")
    docs = projects_ref.stream()
    
    project_map = {}
    for doc in docs:
        data = doc.to_dict()
        if "name" in data:
            project_map[data["name"]] = doc.id
            
    return project_map

@st.cache_data(ttl=3600)
def get_pillars():
    """Fetches all pillars from Firestore."""
    db = get_db()
    pillars_ref = db.collection("pillars").stream()
    pillars = []
    for doc in pillars_ref:
        d = doc.to_dict()
        pillars.append(d.get("name", doc.id))
    return pillars

@st.cache_data(ttl=600)
def get_all_data():
    """Fetches Logs, Projects, and Pillars for the Dashboard."""
    db = get_db()
    
    # 1. Fetch Projects
    projects_ref = db.collection("projects").stream()
    projects_data = {}
    for doc in projects_ref:
        d = doc.to_dict()
        projects_data[doc.id] = {
            "project_name": d.get("name"),
            "pillar_id": d.get("pillar_id"),
            "budget": d.get("total_hours_budget", 0),
            "status": d.get("status", "Active"),
            "quarter": d.get("quarter", "Top Priority"), # Default if missing
            "visibility": d.get("visibility", True) # Default Visible
        }
        
    # 2. Fetch Work Logs
    logs_ref = db.collection("work_logs").order_by("date", direction=firestore.Query.DESCENDING).stream()
    logs_list = []
    for doc in logs_ref:
        d = doc.to_dict()
        if d.get("date"):
            d["date"] = d["date"]
        # Add doc ID for deletion
        d["id"] = doc.id 
        logs_list.append(d)
        
    df_logs = pd.DataFrame(logs_list)
    
    # 3. Merge Data
    if not df_logs.empty and projects_data:
        df_logs["pillar_id"] = df_logs["project_id"].map(lambda x: projects_data.get(x, {}).get("pillar_id", "Unknown"))
    
    return df_logs, projects_data

def get_todays_logs():
    """Fetches work logs for the current date."""
    db = get_db()
    today = datetime.datetime.now().date()
    start_of_day = datetime.datetime.combine(today, datetime.time.min)
    end_of_day = datetime.datetime.combine(today, datetime.time.max)
    
    logs_ref = db.collection("work_logs")
    query = logs_ref.where(
        field_path="date", op_string=">=", value=start_of_day
    ).where(
        field_path="date", op_string="<=", value=end_of_day
    ).order_by(
        "date", direction=firestore.Query.DESCENDING
    ).stream()

    logs_data = []
    for doc in query:
        logs_data.append(doc.to_dict())
        
    return pd.DataFrame(logs_data)

def get_active_session():
    """Checks for an active session in Firestore."""
    db = get_db()
    doc_ref = db.collection("active_sessions").document("current_session")
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        # Ensure timestamp is datetime aware
        if 'start_time' in data and data['start_time']:
             pass
        return data
    return None

def start_session(project_name, project_id):
    """Creates an active session in Firestore."""
    db = get_db()
    db.collection("active_sessions").document("current_session").set({
        "project_name": project_name,
        "project_id": project_id,
        "start_time": firestore.SERVER_TIMESTAMP
    })

def discard_session():
    """Deletes the active session."""
    db = get_db()
    db.collection("active_sessions").document("current_session").delete()

def save_and_clear_session(project_id, project_name, hours, focus_score, log_date):
    """Transaction to save log and delete active session."""
    db = get_db()
    batch = db.batch()
    
    # 1. Create Work Log
    log_ref = db.collection("work_logs").document()
    log_entry = {
         "project_id": project_id,
         "project_name": project_name,
         "hours": hours,
         "focus_score": focus_score,
         "date": log_date,
         "created_at": firestore.SERVER_TIMESTAMP
    }
    batch.set(log_ref, log_entry)
    
    # 2. Delete Active Session
    session_ref = db.collection("active_sessions").document("current_session")
    batch.delete(session_ref)
    
    batch.commit()

def get_current_quarter_str():
    """Returns 'Q1-2025', etc."""
    today = datetime.date.today()
    q = (today.month - 1) // 3 + 1
    return f"Q{q}-{today.year}"

def render_donut_chart(value, total, color="green"):
    """Generates a simple SVG Donut Chart."""
    if total > 0:
        pct = (value / total) * 100
    else:
        pct = 0
    
    # Cap at 100 for the circle stroke, but text shows real
    stroke_pct = min(pct, 100)
    dash_array = f"{stroke_pct}, 100"
    
    # Colors
    colors = {
        "green": "#4CAF50",
        "orange": "#FF9800",
        "red": "#F44336",
        "grey": "#444"
    }
    c = colors.get(color, "#4CAF50")
    
    svg = f"""
    <svg viewBox="0 0 36 36" class="circular-chart" style="max-height: 100px; max-width: 100px;">
      <path class="circle-bg"
        d="M18 2.0845
          a 15.9155 15.9155 0 0 1 0 31.831
          a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none" stroke="{colors['grey']}" stroke-width="3" stroke-opacity="0.2"
      />
      <path class="circle"
        stroke-dasharray="{dash_array}"
        d="M18 2.0845
          a 15.9155 15.9155 0 0 1 0 31.831
          a 15.9155 15.9155 0 0 1 0 -31.831"
        fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round"
      />
      <text x="18" y="20.35" class="percentage" text-anchor="middle" fill="white" font-size="8px" font-weight="bold">{int(pct)}%</text>
    </svg>
    """
    return svg

def render_dashboard():
    st.title("Strategic Dashboard 📊")
    st.caption("Quarterly Focus: " + get_current_quarter_str())
    
    df_logs, projects_data = get_all_data()
    
    # --- Top KPIs (Daily & Weekly) ---
    now = datetime.datetime.now(datetime.timezone.utc)
    today = datetime.date.today()
    start_week = today - datetime.timedelta(days=today.weekday())
    start_week_dt = datetime.datetime.combine(start_week, datetime.time.min).replace(tzinfo=datetime.timezone.utc)
    
    if not df_logs.empty:
        df_logs['date'] = pd.to_datetime(df_logs['date'], utc=True)
        # Weekly
        mask_this_week = df_logs['date'] >= pd.Timestamp(start_week_dt)
        df_this_week = df_logs[mask_this_week]
        weekly_hours = df_this_week['hours'].sum()
        
        # Daily
        mask_today = df_logs['date'].dt.date == today
        df_today = df_logs[mask_today]
        daily_hours = df_today['hours'].sum()
        
        col1, col2, col3 = st.columns(3)
        col1.metric("Today's Output", f"{daily_hours:.1f}h", "Focus")
        col2.metric("Weekly Deep Work", f"{weekly_hours:.1f}h", "Target: 20h")
        
        avg_focus = df_this_week['focus_score'].mean()
        col3.metric("Avg Focus (Week)", f"{avg_focus:.1f}/5.0" if not pd.isna(avg_focus) else "N/A")
    else:
        st.info("No logs yet.")

    st.divider()
    
    # --- Visibility Controls ---
    with st.expander("👁️ Project Visibility & Filters"):
        show_all = st.checkbox("Show All Quarters (Override Smart Filter)", value=False)
    
    # --- Project Cards Section ---
    st.subheader("🚀 Active Projects")
    
    # Structure Data for Cards
    project_stats = {}
    if not df_logs.empty:
        project_stats = df_logs.groupby("project_id")['hours'].sum().to_dict()
    
    # Filter Logic
    curr_q = get_current_quarter_str()
    filtered_projects = {}
    
    for pid, data in projects_data.items():
        # 1. Status Check
        if data.get("status") == "Completed": continue
        
        # 2. Visibility Check (Manual Override)
        is_visible = data.get("visibility", True)
        
        # 3. Quarterly Check
        proj_q = data.get("quarter", "Top Priority")
        is_current_q = (proj_q == curr_q) or (proj_q == "Top Priority")
        
        # Logic: Show if (Visible AND Current Q) OR (Show All is checked)
        # Actually user requirement: "Allow user to manually Toggle Visibility... overriding quarterly logic"
        # So if visibility is False, hide it. If True, check Quarter unless Show All.
        if not is_visible: continue
        
        if show_all or is_current_q:
            filtered_projects[pid] = data

    # Grid Layout (3 columns)
    if not filtered_projects:
        st.info(f"No active projects found for {curr_q}. Check 'Settings' to add one or toggle 'Show All'.")
    else:
        cols = st.columns(3)
        for idx, (pid, pdata) in enumerate(filtered_projects.items()):
            spent = project_stats.get(pid, 0.0)
            budget = pdata['budget']
            name = pdata['project_name']
            pillar = pdata['pillar_id']
            
            # Calculate Progress
            progress = spent / budget if budget > 0 else 0
            
            # Determine Color
            bar_color = "green"
            if progress > 1.0:
                bar_color = "red"
            elif progress > 0.8:
                bar_color = "orange"
                
            with cols[idx % 3]:
                with st.container(border=True):
                    # Horizontal Layout: Text Left, Donut Right
                    c_txt, c_chart = st.columns([2, 1])
                    with c_txt:
                        st.markdown(f"**{name}**")
                        st.caption(f"{pillar}")
                        st.caption(f"{spent:.1f} / {budget} hrs")
                        if progress > 1.0:
                            st.error(f"+{(spent-budget):.1f}h")
                    with c_chart:
                        st.markdown(render_donut_chart(spent, budget, bar_color), unsafe_allow_html=True)

    st.divider()
    
    # --- Activity Trend ---
    st.subheader("📈 30-Day Activity")
    last_30 = pd.Timestamp.now(tz='UTC') - pd.Timedelta(days=30)
    df_chart = df_logs[df_logs['date'] >= last_30].copy() if not df_logs.empty else pd.DataFrame()
    
    if not df_chart.empty:
        df_chart['day'] = df_chart['date'].dt.date
        daily_data = df_chart.groupby(['day', 'pillar_id'])['hours'].sum().reset_index()
        fig = px.bar(daily_data, x='day', y='hours', color='pillar_id', title="Deep Work by Pillar", height=350)
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.write("No recent activity.")

def get_strategic_context():
    """Generates a context string for the AI Coach."""
    df_logs, _ = get_all_data()
    active_session = get_active_session()
    
    # Current Week Stats
    now = datetime.datetime.now(datetime.timezone.utc)
    today = datetime.date.today()
    start_week = today - datetime.timedelta(days=today.weekday())
    start_week_dt = datetime.datetime.combine(start_week, datetime.time.min).replace(tzinfo=datetime.timezone.utc)
    
    weekly_hours = 0
    debt_hours = 0
    top_project = "None"
    
    if not df_logs.empty:
        df_logs['date'] = pd.to_datetime(df_logs['date'], utc=True)
        mask_this_week = df_logs['date'] >= pd.Timestamp(start_week_dt)
        df_this_week = df_logs[mask_this_week]
        
        weekly_hours = df_this_week['hours'].sum()
        debt_hours = df_logs[df_logs['pillar_id'].str.contains("Debt", case=False, na=False)]['hours'].sum()
        if not df_this_week.empty:
            top_project = df_this_week.groupby("project_name")['hours'].sum().idxmax()
            
    is_working = "Yes, on " + active_session['project_name'] if active_session else "No"
    
    context = f"""
    - **Current Week Deep Work:** {weekly_hours:.1f} hours (Target: 20h).
    - **Total Debt Clearance:** {debt_hours:.1f} hours.
    - **Top Project This Week:** {top_project}.
    - **Currently Working?** {is_working}.
    """
    return context

def render_strategy_tab():
    st.title("Strategy Map 🗺️")
    st.caption("North Star 2026")
    
    st.markdown("## 🌟 **Vision**")
    st.markdown("> ### To become the #1 AI for Finance Expert for Mid-sized companies, backed by academic depth and strategic partnerships.")
    st.divider()

    st.subheader("The 3 Pillars of Execution")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.info("**Pillar 1: The Cleanup (Debt)**")
        st.markdown("- Clear Debt (WeSecure, Privacy).\n- **No new WIP until cleared.**")
    with col2:
        st.success("**Pillar 2: The Growth Engine**")
        st.markdown("- Marla Course Launch.\n- LinkedIn Personal Brand.")
    with col3:
        st.info("**Pillar 3: The Vertical**")
        st.markdown("- Finance Studies.\n- High-Ticket Finance Offer V1.")
    st.divider()

    with st.expander("📅 Quarterly Roadmap (2026)", expanded=True):
        tab1, tab2, tab3, tab4 = st.tabs(["Q1: Cleanup & Launch", "Q2: Foundation", "Q3: Sales", "Q4: Scale"])
        with tab1:
            st.subheader("Q1: Cleanup & Launch")
            st.write("**Focus:** Tech Debt & Course Launch (MVP). KPI: 10 Course Sales.")
        with tab2:
            st.subheader("Q2: Foundation")
            st.write("**Focus:** Finance Studies & Offer V1. KPI: $2k Passive Income.")
        with tab3:
            st.subheader("Q3: Sales")
            st.write("**Focus:** High-Ticket Sales. KPI: $6k/mo.")
        with tab4:
            st.subheader("Q4: Scale")
            st.write("**Focus:** Sustainability. KPI: $10k/mo.")
    st.divider()

    st.error("❌ **The 'NOT-TO-DO' List**")
    st.markdown("""
    - ❌ Start new project before finishing old ones.
    - ❌ Change Niche (Stay in AI for Finance).
    - ❌ Barter deals.
    - ❌ Work on Weekends.
    - ❌ Social Media before 12 PM.
    """)

def render_quarterly_dashboard():
    st.title("Quarterly Performance 📈")
    st.caption("Plan vs. Execution (2026)")
    
    df_logs, _ = get_all_data()
    if not df_logs.empty:
         df_logs['date'] = pd.to_datetime(df_logs['date'], utc=True)
         
    now = datetime.datetime.now(datetime.timezone.utc)
    
    q1, q2, q3, q4 = st.tabs(["Q1: Cleanup", "Q2: Foundation", "Q3: Sales", "Q4: Scale"])
    
    quarters = {
        "Q1": {"tab": q1, "start": "2026-01-01", "end": "2026-03-31", "goals": "Goals: Clear Tech Debt + Launch Course.\nKPIs: 10 Sales.", "budget": 480},
        "Q2": {"tab": q2, "start": "2026-04-01", "end": "2026-06-30", "goals": "Goals: Finance Studies + Offer Design.\nKPIs: Offer Deck Ready.", "budget": 480},
         "Q3": {"tab": q3, "start": "2026-07-01", "end": "2026-09-30", "goals": "Goals: High-Ticket Sales System.\nKPIs: $6k/mo MRR.", "budget": 480},
         "Q4": {"tab": q4, "start": "2026-10-01", "end": "2026-12-31", "goals": "Goals: Sustainability.\nKPIs: $10k/mo MRR.", "budget": 480}
    }
    
    for q_name, q_data in quarters.items():
        with q_data["tab"]:
            start_dt = pd.Timestamp(q_data["start"]).replace(tzinfo=datetime.timezone.utc)
            end_dt = pd.Timestamp(q_data["end"]).replace(tzinfo=datetime.timezone.utc)
            
            if start_dt <= now <= end_dt:
                st.success("📍 **We Are Here**")
            
            if not df_logs.empty:
                mask = (df_logs['date'] >= start_dt) & (df_logs['date'] <= end_dt)
                df_q = df_logs[mask]
            else:
                df_q = pd.DataFrame()
                
            total_hours = df_q['hours'].sum() if not df_q.empty else 0
            completion_rate = (total_hours / q_data['budget']) * 100
            most_active = df_q.groupby("project_name")['hours'].sum().idxmax() if not df_q.empty else "N/A"
            
            col_m1, col_m2, col_m3 = st.columns(3)
            col_m1.metric("Total Hours", f"{total_hours:.1f}", f"Target: {q_data['budget']}")
            col_m2.metric("Most Active", most_active)
            col_m3.metric("Completion Rate", f"{completion_rate:.1f}%")
            
            st.divider()
            col_left, col_right = st.columns(2)
            with col_left:
                st.subheader("The Strategy (Plan)")
                st.info(q_data['goals'])
                st.markdown(f"**Budget:** {q_data['budget']} Hours")
            with col_right:
                st.subheader("The Execution (Reality)")
                if not df_q.empty:
                    fig = px.pie(df_q, values='hours', names='project_name', title=f"{q_name} Hours Distribution")
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.warning("No data logged for this period yet.")

def render_ai_coach():
    st.title("AI Business Strategist 🤖")
    st.caption("Your Ruthless CFO & Strategy Coach")

    if "GOOGLE_API_KEY" in st.secrets:
        genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
    else:
        st.error("Missing Google API Key in secrets.")
        return

    if "messages" not in st.session_state:
        st.session_state.messages = []

    def is_arabic(text):
        if text and re.search(r'[\u0600-\u06FF]', text):
            return True
        return False

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            content = message["content"]
            if is_arabic(content):
                st.markdown(f'<div dir="rtl" style="text-align: right;">{content}</div>', unsafe_allow_html=True)
            else:
                st.markdown(content)

    if prompt := st.chat_input("Ask for strategic advice..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            if is_arabic(prompt):
                 st.markdown(f'<div dir="rtl" style="text-align: right;">{prompt}</div>', unsafe_allow_html=True)
            else:
                 st.markdown(prompt)

        with st.chat_message("assistant"):
            try:
                context = get_strategic_context()
                system_instruction = f"""
                You are an Elite Business Strategist for an AI Founder.
                Current Context: {context}.
                Rules:
                - Be direct and ruthless (CFO persona).
                - This is the founders North Star: "To become the #1 AI for Finance Expert for Mid-sized companies".
                - If 'Deep Work' is low (< 20h), scold them.
                - If they ask about 'New Tools' or new ideas, remind them of the 'No New WIP' rule and 'The Cleanup' pillar.
                - **FORMATTING:** Use numbered lists (1., 2., 3.) for advice. Use bolding for emphasis. Ensure there are line breaks between points.
                - **LANGUAGE ADAPTABILITY:** Detect the language of the user's input. If the user speaks Arabic, reply in Arabic. If English, reply in English.
                """
                
                model = genai.GenerativeModel('gemini-2.5-flash', system_instruction=system_instruction)
                
                chat = model.start_chat(history=[
                    {"role": "user" if m["role"] == "user" else "model", "parts": [m["content"]]}
                    for m in st.session_state.messages[:-1]
                ])
                
                response = chat.send_message(prompt, stream=True)
                
                placeholder = st.empty()
                full_response_text = ""
                
                for chunk in response:
                    text_chunk = chunk.text
                    full_response_text += text_chunk
                    
                    if is_arabic(full_response_text):
                        formatted_text = full_response_text.replace('\n', '<br>')
                        placeholder.markdown(f'<div dir="rtl" style="text-align: right;">{formatted_text}</div>', unsafe_allow_html=True)
                    else:
                        placeholder.markdown(full_response_text)
                
                st.session_state.messages.append({"role": "assistant", "content": full_response_text})
                
            except Exception as e:
                st.error(f"AI Error: {e}")

def render_settings_tab():
    st.title("Settings ⚙️")
    st.caption("Manage Projects & Fix Logs")
    
    db = get_db()
    
    # --- Section 1: Project Management (CRUD) ---
    with st.expander("📂 Manage Projects"):
        tab_add, tab_edit = st.tabs(["Add New Project", "Edit Existing"])
        
        with tab_add:
            st.subheader("Add New Project")
            st.caption("✋ Projects require Strategic AI Approval")
            
            # Input Fields
            with st.container():
                new_proj_name = st.text_input("Project Name")
                # Get pillars via helper
                pillars = get_pillars()
                selected_pillar = st.selectbox("Select Pillar", pillars)
                new_budget = st.number_input("Budget (Hours)", min_value=1, value=100)
                # Justification below
                
                # Config
                col_c, col_v = st.columns(2)
                with col_c:
                    quarters = ["Top Priority", "Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025", "Q1-2026"]
                    selected_quarter = st.selectbox("Quarter", quarters)
                with col_v:
                    is_visible = st.toggle("Visible on Dashboard", value=True)
                
                justification = st.text_area("Justification (Why this? Why now?)")
                
            # Audit Action
            if st.button("🕵️ Audit Strategy Alignment"):
                if not new_proj_name or not justification:
                    st.error("Please provide both a Project Name and Justification.")
                else:
                    with st.spinner("Consulting the Investment Committee..."):
                        try:
                            # 1. Get Context
                            context_str = get_strategic_context()
                            
                            # 2. Construct Prompt (Previous logic...)
                            system_instruction = f"""
                            You are a ruthless Investment Committee member for an AI Founder.
                            Current Strategic Context: {context_str}
                            
                            Your Goal: Prevent Scope Creep.
                            
                            Rules for Approval:
                            1. REJECT if 'The Cleanup (Debt)' hours are low but they want to add new features unrelated to debt.
                            2. REJECT if the project is generic (e.g., 'Learn AI') instead of specific execution.
                            3. REJECT if it violates the 'No New WIP' rule (unless it's critical debt fixing).
                            4. APPROVE only if it directly contributes to: "AI for Finance Expert for Mid-sized companies" OR clearing Tech Debt.
                            
                            Output Format: JSON only.
                            {{
                                "status": "APPROVED" or "REJECTED",
                                "reason": "Short, ruthless explanation."
                            }}
                            """
                            
                            user_proposal = f"""
                            Propsoal:
                            Project: {new_proj_name}
                            Pillar: {selected_pillar}
                            Hours: {new_budget}
                            Justification: {justification}
                            """
                            
                            # 3. Call Gemini
                            model = genai.GenerativeModel('gemini-2.5-flash', system_instruction=system_instruction, generation_config={"response_mime_type": "application/json"})
                            response = model.generate_content(user_proposal)
                            result = json.loads(response.text)
                            
                            # 4. Save to State
                            st.session_state['audit_result'] = result
                            st.session_state['audit_payload'] = {
                                "name": new_proj_name,
                                "pillar_id": selected_pillar,
                                "total_hours_budget": new_budget,
                                "status": "Active",
                                "quarter": selected_quarter,
                                "visibility": is_visible,
                                "created_at": firestore.SERVER_TIMESTAMP
                            }
                            
                        except Exception as e:
                            st.error(f"Audit Failed: {e}")
            
            # Display Result & Confirm Button (Same as before)
            if 'audit_result' in st.session_state:
                result = st.session_state['audit_result']
                
                if result['status'] == 'APPROVED':
                    st.success(f"✅ **APPROVED:** {result['reason']}")
                    
                    if st.button("🚀 Confirm & Add to Database"):
                        try:
                            payload = st.session_state['audit_payload']
                            db.collection("projects").add(payload)
                            st.success(f"Project '{payload['name']}' created!")
                            # Clear State
                            del st.session_state['audit_result']
                            if 'audit_payload' in st.session_state: del st.session_state['audit_payload']
                            
                            get_projects.clear() 
                            get_all_data.clear()
                            time.sleep(1)
                            st.rerun()
                        except Exception as e:
                            st.error(f"Error: {e}")
                            
                else:
                    st.error(f"🚫 **REJECTED:** {result['reason']}")
                    st.warning("You cannot add this project. Focus on your North Star.")
                    # Option to clear state to try again
                    if st.button("Reset Form"):
                        del st.session_state['audit_result']
                        st.rerun()
                        
        with tab_edit:
            st.subheader("Edit Project")
            project_map = get_projects()
            if project_map:
                edit_proj_name = st.selectbox("Select Project to Edit", list(project_map.keys()))
                proj_id = project_map[edit_proj_name]
                
                # Fetch current details (can optimize by storing more in project_map, but one read is fine)
                doc = db.collection("projects").document(proj_id).get()
                if doc.exists:
                    curr_data = doc.to_dict()
                    curr_budget = curr_data.get("total_hours_budget", 100)
                    curr_status = curr_data.get("status", "Active")
                    curr_q = curr_data.get("quarter", "Top Priority")
                    curr_vis = curr_data.get("visibility", True)
                    
                    with st.form("edit_project_form"):
                        updated_budget = st.number_input("Update Budget (Hours)", min_value=1, value=curr_budget)
                        updated_status = st.selectbox("Status", ["Active", "Completed", "On Hold"], index=["Active", "Completed", "On Hold"].index(curr_status) if curr_status in ["Active", "Completed", "On Hold"] else 0)
                        
                        col1, col2 = st.columns(2)
                        with col1:
                            quarters = ["Top Priority", "Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025", "Q1-2026"]
                            updated_q = st.selectbox("Quarter", quarters, index=quarters.index(curr_q) if curr_q in quarters else 0)
                        with col2:
                             updated_vis = st.toggle("Visible", value=curr_vis)

                        if st.form_submit_button("Update Project"):
                            db.collection("projects").document(proj_id).update({
                                "total_hours_budget": updated_budget,
                                "status": updated_status,
                                "quarter": updated_q,
                                "visibility": updated_vis
                            })
                            st.success("Project updated!")
                            get_all_data.clear()
                            time.sleep(1)
                            st.rerun()
                        
                        with col2:
                            # Handling delete specifically
                            pass 
                    
                    # Delete outside form to avoid nested button issues or use a separate button with logic
                    st.divider()
                    st.warning("Danger Zone")
                    if st.button("Delete Project 🗑️", key="del_proj"):
                         db.collection("projects").document(proj_id).delete()
                         st.success(f"Project deleted.")
                         get_projects.clear()
                         get_all_data.clear()
                         time.sleep(1)
                         st.rerun()
            else:
                st.info("No projects found.")

    # --- Section 2: Log Correction ---
    with st.expander("🛠️ Fix Logs (Undo)", expanded=True):
        st.subheader("Last 5 Work Logs")
        
        # We need the ID to delete, so we fetch normally
        logs_ref = db.collection("work_logs").order_by("created_at", direction=firestore.Query.DESCENDING).limit(5).stream()
        
        logs = []
        for doc in logs_ref:
            d = doc.to_dict()
            d['id'] = doc.id
            logs.append(d)
            
        if logs:
            for log in logs:
                col1, col2, col3, col4 = st.columns([2, 1, 1, 1])
                with col1:
                    st.write(f"**{log.get('project_name', 'Unknown')}**")
                    if 'date' in log:
                         # Format date safely
                         val = log['date']
                         # If it's a timestamp object, it has strftime
                         # If string, just show
                         ts_str = str(val)
                         st.caption(ts_str)
                with col2:
                    st.write(f"{log.get('hours', 0)}h")
                with col3:
                    st.write(f"Focus: {log.get('focus_score', '-')}")
                with col4:
                    if st.button("Delete", key=f"del_{log['id']}"):
                        db.collection("work_logs").document(log['id']).delete()
                        st.success("Log deleted.")
                        get_all_data.clear()
                        time.sleep(0.5)
                        st.rerun()
                st.divider()
        else:
            st.info("No logs found.")


# --- UI Layout ---
st.set_page_config(page_title="Deep Work Logger", page_icon="🚀", layout="wide")

st.sidebar.title("Navigation")
page = st.sidebar.radio("Go to", ["Home", "Log Work", "Strategy Map", "Quarterly Perf.", "AI Coach", "Settings"])

if page == "Home":
    render_dashboard()

elif page == "Log Work":
    st.header("Log Deep Work 🧠")
    db = get_db()
    project_map = get_projects()
    active_session = get_active_session()
    
    if 'review_data' in st.session_state and st.session_state['review_data']:
        st.info(f"⏱️ Session Stopped. You worked for **{st.session_state['review_data']['hours']:.2f} hours**.")
        with st.form("review_session_form"):
            project_name = st.session_state['review_data']['project_name']
            st.write(f"Project: **{project_name}**")
            focus_score = st.slider("Rate your Focus Score", 1, 5, 3)
            col1, col2 = st.columns(2)
            with col1:
                confirm = st.form_submit_button("✅ Save Session")
            with col2:
                discard = st.form_submit_button("🗑️ Discard")
            if confirm:
                try:
                    data = st.session_state['review_data']
                    log_date = datetime.datetime.now(datetime.timezone.utc)
                    save_and_clear_session(data['project_id'], data['project_name'], data['hours'], focus_score, log_date)
                    st.success(f"Saved {data['hours']:.2f} hours for '{project_name}'!")
                    st.balloons()
                    del st.session_state['review_data']
                    st.rerun()
                except Exception as e:
                    st.error(f"Error saving: {e}")
            if discard:
                discard_session()
                del st.session_state['review_data']
                st.rerun()
    elif active_session:
        project_name = active_session.get('project_name')
        start_time_server = active_session.get('start_time')
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        if start_time_server:
            elapsed = now_utc - start_time_server
            if elapsed.total_seconds() < 0: elapsed = datetime.timedelta(0)
            elapsed_str = str(elapsed).split('.')[0]
            st.info(f"🔥 You have been working on **{project_name}**")
            st.metric("Elapsed Time", elapsed_str)
            st.caption(f"Started at {start_time_server.strftime('%H:%M')} UTC")
            col1, col2 = st.columns([1, 4])
            with col1:
                if st.button("⏹️ Stop & Save"):
                    total_seconds = elapsed.total_seconds()
                    hours = total_seconds / 3600
                    st.session_state['review_data'] = {"project_name": project_name, "project_id": active_session.get('project_id'), "hours": hours}
                    st.rerun()
            with col2:
                if st.button("Cancel Session"):
                    discard_session()
                    st.rerun()
            time.sleep(1)
            st.rerun()
        else:
            st.warning("Session found but start time is missing.")
            if st.button("Force Discard"): discard_session(); st.rerun()
    else:
        if not project_map:
            st.warning("No projects found. Please seed the database first.")
        else:
            if st.checkbox("Manual Mode", value=False):
                with st.form("log_work_form"):
                    st.subheader("Manual Input")
                    selected_project_name = st.selectbox("Select Project", options=list(project_map.keys()))
                    duration = st.number_input("Duration (Hours)", min_value=0.1, max_value=24.0, step=0.1, value=1.0)
                    focus_score = st.slider("Focus Score", min_value=1, max_value=5, value=3)
                    date_input = st.date_input("Date", value=datetime.date.today())
                    submit_button = st.form_submit_button("Commit to Database")
                    if submit_button:
                        try:
                            project_id = project_map[selected_project_name]
                            log_date = datetime.datetime.combine(date_input, datetime.datetime.now().time()).replace(tzinfo=datetime.timezone.utc)
                            db.collection("work_logs").add({"project_id": project_id, "project_name": selected_project_name, "hours": duration, "focus_score": focus_score, "date": log_date, "created_at": firestore.SERVER_TIMESTAMP})
                            st.success(f"Logged {duration} hours for '{selected_project_name}'!")
                            st.balloons()
                            time.sleep(1)
                            st.rerun()
                        except Exception as e:
                            st.error(f"Failed to save log: {e}")
            else:
                st.subheader("Start a Focus Session")
                selected_project = st.selectbox("Select Project to Work On", list(project_map.keys()))
                if st.button("🟢 Start Focus Session", use_container_width=True):
                    project_id = project_map[selected_project]
                    start_session(selected_project, project_id)
                    st.rerun()
    st.markdown("---")
    st.subheader("Today's Logs")
    try:
        df = get_todays_logs()
        if not df.empty:
            display_cols = ["project_name", "hours", "focus_score", "date"]
            available_cols = [c for c in display_cols if c in df.columns]
            st.dataframe(df[available_cols], use_container_width=True)
        else:
            st.info("No logs found for today.")
    except Exception as e:
        st.error(f"Error fetching logs: {e}")

elif page == "Strategy Map":
    render_strategy_tab()

elif page == "Quarterly Perf.":
    render_quarterly_dashboard()

elif page == "AI Coach":
    render_ai_coach()

elif page == "Settings":
    render_settings_tab()
