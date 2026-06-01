<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DoctorHoliday extends Model
{
    protected $fillable = ['doctor_id', 'holiday_date', 'reason'];
    protected $casts = ['holiday_date' => 'date'];

    public function doctor(): BelongsTo { return $this->belongsTo(Doctor::class); }
}
