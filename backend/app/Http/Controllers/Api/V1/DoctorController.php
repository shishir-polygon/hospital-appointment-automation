<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\DoctorHoliday;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DoctorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = auth()->user();

        // Filter by hospital via the doctor_hospitals pivot (supports multi-hospital doctors)
        $hospitalId = $user->isSuperAdmin()
            ? ($request->hospital_id ?: null)
            : $user->hospital_id;

        $query = Doctor::with(['department', 'schedules', 'hospitals']);

        if ($hospitalId) {
            $query->whereHas('hospitals', fn($q) => $q->where('hospitals.id', $hospitalId)
                ->where('doctor_hospitals.is_active', true));
        }

        if ($request->search) {
            $query->where('name', 'ilike', "%{$request->search}%");
        }
        if ($request->department_id) {
            $query->where('department_id', $request->department_id);
        }
        if ($request->boolean('active_only', true)) {
            $query->where('is_active', true);
        }

        return response()->json($query->paginate(20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'department_id' => 'nullable|exists:departments,id',
            'name' => 'required|string|max:255',
            'title' => 'string|max:20',
            'email' => 'nullable|email',
            'phone' => 'nullable|string',
            'qualifications' => 'nullable|string',
            'specializations' => 'nullable|string',
            'bio' => 'nullable|string',
            'consultation_fee' => 'numeric|min:0',
            'avg_consultation_minutes' => 'integer|min:5',
            'schedules' => 'array',
            'schedules.*.day_of_week' => 'integer|between:0,6',
            'schedules.*.start_time' => 'date_format:H:i',
            'schedules.*.end_time' => 'date_format:H:i',
            'schedules.*.max_patients' => 'integer|min:1',
        ]);

        $hospitalId = auth()->user()->hospital_id;
        $doctor = Doctor::create(array_merge($data, ['hospital_id' => $hospitalId]));

        if (!empty($data['schedules'])) {
            foreach ($data['schedules'] as $schedule) {
                $doctor->schedules()->create($schedule);
            }
        }

        return response()->json($doctor->load(['department', 'schedules']), 201);
    }

    public function show(Doctor $doctor): JsonResponse
    {
        $this->authorizeHospital($doctor->hospital_id);
        return response()->json($doctor->load(['department', 'schedules', 'holidays']));
    }

    public function update(Request $request, Doctor $doctor): JsonResponse
    {
        $this->authorizeHospital($doctor->hospital_id);
        $data = $request->validate([
            'name' => 'string|max:255',
            'title' => 'string|max:20',
            'email' => 'nullable|email',
            'phone' => 'nullable|string',
            'qualifications' => 'nullable|string',
            'specializations' => 'nullable|string',
            'bio' => 'nullable|string',
            'consultation_fee' => 'numeric|min:0',
            'avg_consultation_minutes' => 'integer|min:5',
            'is_active' => 'boolean',
        ]);
        $doctor->update($data);
        return response()->json($doctor->fresh(['department', 'schedules']));
    }

    public function attachHospital(Request $request, Doctor $doctor): JsonResponse
    {
        $data = $request->validate([
            'hospital_id'      => 'required|exists:hospitals,id',
            'department_id'    => 'nullable|exists:departments,id',
            'consultation_fee' => 'nullable|numeric|min:0',
        ]);
        $doctor->hospitals()->syncWithoutDetaching([
            $data['hospital_id'] => [
                'department_id'    => $data['department_id'] ?? null,
                'consultation_fee' => $data['consultation_fee'] ?? $doctor->consultation_fee,
                'is_active'        => true,
            ],
        ]);
        return response()->json($doctor->load('hospitals'));
    }

    public function detachHospital(Doctor $doctor, int $hospital): JsonResponse
    {
        $doctor->hospitals()->detach($hospital);
        return response()->json(['detached' => true]);
    }

    public function queue(Doctor $doctor): JsonResponse
    {
        return response()->json($doctor->todayQueue());
    }

    public function slots(Request $request, Doctor $doctor): JsonResponse
    {
        $date = $request->validate(['date' => 'required|date'])['date'];
        $carbon = Carbon::parse($date);
        $dayOfWeek = $carbon->dayOfWeek;

        $schedule = $doctor->schedules()
            ->where('day_of_week', $dayOfWeek)
            ->where('is_active', true)
            ->first();

        if (!$schedule) {
            return response()->json(['slots' => [], 'available' => false]);
        }

        $isHoliday = $doctor->holidays()->whereDate('holiday_date', $date)->exists();
        if ($isHoliday) {
            return response()->json(['slots' => [], 'available' => false, 'reason' => 'holiday']);
        }

        $bookedCount = $doctor->appointments()->whereDate('appointment_date', $date)->count();
        $slotsLeft = $schedule->max_patients - $bookedCount;

        return response()->json([
            'available' => $slotsLeft > 0,
            'slots_remaining' => max(0, $slotsLeft),
            'schedule' => [
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'max_patients' => $schedule->max_patients,
            ],
        ]);
    }

    public function addHoliday(Request $request, Doctor $doctor): JsonResponse
    {
        $this->authorizeHospital($doctor->hospital_id);
        $data = $request->validate([
            'holiday_date' => 'required|date|after_or_equal:today',
            'reason' => 'nullable|string',
        ]);
        $holiday = $doctor->holidays()->updateOrCreate(
            ['holiday_date' => $data['holiday_date']],
            ['reason' => $data['reason'] ?? null]
        );
        return response()->json($holiday, 201);
    }

    private function authorizeHospital(int $hospitalId): void
    {
        $user = auth()->user();
        if (!$user->isSuperAdmin() && $user->hospital_id !== $hospitalId) {
            abort(403, 'Unauthorized');
        }
    }
}
