<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\CallLog;
use App\Models\Doctor;
use App\Models\Hospital;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $user = auth()->user();
        $hospitalId = $user->hospital_id;
        $today = Carbon::today();
        $thisMonth = Carbon::now()->startOfMonth();

        $baseQuery = fn() => Appointment::when($hospitalId, fn($q) => $q->where('hospital_id', $hospitalId));
        $callQuery = fn() => CallLog::when($hospitalId, fn($q) => $q->where('hospital_id', $hospitalId));

        return response()->json([
            'calls_today' => $callQuery()->whereDate('created_at', $today)->count(),
            'bookings_today' => $baseQuery()->whereDate('appointment_date', $today)->count(),
            'bookings_this_month' => $baseQuery()->where('created_at', '>=', $thisMonth)->count(),
            'ai_bookings_today' => $baseQuery()->whereDate('appointment_date', $today)->where('booking_channel', 'ai_voice')->count(),
            'active_doctors' => Doctor::when($hospitalId, fn($q) => $q->where('hospital_id', $hospitalId))->where('is_active', true)->count(),
            'total_hospitals' => $user->isSuperAdmin() ? Hospital::count() : 1,
            'success_rate' => $this->getSuccessRate($hospitalId),
            'avg_call_duration' => $callQuery()->whereDate('created_at', $today)->avg('duration_seconds') ?? 0,
        ]);
    }

    public function callTrends(Request $request): JsonResponse
    {
        $user = auth()->user();
        $days = min((int) $request->input('days', 7), 30);
        $startDate = Carbon::now()->subDays($days);

        $data = CallLog::when($user->hospital_id, fn($q) => $q->where('hospital_id', $user->hospital_id))
            ->where('created_at', '>=', $startDate)
            ->selectRaw("DATE(created_at) as date, COUNT(*) as calls, AVG(duration_seconds) as avg_duration")
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json($data);
    }

    public function topDoctors(Request $request): JsonResponse
    {
        $user = auth()->user();
        $month = Carbon::now()->startOfMonth();

        $data = Appointment::with('doctor')
            ->when($user->hospital_id, fn($q) => $q->where('hospital_id', $user->hospital_id))
            ->where('created_at', '>=', $month)
            ->selectRaw("doctor_id, COUNT(*) as bookings")
            ->groupBy('doctor_id')
            ->orderByDesc('bookings')
            ->limit(10)
            ->get()
            ->map(fn($row) => [
                'doctor' => $row->doctor?->full_name,
                'department' => $row->doctor?->department?->name,
                'bookings' => $row->bookings,
            ]);

        return response()->json($data);
    }

    public function peakHours(Request $request): JsonResponse
    {
        $user = auth()->user();
        $days = (int) $request->input('days', 30);

        $data = CallLog::when($user->hospital_id, fn($q) => $q->where('hospital_id', $user->hospital_id))
            ->where('created_at', '>=', Carbon::now()->subDays($days))
            ->selectRaw("EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as calls")
            ->groupBy('hour')
            ->orderBy('hour')
            ->get();

        return response()->json($data);
    }

    private function getSuccessRate(?int $hospitalId): float
    {
        $total = CallLog::when($hospitalId, fn($q) => $q->where('hospital_id', $hospitalId))
            ->whereDate('created_at', Carbon::today())
            ->count();

        if ($total === 0) return 0.0;

        $successful = CallLog::when($hospitalId, fn($q) => $q->where('hospital_id', $hospitalId))
            ->whereDate('created_at', Carbon::today())
            ->where('outcome', 'appointment_booked')
            ->count();

        return round(($successful / $total) * 100, 1);
    }
}
