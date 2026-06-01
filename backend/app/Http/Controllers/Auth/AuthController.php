<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if (!$token = auth()->attempt($credentials)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $user = auth()->user();
        if (!$user->is_active) {
            auth()->logout();
            return response()->json(['message' => 'Account is disabled'], 403);
        }

        return $this->respondWithToken($token);
    }

    public function me(): JsonResponse
    {
        $user = auth()->user()->load('hospital');
        return response()->json($user);
    }

    public function refresh(): JsonResponse
    {
        return $this->respondWithToken(auth()->refresh());
    }

    public function logout(): JsonResponse
    {
        auth()->logout();
        return response()->json(['message' => 'Logged out successfully']);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = auth()->user();

        $data = $request->validate([
            'name'                  => 'sometimes|string|max:255',
            'email'                 => 'sometimes|email|unique:users,email,' . $user->id,
            'current_password'      => 'required_with:password|string',
            'password'              => 'sometimes|string|min:8|confirmed',
        ]);

        if (isset($data['current_password'])) {
            if (!Hash::check($data['current_password'], $user->password)) {
                return response()->json(['message' => 'Current password is incorrect'], 422);
            }
        }

        if (isset($data['name']))     $user->name  = $data['name'];
        if (isset($data['email']))    $user->email = $data['email'];
        if (isset($data['password'])) $user->password = Hash::make($data['password']);

        $user->save();

        return response()->json(['message' => 'Profile updated successfully', 'user' => $user->fresh()->load('hospital')]);
    }

    private function respondWithToken(string $token): JsonResponse
    {
        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth()->factory()->getTTL() * 60,
            'user' => auth()->user()->load('hospital'),
        ]);
    }
}
