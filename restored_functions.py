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
            # Firestore timestamp to datetime conversion if needed, 
            # usually the SDK returns a datetime with tz info or naive.
            # We assume it matches what we need or is handled in the UI logic.
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
