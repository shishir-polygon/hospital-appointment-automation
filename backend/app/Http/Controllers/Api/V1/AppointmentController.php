<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Patient;
use App\Jobs\SendAppointmentNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AppointmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = auth()->user();
        $query = Appointment::with(['doctor', 'patient', 'hospital'])
            ->when(!$user->isSuperAdmin(), fn($q) => $q->where('hospital_id', $user->hospital_id));

        if ($request->date) {
            $query->whereDate('appointment_date', $request->date);
        }
        if ($request->doctor_id) {
            $query->where('doctor_id', $request->doctor_id);
        }
        if ($request->status) {
            $query->where('status', $request->status);
        }
        if ($request->search) {
            $query->whereHas('patient', fn($q) => $q->where('name', 'ilike', "%{$request->search}%")
                ->orWhere('phone', 'like', "%{$request->search}%"));
        }

        return response()->json($query->orderBy('appointment_date')->orderBy('serial_number')->paginate(25));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'doctor_id' => 'required|exists:doctors,id',
            'appointment_date' => 'required|date|after_or_equal:today',
            'appointment_time' => 'nullable|date_format:H:i',
            'patient_name' => 'required|string|max:255',
            'patient_mobile' => 'required|string|max:20',
            'patient_age' => 'nullable|integer|min:0|max:150',
            'patient_gender' => 'nullable|in:male,female,other',
            'notes' => 'nullable|string',
            'booking_channel' => 'in:ai_voice,manual,web,app',
        ]);

        return DB::transaction(function () use ($data) {
            $doctor = Doctor::findOrFail($data['doctor_id']);
            $hospitalId = auth()->user()?->hospital_id ?? $doctor->hospital_id;

            $patient = Patient::firstOrCreate(
                ['hospital_id' => $hospitalId, 'phone' => $data['patient_mobile']],
                [
                    'name' => $data['patient_name'],
                    'age' => $data['patient_age'] ?? null,
                    'gender' => $data['patient_gender'] ?? null,
                ]
            );

            if ($patient->wasRecentlyCreated === false) {
                $patient->update(['name' => $data['patient_name']]);
            }

            $serial = $doctor->nextAvailableSerial($data['appointment_date']);

            $appointment = Appointment::create([
                'hospital_id' => $hospitalId,
                'doctor_id' => $doctor->id,
                'patient_id' => $patient->id,
                'serial_number' => $serial,
                'appointment_date' => $data['appointment_date'],
                'appointment_time' => $data['appointment_time'] ?? null,
                'status' => 'scheduled',
                'booking_channel' => $data['booking_channel'] ?? 'manual',
                'notes' => $data['notes'] ?? null,
                'fee_charged' => $doctor->consultation_fee,
                'created_by' => auth()->id(),
            ]);

            SendAppointmentNotification::dispatch($appointment->id);

            return response()->json($appointment->load(['doctor', 'patient']), 201);
        });
    }

    public function show(Appointment $appointment): JsonResponse
    {
        return response()->json($appointment->load(['doctor', 'patient', 'hospital', 'notifications']));
    }

    public function update(Request $request, Appointment $appointment): JsonResponse
    {
        $data = $request->validate([
            'status' => 'in:scheduled,confirmed,in_progress,completed,cancelled,no_show',
            'appointment_date' => 'date',
            'appointment_time' => 'nullable|date_format:H:i',
            'notes' => 'nullable|string',
        ]);

        $appointment->update($data);

        if (isset($data['status']) && in_array($data['status'], ['cancelled'])) {
            SendAppointmentNotification::dispatch($appointment->id, 'cancellation');
        }

        return response()->json($appointment->fresh(['doctor', 'patient']));
    }

    public function destroy(Appointment $appointment): JsonResponse
    {
        $appointment->update(['status' => 'cancelled']);
        $appointment->delete();
        return response()->json(null, 204);
    }

    public function todayStats(Request $request): JsonResponse
    {
        $user = auth()->user();
        $hospitalId = $user->hospital_id;
        $today = Carbon::today();

        $stats = Appointment::where('hospital_id', $hospitalId)
            ->whereDate('appointment_date', $today)
            ->selectRaw("
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                SUM(CASE WHEN booking_channel = 'ai_voice' THEN 1 ELSE 0 END) as ai_booked
            ")
            ->first();

        return response()->json($stats);
    }
}
