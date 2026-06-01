<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CallLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CallLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = auth()->user();
        $logs = CallLog::with(['appointment.doctor', 'appointment.patient'])
            ->when(!$user->isSuperAdmin(), fn($q) => $q->where('hospital_id', $user->hospital_id))
            ->when($request->outcome, fn($q) => $q->where('outcome', $request->outcome))
            ->when($request->date, fn($q) => $q->whereDate('created_at', $request->date))
            ->orderByDesc('created_at')
            ->paginate(25);

        return response()->json($logs);
    }

    public function show(CallLog $callLog): JsonResponse
    {
        return response()->json($callLog->load(['transcripts', 'appointment.doctor', 'appointment.patient']));
    }
}
