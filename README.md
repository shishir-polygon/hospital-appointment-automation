# AI Voice Doctor Appointment System

An AI-powered voice booking platform for hospitals. Patients speak naturally in Bengali (or English/Hindi) and the AI books appointments, checks queues, and provides doctor information — all in real time from the database.

---

## Architecture

```
Browser (voice UI)
    │  audio upload / text
    ▼
AI Service  :8001  (Python FastAPI)
    │  direct SQL
    ▼
PostgreSQL  :5433  (Docker)
    ▲
    │  migrations + seeders
Laravel Backend  :8000  (PHP 8.3)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Docker + Docker Compose | any recent |
| PHP | 8.3 |
| Python | 3.10+ |
| Composer | 2.x |

PHP extensions required (installed once):
```bash
sudo apt-get install -y php8.3-pgsql php8.3-xml php8.3-mbstring php8.3-zip php8.3-bcmath php8.3-curl
```

---

## 1. Start the database

```bash
cd "ai project"
docker compose up -d postgres redis
```

PostgreSQL is now available at `localhost:5433`, database `ai_doctor`.

---

## 2. Run Laravel migrations and seed

```bash
cd backend
cp ../.env .env          # already configured for Docker DB
php artisan migrate:fresh --force
php artisan db:seed --force
```

This creates all tables and seeds:
- **4 hospitals** (Demo, ঢাকা মেডিকেল, স্কয়ার, চট্টগ্রাম মেডিকেল)
- **8 departments** per hospital
- **11 doctors** with schedules and fees
- **Admin users** (see credentials below)

### Seeded admin credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@hospital.com | password |
| Hospital Admin (Demo) | hospitaladmin@demo.com | password |

---

## 3. Configure the AI service

```bash
cd ai-service
```

Edit `.env` and set your Groq API key:
```env
GROQ_API_KEY=your_groq_api_key_here
DATABASE_URL=host=localhost port=5433 dbname=ai_doctor user=postgres password=secret
REDIS_URL=redis://localhost:6379/0
LLM_MODEL=llama-3.3-70b-versatile
STT_MODEL=whisper-large-v3
```

Install Python dependencies (first time only):
```bash
pip3 install fastapi uvicorn groq edge-tts redis httpx psycopg2-binary \
             pydantic-settings structlog tenacity langdetect --break-system-packages
```

---

## 4. Start the AI service

```bash
cd ai-service
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

---

## 5. Open the voice demo UI

Navigate to: **http://localhost:8001**

### How to use

1. **Select a hospital** from the dropdown (optional — leave blank to search all hospitals)
2. **Click "নতুন কথোপকথন শুরু করুন"** — the AI greets you in Bengali
3. **Hold the mic button** and speak, release to send
4. **Or type** in the text box and press Enter / click Send
5. The AI responds in voice + text

### Example conversation (Bengali)

```
You:  আনোয়ার হোসেন স্যারের কাছে আগামীকাল সকালে অ্যাপয়েন্টমেন্ট নিতে চাই
AI:   অধ্যাপক ডাঃ মোহাম্মদ আনোয়ার হোসেন স্যারের... আপনার নাম কী?

You:  আমার নাম রহিম, মোবাইল 01711223344, বয়স 45, পুরুষ
AI:   রহিম ভাই, ২০২৬-০৬-০২ তারিখে... কনফার্ম করতে "হ্যাঁ" বলুন

You:  হ্যাঁ
AI:   আপনার অ্যাপয়েন্টমেন্ট সফলভাবে বুক হয়েছে! সিরিয়াল নম্বর ১।
```

### Supported languages
- Bengali (বাংলা) — default
- English
- Hindi

### Supported intents
| Intent | Example phrase |
|--------|----------------|
| Book appointment | "আনোয়ার স্যারের কাছে বুক করতে চাই" |
| Check queue | "এখন কত নম্বর চলছে?" |
| Doctor info | "হৃদরোগ বিভাগের ডাক্তার কারা আছেন?" |
| General inquiry | "হাসপাতাল কোথায়?" |

---

## 6. Verify appointments in the database

```bash
docker exec ai_doctor_postgres psql -U postgres -d ai_doctor -c \
  "SELECT a.id, a.serial_number, a.appointment_date, d.name AS doctor, p.name AS patient
   FROM appointments a
   JOIN doctors d ON d.id = a.doctor_id
   JOIN patients p ON p.id = a.patient_id
   ORDER BY a.id DESC LIMIT 10;"
```

---

## Seeded doctors reference

### ঢাকা মেডিকেল কলেজ হাসপাতাল (hospital_id=2)
| Doctor | Department | Fee | Schedule |
|--------|-----------|-----|---------|
| অধ্যাপক ডাঃ মোহাম্মদ আনোয়ার হোসেন | হৃদরোগ | ১২০০ ৳ | রবি/মঙ্গল/বৃহস্পতি সকাল ৯–১টা |
| ডাঃ ফারহানা বেগম | অর্থোপেডিক | ৮০০ ৳ | রবি/সোম/বুধ বিকাল ২–৬টা |
| ডাঃ রাহেলা খানম | শিশু রোগ | ৬০০ ৳ | রবি/মঙ্গল/বৃহস্পতি সকাল ১০–২টা |
| অধ্যাপক ডাঃ সিরাজুল ইসলাম | নিউরোলজি | ১০০০ ৳ | সোম/বুধ/শুক্র সকাল ৯–১টা |

### স্কয়ার হাসপাতাল (hospital_id=3)
| Doctor | Department | Fee | Schedule |
|--------|-----------|-----|---------|
| ডাঃ তানভীর আহমেদ | হৃদরোগ | ১৫০০ ৳ | রবি/মঙ্গল/বৃহস্পতি বিকাল ৪–৮টা |
| ডাঃ নাসরিন আক্তার | ডায়াবেটিস ও মেডিসিন | ৯০০ ৳ | সোম/বুধ/শুক্র/শনি সকাল ১০–২টা |
| ডাঃ মাহবুব আলম | নাক-কান-গলা | ৭০০ ৳ | রবি/মঙ্গল/বৃহস্পতি বিকাল ৫–৮টা |
| ডাঃ শারমিন সুলতানা | গাইনি ও প্রসূতি | ১০০০ ৳ | সোম/বুধ/শুক্র বিকাল ৩–৭টা |

### চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল (hospital_id=4)
| Doctor | Department | Fee | Schedule |
|--------|-----------|-----|---------|
| ডাঃ করিম উদ্দিন | চর্মরোগ | ৬০০ ৳ | রবি/মঙ্গল/বৃহস্পতি সকাল ৯–১টা |
| অধ্যাপক ডাঃ আবুল কালাম আজাদ | অর্থোপেডিক | ১১০০ ৳ | সোম/বুধ/শুক্র সকাল ১০–২টা |
| ডাঃ মাহমুদা বেগম | শিশু রোগ | ৫০০ ৳ | রবি/মঙ্গল/বৃহস্পতি সকাল ৮–১২টা |

---

## Re-seed (reset all data)

```bash
cd backend
php artisan migrate:fresh --seed --force
```

---

## API endpoints (AI service)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Voice demo UI |
| POST | `/api/conversation/start` | Start session, get greeting audio |
| POST | `/api/conversation/audio-turn` | Send voice, get AI response audio |
| POST | `/api/conversation/turn` | Text-only turn |
| DELETE | `/api/conversation/{session_id}` | End session |
| POST | `/api/stt` | Standalone Whisper transcription |

---

## Troubleshooting

**AI service can't connect to DB**
```bash
# Check Docker is running
docker ps | grep ai_doctor_postgres
# Verify connection
psql -h localhost -p 5433 -U postgres -d ai_doctor -c "SELECT COUNT(*) FROM doctors;"
```

**No audio in browser**
- Allow microphone access when prompted
- Use Chrome or Edge (best WebRTC support)
- Check browser console for errors

**AI hallucinating doctor names**
- Always select a hospital from the dropdown before starting
- The AI only uses real data from the DB; if no hospital is selected it searches all hospitals

**Redis connection error (non-fatal)**
- Sessions fall back to in-memory store automatically
- The system still works; sessions just don't survive service restarts
