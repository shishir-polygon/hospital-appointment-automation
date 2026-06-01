<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Patient;
use App\Jobs\SendAppointmentNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Internal API — only callable by the AI service using X-Internal-Secret header.
 */
class InternalController extends Controller
{
    public function getDoctors(Request $request): JsonResponse
    {
        $query = Doctor::with(['department', 'schedules'])
            ->where('is_active', true);

        if ($request->hospital_id) {
            $query->where('hospital_id', $request->hospital_id);
        }
        if ($request->search) {
            $query->where('name', 'ilike', "%{$request->search}%");
        }
        if ($request->department) {
            $query->whereHas('department', fn($q) => $q->where('name', 'ilike', "%{$request->department}%"));
        }

        $doctors = $query->limit(10)->get()->map(fn($d) => [
            'id' => $d->id,
            'name' => $d->full_name,
            'department' => $d->department?->name,
            'specializations' => $d->specializations,
            'qualifications' => $d->qualifications,
            'consultation_fee' => $d->consultation_fee,
            'avg_consultation_minutes' => $d->avg_consultation_minutes,
            'is_available_today' => $d->isAvailableToday(),
        ]);

        return response()->json($doctors);
    }

    public function getDoctor(int $id): JsonResponse
    {
        $doctor = Doctor::with(['department', 'schedules'])->findOrFail($id);
        return response()->json([
            'id' => $doctor->id,
            'name' => $doctor->full_name,
            'department' => $doctor->department?->name,
            'qualifications' => $doctor->qualifications,
            'specializations' => $doctor->specializations,
            'consultation_fee' => $doctor->consultation_fee,
            'bio' => $doctor->bio,
            'schedules' => $doctor->schedules->map(fn($s) => [
                'day' => $s->day_name,
                'start' => $s->start_time,
                'end' => $s->end_time,
            ]),
        ]);
    }

    public function getDoctorQueue(int $id): JsonResponse
    {
        $doctor = Doctor::findOrFail($id);
        return response()->json($doctor->todayQueue());
    }

    public function getDoctorSlots(Request $request, int $id): JsonResponse
    {
        $doctor = Doctor::findOrFail($id);
        $date = $request->input('date', now()->toDateString());
        $dayOfWeek = \Carbon\Carbon::parse($date)->dayOfWeek;

        $schedule = $doctor->schedules()
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->first();

        if (!$schedule) {
            return response()->json(['available' => false, 'slots_remaining' => 0]);
        }

        $booked = $doctor->appointments()->whereDate('appointment_date', $date)->count();
        return response()->json([
            'available' => ($schedule->max_patients - $booked) > 0,
            'slots_remaining' => max(0, $schedule->max_patients - $booked),
            'next_serial' => $doctor->nextAvailableSerial($date),
            'schedule' => ['start' => $schedule->start_time, 'end' => $schedule->end_time],
        ]);
    }

    public function createAppointment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'hospital_id' => 'nullable|integer',
            'doctor_id' => 'required|integer|exists:doctors,id',
            'preferred_date' => 'required|date',
            'preferred_time' => 'nullable|date_format:H:i',
            'patient_name' => 'required|string',
            'patient_mobile' => 'required|string',
            'patient_age' => 'nullable|integer',
            'patient_gender' => 'nullable|in:male,female,other',
            'call_sid' => 'nullable|string',
            'caller_number' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($data) {
            $doctor = Doctor::findOrFail($data['doctor_id']);
            $hospitalId = $data['hospital_id'] ?? $doctor->hospital_id;

            $patient = Patient::firstOrCreate(
                ['hospital_id' => $hospitalId, 'phone' => $data['patient_mobile']],
                [
                    'name' => $data['patient_name'],
                    'age' => $data['patient_age'] ?? null,
                    'gender' => $data['patient_gender'] ?? null,
                ]
            );

            $serial = $doctor->nextAvailableSerial($data['preferred_date']);

            $appointment = Appointment::create([
                'hospital_id' => $hospitalId,
                'doctor_id' => $doctor->id,
                'patient_id' => $patient->id,
                'serial_number' => $serial,
                'appointment_date' => $data['preferred_date'],
                'appointment_time' => $data['preferred_time'] ?? null,
                'status' => 'scheduled',
                'booking_channel' => 'ai_voice',
                'call_sid' => $data['call_sid'] ?? null,
                'fee_charged' => $doctor->consultation_fee,
            ]);

            SendAppointmentNotification::dispatch($appointment->id);

            return response()->json([
                'id' => $appointment->id,
                'appointment_ref' => $appointment->appointment_ref,
                'serial_number' => $serial,
                'doctor_name' => $doctor->full_name,
                'appointment_date' => $data['preferred_date'],
                'patient_name' => $patient->name,
            ], 201);
        });
    }
}
