<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Api\V1\AppointmentController;
use App\Http\Controllers\Api\V1\DoctorController;
use App\Http\Controllers\Api\V1\AnalyticsController;
use App\Http\Controllers\Api\V1\InternalController;
use App\Http\Controllers\Api\V1\HospitalController;
use App\Http\Controllers\Api\V1\CallLogController;
use Illuminate\Support\Facades\Route;

// ── Auth ──────────────────────────────────────────────────────────────────────
Route::prefix('v1/auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::middleware('auth:api')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::put('profile', [AuthController::class, 'updateProfile']);
        Route::post('refresh', [AuthController::class, 'refresh']);
        Route::post('logout', [AuthController::class, 'logout']);
    });
});

// ── Internal API (AI Service → Backend) ───────────────────────────────────────
Route::prefix('v1/internal')->middleware('internal.api')->group(function () {
    Route::get('doctors', [InternalController::class, 'getDoctors']);
    Route::get('doctors/{id}', [InternalController::class, 'getDoctor']);
    Route::get('doctors/{id}/queue', [InternalController::class, 'getDoctorQueue']);
    Route::get('doctors/{id}/slots', [InternalController::class, 'getDoctorSlots']);
    Route::post('appointments', [InternalController::class, 'createAppointment']);
});

// ── Authenticated API ─────────────────────────────────────────────────────────
Route::prefix('v1')->middleware('auth:api')->group(function () {

    // Hospitals (super_admin only)
    Route::middleware('role:super_admin')->group(function () {
        Route::apiResource('hospitals', HospitalController::class);
        Route::put('hospitals/{hospital}/admin', [HospitalController::class, 'updateAdmin']);
    });

    // Doctors
    Route::get('doctors', [DoctorController::class, 'index']);
    Route::get('doctors/{doctor}', [DoctorController::class, 'show']);
    Route::get('doctors/{doctor}/queue', [DoctorController::class, 'queue']);
    Route::get('doctors/{doctor}/slots', [DoctorController::class, 'slots']);
    Route::middleware('role:hospital_admin,super_admin')->group(function () {
        Route::post('doctors', [DoctorController::class, 'store']);
        Route::put('doctors/{doctor}', [DoctorController::class, 'update']);
        Route::post('doctors/{doctor}/holidays', [DoctorController::class, 'addHoliday']);
    });

    // Appointments
    Route::apiResource('appointments', AppointmentController::class);
    Route::get('appointments-today-stats', [AppointmentController::class, 'todayStats']);

    // Call logs
    Route::get('call-logs', [CallLogController::class, 'index']);
    Route::get('call-logs/{callLog}', [CallLogController::class, 'show']);

    // Analytics
    Route::prefix('analytics')->group(function () {
        Route::get('dashboard', [AnalyticsController::class, 'dashboard']);
        Route::get('call-trends', [AnalyticsController::class, 'callTrends']);
        Route::get('top-doctors', [AnalyticsController::class, 'topDoctors']);
        Route::get('peak-hours', [AnalyticsController::class, 'peakHours']);
    });
});
