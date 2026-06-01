<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    protected $fillable = ['hospital_id', 'name', 'slug', 'description', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function hospital(): BelongsTo { return $this->belongsTo(Hospital::class); }
    public function doctors(): HasMany { return $this->hasMany(Doctor::class); }
}
