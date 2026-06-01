<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Hospital;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class HospitalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $hospitals = Hospital::withCount(['doctors', 'appointments'])
            ->when($request->search, fn($q) => $q->where('name', 'ilike', "%{$request->search}%"))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->paginate(20);

        return response()->json($hospitals);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'required|string',
            'city' => 'required|string',
            'country' => 'string|size:2',
            'phone' => 'nullable|string',
            'email' => 'nullable|email',
            'website' => 'nullable|url',
            'twilio_phone_number' => 'nullable|string|unique:hospitals',
        ]);

        $data['slug'] = Str::slug($data['name']) . '-' . Str::random(4);
        $hospital = Hospital::create($data);

        return response()->json($hospital, 201);
    }

    public function show(Hospital $hospital): JsonResponse
    {
        return response()->json($hospital->load(['doctors', 'departments', 'subscription', 'adminUser']));
    }

    public function update(Request $request, Hospital $hospital): JsonResponse
    {
        $data = $request->validate([
            'name' => 'string|max:255',
            'address' => 'string',
            'city' => 'string',
            'phone' => 'nullable|string',
            'email' => 'nullable|email',
            'twilio_phone_number' => 'nullable|string|unique:hospitals,twilio_phone_number,' . $hospital->id,
            'status' => 'in:active,inactive,suspended',
            'settings' => 'array',
        ]);
        $hospital->update($data);
        return response()->json($hospital->fresh());
    }

    public function destroy(Hospital $hospital): JsonResponse
    {
        $hospital->delete();
        return response()->json(null, 204);
    }

    public function updateAdmin(Request $request, Hospital $hospital): JsonResponse
    {
        $data = $request->validate([
            'email'                 => 'sometimes|email|unique:users,email,' . ($hospital->adminUser?->id ?? 0),
            'password'              => 'sometimes|string|min:8|confirmed',
            'password_confirmation' => 'sometimes|string',
            'name'                  => 'sometimes|string|max:255',
        ]);

        $admin = $hospital->adminUser;

        if (!$admin) {
            // Create admin user if none exists
            $admin = User::create([
                'hospital_id'       => $hospital->id,
                'name'              => $data['name'] ?? $hospital->name . ' Admin',
                'email'             => $data['email'] ?? Str::slug($hospital->name) . '@hospital.local',
                'password'          => Hash::make($data['password'] ?? Str::random(16)),
                'role'              => 'hospital_admin',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]);
        } else {
            if (isset($data['name']))     $admin->name     = $data['name'];
            if (isset($data['email']))    $admin->email    = $data['email'];
            if (isset($data['password'])) $admin->password = Hash::make($data['password']);
            $admin->save();
        }

        return response()->json([
            'message'    => 'Hospital admin updated successfully.',
            'admin_user' => $admin->only(['id', 'name', 'email', 'role']),
        ]);
    }
}
