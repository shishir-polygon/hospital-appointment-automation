-- Minimal schema for AI service testing
-- (Full migrations run via Laravel once PHP extensions are installed)

CREATE TABLE IF NOT EXISTS hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    address TEXT,
    city VARCHAR(100),
    phone VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    hospital_id INT REFERENCES hospitals(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    hospital_id INT REFERENCES hospitals(id) ON DELETE CASCADE,
    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(20) DEFAULT 'ডাঃ',
    qualifications TEXT,
    specializations TEXT,
    bio TEXT,
    consultation_fee NUMERIC(10,2) DEFAULT 0,
    avg_consultation_minutes INT DEFAULT 15,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_schedules (
    id SERIAL PRIMARY KEY,
    doctor_id INT REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_patients INT DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    hospital_id INT REFERENCES hospitals(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    age INT,
    gender VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(hospital_id, phone)
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    hospital_id INT REFERENCES hospitals(id) ON DELETE CASCADE,
    doctor_id INT REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id INT REFERENCES patients(id) ON DELETE CASCADE,
    appointment_ref VARCHAR(50) UNIQUE,
    serial_number INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME,
    status VARCHAR(30) DEFAULT 'scheduled',
    booking_channel VARCHAR(20) DEFAULT 'ai_voice',
    call_sid VARCHAR(100),
    fee_charged NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(doctor_id, appointment_date, serial_number)
);

CREATE TABLE IF NOT EXISTS call_logs (
    id SERIAL PRIMARY KEY,
    hospital_id INT REFERENCES hospitals(id) ON DELETE SET NULL,
    appointment_id INT REFERENCES appointments(id) ON DELETE SET NULL,
    call_sid VARCHAR(100) UNIQUE,
    caller_number VARCHAR(50),
    status VARCHAR(30) DEFAULT 'completed',
    outcome VARCHAR(50),
    duration_seconds INT,
    language VARCHAR(5) DEFAULT 'bn',
    created_at TIMESTAMP DEFAULT NOW()
);
