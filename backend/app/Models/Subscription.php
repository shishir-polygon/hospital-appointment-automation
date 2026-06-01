<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Subscription extends Model
{
    protected $fillable = ['name', 'monthly_price', 'max_doctors', 'max_calls_per_month', 'features', 'is_active'];
    protected $casts = ['features' => 'array', 'monthly_price' => 'decimal:2'];

    public function hospitals(): HasMany { return $this->hasMany(Hospital::class); }
}
