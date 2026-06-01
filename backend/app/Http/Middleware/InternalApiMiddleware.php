<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InternalApiMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = $request->header('X-Internal-Secret');
        if ($secret !== config('app.internal_api_secret')) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }
        return $next($request);
    }
}
