"""
Direct PostgreSQL queries for the AI service.
Seed data lives in backend/database/seeders/ (Laravel) — run via: php artisan db:seed
"""
import os
from datetime import date
from typing import Optional

import psycopg2
import psycopg2.extras
import structlog

logger = structlog.get_logger()

DSN = os.environ.get(
    "DATABASE_URL",
    "host=postgres port=5432 dbname=ai_doctor user=postgres password=secret"
)


import decimal

def _to_python(obj):
    """Recursively convert Decimal/date/time to JSON-serialisable types."""
    if isinstance(obj, dict):
        return {k: _to_python(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_python(v) for v in obj]
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    return obj


def _conn():
    return psycopg2.connect(DSN, cursor_factory=psycopg2.extras.RealDictCursor)


def search_doctors(
    hospital_id: Optional[int] = None,
    search: Optional[str] = None,
    department: Optional[str] = None,
    limit: int = 8,
) -> list[dict]:
    """Find active doctors matching the criteria."""
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                sql = """
                    SELECT d.id, d.name, d.title, d.qualifications, d.specializations,
                           d.consultation_fee, d.avg_consultation_minutes,
                           dept.name AS department,
                           h.name AS hospital_name, h.id AS hospital_id
                    FROM doctors d
                    JOIN hospitals h ON h.id = d.hospital_id
                    LEFT JOIN departments dept ON dept.id = d.department_id
                    WHERE d.is_active = TRUE
                """
                params = []
                if hospital_id:
                    sql += " AND d.hospital_id = %s"
                    params.append(hospital_id)
                if search:
                    sql += " AND (d.name ILIKE %s OR d.specializations ILIKE %s)"
                    params += [f"%{search}%", f"%{search}%"]
                if department:
                    sql += " AND dept.name ILIKE %s"
                    params.append(f"%{department}%")
                sql += " ORDER BY d.id LIMIT %s"
                params.append(limit)
                cur.execute(sql, params)
                return [_to_python(dict(r)) for r in cur.fetchall()]
    except Exception as e:
        logger.warning("db_search_doctors_error", error=str(e))
        return []


def get_doctor(doctor_id: int) -> Optional[dict]:
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT d.id, d.name, d.title, d.qualifications, d.specializations,
                           d.bio, d.consultation_fee, d.avg_consultation_minutes,
                           dept.name AS department,
                           h.name AS hospital_name, h.address AS hospital_address
                    FROM doctors d
                    JOIN hospitals h ON h.id = d.hospital_id
                    LEFT JOIN departments dept ON dept.id = d.department_id
                    WHERE d.id = %s AND d.is_active = TRUE
                """, (doctor_id,))
                row = cur.fetchone()
                if not row:
                    return None
                doctor = _to_python(dict(row))

                # schedules
                cur.execute("""
                    SELECT day_of_week, start_time::text, end_time::text, max_patients
                    FROM doctor_schedules WHERE doctor_id = %s AND is_active = TRUE
                """, (doctor_id,))
                days = ["রবিবার","সোমবার","মঙ্গলবার","বুধবার","বৃহস্পতিবার","শুক্রবার","শনিবার"]
                doctor["schedules"] = [
                    {"day": days[r["day_of_week"]], "start": r["start_time"], "end": r["end_time"]}
                    for r in cur.fetchall()
                ]
                return doctor
    except Exception as e:
        logger.warning("db_get_doctor_error", error=str(e))
        return None


def get_queue(doctor_id: int) -> dict:
    today = date.today()
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT
                        COALESCE(MAX(CASE WHEN status IN ('completed','in_progress') THEN serial_number END), 0) AS current_serial,
                        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) AS waiting_count,
                        MAX(CASE WHEN status = 'in_progress' THEN serial_number END) AS in_progress_serial
                    FROM appointments
                    WHERE doctor_id = %s AND appointment_date = %s
                """, (doctor_id, today))
                row = dict(cur.fetchone())

                cur.execute("""
                    SELECT ds.start_time::text, ds.end_time::text
                    FROM doctor_schedules ds
                    WHERE ds.doctor_id = %s AND ds.day_of_week = %s AND ds.is_active = TRUE
                """, (doctor_id, today.weekday() if today.weekday() < 6 else 6))  # py weekday Mon=0
                sched = cur.fetchone()

                # avg consultation minutes
                cur.execute("SELECT avg_consultation_minutes FROM doctors WHERE id=%s", (doctor_id,))
                avg_min = (cur.fetchone() or {}).get("avg_consultation_minutes", 15)

                waiting = int(row["waiting_count"] or 0)
                return _to_python({
                    "current_serial": int(row["current_serial"] or 0),
                    "in_progress_serial": row["in_progress_serial"],
                    "waiting_count": waiting,
                    "estimated_wait_minutes": waiting * avg_min,
                    "doctor_available": sched is not None,
                    "schedule": {"start": sched["start_time"], "end": sched["end_time"]} if sched else None,
                })
    except Exception as e:
        logger.warning("db_get_queue_error", error=str(e))
        return {"current_serial": 0, "waiting_count": 0, "estimated_wait_minutes": 0, "doctor_available": True}


def get_slots(doctor_id: int, appt_date: str) -> dict:
    try:
        d = date.fromisoformat(appt_date)
        # Python: Mon=0..Sun=6 → our DB: Sun=0..Sat=6
        db_day = (d.weekday() + 1) % 7
        with _conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT max_patients, start_time::text, end_time::text
                    FROM doctor_schedules
                    WHERE doctor_id=%s AND day_of_week=%s AND is_active=TRUE
                """, (doctor_id, db_day))
                sched = cur.fetchone()
                if not sched:
                    return {"available": False, "slots_remaining": 0, "next_serial": 1}

                cur.execute("""
                    SELECT COUNT(*) AS booked, COALESCE(MAX(serial_number),0) AS last_serial
                    FROM appointments WHERE doctor_id=%s AND appointment_date=%s
                """, (doctor_id, appt_date))
                row = dict(cur.fetchone())
                booked = int(row["booked"])
                remaining = int(sched["max_patients"]) - booked
                return _to_python({
                    "available": remaining > 0,
                    "slots_remaining": max(0, remaining),
                    "next_serial": int(row["last_serial"]) + 1,
                    "schedule": {"start": sched["start_time"], "end": sched["end_time"]},
                })
    except Exception as e:
        logger.warning("db_get_slots_error", error=str(e))
        return {"available": True, "slots_remaining": 10, "next_serial": 1}


def create_appointment(
    hospital_id: int, doctor_id: int, appt_date: str,
    patient_name: str, patient_phone: str,
    patient_age: Optional[int], patient_gender: Optional[str],
    call_sid: Optional[str] = None,
    appt_time: Optional[str] = None,
) -> dict:
    import random, string
    ref = "APT-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    try:
        with _conn() as conn:
            with conn.cursor() as cur:
                # Upsert patient
                cur.execute("""
                    INSERT INTO patients (hospital_id, name, phone, age, gender)
                    VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT (hospital_id, phone) DO UPDATE SET name=EXCLUDED.name
                    RETURNING id
                """, (hospital_id, patient_name, patient_phone, patient_age, patient_gender))
                patient_id = cur.fetchone()["id"]

                # Next serial
                cur.execute("""
                    SELECT COALESCE(MAX(serial_number),0)+1 AS next_serial
                    FROM appointments WHERE doctor_id=%s AND appointment_date=%s
                """, (doctor_id, appt_date))
                serial = cur.fetchone()["next_serial"]

                cur.execute("SELECT consultation_fee, name, title FROM doctors WHERE id=%s", (doctor_id,))
                doc = cur.fetchone()

                cur.execute("""
                    INSERT INTO appointments
                      (hospital_id, doctor_id, patient_id, appointment_ref, serial_number,
                       appointment_date, appointment_time, status, booking_channel, call_sid, fee_charged)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,'scheduled','ai_voice',%s,%s)
                    RETURNING id
                """, (hospital_id, doctor_id, patient_id, ref, serial, appt_date,
                      appt_time, call_sid, doc["consultation_fee"] if doc else 0))
                appt_id = cur.fetchone()["id"]
                conn.commit()

                doctor_name = f"{doc['title']} {doc['name']}" if doc else "ডাক্তার"
                return {
                    "id": appt_id,
                    "appointment_ref": ref,
                    "serial_number": serial,
                    "doctor_name": doctor_name,
                    "appointment_date": appt_date,
                    "patient_name": patient_name,
                }
    except Exception as e:
        logger.error("db_create_appointment_error", error=str(e))
        raise


def get_hospitals() -> list:
    """Return all active hospitals."""
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, city, phone
                FROM hospitals
                WHERE status = 'active' AND deleted_at IS NULL
                ORDER BY id
            """)
            return [_to_python(dict(r)) for r in cur.fetchall()]
